'use strict';

var $TimelineRegistry = [function() {
  var lookup = {};
  return {
    register : function(name, ctrl) {
      lookup[name] = ctrl;
    },
    lookup : function(names) {
      var results = [];

      names = isArray(names) ? names : names.split(' ');
      angular.forEach(names, function(name) {
        if (lookup[name]) {
          results.push(lookup[name]);
        }
      });

      return results;
    }
  };
}];
