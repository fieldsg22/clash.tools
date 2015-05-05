'use strict';

/*
*  Service for wars
*/

angular.module('Clashtools.services')
.factory('warService', ['$http', 'errorService',
function ($http, errorService) {
    return {
        save: function(war, callback) {
            $http({
                url: '/crud/war',
                method: 'POST',
                data: war,
                headers: {'Content-Type': 'application/json'}
            }).success(function (data, status, headers, config) {
                callback(null, data);
            }).error(function (data, status, headers, config) {
                callback(errorService.initMessage('clan-service.js', 'save', data), null);
            });
        },
        getById: function(id, callback) {
            $http({
                url: '/crud/war/' + id,
                method: 'GET'
            }).success(function (data, status, headers, config) {
                callback(null, data);
            }).error(function (data, status, headers, config) {
                callback(errorService.initMessage('war-service.js', 'get', status), null);
            });
        },
        getActive: function(clanId, callback) {
            $http({
                url: '/crud/war/' + clanId + '/active',
                method: 'GET'
            }).success(function (data, status, headers, config) {
                callback(null, data);
            }).error(function (data, status, headers, config) {
                if (status==404) {
                    callback(null, null);
                }
                callback(errorService.initMessage('war-service.js', 'get', status), null);
            });
        }
/*        allClans: function(query, callback) {
            $http({
                url: '/crud/clans/' + query,
                method: 'GET'
            }).success(function (data, status, headers, config) {
                callback(null, data);
            }).error(function (data, status, headers, config) {
                callback(errorService.initMessage('clan-service.js', 'get', status), null);
            });
        },
        getMembers: function(clanId, types, callback) {
            $http({
                url: '/crud/clan/' + clanId + '/members?types=' + types,
                method: 'GET'
            }).success(function (data, status, headers, config) {
                callback(null, data);
            }).error(function (data, status, headers, config) {
                callback(errorService.initMessage('clan-service.js', 'get', status), null);
            });
        }*/
    }
}]);