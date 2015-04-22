'use strict';

/*
*   Controller for clan page
*/

angular.module('Clashtools.controllers')
.controller('ClanCtrl', ['$rootScope', '$scope', '$routeParams', '$location', 'authService', 'sessionService', 'errorService', 'messagelogService', 'clanService',
function ($rootScope, $scope, $routeParams, $location, authService, sessionService, errorService, messagelogService, clanService) {
    //$scope.helpLink = 'http://www.siftrock.com/help/dashboard/';

    var clanId = $routeParams.id;

    if (clanId !== 'new') {
        $scope.newClan = false;

        clanService.getById(clanId, function (err, clan) {
            $scope.clan = clan;
        });

        $rootScope.title = 'New clan - clash.tools';
    }
    else {
        $scope.newClan = true;
        $scope.clan = {
            meta: {},
            created_by: authService.user.id
        };
        $rootScope.title = 'New clan - clash.tools';
    }

/*    sessionService.getUserMeta(authService.user.id, function (err, meta) {
        $scope.ign = meta.ign;
        $scope.clan = meta.clan;
    });
*/


    $scope.saveNewClan = function() {
        clanService.save($scope.clan, function (err, result) {
            if (err) {
                err.stack_trace.unshift( { file: 'clan-controller.js', func: '$scope.saveNewClan', message: 'Error saving new clan' } );
                errorService.save(err, function() {});
            }
            else if (!result) {
                // clan tag already exists
                $scope.errorMsg = 'A clan with that tag already exists';
            }
            else {
                // Log this activity
                messagelogService.save(result._id, 'Clan "' + $scope.clan.name + '" created by [ign]', $scope.ign, 'special', function (err, msg) {
                    if (err) {
                        err.stack_trace.unshift( { file: 'clan-controller.js', func: '$scope.saveNewClan', message: 'Error saving new clan message in the log' } );
                        errorService.save(err, function() {});
                    }
                });

                // In every case with a new clan, the creator becomes the leader. Need to reset role for UI permissions. The back-end
                // takes care of changing the values in the database
                var newUser = authService.user;
                newUser.role = { bitMask: 16, title: 'leader' };
                authService.changeUser(newUser, function () {
                    sessionService.clearUserMeta(); // clear session data so clan gets reset in user meta data
                    $location.url('/clan/' + result._id).replace();
                });
            }
        });
    }

}]);