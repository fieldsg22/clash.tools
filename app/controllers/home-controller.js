'use strict';

/*
*   Controller for the home page of the application
*/

angular.module('Clashtools.controllers')
.controller('HomeCtrl', ['$rootScope', '$scope', '$window', '$interval', '$modal', 'moment', 'authService', 'cacheService', 'sessionService', 'errorService', 'messagelogService', 'warService', 'clanService',
function ($rootScope, $scope, $window, $interval, $modal, moment, authService, cacheService, sessionService, errorService, messagelogService, warService, clanService) {
    // initialize
    $rootScope.title = 'Dashboard - clash.tools';

    $scope.nullState = true;

    sessionService.getUserMeta(authService.user.id, function (err, meta) {
        $scope.meta = meta;

        if ($scope.meta.current_clan.clan_id) {
            $scope.nullState = false;
            
            // load clan messages initially, and every 60 seconds after that
            loadClanMessages();
            var promise = $interval(loadClanMessages, 60000);
            $scope.$on('$destroy', function() {
                $interval.cancel(promise);
            });

            clanService.getById($scope.meta.current_clan.clan_id, function (err, clan) {
                if (err) {
                    err.stack_trace.unshift( { file: 'startwar-controller.js', func: 'init', message: 'Error getting clan' } );
                    errorService.save(err, function() {});
                }
                else {
                    $scope.clan = clan;

                    // load war once, then every 60 seconds to keep open targets up to date
                    loadWar(function(){});
                    var promiseWar = $interval(function() {
                        loadWar(function(){});
                    }, 60000);

                    $scope.$on('$destroy', function() {
                        $interval.cancel(promiseWar);
                    });                                        
                }
            });
        }
    });

    $scope.changeStars = function(targetNum, baseNum, numStars) {
        $scope.playerTargets[targetNum].stars = numStars;
        angular.forEach($scope.war.bases[baseNum].a, function (assignment) {
            if (assignment.u == authService.user.id) {
                assignment.s = numStars;
            }
            else {
                // TODO: something if someone else was also signed up?
            }
        });

        warService.save($scope.war, function (err, war) {
            if (err) {
                err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.changeStars', message: 'Error setting stars' } );
                errorService.save(err, function() {});
            }
            else {
                $scope.war = war;
            }
        });

        // Log this activity
        var starsText = 'stars';
        if (numStars == 1) {
            starsText = 'star';
        }

        messagelogService.save($scope.meta.current_clan.clan_id, '[ign] attacked base ' + baseNum + ' for ' + numStars + ' ' + starsText, $scope.meta.ign, 'attack', function (err, msg) {
            if (err) {
                err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.changeStars', message: 'Error saving attack message in the log' } );
                errorService.save(err, function() {});
            }
            else {
                loadClanMessages();
            }
        });
    }

    $scope.reserveBase = function(baseNum) {
        // first double-check that someone else hasn't reserved the target - load war and verify to reduce
        // the changes that two people sign up for the same target
        loadWar(function() {
            var open = false;

            var now = new Date();
            var warStart = new Date($scope.war.start);
            var possibleExpireDate = new Date(now.getTime() + ($scope.clan.war_config.cleanup_attack_time*60*60*1000));
            var freeForAllDate = new Date(warStart.getTime() + ((24 - $scope.clan.war_config.free_for_all_time)*60*60*1000));
            var warEnd = new Date(warStart.getTime() + (24*60*60*1000));

            if ($scope.clan.war_config.overcalls) {
                // if overcalls are allowed we don't care if the base has already been reserved
                open = true;
            }
            else if (now.getTime() >= freeForAllDate.getTime()) {
                // if we are in the free for all period, overcalls are allowed no matter what
                open = true;
            }
            else {
                // no overcalls allowed and not in free for all period, make sure the base is still open to avoid double reservations
                angular.forEach($scope.openBases, function (base) {
                    if (base.base_num == baseNum) {
                        open = true;
                    }
                });
            }

            if (open) {
                var cssClass = 'center';
                if ($window.innerWidth < 500) {
                    cssClass = 'mobile';
                }
                
                $scope.modalOptions = {
                    title: 'Confirm reservation',
                    message: 'Please confirm you want to reserve base ' + baseNum,
                    yesBtn: 'Reserve',
                    noBtn: 'Cancel',
                    cssClass: cssClass,
                    onYes: function(formData) {

                        // calculate when this call expires. this is based on a lot of factors, including the configured cleanup time allowed, free for all
                        // time allowed, and whether the reservation time crosses the end of the war
                        var expireDate = null;
                        

                        if (now.getTime() >= freeForAllDate.getTime()) {
                            // already passed the free for all time
                            expireDate = null;
                        }

                        else if (possibleExpireDate.getTime() >= warEnd) {
                            // possible expire date is already greater than war end
                            expireDate = warEnd;
                        }
                        else {
                            expireDate = possibleExpireDate;
                        }

                        $scope.war.bases[baseNum].a.push(
                            {
                                u: authService.user.id,
                                i: $scope.meta.ign,
                                c: new Date(),
                                e: expireDate,
                                s: null,                                
                            }  
                        );

                        warService.save($scope.war, function (err, war) {
                            if (err) {
                                err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.reserveBase', message: 'Error setting stars' } );
                                errorService.save(err, function() {});
                            }
                            else {
                                $scope.war = war;
                                refreshInterface();
                            }
                        });
                    }
                };

                var modalInstance = $modal(
                    {
                        scope: $scope,
                        animation: 'am-fade-and-slide-top',
                        placement: 'center',
                        template: "/views/partials/confirmDialog.html",
                        show: false
                    }
                );

                modalInstance.$promise.then(function() {
                    modalInstance.show();
                });        
            }
            else {
                // notify user that the base is now reserved somehow
                var cssClass = 'center';
                if ($window.innerWidth < 500) {
                    cssClass = 'mobile';
                }
                
                $scope.modalOptions = {
                    title: 'Base is reserved',
                    message: 'Base ' + baseNum + ' was just reserved a few seconds ago by ' + $scope.war.bases[baseNum].a[$scope.war.bases[baseNum].a.length-1].i,
                    cssClass: cssClass
                };

                var modalInstance = $modal(
                    {
                        scope: $scope,
                        animation: 'am-fade-and-slide-top',
                        placement: 'center',
                        template: "/views/partials/notifyDialog.html",
                        show: false
                    }
                );

                modalInstance.$promise.then(function() {
                    modalInstance.show();
                }); 
            }
        });
    }

    function loadClanMessages() {
        messagelogService.get($scope.meta.current_clan.clan_id, 40, function (err, messages) {
            if (err) {
                err.stack_trace.unshift( { file: 'home-controller.js', func: 'loadClanMessages', message: 'Error getting message log' } );
                errorService.save(err, function() {});
            }
            else {
                angular.forEach(messages, function (message) {
                    message.created_at = new moment(message.created_at);
                    message.message = message.message.replace('[ign]', '<b class="emphasis">' + message.ign + '</b>');
                });
                $scope.clanMessages = messages;
            }
        });        
    }

    function loadWar(callback) {
        warService.getActive($scope.meta.current_clan.clan_id, function (err, war) {
            if (err) {
                err.stack_trace.unshift( { file: 'home-controller.js', func: 'loadWar', message: 'Error getting current war' } );
                errorService.save(err, function() {});
                callback();
            }
            else {
                if (war) {
                    $scope.war = war;
                    refreshInterface();
                    callback();                    
                }
                else {
                    callback();
                }
            }
        });
    }

    function refreshInterface() {
        var now = new Date();
        var start = new Date($scope.war.start);
        if (start.getTime() <= now.getTime()) {
            // war has started, set the end time to +24 hours from start
            $scope.warStartTime = start.getTime() + 24*60*60*1000;
            $scope.warStarted = true;
        }   
        else {
            $scope.warStartTime = start.getTime(); 
            $scope.warStarted = false;
        }
        $scope.$broadcast('timer-start'); 

        $scope.playerTargets = [];
        angular.forEach($scope.war.bases, function (base) {
            angular.forEach(base.a, function (assignment) {
                if (assignment.u == authService.user.id) {
                    // if we've passed free for all time there is no expiration
                    var expires = 0;
                    if (assignment.e != null) {
                        var expireTime = new Date(assignment.e);
                        expires = expireTime.getTime();
                    }
                    $scope.playerTargets.push(
                        {
                            base_num: base.b,
                            stars: assignment.s,
                            expires: expires,
                            hours: 0,
                            minutes: 0
                        }
                    );
                }
            })
        });

        // set countdown for targets, and set it to refresh every 30 seconds 
        if ($scope.playerTargets.length > 0) {
            setCountdownTimers();
            var promise = $interval(setCountdownTimers, 30000);
            $scope.$on('$destroy', function() {
                $interval.cancel(promise);
            });
        }
        findOpenTargets();
    }

    function setCountdownTimers() {
        var now = new Date();
        angular.forEach($scope.playerTargets, function (target) {
            if (target.expires > 0) {
                var minutesLeft = parseInt((target.expires - now.getTime())/1000/60);
                target.hours = parseInt(minutesLeft / 60);
                target.minutes = parseInt(minutesLeft % 60);
            }
        });
    }

    /*
    *   Using a combination of clan settings and current assignments, determine which bases are open
    */
    function findOpenTargets() {
        $scope.openBases = [];

        var now = new Date();
        var warStart = new Date($scope.war.start);
        var freeForAllDate = new Date(warStart.getTime() + ((24 - $scope.clan.war_config.free_for_all_time)*60*60*1000));

        angular.forEach($scope.war.bases, function (base) {
            var open = false;
            // clan allows first assignments to be open
            if ($scope.clan.war_config.first_assignment == 'all') {
                if (base.a.length == 0) {
                    // no assignments yet
                    open = true;
                }
            }

            // clan allows cleanups to be open
            if ($scope.clan.war_config.cleanup_assignment == 'all') {
                if (base.a.length > 0
                    && base.a[base.a.length-1].s != null
                    && base.a[base.a.length-1].s != 3)  {
                    // there has been at least one attack, and the latest attack has been done
                    // without getting 3 stars
                    open = true;
                }

                else if (base.a.length > 0) {
                    // check for expired assignments
                    //var now2 = new Date();
                    var expireDate = new Date(base.a[base.a.length-1]);
                    var minutesLeft = parseInt((expireDate - now.getTime())/1000/60);
                    if (minutesLeft <= 0) {
                        // call is expired
                        open = true;
                    }
                }
            }

            // if we're in the free-for-all period, all bases not 3-starred should be open
            if (now.getTime() >= freeForAllDate.getTime()) {
                open = true;
            }

            if (open) {
                // make sure the user hasn't already attacked the target, and figure out max stars so far
                var alreadyAttacked = false;
                var maxStars = 0;
                angular.forEach(base.a, function (assignment) {
                    if (assignment.u == authService.user.id) {
                        alreadyAttacked = true;
                    }

                    if (assignment.s > maxStars) {
                        maxStars = assignment.s;
                    }
                });

                if (!alreadyAttacked && maxStars < 3) {
                    $scope.openBases.push( 
                        {
                            th: base.t,
                            base_num: base.b,
                            stars: maxStars
                        }
                    );
                }
            }
        });
    }

}]);