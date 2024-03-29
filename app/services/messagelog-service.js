'use strict';

/*
*  Service for account messages
*/

angular.module('Clashtools.services')
.factory('messagelogService', ['$http', '$rootScope', 'authService', 'errorService',
function ($http, $rootScope, authService, errorService) {
    return {
        save: function(clanId, message, ign, type, callback) {
            var newMsg = {
                clan_id: clanId,
                user_id: authService.user.id,
                message: message,
                ign: ign,
                type: type /* member, target (called), target (attacked), delete (deleted call), special (start war), note (base notes) */
            };

            $http({
                url: '/crud/messagelog/' + message.clan_id,
                method: 'POST',
                data: newMsg,
                headers: {'Content-Type': 'application/json'}
            }).success(function (data, status, headers, config) {
                callback(null, data);
            }).error(function (data, status, headers, config) {
                callback(errorService.initMessage('messagelog-service.js', 'save', status), null);
            });
        },
        get: function(clanId, count, callback) {
            $http({
                url: '/crud/messagelog/' + clanId + '?count=' + count,
                method: 'GET'
            }).success(function (data, status, headers, config) {
                callback(null, data);
            }).error(function (data, status, headers, config) {
                callback(errorService.initMessage('messagelog-service.js', 'get', status), null);
            });
        }
    }
}]);
