/*
*   CRUD API for Clans
*/

var ObjectID = require('mongodb').ObjectID,
    async    = require('async'),
    _        = require('underscore');

var clanModel         = require('./clan-model'),
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


    // add a check for an already active war in case two people attempt to start at the same time

    async.waterfall([
        function (callback_w) {
            // first check to see if there's already an active war
            if (model._id) {
                // saving an existing war
                callback_w(null, false);
            }
            else {
                exports.activeWar(model.clan_id, false, function (err, war) {
                    if (err) {
                        callback_w(err);
                    }
                    else if (war) {
                        callback_w(null, true);
                    }
                    else {
                        callback_w(null, false);
                    }
                });
            }
        },
        function (existingActive, callback_w) {
            if (existingActive) {
                // there was an existing active war and trying to save another new war
                callback_w(null, null);
            }
            else {
                // either saving an existing war, or saving a valid new war
                db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
                    if (err) {
                        callback_w(err, null);
                    }
                    else {
                        collection.save(model, function (err, results) {
                            if (err) {
                                callback_w(err, null);
                            }
                            else {
                                if (results.result.ok == 1) { // successful update
                                    callback_w(null, model);
                                }
                                else {  // successful save new
                                    callback_w(null, results);
                                }
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
            // will return null result if there was already an active war
            callback(null, result);
        }
    });
}

exports.delete = function(warId, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    async.waterfall([
        function (callback_w) {
            // delete attack results
            attackResultModel.deleteWar(warId, function (err, count) {
                if (err) {
                    callback_w(err, null);
                }
                else {
                    callback_w(null, count);
                }
            });
        },
        function (count, callback_w) {
            // delete the war
            db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
                if (err) {
                    callback_w(err, null);
                }
                else {
                    collection.remove( { _id: warId }, function (err, count) {
                        if (err) {
                            callback_w(err, null);
                        }
                        else {
                            callback_w(null, count);
                        }
                    });
                }
            });
        }
    ], function (err, results) {
        if (err) {
            callback(err, null)
        }
        else {
            callback(null, results);
        }
    });
}

exports.assignBase = function(warId, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    // need to validate this record - on occasion it looks like corrupt data is getting through
    var valid = true;
    if (!model || model==null || model==undefined) {
        valid = false;
    }
    else if (!model.assignment || model.assignment==null || model.assignment==undefined) {
        valid = false;
    }
    else if (!model.assignment.u || model.assignment.u==null || model.assignment.u==undefined || model.assignment.u.length == 0) {
        valid = false;
    }
    else if (!model.assignment.i || model.assignment.i==null || model.assignment.i==undefined || model.assignment.i.length==0) {
        valid = false;
    }
    else if (!model.assignment.c || model.assignment.c==null || model.assignment.c==undefined) {
        valid = false;
    }

    if (valid) {
        db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
            if (err) {
                callback(err, null);
            }
            else {
                async.waterfall([
                    function (callback_w) {
                        exports.findById(warId, function (err, war) {
                            if (err) {
                                callback_w(err, null);
                            }
                            else {
                                var exists = false;
                                _.each(war.bases[model.bIndex].a, function (assignment) {
                                    if (assignment.i == model.assignment.i) {
                                        exists = true;
                                    }
                                });
                                callback_w(null, exists);
                            }
                        });
                    },
                    function (exists, callback_w) {
                        if (!exists) {
                            // bases.0.a.ign (pull out of base array where base is zero and assignment is ign)
                            var push = {};
                            push['bases.' + model.bIndex + '.a'] = model.assignment;
                            collection.update(
                                { _id: warId,  },
                                { $push: push },
                                { upsert: false },
                                function (err, result) {
                                    if (err) {
                                        callback_w(err, null);
                                    }
                                    else {
                                        callback_w(null, result);
                                    }
                                }
                            );
                        }
                        else {
                            callback_w('Assignment already exists', null);
                        }
                    }
                ], function (err, results) {
                    if (err) {
                        callback(err, null);
                    }
                    else {
                        callback(null, results);
                    }
                });
            }
        });
    }
    else {
        callback('Invalid model', null);
    }
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

        //verify the model
        var valid = true;
        if (!model || model==null || model==undefined) {
            valid = false;
        }
        else if (!model.u || model.u==null || model.u==undefined || model.u.length == 0) {
            valid = false;
        }
        else if (model.bIndex==null || model.bIndex==undefined) {
            valid = false;
        }

        if (valid) {
            db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
                if (err) {
                    callback(err, null);
                }
                else {
                    // bases.0.a.u (pull out of base array where base is zero and assignment is user)
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
            callback("invalid model", null);
        }
    }
    else {
        //verify the model
        var valid = true;
        if (!model || model==null || model==undefined) {
            valid = false;
        }
        else if (!model.u || model.u==null || model.u==undefined || model.u.length == 0) {
            valid = false;
        }
        else if (model.bIndex==null || model.bIndex==undefined) {
            valid = false;
        }
        else if (model.aIndex==null || model.aIndex==undefined) {
            valid = false;
        }
        else if (model.stars==null || model.stars==undefined) {
            valid = false;
        }

        if (valid) {
            db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
                if (err) {
                    callback(err, null);
                }
                else {
                    async.waterfall([
                        function (callback_w) {
                            // this step verifies that the assignment actually exists and is this user's assignment
                            // in some cases someone will update stars after a call has been removed and the UI isn't refreshed
                            var query = {
                                _id: warId
                            };
                            query['bases.' + model.bIndex + '.a.' + model.aIndex + '.u'] = model.u;

                            collection.findOne( query, function (err, item) {
                                if (err) {
                                    callback_w(err, null);
                                }
                                else {
                                    if (item) {
                                        callback_w(null, true);
                                    }
                                    else {
                                        callback_w(null, false);
                                    }

                                }
                            });
                        },
                        function (callValid, callback_w) {
                            // the check in the first waterfall step ensures the call is still valid before doing the update
                            if (callValid) {
                                // bases.0.a.0.s (array indexing to base 0, assignment 0, stars)
                                var update = {};
                                update['bases.' + model.bIndex + '.a.' + model.aIndex + '.s'] = model.stars;
                                collection.update(
                                    { _id: warId },
                                    { $set: update },
                                    { upsert: false },
                                    function (err, result) {
                                        if (err) {
                                            callback_w(err, null);
                                        }
                                        else {
                                            attackResultModel.save(warId, model, function (err, res) {
                                                if (err) {
                                                    callback_w(err, null);
                                                }
                                                else {
                                                    callback_w(null, result);
                                                }
                                            });
                                        }
                                    }
                                );
                            }
                            else {
                                callback_w('Call was no longer valid', null);
                            }
                        }
                    ], function (err, results) {
                        if (err) {
                            callback(err, null);
                        }
                        else {
                            callback(null, results);
                        }
                    });
                }
            });
        }
        else {
            callback("invalid model", null);
        }
    }
}

