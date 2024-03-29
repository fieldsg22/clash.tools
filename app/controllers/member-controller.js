'use strict';

/*
*   Controller for the home page of the application
*/

angular.module('Clashtools.controllers')
.controller('MemberCtrl', ['$rootScope', '$scope', '$routeParams', '$interval', '$modal', '$window', 'moment', 'authService', 'cacheService', 'sessionService', 'errorService', 'userService', 'Upload', 'imageUploadService',
function ($rootScope, $scope, $routeParams, $interval, $modal, $window, moment, authService, cacheService, sessionService, errorService, userService, Upload, imageUploadService) {
    // initialize
    $scope.walls = [];
    for (var idx=0; idx<=250; idx++) {
        $scope.walls.push({count: idx});
    }

    $scope.userId = $routeParams.id;

    userService.getById($scope.userId, function (err, user) {
        if (err) {
            err.stack_trace.unshift( { file: 'member-controller.js', func: 'init', message: 'Error getting user' } );
            errorService.save(err, function() {});
        }
        else {
            $scope.user = user;

            $scope.meta = { avatar: user.profile.avatar };
            $rootScope.title = 'Member Profile - ' + user.ign + ' - clash.tools';

            setCountdownTimers();

            // set countdown timers to refresh every three minutes
            var promise = $interval(setCountdownTimers, 180000);
            $scope.$on('$destroy', function() {
                $interval.cancel(promise);
            });
        }
    });


    $scope.saveUser = function() {
        saveUserInternal();
    }

    /*
    *   Special case for top form which has a $dirty error
    */
    $scope.saveTop = function() {
        saveUserInternal();
        $scope.nameForm.$setPristine();        
        $rootScope.globalMessage = 'Profile was saved.';
    }

    $scope.saveWithFeedback = function() {
        saveUserInternal();
        $rootScope.globalMessage = 'Member profile saved';
    }
    
    $scope.uploadAvatar = function(file) {
        if (file.length > 0) {
            imageUploadService.uploadAvatar($scope.userId, file, function (err, result) {
                if (err) {
                    err.stack_trace.unshift( { file: 'member-controller.js', func: '$scope.uploadAvatar', message: 'Error uploading avatar' } );
                    errorService.save(err, function() {});
                }
                else {
                    $scope.user.profile.avatar = result.newFile;
                    $scope.meta = { avatar: result.newFile };
                    saveUserInternal();
                }
            });
        }
    }

    $scope.upgradeHero = function(isBK) {
        var cssClass = 'center';
        if ($window.innerWidth < 500) {
            cssClass = 'mobile';
        }

        $scope.modalOptions = {
            yesBtn: 'Set',
            noBtn: 'Cancel',
            cssClass: cssClass,
            formData: {},
            onYes: function(formData) {
                var now = new Date();
                if (isBK) {
                    $scope.user.profile.bkUpgrade = new Date(now.getTime() + ((formData.finishedDays*24*60 + formData.finishedHours*60)*60000));
                }
                else {
                    $scope.user.profile.aqUpgrade = new Date(now.getTime() + ((formData.finishedDays*24*60 + formData.finishedHours*60)*60000));
                }
                saveUserInternal();
            }
        };

        var modalInstance = $modal(
            {
                scope: $scope,
                animation: 'am-fade-and-slide-top',
                placement: 'center',
                template: "/views/partials/heroUpgradeDialog.html",
                show: false
            }
        );

        modalInstance.$promise.then(function() {
            modalInstance.show();
        });
    }

    function saveUserInternal() {
        // clear meta data in case the UI needs bits refreshed
        sessionService.clearUserMeta();

        userService.update($scope.user._id, $scope.user, function (err, newUser) {
            if (err) {
                err.stack_trace.unshift( { file: 'profile-controller.js', func: '$scope.saveUser', message: 'Error saving user' } );
                errorService.save(err, function() {});
            }
            else {
                $scope.user = newUser;
                setCountdownTimers();
            }
        });
    }

    function setCountdownTimers() {
        var now = new Date();

        var bkFinishTime = new Date($scope.user.profile.bkUpgrade);
        bkFinishTime = bkFinishTime.getTime();

        if (bkFinishTime > now.getTime()) {
            var hoursLeft = parseInt((bkFinishTime - now.getTime())/1000/60/60);
            $scope.bkDays = parseInt(hoursLeft / 24);
            $scope.bkHours = parseInt(hoursLeft % 24);
        }
        else {
            $scope.bkDays = 0;
            $scope.bkHours = 0;
        }

        var aqFinishTime = new Date($scope.user.profile.aqUpgrade);
        aqFinishTime = aqFinishTime.getTime();

        if (aqFinishTime > now.getTime()) {
            var hoursLeft = parseInt((aqFinishTime - now.getTime())/1000/60/60);
            $scope.aqDays = parseInt(hoursLeft / 24);
            $scope.aqHours = parseInt(hoursLeft % 24);
        }
        else {
            $scope.aqDays = 0;
            $scope.aqHours = 0;
        }
    }

}]);