'use strict';

module.exports = function (callback) {
    callback = (typeof callback === 'function') ? callback : function() {};

    const emitter = this;

    emitter.db.all(
        'SELECT * from feeds',
        [],
        (err, rows) => {
            callback(err, rows);
        }
    );
};