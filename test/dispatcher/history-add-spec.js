var assert, events, historyAdd, setup, sqlite3;

sqlite3 = require('sqlite3').verbose();
setup = require('../../dispatcher/setup');
historyAdd = require('../../dispatcher/history/add.js');
assert = require('assert');
events = require('events');

describe('history:add handler', function() {
    'use strict';

    beforeEach(function (done) {
        var self = this;
        this.fetchId = 'fetch';
        this.db = new sqlite3.Database(':memory:');
        this.emitter = new events.EventEmitter();
        this.emitter.unlisten = function () {};
        this.emitter.on('setup', setup);
        this.emitter.on('history:add', historyAdd);
        this.emitter.on('setup:done', function () {
            self.db.run('INSERT INTO feeds (url) VALUES (?)', ['http://example.com/feed.rss'], function (err) {
                if (err) {
                    throw err;
                }

                self.feedId = this.lastID;
                done();
            });
        });
        this.emitter.emit('setup', this.db);
    });

    afterEach(function () {
        this.db.close();
        this.emitter.removeAllListeners();
    });

    it('adds a row to the history table', function (done) {
        var self = this;

        self.emitter.on('history:add:done', function (args) {
            assert.strictEqual(args.changes, 1);
            assert.strictEqual(args.id, 1);
            assert.strictEqual(args.error, null);

            self.db.get('SELECT COUNT(*) as count FROM history', function (dbErr, row) {
                if (dbErr) {
                    throw dbErr;
                }
                assert.strictEqual(row.count, 1);
                done();
            });
        });

        self.emitter.emit('history:add', self.db, {
            type: 'fetch',
            id: self.feedId,
            fetchId: self.fetchId,
            status: 200,
            'itemCount': 10
        });
    });

    it('handles failure to add row', function (done) {
        var self = this;

        self.emitter.on('history:add:done', function (args) {
            assert.strictEqual(args.changes, undefined);
            assert.strictEqual(args.id, undefined);
            assert(args.error);
            done();
        });

        self.db.get('DROP TABLE history', function (err) {
            if (err) {
                throw err;
            }
            self.emitter.emit('history:add', self.db, {
                type: 'fetch',
                id: self.feedId,
                fetchId: self.fetchId,
                status: 200,
                'itemCount': 10
            });
        });
    });
});