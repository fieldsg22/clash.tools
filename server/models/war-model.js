/*
*   CRUD API for Clans
*/

var ObjectID = require('mongodb').ObjectID,
    async    = require('async'),
    _        = require('underscore');

var config            = require('../../config/config'),
    clanModel         = require('./clan-model'),
    attackResultModel = require('./attackresult-model');


/*
*   Get active war by clan id
*
*   Only one war can be active at once
*
*   visibleRequired tells the system whether to filter by visible
*/
exports.activeWar = function(clanId, visibleRequired, callback) {
    if (_.isString(clanId)) {
        clanId = new ObjectID.createFromHexString(clanId);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            var whereClause = {
                clan_id: clanId,
                active: true
            };

            if (visibleRequired) {
                whereClause.visible = true;
            }

            collection.findOne( whereClause , function (err, war) {
                if (err) {
                    callback(err, null);
                }
                else {
                    callback(null, war);
                }
            });
        }
    });
}

/*
* Upserts a record and returns the record
*/
exports.save = function(model, callback) {

    if (model._id && _.isString(model._id)) {
        model._id = new ObjectID.createFromHexString(model._id);
    }

    if (_.isString(model.clan_id)) {
        model.clan_id = new ObjectID.createFromHexString(model.clan_id);
    }

    if (_.isString(model.created_by)) {
        model.created_by = new ObjectID.createFromHexString(model.created_by);
    }

    model.last_updated_at = new Date();

    if (model.created_at) {
        model.created_at = new Date(model.created_at);
    }
    else {
        model.created_at = model.last_updated_at;
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.save(model, function (err, war) {
                if (err) {
                    callback(err, null);
                }
                else {
                    if (war == 1) { // successful update
                        callback(null, model);
                    }
                    else {  // successful save new
                        callback(null, war);
                    }
                }
            });
        }
    });

}

exports.assignBase = function(warId, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            // bases.0.a.ign (pull out of base array where base is zero and assignment is ign)
            var push = {};
            push['bases.' + model.bIndex + '.a'] = model.assignment;
            collection.update(
                { _id: warId,  },
                { $push: push },
                { upsert: false },
                function (err, result) {
                    if (err) {
                        callback(err, null);
                    }
                    else {
                        callback(null, result);
                    }
                }
            );
        }
    });
}

/*
*   Update stars on a specific base assignment
*/
exports.updateStars = function(warId, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    if (model.stars < 0) {
        // negative stars means delete the call
        db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
            if (err) {
                callback(err, null);
            }
            else {
                // bases.0.a.ign (pull out of base array where base is zero and assignment is ign)
                var pull = {};
                pull['bases.' + model.bIndex + '.a'] = { u: model.u };
                collection.update(
                    { _id: warId,  },
                    { $pull: pull },
                    { upsert: false },
                    function (err, result) {
                        if (err) {
                            callback(err, null);
                        }
                        else {
                            attackResultModel.remove(warId, model, function (err, res) {
                                if (err) {
                                    callback(err, null);
                                }
                                else {
                                    callback(null, result);
                                }
                            });
                        }
                    }
                );
            }
        });
    }
    else {
        db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
            if (err) {
                callback(err, null);
            }
            else {
                // bases.0.a.0.s (array indexing to base 0, assignment 0, stars)
                var update = {};
                update['bases.' + model.bIndex + '.a.' + model.aIndex + '.s'] = model.stars;
                collection.update(
                    { _id: warId },
                    { $set: update },
                    { upsert: false },
                    function (err, result) {
                        if (err) {
                            callback(err, null);
                        }
                        else {
                            attackResultModel.save(warId, model, function (err, res) {
                                if (err) {
                                    callback(err, null);
                                }
                                else {
                                    callback(null, result);
                                }
                            });
                        }
                    }
                );
            }
        });
    }
}


/*
*   Find war by id
*/
exports.findById = function(id, callback) {
    if (_.isString(id)) {
        id = new ObjectID.createFromHexString(id);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.findOne( { _id: id }, function (err, item) {
                if (err) {
                    callback(err, null);
                }
                else {
                    callback(null, item);
                }
            });
        }
    });
}

exports.getHistory = function(clanId, callback) {
    if (_.isString(clanId)) {
        clanId = new ObjectID.createFromHexString(clanId);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.find( { clan_id: clanId, active: false }, {  } )
            .sort( {created_at: -1} )
            .toArray(function (err, wars) {
                if (err) {
                    callback(err, null);
                }
                else {
                    if (wars) {
                        var retWars = [];
                        _.each(wars, function (war) {
                            var w = {
                                _id: war._id,
                                opponent_name: war.opponent_name,
                                player_count: war.player_count,
                                stars: war.result.stars,
                                opponent_stars: war.result.opponentStars,
                                result: war.result.result,
                                start: war.start
                            };
                            retWars.push(w);
                        });
                        callback(null, retWars);
                    }
                    else {
                        callback(null, null);
                    }
                }
            });
        }
    });
}

exports.getFullHistory = function(clanId, callback) {
    if (_.isString(clanId)) {
        clanId = new ObjectID.createFromHexString(clanId);
    }

    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.find( { clan_id: clanId, active: false }, {  } )
            .sort( {created_at: -1} )
            .toArray(function (err, wars) {
                if (err) {
                    callback(err, null);
                }
                else {
                    if (wars) {
                        callback(null, wars);
                    }
                    else {
                        callback(null, null);
                    }
                }
            });
        }
    });
}

