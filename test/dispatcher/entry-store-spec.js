var assert, entryStore, events, setup, sqlite3;

sqlite3 = require('sqlite3').verbose();
setup = require('../../dispatcher/setup');
entryStore = require('../../dispatcher/entry/store');
assert = require('assert');
events = require('events');

describe('entry:store handler', function() {
    'use strict';

    beforeEach(function (done) {
        var self = this;
        this.feedId = 1;
        this.fetchId = 'fetch';
        this.db = new sqlite3.Database(':memory:');
        this.emitter = new events.EventEmitter();
        this.emitter.unlisten = function () {};
        this.emitter.on('entry:store', entryStore);
        this.emitter.on('setup', setup);

        this.emitter.on('setup:done', function () {
            self.db.run('INSERT INTO feeds (url) VALUES (?)', ['http://example.com/feed.rss'], function (err) {
                if (err) {
                    throw err;
                }
                done();
            });
        });

        this.emitter.emit('setup', self.db);

    });

    afterEach(function () {
        this.db.close();
        this.emitter.removeAllListeners();
    });

    it('adds a row to the entries table', function (done) {
        var entry, self;

        self = this;
        entry = {
            title: 'the title',
            author: 'H&#229;kon',
            createdUtc: new Date().getTime(),
            url: 'http://example.com/entry1.html',
            feedId: self.feedId,
            fetchId: self.fetchId
        };

        self.emitter.on('entry:store:done', function (args) {
            assert.strictEqual(args.changes, 1);
            assert.strictEqual(args.id, 1);
            assert.strictEqual(args.author, 'Håkon');
            assert.strictEqual(args.fetchId, self.fetchId);

            self.db.get('SELECT COUNT(*) as count FROM entries', function (err, row) {
                assert.strictEqual(err, null);
                assert.strictEqual(row.count, 1);
                done();
            });
        });

        self.emitter.emit('entry:store', self.db, entry);
    });

    it('normalizes the url', function (done) {
        var entry, self;

        self = this;
        entry = {
            title: 'the title',
            createdUtc: new Date().getTime(),
            url: 'http://example.com/entry1.html#whatever',
            feedId: self.feedId,
            fetchId: self.fetchId
        };

        self.emitter.on('entry:store:done', function (args) {
            assert.strictEqual(args.changes, 1);
            assert.strictEqual(args.id, 1);
            assert(args.normalizedUrl);
            assert(args.fetchId, self.fetchId);
            assert(args.url);
            assert.notStrictEqual(args.normalizedUrl, args.url);
            done();
        });

        self.emitter.emit('entry:store', self.db, entry);

    });

    it('blocks duplicate urls', function (done) {
        var entry, self;

        self = this;
        entry = {
            title: 'the title',
            createdUtc: new Date().getTime(),
            url: 'http://example.com/entry1.html',
            feedId: self.feedId,
            fetchId: self.fetchId
        };

        self.emitter.emit('entry:store', self.db, entry);

        self.emitter.once('entry:store:done', function (args) {
            assert.strictEqual(args.changes, 1);
            assert.strictEqual(args.id, 1);
            self.emitter.once('entry:store:done', function (args2) {
                assert.strictEqual(args2.changes, 0);
                assert.strictEqual(args2.id, 1);

                self.db.get('SELECT COUNT(*) as count FROM entries', function (err, row) {
                    assert.strictEqual(err, null);
                    assert.strictEqual(row.count, 1);
                    done();
                });
            });
            self.emitter.emit('entry:store', self.db, entry);
        });
    });

    it('requires entry url', function (done) {
        var entry, self;

        self = this;
        entry = {
            feedId: self.feedId,
            fetchId: self.fetchId
        };

        self.emitter.on('log:warn', function (message, fields) {
            assert(message);
            assert(fields);

            self.db.get('SELECT COUNT(*) as count FROM entries', function (err, row) {
                if (err) {
                    throw err;
                }
                assert.strictEqual(row.count, 0);
                done();
            });
        });

        self.emitter.emit('entry:store', self.db, entry);
    });

    it('logs failure to select from entries table', function (done) {
        var entry, self;

        self = this;

        entry = {
            title: 'the title',
            url: 'http://example.com',
            feedId: self.feedId,
            fetchId: self.fetchId
        };

        self.emitter.on('log:error', function (message, fields) {
            assert(message);
            assert(fields);
            done();
        });

        self.db.run('DROP TABLE entries', function (err) {
            if (err) {
                throw err;
            }

            self.emitter.emit('entry:store', self.db, entry);
        });
    });

    it('requires valid feed ID', function (done) {
        var entry, self;

        self = this;
        entry = {
            url: 'http://example.com',
            feedId: 999,
            fetchId: self.fetchId
        };

        self.emitter.on('entry:store:done', function (args) {
            assert.strictEqual(args.changes, undefined);

            self.db.get('SELECT COUNT(*) as count FROM entries', function (err, row) {
                if (err) {
                    throw err;
                }
                assert.strictEqual(row.count, 0);
                done();
            });
        });

        self.emitter.emit('entry:store', self.db, entry);
    });

    it('emits discussion event', function (done) {
        var entry, self;

        self = this;
        entry = {
            url: 'http://example.com',
            discussion: {
                'foo': 'bar'
            },
            feedId: self.feedId,
            fetchId: self.fetchId
        };

        self.emitter.on('discussion', function (args) {
            assert.strictEqual(args.foo, entry.discussion.foo);
            done();
        });

        self.emitter.emit('entry:store', self.db, entry);
    });


    it('parses non-numeric creation date', function (done) {
        var entries, self;

        self = this;
        entries = [
            {title: 'title1', url: 'http://example.com/entry1.html', created: 'Sun, 19 Jul 2015 06:51:17 -0500'},
            {title: 'title2', url: 'http://example.com/entry2.html', created: '2015-03-30T11:07:01.441-07:00'},
            {title: 'title3', url: 'http://example.com/entry3.html', created: '2015-06-15T00:00:00Z'},
            {title: 'title4', url: 'http://example.com/entry4.html', created: 'bogus'},
            {title: 'title5', url: 'http://example.com/entry5.html'}
        ];

        entries.forEach(function (entry, index) {
            entry.feedId = self.feedId;
            entry.fetchId = self.fetchId;
            self.emitter.once('entry:store:done', function (args) {
                assert.strictEqual(args.changes, 1);
                assert(args.id, index + 1);
                assert(args.createdUtcSeconds);

                if (entry === entries[entries.length - 1]) {
                    done();
                }
            });

            self.emitter.emit('entry:store', self.db, entry);
        });
    });

});