exports.saveBaseImage = function(warId, baseNum, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    var baseIndex = parseInt(baseNum) - 1;
    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            var update = {};
            update['bases.' + baseIndex + '.n.img'] = model.fileName;
            collection.update(
                { _id: warId },
                { $set: update },
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

exports.addBaseNote = function(warId, baseNum, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    var baseIndex = parseInt(baseNum) - 1;
    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            var push = {};
            push['bases.' + baseIndex + '.n.n'] = model;
            collection.update(
                { _id: warId },
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

exports.deleteBaseNote = function(warId, baseNum, model, callback) {
    if (_.isString(warId)) {
        warId = new ObjectID.createFromHexString(warId);
    }

    var baseIndex = parseInt(baseNum) - 1;
    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            var pull = {};
            pull['bases.' + baseIndex + '.n.n'] = { u: model.u, content: model.content };
            collection.update(
                { _id: warId },
                { $pull: pull },
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
                                result: war.result,
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

exports.backfillAttackResults = function(war, callback) {
    clanModel.findById(war.clan_id, function (err, clan) {
        if (err) {
            callback(err, null);
        }
        else if (clan) {
            var count = 0;
            var endDate = new Date(war.start);
            endDate = new Date(endDate.getTime() + 24*60*60*1000);

            var q = async.queue(function (model, callback_q) {
                attackResultModel.save(war._id, model, function (err, result) {
                    if (err) {
                        logger.error(err);
                        callback_q(err);
                    }
                    else {
                        logger.info('WarId: ' + war._id + ' attack result saved for base ' + (model.bIndex + 1));
                        callback_q(null);
                    }
                });
            });

            q.drain = function() {
                logger.info('Done processing attack result queue');
                callback(null, null);
            }

            var resultArray = [];
            _.each(war.bases, function (base) {
                _.each(base.a, function (assignment) {
                    if (assignment.s != null) {
                        // only process if stars have been logged
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
                                on: war.opponent_name,
                                u: assignment.u,
                                i: assignment.i,
                                t: war.team[playerIndex].t,
                                ot: parseInt(base.t),
                                we: endDate
                            };

                            resultArray.push(update);
                        }
                    }
                });
            });

            if (resultArray.length > 0) {
                q.push(resultArray, function (err) {
                    if (err) {
                        logger.error(err);
                    }
                });
            }
            else {
                callback(null, null);
            }
        }
        else {
            logger.warn('No clan found for war ' + war._id);
            callback(null, null);
        }
    });
}

exports.backfillAllWars = function(callback) {
    db(config.env[process.env.NODE_ENV].mongoDb.dbName, 'war', function (err, collection) {
        if (err) {
            callback(err, null);
        }
        else {
            collection.find( { } )
            .sort( {created_at: -1} )
            .toArray(function (err, wars) {
                if (err) {
                    callback(err, null);
                }
                else {
                    if (wars) {
                        var warCount = wars.length;
                        async.eachSeries(wars, function (war, callback_each) {
                            exports.backfillAttackResults(war, function (err, result) {
                                if (err) {
                                    logger.error('Could not backfill war ' + war._id);
                                    callback('backfill failed');
                                }
                                else {
                                    warCount--;
                                    logger.info('WarId: ' + war._id +  ' done, ' + warCount +  ' wars left');
                                    callback_each(null);
                                }
                            });
                        }, function (err) {
                            callback(err, null);
                        });
                    }
                    else {
                        callback(null, null);
                    }
                }
            });
        }
    });
}



