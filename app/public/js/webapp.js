

angular.module('Clashtools.controllers', []);
angular.module('Clashtools.services', []);
angular.module('Clashtools.directives', []);

angular.module('Clashtools', ['ngRoute', 'ngCookies', 'ngAnimate', 'ngSanitize', 'Clashtools.controllers', 'Clashtools.services', 'Clashtools.directives', 'angular-md5', 'angularMoment', 'webStorageService', 'mgcrea.ngStrap', 'ui.bootstrap.dropdown', 'ui.bootstrap.buttons', 'ui.bootstrap.accordion', 'ui.bootstrap.collapse', 'ui.bootstrap.transition', 'ui.bootstrap.typeahead', 'ui.bootstrap.popover', 'ngTagsInput', 'ngFileUpload', 'timer', 'btford.socket-io', 'xeditable'])
.config(function ($locationProvider, $routeProvider, $httpProvider) {

    $locationProvider.html5Mode(true);

    var access = roleConfig.accessLevels;

    $routeProvider
        .when('/', { controller: 'DefaultCtrl', templateUrl: '/views/default.html', access: access.public } )
        .when('/help/:id', { controller: 'HelpCtrl', templateUrl: '/views/help.html', access: access.public } )
        .when('/register', { controller: 'RegisterCtrl', templateUrl: '/views/register.html', access: access.public } )
        .when('/login', { controller: 'LoginCtrl', templateUrl: '/views/login.html', access: access.public } )
        .when('/logout', { controller: 'LogoutCtrl', templateUrl: '/views/login.html', access: access.public } )
        .when('/verify/:id', { controller: 'EmailVerifyCtrl', templateUrl: '/views/emailVerify.html', access: access.public } )
        .when('/pwreset/:id', { controller: 'PWResetCtrl', templateUrl: '/views/pwreset.html', access: access.public } )
        .when('/sept', { controller: 'SeptCtrl', templateUrl: '/views/sept.html', access: access.public } )
        .when('/home', { controller: 'HomeCtrl', templateUrl: '/views/home.html', access: access.member } )
        .when('/profile', { controller: 'ProfileCtrl', templateUrl: '/views/profile.html', access: access.member } )
        .when('/results', { controller: 'ResultsCtrl', templateUrl: '/views/results.html', access: access.member } )
        .when('/results/:id', { controller: 'ResultsCtrl', templateUrl: '/views/results.html', access: access.coleader } )
        .when('/playernotes/:id', { controller: 'PlayerNotesCtrl', templateUrl: '/views/playerNotes.html', access: access.coleader } )
        .when('/mail', { controller: 'MailCtrl', templateUrl: '/views/mail.html', access: access.member } )
        .when('/mail/:id', { controller: 'MailDetailCtrl', templateUrl: '/views/mailDetail.html', access: access.member } )
        .when('/newmail/:id', { controller: 'NewMailCtrl', templateUrl: '/views/newMail.html', access: access.member } )
        .when('/clan/:id', { controller: 'ClanCtrl', templateUrl: '/views/clan.html', access: access.member } )
        .when('/clans/:query', { controller: 'ClansCtrl', templateUrl: '/views/clans.html', access: access.member } )
        .when('/startwar/:id', { controller: 'StartWarCtrl', templateUrl: '/views/startWar.html', access: access.coleader } )
        .when('/war', { controller: 'WarsCtrl', templateUrl: '/views/wars.html', access: access.member } )
        .when('/war/:id', { controller: 'WarCtrl', templateUrl: '/views/war.html', access: access.member } )
        .when('/war/team/:id', { controller: 'WarTeamCtrl', templateUrl: '/views/warTeam.html', access: access.member } )
        .when('/war/summary/:id', { controller: 'WarSummaryCtrl', templateUrl: '/views/warSummary.html', access: access.member } )
        .when('/war/end/:id', { controller: 'WarEndCtrl', templateUrl: '/views/warEnd.html', access: access.coleader } )
        .when('/war/notes/:id/:baseNum', { controller: 'BaseNotesCtrl', templateUrl: '/views/baseNotes.html', access: access.member } )
        .when('/members', { controller: 'MembersCtrl', templateUrl: '/views/members.html', access: access.member } )
        .when('/members/:id', { controller: 'MemberCtrl', templateUrl: '/views/profile.html', access: access.coleader } )
        .when('/roster', { controller: 'RosterCtrl', templateUrl: '/views/roster.html', access: access.coleader } )
        .when('/banlist', { controller: 'BannedCtrl', templateUrl: '/views/banned.html', access: access.elder } )
        .when('/arranged', { controller: 'ArrangedCtrl', templateUrl: '/views/arranged.html', access: access.coleader } )
        .when('/arranged/:id', { controller: 'ArrangedDetailCtrl', templateUrl: '/views/arrangedDetail.html', access: access.coleader } )
        .when('/chat', { controller: 'ChatCtrl', templateUrl: '/views/chat.html', access: access.member } )
        .when('/action/:id', { controller: 'ActionCtrl', templateUrl: '/views/action.html', access: access.member } )
        .when('/admin', { controller: 'AdminHomeCtrl', templateUrl: '/views/admin/admin-home.html', access: access.sadmin } )
        .when('/admin/clan/:id', { controller: 'AdminClanCtrl', templateUrl: '/views/admin/admin-clan.html', access: access.sadmin } )
        .when('/admin/bounce', { controller: 'AdminBounceCtrl', templateUrl: '/views/admin/admin-bounce.html', access: access.sadmin } )
/*        .when('/messages', { controller: 'MessagesCtrl', templateUrl: '/views/messages.html', access: access.user } )
        .when('/admin', { controller: 'AdminCtrl', templateUrl: '/views/admin/home.html', access: access.sadmin } )
        .when('/admin/unspoof', { controller: 'AdminCtrl', templateUrl: '/views/admin/home.html', access: access.admin } )
        .when('/form/:id', { controller: 'FormCtrl', templateUrl: '/views/form.html', access: access.public } )*/
        .when('/404', { templateUrl: '/views/404.html' } )
        .otherwise({ redirectTo: '/404'} );

        var interceptor = ['$location', '$q', function($location, $q) {
            function success(response) {
                return response;
            }

            function error(response) {

                if(response.status === 401) {
                    $location.path('/login');
                    return $q.reject(response);
                }
                else {
                    return $q.reject(response);
                }
            }

            return function(promise) {
                return promise.then(success, error);
            }
        }];

        $httpProvider.responseInterceptors.push(interceptor);
})

