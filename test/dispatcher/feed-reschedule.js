'use strict';

const sqlite3 = require('sqlite3').verbose();
const startup = require('../../dispatcher/startup');
const schema = require('../../dispatcher/schema');
const reschedule = require('../../dispatcher/feed/reschedule');
const assert = require('assert');
const events = require('events');

describe('feed:reschedule', function() {

    beforeEach(function (done) {
        const self = this;
        this.db = new sqlite3.Database(':memory:');
        this.emitter = new events.EventEmitter();
        this.emitter.unlisten = function () {};
        this.emitter.on('feed:reschedule', reschedule);
        this.emitter.on('startup', startup);
        this.emitter.on('schema', schema);

        this.emitter.on('schema:done', () => {
            self.db.serialize(function () {
                self.db.run(
                    'INSERT INTO feeds (url) VALUES (?)',
                    ['http://example.com/feed.rss'],
                    function (err) {
                        if (err) {
                            throw err;
                        }

                        self.feedId = this.lastID;

                        done();
                    }
                );
            });
        });

        this.emitter.emit('startup', self.db);
    });

    afterEach(function () {
        this.db.close();
        this.emitter.removeAllListeners();
    });

    it('schedules refetch for 1 hour by default', function (done) {
        const self = this;

        self.emitter.on('feed:reschedule:done', (feedId) => {
            assert.strictEqual(feedId, self.feedId);

            self.db.get(
                'SELECT nextFetch FROM feeds WHERE id=?',
                [self.feedId],
                (err, row) => {
                    if (err) {
                        throw err;
                    }

                    const nextFetch = new Date(row.nextFetch);

                    const delta = (nextFetch - new Date())/1000/60;

                    assert.ok(delta >= 1);
                    done();
                }
            );

        });

        self.emitter.emit('feed:reschedule', this.feedId);
    });

    it('schedules refetch for 1 hour by default - callback', function (done) {
        const self = this;

        self.emitter.emit('feed:reschedule', this.feedId, null, (feedId) => {
            assert.strictEqual(feedId, self.feedId);

            self.db.get(
                'SELECT nextFetch FROM feeds WHERE id=?',
                [self.feedId],
                (err, row) => {
                    if (err) {
                        throw err;
                    }

                    const nextFetch = new Date(row.nextFetch);

                    assert.ok(nextFetch > new Date());
                    done();
                }
            );
        });
    });

    it('allows interval to be specified', function (done) {
        const self = this;

        self.emitter.emit('feed:reschedule', this.feedId, 5, (feedId) => {
            assert.strictEqual(feedId, self.feedId);

            self.db.get(
                'SELECT nextFetch FROM feeds WHERE id=?',
                [self.feedId],
                (err, row) => {
                    if (err) {
                        throw err;
                    }

                    const nextFetch = new Date(row.nextFetch);

                    const delta = (nextFetch - new Date())/1000/60;

                    assert.ok(delta >= 5);
                    done();
                }
            );
        });
    });

    it('handles update failure', function (done) {
        const self = this;

        self.db.run('DROP TABLE feeds', (err) => {
            if (err) {
                throw err;
            }

            self.emitter.emit(
                'feed:reschedule',
                this.feedId,
                null,
                (feedId) => {
                    assert.strictEqual(feedId, null);
                    done();
                }
            );
        });
    });
});
