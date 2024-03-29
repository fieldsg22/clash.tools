/*
*   User endpoints
*/

var passport      = require('passport'),
    model          = require('../models/user-model');


/*
*   Get a user model by user id
*/
exports.getById = function(req, res, next) {
    model.findById(req.params.userId, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            res.json(200, user);
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Get a user model by user id (limited, removing email and password)
*/
exports.getByIdLimited = function(req, res, next) {
    model.findById(req.params.userId, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            var ret = {
                _id: user._id,
                ign: user.ign,
                player_tag: user.player_tag
            };
            res.json(200, ret);
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Get a user model by verify token
*/
exports.getByVerifyToken = function(req, res, next) {
    model.findByVerifyToken(req.params.token, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            res.json(200, user);
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Request to join a clan
*/
exports.joinClan = function(req, res, next) {
    model.joinClan(req.params.userId, req.body, function (err, result) {
        if (err) {
            res.send(500, err);
        }
        else if (result) {
            socket.emit('messagelog:' + req.body.clanId + ':change', null);
            res.json(200, { updateStatus: result} );
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Updates a user's clan. Note this is ONLY for joining an existing clan
*/
exports.updateClan = function(req, res, next) {
    model.updateClan(req.params.userId, req.body, false, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            socket.emit('user:' + user._id + ':meta');
            res.json(200, { updateStatus: user} );
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Updates a user's role
*/
exports.updateRole = function(req, res, next) {
    model.updateRole(req.params.userId, req.query.role, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            socket.emit('user:' + user._id + ':meta');
            res.json(200, user);
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Updates roster data
*/
exports.updateFromRoster = function(req, res, next) {
    model.updateFromRoster(req.params.userId, req.body, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            res.json(200, {result: 'success'});
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Save a user model. Note this should be used for update only. New users are always
*   created through the auth workflow
*/
exports.save = function(req, res, next) {
    model.saveModel(req.body, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            socket.emit('user:' + user._id + ':meta');
            res.json(200, user);
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Change user's password
*/
exports.changePassword = function(req, res, next) {
    model.changePassword(req.params.userId, req.body, function (err, result) {
        if (err) {
            res.send(500, err);
        }
        else if (result) {
            res.send(200, 'ok');
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   User has verified their email address
*/
exports.setVerified = function(req, res, next) {
    model.setVerified(req.params.userId, function (err, result) {
        if (err) {
            res.send(500, err);
        }
        else if (result) {
            res.send(200, 'ok');
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Disables a user
*/
exports.disable = function(req, res, next) {
    model.disable(req.params.userId, function (err, result) {
        if (err) {
            res.send(500, err);
        }
        else if (result) {
            res.send(200, 'ok');
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Gets user meta data
*/
exports.getMeta = function(req, res, next) {
    model.findById(req.params.userId, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            var ret = {
                _id: user._id,
                ign: user.ign,
                email_address: user.email_address,
                current_clan: user.current_clan,
                role: user.role.title,
                avatar: user.profile.avatar,
                bkLevel: user.profile.heroes.bk,
                aqLevel: user.profile.heroes.aq,
                gwLevel: user.profile.heroes.gw,
                bkUpgrade: user.profile.bkUpgrade,
                aqUpgrade: user.profile.aqUpgrade,
                gwUpgrade: user.profile.gwUpgrade,
                created_at: user.created_at
            };
            res.json(200, ret);
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Gets a user session
*/
exports.getUserSession = function(req, res, next) {
    model.findById(req.params.userId, function (err, user) {
        if (err) {
            res.send(500, err);
        }
        else if (user) {
            res.json(200, user.session_data);
        }
        else {
            res.send(404, 'not found');
        }
    });
}

/*
*   Saves user session data
*/
exports.saveUserSession = function(req, res, next) {
    model.saveSession(req.params.userId, req.body, function (err, result) {
        if (err) {
            res.send(500, err);
        }
        else if (result) {
            res.json(200,  { records: result } );
        }
        else {
            res.send(404, 'not found');
        }
    });
}

exports.adminSetBounces = function(req, res, next) {
    model.adminSetBounces(req.body, function (err, results) {
        if (err) {
            res.send(500, err);
        }
        else {
            res.json(200, { records_updated: results } );
        }        
    });
}

/*
*   Get users for account
*/
/*exports.getByAccount = function(req, res, next) {
    model.getByAccount(req.params.id, function (err, users) {
        if (err) {
           res.send(500, err);
        }
        else if (users) {
            res.json(200, users);
        }
        else {
            res.send(404, 'not found');
        }
    });
}*/