exports.backfillAttackResults = function(warId, callback) {
    exports.findById(warId, function (err, war) {
        if (err) {
            callback(err, null);
        }
        else {

            clanModel.findById(war.clan_id, function (err, clan) {
                if (err) {
                    callback(err, null);
                }
                else {
                    var endDate = new Date(war.start);
                    endDate = new Date(endDate.getTime() + 24*60*60*1000);
                    _.each(war.bases, function (base) {
                        _.each(base.a, function (assignment) {

                            var playerIndex = -1;
                            for (var idx=0; idx<war.team.length; idx++) {
                                if (war.team[idx].u == assignment.u) {
                                    playerIndex = idx;
                                }
                            }

                            // make sure nothing strange happened to the team
                            if (playerIndex >= 0) {
                                var update = {
                                    bIndex: base.b-1,
                                    pIndex: playerIndex,
                                    stars: assignment.s,
                                    c: war.clan_id,
                                    cn: clan.name,
                                    u: assignment.u,
                                    i: assignment.i,
                                    t: war.team[playerIndex].t,
                                    ot: parseInt(base.t),
                                    we: endDate
                                };

                                attackResultModel.save(warId, update, function (err, result) {
                                    if (err) {
                                        logger.error(err);
                                    }
                                    else {

                                    }
                                });
                            }
                        });
                    });

                    callback(null, null);
                }
            });
        }
    });
}

exports.backfillAllWars = function(callback) {
    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.find( { }, { _id: 1 } )
            .sort( {created_at: -1} )
            .toArray(function (err, wars) {
                if (err) {
                    callback(err, null);
                }
                else {
                    if (wars) {
                        _.each(wars, function (war) {
                            exports.backfillAttackResults(war._id, function (err, result) {
                                if (err) {
                                    logger.error('Could not backfill war ' + war._id);
                                }
                            });
                        });
                        callback(null, null);
                    }
                    else {
                        callback(null, null);
                    }
                }
            });
        }
    });
}

/*
* Upserts a record and returns the resulting record
*/
/*exports.save = function(model, callback) {
    var me = this;
    var newClan = false;
    async.waterfall([
        function (callback_wf) {
            if (!model._id) {
                me.findByTag(model.clan_tag, function (err, record) {
                    if (err) {
                        callback_wf(err, null);
                    }
                    else if (record) {
                        callback_wf('Clan already exists', record);
                    }
                    else {
                        newClan = true;
                        callback_wf(null, null);
                    }
                });
            }
            else {
                callback_wf(null, null);
            }
        },
        function (clan, callback_wf) {
            if (clan) {
                // attempting to save a new clan, clan tag already exists
                logger.error('we should never see this message');
                callback_wf('Clan already exists', clan);
            }
            else {  // everything is good, save clan (new or existing)
                // sometimes id is native, sometimes it's been converted to a string
                if (model._id && _.isString(model._id)) {
                    model._id = new ObjectID.createFromHexString(model._id);
                }

                if (_.isString(model.created_by)) {
                    model.created_by = new ObjectID.createFromHexString(model.created_by);
                }

                // clan is safe to save
                model.last_updated_at = new Date();

                if (!model.created_at) {
                    model.created_at = model.last_updated_at;
                }
                else {
                    model.created_at = new Date(model.created_at);
                }

                db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'clan', function (err, collection) {
                    if (err) {
                        callback_wf(err, null);
                    }
                    else {
                        collection.save(model, function (err, result) {
                            if (err) {
                                callback_wf(err, null);
                            }
                            else {
                                if (result == 1) {
                                    // result is 1 if the record existed and was updated
                                    callback_wf(null, model);
                                }
                                else {
                                    // record was inserted, send back the new object that includes the _id field
                                    callback_wf(null, result);
                                }
                            }
                        });
                    }
                });
            }
        }
    ], function (err, result) {
        if (err && !result) {       // an error happened
            callback(err, null);
        }
        else if (err && result) {   // tried to save a duplicate
            callback(err, result);
        }
        else {                      // save successful
            if (newClan) {
                // in the case of a new clan, we need to update the user model to reflect joining the new clan (and leader)
                userModel.updateClan(result.created_by, result, true, function (err, user) {
                    if (err) {
                        // this should never hapen
                        callback(err, null);
                    }
                    else {
                        callback(null, result);
                    }
                });
            }
            else {
                callback(null, result);
            }
        }
    });
}*/

/*
*   Get metadata for all clans
*/
/*exports.allClans = function(query, callback) {
    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'clan', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            var q = {};
            if (query !== '*') {
                q.$or = [
                    { name: { $regex: query, $options: 'i'} },
                    { clan_tag: { $regex: query, $options: 'i'} }
                ];
            }

            collection.find( q, {} ).sort({name: 1}).limit(50).toArray(function (err, clans) {
                if (err) {
                    callback(err, null);
                }
                else {
                    if (clans) {
                        async.each(clans, function (clan, callback_a) {
                            clanMetrics(clan._id, function (err, metrics) {
                                if (err) {
                                    callback_a(err);
                                }
                                else {
                                    clan.metrics = metrics;
                                    callback_a(null)
                                }
                            });
                        }, function (err) {
                            if (err) {
                                callback(err, null);
                            }
                            else {
                                callback(null, clans);
                            }
                        });
                    }
                    else {
                        callback(null, null);
                    }
                }
            });
        }
    });
}*/


