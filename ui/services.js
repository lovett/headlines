var appServices = angular.module('appServices', ['ngResource']);

appServices.factory('List', ['$resource', function ($resource) {
    'use strict';
    return $resource('/list/:name/:segment', {count: '@count', page: '@page', terms: '@terms'}, {
        export: {
            method: 'GET',
            headers: {
                'Accept': 'text/xml'
            },
            isArray: false,
            transformResponse: function (data) {
                return {
                    xml: data
                };
            }
        },
        get:  {
            method: 'GET'
        },
        update: {
            method: 'POST'
        }
    });
}]);

appServices.factory('Feed', ['$resource', function ($resource) {
    'use strict';
    return $resource('/feed/:id', {id: '@id'});
}]);


appServices.factory('SignupService', ['$resource', function ($resource) {
    'use strict';
    return $resource('/signup', {});
}]);

appServices.factory('AuthService', ['$resource', function ($resource) {
    'use strict';
    return $resource('/authenticate', {}, {
        'login': {
            method: 'POST',
        },
        'logout': {
            method: 'POST',
        }
    });
}]);

appServices.factory('UserService', [function () {
    'use strict';

    return {
        loggedIn: false,

        getToken: function () {
            if (sessionStorage.token) {
                this.loggedIn = true;
                return sessionStorage.token;
            } else if (localStorage.token) {
                this.loggedIn = true;
                return localStorage.token;
            }
        },

        setToken: function (value, persist) {
            this.loggedIn = true;
            if (persist === true) {
                localStorage.token = value;
            } else {
                sessionStorage.token = value;
            }

        },

        forgetToken: function () {
            this.loggedIn = false;
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
        }
    };
}]);

appServices.factory('HttpInterceptService', ['$q', '$location', 'UserService', function ($q, $location, UserService) {
    'use strict';
    var interceptor = {
        'request': function (config) {
            config.headers['X-Auth'] = UserService.getToken();
            return config;
        },
        'responseError': function (response) {
            if (response.status === 401) {
                $location.path('/login');
            }
            return $q.reject(response);
        }

    };
    return interceptor;
}]);

appServices.factory('Reader', ['$window', '$q', function ($window, $q) {
    'use strict';
    return {
        readXML: function (fileList) {
            var deferred = $q.defer();

            var reader = new $window.FileReader();

            angular.forEach(fileList, function (file) {
                if (file.type !== 'text/xml') {
                    return;
                }

                reader.onloadend = function () {
                    var parser = new $window.DOMParser();
                    var dom = parser.parseFromString(reader.result, file.type);
                    deferred.resolve(dom);
                };
                reader.readAsText(file);
            });

            return deferred.promise;
        }
    };
}]);