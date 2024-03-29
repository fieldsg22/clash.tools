'use strict';

/*
*   Controller for the home page of the application
*/

angular.module('Clashtools.controllers')
.controller('HomeCtrl', ['$rootScope', '$scope', '$window', '$interval', '$modal', 'moment', 'ctSocket', 'authService', 'userService', 'sessionService', 'errorService', 'messagelogService', 'warService', 'clanService', 'trackService',
function ($rootScope, $scope, $window, $interval, $modal, moment, ctSocket, authService, userService, sessionService, errorService, messagelogService, warService, clanService, trackService) {
    // initialize
    $rootScope.title = 'Dashboard - clash.tools';

    $scope.nullState = true;

    sessionService.getUserMeta(authService.user.id, function (err, meta) {
        $scope.meta = meta;
        if ($scope.meta.current_clan.clan_id) {
            $scope.nullState = false;

            // load clan messages initially, and every 60 seconds after that
            loadClanMessages();

            // and after that any time a change is broadcast by socket.io
            ctSocket.on('messagelog:' + $scope.meta.current_clan.clan_id + ':change', function (data) {
                loadClanMessages();
            });

            // set countdown for heroes, and set it to refresh every 15 minutes
            setHeroTimers();
            var promise = $interval(setHeroTimers, 900000);
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
                    // load war initially
                    loadWar(function() {
                        // and after that any time a change is broadcast by socket.io (if there is a war active)
                        if($scope.war) {
                            ctSocket.on('war:' + $scope.war._id + ':change', function (data) {
                                loadWar(function(){});
                            });
                        }
                    });

                    // also watch for a new save because the visible state change needs a war refresh for members and elders
                    ctSocket.on('clan:' + $scope.meta.current_clan.clan_id + ':warchange', function (data) {
                        // in this case the war object is passed back so we don't to re-load it
                        $scope.war = data;
                        refreshInterface();
                    });
                }
            });
        }
    });

    sessionService.getUserSession(authService.user.id, function (err, session) {
        if (!session.ui_flags.fundraiser_2) {
            session.ui_flags.fundraiser_2 = 'on';
        }
        $scope.userSession = session;
    });

    $scope.dismissUIBit = function(bit, value) {
        $scope.userSession.ui_flags[bit] = value;
        sessionService.saveUserSession(authService.user.id, $scope.userSession, function (err, result) {

        });
    }

    $scope.changeStars = function(targetNum, baseNum, numStars) {
        var assignmentIndex = -1;
        var playerIndex = -1;
        for (var idx=0; idx<$scope.war.bases[baseNum-1].a.length; idx++) {
            if ($scope.war.bases[baseNum-1].a[idx].u == authService.user.id) {
                assignmentIndex = idx;
                break;
            }
        }

        for (var idx=0; idx<$scope.war.team.length; idx++) {
            if ($scope.war.team[idx].u == authService.user.id) {
                playerIndex = idx;
            }
        }

        var endDate = new Date($scope.war.start);
        endDate = new Date(endDate.getTime() + 24*60*60*1000);

        // much of this meta data is for the attack history collection
        var update = {
            aIndex: assignmentIndex,
            bIndex: baseNum-1,
            pIndex: playerIndex,
            stars: numStars,
            c: $scope.meta.current_clan.clan_id,
            u: authService.user.id,
            i: $scope.meta.ign,
            cn: $scope.meta.current_clan.name,
            on: $scope.war.opponent_name,
            t: $scope.war.team[playerIndex].t,
            ot: parseInt($scope.war.bases[baseNum-1].t),
            we: endDate
        };

        // update the UI immediately in case this call takes a long time. And even if it fails this prevents
        // people from spamming the app with updates when things are broken
        $scope.war.bases[baseNum-1].a[assignmentIndex].s = numStars;

        warService.updateStars($scope.war._id, update, function (err, result) {
            if (err) {
                err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.changeStars', message: 'Error updating stars' } );
                errorService.save(err, function() {});
            }
            else {
                // Log this activity
                var starsText = 'stars';
                if (numStars == 1) {
                    starsText = 'star';
                }
                messagelogService.save($scope.meta.current_clan.clan_id, '[ign] attacked base ' + (baseNum) + ' for ' + numStars + ' ' + starsText, $scope.meta.ign, 'attack', function (err, msg) {
                    if (err) {
                        err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.changeStars', message: 'Error saving attack message in the log' } );
                        errorService.save(err, function() {});
                    }
                    else {
                    }
                });

                $rootScope.globalMessage = 'Your attack on base #' + baseNum + ' for ' + numStars + ' ' + starsText + ' has been recorded.'
                refreshInterface();
            }
        });
    }

    $scope.reserveBase = function(baseNum) {
        // first double-check that someone else hasn't reserved the target - load war and verify to reduce
        // the changes that two people sign up for the same target
        loadWar(function() {

            var now = new Date();
            var warStart = new Date($scope.war.start);
            var freeForAllDate = new Date(warStart.getTime() + ((24 - $scope.clan.war_config.free_for_all_time)*60*60*1000));

            // determine if the base is still open
            var open = false;

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
                        var expireDate = warService.callExpiration($scope.war, $scope.clan.war_config, baseNum);
                        var model =
                        {
                            bIndex: baseNum-1,
                            assignment: {
                                u: authService.user.id,
                                i: $scope.meta.ign,
                                c: new Date(),
                                e: expireDate,
                                s: null
                            }
                        }

                        // update UI so the user gets the feedback, even if the save fails
                        $scope.war.bases[baseNum-1].a.push(model.assignment);

                        warService.assignBase($scope.war._id, model, function (err, result) {
                            if (err) {
                                err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.reserveBase', message: 'Error reserving base' } );
                                errorService.save(err, function() {});
                            }
                            else {
                                messagelogService.save($scope.meta.current_clan.clan_id, '[ign] called base ' + baseNum, $scope.meta.ign, 'target', function (err, msg) {
                                    if (err) {
                                        err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.reserveBase', message: 'Error saving reservation message in the log' } );
                                        errorService.save(err, function() {});
                                    }
                                    else {
                                    }
                                });

                                trackService.track('reserved-target', { "view": "home"} );
                                $rootScope.globalMessage = 'Your call on base #' + baseNum + ' has been saved.';

                                // do this after the assignment - will ensure that if a double assign happens the UI will fix itself
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
                    message: 'Base ' + (baseNum+1) + ' was just reserved a few seconds ago by ' + $scope.war.bases[baseNum].a[$scope.war.bases[baseNum].a.length-1].i,
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

    $scope.deleteCall = function(targetNum, baseNum) {
        // delete works differently because removing an item from an array in
        // MongoDb requires a value (in this case, userId)

        var assignmentIndex = -1;

        for (var idx=0; idx<$scope.war.bases[baseNum-1].a.length; idx++) {
            if ($scope.war.bases[baseNum-1].a[idx].u == authService.user.id) {
                assignmentIndex = idx;
            }
        }

        var update = {
            u: authService.user.id,
            bIndex: baseNum - 1,
            stars: -1
        };

        // update UI regardless of whether the save works to avoid spamming with updates
        $scope.war.bases[baseNum-1].a.splice(assignmentIndex, 1);

        warService.updateStars($scope.war._id, update, function (err, result) {
            if (err) {
                err.stack_trace.unshift( { file: 'war-controller.js', func: '$scope.deleteCall', message: 'Error deleting call' } );
                errorService.save(err, function() {});
            }
            else {
                messagelogService.save($scope.meta.current_clan.clan_id, '[ign] removed call on base ' + baseNum, $scope.meta.ign, 'delete', function (err, msg) {
                    if (err) {
                        err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.deleteCall', message: 'Error saving delete call message in the log' } );
                        errorService.save(err, function() {});
                    }
                    else {
                        // nothing
                    }
                });

                $rootScope.globalMessage = 'Your call on base #' + baseNum + ' has been removed.';

                refreshInterface();
            }
        });

    }

    $scope.leaveClan = function() {
        if ($scope.meta.role == 'leader') {
            // if the leader is trying to leave, there are two possibilities:
            //      1. The clan has more members and they need to assign leadership
            //      2. They are the last one in the clan and should get the "clan will be deleted" warning
            clanService.getMembers($scope.meta.current_clan.clan_id, 'all', function (err, members) {
                if (err) {
                    err.stack_trace.unshift( { file: 'war-controller.js', func: '$scope.leaveClan', message: 'Error getting clan members' } );
                    errorService.save(err, function() {});
                }
                else {
                    if (members.length > 1) {
                        // This clan has more members - this person needs to assign leadership before leaving
                        var cssClass = 'center';
                        if ($window.innerWidth < 500) {
                            cssClass = 'mobile';
                        }

                        $scope.modalOptions = {
                            title: 'Promote someone else to leader before you leave the clan',
                            message: 'Every clan needs a leader! Before you leave, promote another member to leader through the members page.',
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
                    else {
                        // leader is the last member of the clan. Let them leave, but verify first and delete the clan
                        var cssClass = 'center';
                        if ($window.innerWidth < 500) {
                            cssClass = 'mobile';
                        }

                        $scope.modalOptions = {
                            yesBtn: 'Leave',
                            noBtn: 'Cancel',
                            modalOptions: {

                            },
                            cssClass: cssClass,
                            onYes: function() {
                                clanService.deleteClan($scope.meta.current_clan.clan_id, function (err, result) {
                                    if (err) {
                                        err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.leaveClan', message: 'Error deleting clan' } );
                                        errorService.save(err, function() {});
                                    }
                                    else {
                                        $rootScope.globalMessage = 'Clan ' + $scope.meta.current_clan.name + ' was deleted.';
                                        trackService.track('left-clan');
                                        trackService.track('deleted-clan', { clan: $scope.meta.current_clan.name });

                                        // clear meta data so the clan gets refreshed
                                        sessionService.clearUserMeta();
                                        $window.location.reload();
                                    }
                                });

                            }
                        };

                        var modalInstance = $modal(
                            {
                                scope: $scope,
                                animation: 'am-fade-and-slide-top',
                                placement: 'center',
                                template: "/views/partials/deleteClanDialog.html",
                                show: false
                            }
                        );

                        modalInstance.$promise.then(function() {
                            modalInstance.show();
                        });
                    }
                }
            });
        }

        else {
            var cssClass = 'center';
            if ($window.innerWidth < 500) {
                cssClass = 'mobile';
            }

            $scope.modalOptions = {
                title: 'Leave clan?',
                message: 'Please confirm you want to leave the clan "' + $scope.meta.current_clan.name + '"',
                yesBtn: 'Leave',
                noBtn: 'Cancel',
                cssClass: cssClass,
                onYes: function() {
                    userService.updateClan(authService.user.id, {}, function (err, m) {
                        if (err) {
                            err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.leaveClan', message: 'Error leaving clan' } );
                            errorService.save(err, function() {});
                        }
                        else {
                            messagelogService.save($scope.meta.current_clan.clan_id, '[ign] left the clan', $scope.meta.ign, 'member', function (err, msg) {
                                if (err) {
                                    err.stack_trace.unshift( { file: 'home-controller.js', func: '$scope.leaveClan', message: 'Error saving left clan message' } );
                                    errorService.save(err, function() {});
                                }
                                else {
                                    // nothing to do
                                }
                            });

                            // clear meta data so the clan gets refreshed
                            sessionService.clearUserMeta();
                            trackService.track('left-clan');
                            $window.location.reload();
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
        warService.getActive($scope.meta.current_clan.clan_id, $scope.meta.role, function (err, war) {
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
                    $scope.war = null;
                    //refreshInterface();
                    callback();
                }
            }
        });
    }

    function refreshInterface() {
        var now = new Date();
        var start = new Date($scope.war.start);
        var warEnd = new Date(start.getTime() + (24*60*60*1000));
        var freeForAllDate = new Date(start.getTime() + ((24 - $scope.clan.war_config.free_for_all_time)*60*60*1000));

        if (start.getTime() <= now.getTime()) {
            // war has started, set the end time to +24 hours from start
            $scope.warStartTime = start.getTime() + 24*60*60*1000;
            $scope.warStarted = true;
        }
        else {
            $scope.warStartTime = start.getTime();
            $scope.warStarted = false;
        }

        $scope.warEnded = false;
        if (warEnd.getTime() <= now.getTime()) {
            $scope.warEnded = true;
        }

        $scope.$broadcast('timer-start');


        // make sure this person is in the war
        $scope.isInWar = false;
        angular.forEach($scope.war.team, function (member) {
            if (member.u == authService.user.id) {
                $scope.isInWar = true;
            }
        });

        $scope.playerTargets = [];

        if ($scope.isInWar) {
            angular.forEach($scope.war.bases, function (base) {
                angular.forEach(base.a, function (assignment) {
                    if (assignment.u == authService.user.id) {
                        // if we've passed free for all time there is no expiration
                        var expires = 0;
                        if (assignment.e != null) {
                            var expireTime = new Date(assignment.e);
                            expires = expireTime.getTime();

                            if (now > freeForAllDate) {
                                expires = 0;
                            }
                        }
                        $scope.playerTargets.push(
                            {
                                base_num: base.b,
                                stars: assignment.s,
                                expires: expires,
                                hours: 0,
                                minutes: 0,
                                label: base.l || '',
                                tags: base.tags || []
                            }
                        );
                    }
                })
            });

            // set countdown for targets, and set it to refresh every 30 seconds
            setCountdownTimers();
            var promise = $interval(setCountdownTimers, 30000);
            $scope.$on('$destroy', function() {
                $interval.cancel(promise);
            });
            findOpenTargets();
        }
    }

    function setCountdownTimers() {
        var now = new Date();

        // Targets
        angular.forEach($scope.playerTargets, function (target) {
            if (target.expires > 0) {
                var minutesLeft = parseInt((target.expires - now.getTime())/1000/60);
                target.hours = parseInt(minutesLeft / 60);
                target.minutes = parseInt(minutesLeft % 60);

                if (minutesLeft < 0) {
                    //expired!
                    target.expires = -target.expires;
                }
            }
        });
    }

    function setHeroTimers() {
        var now = new Date();

        var bkFinishTime = new Date($scope.meta.bkUpgrade);
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

        var aqFinishTime = new Date($scope.meta.aqUpgrade);
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

        var gwFinishTime = new Date($scope.meta.gwUpgrade);
        gwFinishTime = gwFinishTime.getTime();

        if (gwFinishTime > now.getTime()) {
            var hoursLeft = parseInt((gwFinishTime - now.getTime())/1000/60/60);
            $scope.gwDays = parseInt(hoursLeft / 24);
            $scope.gwHours = parseInt(hoursLeft % 24);
        }
        else {
            $scope.gwDays = 0;
            $scope.gwHours = 0;
        }
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
                    var expireDate = new Date(base.a[base.a.length-1].e);
                    var minutesLeft = parseInt((expireDate.getTime() - now.getTime())/1000/60);
                    if (minutesLeft <= 0) {
                        // call is expired
                        open = true;
                    }
                }
                else if ($scope.warStarted && base.a.length == 0) {
                    // war has started and this base is uncalled
                    open = true;
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
                            stars: maxStars,
                            tags: base.tags || []
                        }
                    );
                }
            }
        });
    }

}]);