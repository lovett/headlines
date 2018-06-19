const sqlite3 = require('sqlite3').verbose();
const startup = require('../../dispatcher/startup');
const filterStore = require('../../dispatcher/filter/store');
const assert = require('assert');
const events = require('events');

// Temporarily disabled
xdescribe('filter:store', function() {
    'use strict';

    beforeEach(function (done) {
        var self = this;
        this.db = new sqlite3.Database(':memory:');
        this.emitter = new events.EventEmitter();
        this.emitter.unlisten = function () {};
        this.emitter.on('filter:store', filterStore);
        this.emitter.on('startup', startup);
        this.userId = 1;

        this.emitter.on('startup:done', function () {
            self.db.run('INSERT INTO feeds (url) VALUES (?)', ['http://example.com/feed.rss'], function (err) {
                if (err) {
                    throw err;
                }

                self.feedId = this.lastID;

                self.db.run('INSERT INTO users (username, passwordHash) VALUES ("test", "test")', function () {
                    self.userId = this.lastID;
                    done();
                });
            });
        });

        this.emitter.emit('startup', self.db);

    });

    afterEach(function () {
        this.db.close();
        this.emitter.removeAllListeners();
    });

    it('adds a feed-specific filter', function (done) {
        var filter, self;

        self = this;
        filter = {
            feedId: self.feedId,
            userId: self.userId,
            value: 'test'
        };

        self.emitter.on('filter:store:done', function (args) {
            assert.strictEqual(args.feedId, filter.feedId);
            assert.strictEqual(args.userId, filter.userId);
            assert.strictEqual(args.value, filter.value);
            assert(args.id);

            self.db.get('SELECT COUNT(*) as count FROM filters', function (err, row) {
                assert.strictEqual(err, null);
                assert.strictEqual(row.count, 1);
                done();
            });
        });

        self.emitter.emit('filter:store', self.db, filter);
    });

    it('adds a global filter', function (done) {
        var filter, self;

        self = this;
        filter = {
            userId: self.userId,
            value: 'test'
        };

        self.emitter.on('filter:store:done', function (args) {
            assert.strictEqual(args.feedId, undefined);
            assert.strictEqual(args.userId, filter.userId);
            assert.strictEqual(args.value, filter.value);
            assert(args.id);

            self.db.get('SELECT feedId FROM filters', function (err, row) {
                assert.strictEqual(err, null);
                assert.strictEqual(row.feedId, null);
                done();
            });
        });

        self.emitter.emit('filter:store', self.db, filter);
    });

    it('handles insertion failure', function (done) {
        var filter, self;

        self = this;
        filter = {
            feedId: self.feedId,
            userId: self.userId,
            value: 'test'
        };

        self.emitter.on('log:error', function (message, args) {
            assert(message);
            assert(args);
            done();
        });

        self.db.exec('DROP TABLE FEEDS', function (err) {
            if (err) {
                throw err;
            }

            self.emitter.emit('filter:store', self.db, filter);
        });
    });

    it('updates an existing row', function (done) {
        var filter, self;

        self = this;
        filter = {
            feedId: self.feedId,
            userId: self.userId,
            value: 'test'
        };

        self.emitter.once('filter:store:done', function (insertedFilter) {
            insertedFilter.value = 'newvalue';

            self.emitter.once('filter:store:done', function (updatedFilter) {
                assert.strictEqual(updatedFilter.updated, true);
                done();
            });

            self.emitter.emit('filter:store', self.db, insertedFilter);
        });

        self.emitter.emit('filter:store', self.db, filter);
    });

    it('handles failure to update an existing row', function (done) {
        var filter, self;

        self = this;
        filter = {
            feedId: self.feedId,
            userId: self.userId,
            value: 'test'
        };

        self.emitter.once('filter:store:done', function (insertedFilter) {
            self.db.exec('DROP TABLE filters', function (err) {
                if (err) {
                    throw err;
                }

                self.emitter.once('filter:store:done', function (updatedFilter) {
                    assert.strictEqual(updatedFilter.updated, false);
                    done();
                });

                self.emitter.emit('filter:store', self.db, insertedFilter);
            });
        });

        self.emitter.emit('filter:store', self.db, filter);
    });
});
