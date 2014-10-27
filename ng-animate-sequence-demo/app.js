angular.module("MyApp", ['ngRoute', 'ngAnimateLayout'])
  .config(function($routeProvider) {
    $routeProvider.when('/', {
      controller: 'HomeCtrl as home',
      templateUrl : './home.html?3322d22a21'
    })
    $routeProvider.when('/users', {
      controller: 'UsersCtrl as users',
      templateUrl : './users.html?14x3aa2xs2'
    })
  })
  .controller("HomeCtrl", ["$scope", function($scope) {
    //...
  }])
  .controller("UsersCtrl", ["$scope", function($scope) {
    var entries = this.entries = [];
    for(var i=1;i<20;i++) {
      entries.push(i);
    }
  }])
  .filter('reverse', function() {
    return function(nodes) {
      var elements = [];
      for(var i=-1,l=nodes.length;++i!==l;elements[i]=nodes[i]);
      elements.reverse();
      return elements;
    }
  });
