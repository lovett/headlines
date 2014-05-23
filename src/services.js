var appServices = angular.module('appServices', ['ngResource']);

appServices.factory('List', ['$resource', function ($resource) {
    return $resource('/list/:name', {name: '@name', page: '@page', terms: '@terms'}, {
        get:  {
            method: 'GET'
        },
        update: {
            method: 'POST'
        }
    });
}]);