.run(function ($rootScope, $location, $http, authService, sessionService, cacheService, editableOptions) {
    //editableOptions.theme = 'bs3';

    // on a manual page reload we need to re-boot Intercom
    if (authService.isLoggedIn() && !$rootScope.isSpoofing) {
        sessionService.getUserMeta(authService.user.id, function (err, meta) {
            var dt = new Date(meta.created_at);

            Intercom("boot", {
                app_id: "gxb1pj9u",
                email: meta.email_address,
                created_at: parseInt(dt.getTime()/1000),
                name: meta.ign,
                user_id: authService.user.id,
                widget: {
                    activator: "#IntercomDefaultWidget"
                },
                clan: meta.current_clan.name ? meta.current_clan.name : 'none',
                role: meta.role
            });
        });
    }

    $rootScope.$on("$routeChangeStart", function (event, next, current) {
        if (!next.access || !authService.authorize(next.access.title)) {
            if(authService.isLoggedIn()) {
                $location.path('/home');
            }
            else {
                $location.path('/login');
            }
        }
        else if (authService.isLoggedIn()) {
            Intercom('trackEvent', 'page-view', { "path": next.$$route.originalPath });
        }
    });
})

.constant('CLAN_EMAILS',
    {
        joinRequest: 'There has just been a request to join the clan from <b>[1]</b>. Please confirm or decline the request by selecting from below:<br/><br/><a href="/action/confirm?id=[2]" class="btn btn-sm btn-emphasis">Confirm</a> <a href="/action/decline?id=[2]" class="btn btn-sm btn-alternate">Decline</a>',
        joinConfirmed: 'Your request to join the clan <b>[1]</b> has been approved by <b>[2]</b>. Refresh your browser if you don\'t see the clan name under your user name',
        joinDeclined: 'Your request to join the clan <b>[1]</b> has been declined',
        kicked: 'You have been kicked out of the clan by <b>[1]</b>',
        arranged: 'There has been a request to start an arranged war with <b>[1]</b>. The match has been created and can be found in the <a href="/arranged">arranged war list</a>. If you don\'t want an arranged war with this clan, you can simply ignore the request and delete it from your arranged war list.',
        arrangedRemove: 'The arranged match between <b>[1]</b> has been deleted by <b>[2]</b>'
    }
)
.constant('INTERCOM',
    {
        key: 'gxb1pj9u'
    }
);
