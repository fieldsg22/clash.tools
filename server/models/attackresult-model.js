/*
*   CRUD API for Attack results
*/

var ObjectID = require('mongodb').ObjectID,
    async    = require('async'),
    _        = require('underscore');

var config    = require('../../config/config');

var fib = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
var starVal = [0, 10, 30, 60];

/*
* Upserts a record and returns the record
*/
exports.save = function(warId, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    if (_.isString(model.u)) {
        model.u = new ObjectID.createFromHexString(model.u);
    }

    if (_.isString(model.c)) {
        model.c = new ObjectID.createFromHexString(model.c);
    }

    var rank = model.pIndex + 1;
    var opponentRank = model.bIndex + 1;
    model.we = new Date(model.we);

    var fibIdx = rank - opponentRank;

    // baseline attack value is number of stars
    var attackValue = starVal[model.stars];

    // added or subtracted value based on position of base attacked in lineup compared to attacker
    if (fibIdx >= 0) {
        if (fibIdx < 12) {
            attackValue += Math.sqrt(fib[fibIdx]) * 3;
        }
        else {
            attackValue += 50;
        }
    }
    else {
        fibIdx = fibIdx * -1;
        if (fibIdx < 16) {
            attackValue -= Math.sqrt(fib[fibIdx]);
        }
        else {
            // max attack deduction = 30
            attackValue -= 30;
        }
    }

    // added or subtracted value based on attacking a higher or lower TH level
    if (model.t < model.ot) {
        attackValue += starVal[model.stars] * .5;
    }
    else if (model.t > model.ot) {
        attackValue -= starVal[model.stars] * .25;
    }

    // max is 100
    if (attackValue > 100) {
        attackValue = 100;
    }
    // min is 0
    else if (attackValue < 0) {
        attackValue = 0;
    }

    // final check - zero stars is always worth zero (the above factors could make a zero attack worth points)
    if (model.stars == 0) {
        attackValue = 0;
    }

    // determine if this record exists already

    async.waterfall([
        function (callback_wf) {
            db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'attack_result', function (err, collection) {
                if (err) {
                    callback(err, null);
                }
                else {
                    collection.findOne( { w: warId, u: model.u, r: rank, or: opponentRank }, function (err, item) {
                        if (err) {
                            callback_wf(err, null);
                        }
                        else {
                            callback_wf(null, item);
                        }
                    });
                }
            });
        },
        function (attackResult, callback_wf) {
            if (attackResult == null) {
                // not updating an existing attack result - add new
                var newAR = {
                    u: model.u,
                    i: model.i,
                    c: model.c,
                    cn: model.cn,
                    w: warId,
                    we: model.we,
                    r: rank,
                    or: opponentRank,
                    t: model.t,
                    ot: model.ot,
                    s: model.stars,
                    v: parseInt(attackValue)
                };

                db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'attack_result', function (err, collection) {
                    if (err) {
                        callback_wf(err, null);
                    }
                    else {
                        collection.save(newAR, function (err, ar) {
                            if (err) {
                                callback_wf(err, null);
                            }
                            else {
                                callback_wf(null, ar);
                            }
                        });
                    }
                });
            }
            else {
                // update existing
                var update = {
                    $set: {
                        s: model.stars,
                        v: parseInt(attackValue)
                    }
                };

                db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'attack_result', function (err, collection) {
                    if (err) {
                        callback_wf(err, null);
                    }
                    else {
                        collection.update({ w: warId, u: model.u, or: opponentRank }, update, function (err, ar) {
                            if (err) {
                                callback_wf(err, null);
                            }
                            else {
                                callback_wf(null, ar);
                            }
                        });
                    }
                });
            }
        }
    ], function (err, result) {
        if (err) {
            callback(err, null);
        }
        else {
            callback(null, result);
        }
    });

}

/*
*   Remove a row from attack_result - should rarely be needed
*/
exports.remove = function(warId, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    if (_.isString(model.u)) {
        model.u = new ObjectID.createFromHexString(model.u);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'attack_result', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            //var opponentRank = model.bIndex + 1;
            collection.remove({ w: warId, u: model.u, or: model.bIndex + 1 }, {}, function (err, result) {
                if (err) {
                    callback(err, null);
                }
                else {
                    callback(null, result);
                }
            });
        }
    });
}

/*
*   Get war results by clan id
*/
exports.findByClanId = function(clanId, callback) {
    if (_.isString(clanId)) {
        clanId = new ObjectID.createFromHexString(clanId);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'attack_result', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.find( { c: clanId }).toArray(function (err, items) {
                if (err) {
                    callback(err, null);
                }
                else {
                    callback(null, items);
                }
            });
        }
    });
}

/*
*   Get war results by war id
*/
exports.findByWarId = function(warId, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'attack_result', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.find( { w: warId }).toArray(function (err, items) {
                if (err) {
                    callback(err, null);
                }
                else {
                    callback(null, items);
                }
            });
        }
    });
}