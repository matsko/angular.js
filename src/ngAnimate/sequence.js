angular.module('ngAnimateSequence', ['ngAnimate'])

  .factory('$$animateDriver', ['$q', '$animate', '$rootScope',
                       function($q,   $animate,   $rootScope) {
    return function() {
      var driver = {};
      driver.initialize = angular.noop;

      var operations = [];
      var methods = 'enter,leave,move,addClass,removeClass,setClass'.split(',');
      angular.forEach(methods, function(method) {
        driver[method] = function() {
          var args = arguments;
          operations.push(function() {
            return $animate[method].apply($animate, args);
          });
        }
      });

      driver.start = function(fn) {
        next().then(fn);
      };

      var chain, index = 0;
      function next() {
        chain = operations[index++]().then(function() {
          return index < operations.length && next();
        });
        !$rootScope.$$phase && $rootScope.$digest();
        return chain;
      }
      
      return driver;
    };
  }])

  .factory('$animateQueue', ['$q', '$$animateDriver', function($q, $$animateDriver) {
    return function(driverFactory) {
      var driver = driverFactory ? driverFactory() : $$animateDriver();
      var operations = [];
      
      angular.forEach(driver, function(fn, method) {
        animate[method] = function() {
          var definitionArgs = arguments;
          operations.push(function(startArgs) {
            var args = substituteOptions(definitionArgs, startArgs);
            return fn.apply(driver, args);
          });
          return animate;
        }
      });

      return animate;
      
      function animate() {
        //now run each of the step methods from the driver
        var params = arguments;
        for(var i=0;i<operations.length;i++) {
          operations[i](params);
        }

        (driver.initialize || angular.noop)(arguments);
        return {
          start : function() {
            var defer = $q.defer();
            driver.start(function(failed) {
              failed ? defer.reject() : defer.resolve();
            });
            return defer.promise;
          } 
        };
      }

    }

    function substituteOptions(params, elements) {
      var args = [];
      angular.forEach(params, function(arg, i) {
        if (angular.isString(arg) && arg.charAt(0) == '%') {
          var ii = parseInt(arg.substr(1), 10);
          args[i] = elements[ii];
        } else {
          args[i] = params[i];
        }
      });
      return args;
    }
  }])

  .factory('$animateSequence', ['$$q', function($$q) {
    return function(animations) {
      var operations = [];
      angular.forEach(animations, function(seq, ii) {
        operations.push(function() {
          seq = angular.isArray(seq) ? seq : [seq];

          var promises = [];
          angular.forEach(seq, function(s) {
            promises.push(s.start());
          });
          return $$q.all(promises);
        });
      });

      var chain, index = 0;
      function next() {
        chain = operations[index++]().then(function() {
          return index < operations.length && next();
        });
        return chain;
      }

      return function() {
        return {
          start: next
        };
      };
    };
  }]);
