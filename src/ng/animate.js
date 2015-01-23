'use strict';

var $animateMinErr = minErr('$animate');

function $NoopAnimationDriverProvider() {
  this.$get = ['$animateRunner', function($animateRunner) {
    return $animateRunner({});
  }];
}

function $AnimateRunnerProvider() {
  this.$get = [function() {
    return function(obj, driver) {
      driver = driver || {}
      obj.next     = driver.next     || noop;
      obj.end      = driver.end      || noop;
      obj.pause    = driver.pause    || noop;
      obj.resume   = driver.resume   || noop;
      obj.cancel   = driver.cancel   || noop;
      obj.progress = driver.progress || noop;
      return obj;
    };
  }];
}

var $AnimateProvider = ['$provide', function($provide) {
  this.drivers = [];
  this.drivers.push('$noopAnimationDriver');

  this.$$selectors = [];
  this.register = function(name, factory) {
    var key = name + '-animation';
    if (name && name.charAt(0) != '.') throw $animateMinErr('notcsel',
        "Expecting class selector starting with '.' got '{0}'.", name);
    this.$$selectors[name.substr(1)] = key;
    $provide.factory(key, factory);
  };

  this.$get = ['$animateQueue', function($animateQueue) {
    return {
      enter : function(element, parent, after, options) {
        return $animateQueue.push(element,
          ['enter', 'ng-enter', null, options, insert]);

        function insert() {
          after ? after.after(element) : parent.append(element);
        }
      },

      move : function(element, parent, after, options) {
        return $animateQueue.push(element,
          ['move', 'ng-move', null, options, move]);

        function move() {
          after ? after.after(element) : parent.append(element);
        }
      },

      leave : function(element, options) {
        return $animateQueue.push(element,
          ['leave', 'ng-leave', null, options, remove]);

        function remove() {
          element.remove();
        }
      },

      addClass : function(element, className, options) {
        return $animateQueue.push(element,
          ['addClass', className, null, options, addClass]);

        function addClass() {
          $$jqLite.addClass(element, className);
        }
      },

      removeClass : function(element, className, options) {
        return $animateQueue.push(element,
          ['removeClass', null, className, options, removeClass]);

        function removeClass() {
          $$jqLite.removeClass(element, className);
        }
      },

      setClass : function(element, add, remove, options) {
        return $animateQueue.push(element,
          ['setClass', add, remove, options, setClass]);

        function setClass() {
          add    && $$jqLite.addClass(element, add);
          remove && $$jqLite.removeClass(element, remove);
        }
      }
    };
  }];
}];

function $AnimateQueueProvider() {
  this.$get = ['$$qAnimate', '$rootScope', '$animateSequence', '$animateRunner',
       function($$qAnimate,   $rootScope,   $animateSequence,   $animateRunner) {

    return {
      push : function(element, details) {
        return queueAnimation(element, details);
      }
    };

    function queueAnimation(element, details) {
      var defer = $$qAnimate.defer();
      var args = [element].concat(details);

      // we create a fake runner with a working promise.
      // These methods will become available after the digest has passed
      var runner = $animateRunner(defer.promise);

      $rootScope.$$postDigest(function() {
        var realRunner = $animateSequence.apply($animateSequence, args).then(
          function() { defer.resolve(); },
          function() { defer.reject(); }
        );

        // this will update the runner's flow-control events based on
        // the `realRunner` object.
        $animateRunner(runner, realRunner);
      });

      return runner;
    }
  }];
}

var $AnimateSequenceProvider = ['$animateProvider', function($animateProvider) {
  var NG_ANIMATE_CLASSNAME = 'ng-animate';

  this.$get = ['$$qAnimate', '$injector', '$animateRunner',
       function($$qAnimate,   $injector,   $animateRunner) {

    return function(element, method, add, remove, options, domOperation) {
      var _domOperation = domOperation || noop;
      var domOperationCalled = false;
      domOperation = function() {
        if (!domOperationCalled) {
          _domOperation();
          domOperationCalled = true;
        }
      }

      var className = add || remove || '';
      var classes = resolveElementClasses(element, className);

      var driver = getDriver(element, method, classes, add, options, domOperation);
      var cursor = 0;

      var defer = $$qAnimate.defer();
      var runner = $animateRunner(defer.promise, driver);

      start();
      return runner;

      function resolveElementClasses(element, extraClasses) {
        var classes = (element.attr('class') || '').split(' ');
        if (extraClasses) {
          var tokens = angular.isArray(extraClasses)
              ? extraClasses
              : extraClasses.split(/[\ ,]/);
          classes = classes.concat(tokens);
        }
        return classes;
      }

      function getDriver(element, method, classes, add, remove, options) {
        var drivers = $animateProvider.drivers;

        // we loop in reverse order since the more general drivers (like CSS and JS)
        // may attempt more elements, but custom drivers has more requirements.
        for (var i = drivers.length - 1; i >= 0; i--) {
          var driverName = drivers[i--];
          if (!$injector.has(driverName)) continue;

          var factory = $injector.get(driverName);
          var driver = factory(element, method, classes, add, remove, options, domOperation);
          if (driver) {
            return wrapDriver(driver);
          }
        }
      }

      function wrapDriver(driver) {
        return angular.isFunction(driver)
            ? { next: driver }
            : driver;
      }

      function next(formerData) {
        var result = driver.next(cursor, formerData);
        if (isPromiseLike(result)) {
          result = { value : result, done : false };
        }

        if (!result || !isDefined(result.value)) {
          throw $animateMinErr('etyanires',
            "Animation driver.next() must respond with an object containing value and done members");
        }

        if (result.done) {
          // if nothing is returned at all then we assume the animation failed
          // otherwise, so long as the value is not false then we're fine to assume
          // that the animation was successful
          close(result && result.value !== false);
          return;
        }

        var value = result.value;
        if (isPromiseLike(value)) {
          // this will force a wait for one reflow which in turn
          // ensures that the animation step is asynchronous. If
          // a promise is not returned then we rely on user calling
          // the callback function to end the animation.
          value.then(tick, function() { tick(false); });
        } else {
          //synchronous animation flow
          tick(value);
        }

        function tick(data) {
          if (data === false) {
            close(false);
            return;
          }

          cursor++;
          runner.progress(data);
          next(data);
        }
      }

      function start() {
        element.addClass(NG_ANIMATE_CLASSNAME);
        next();
      }

      function close(success) {
        if (!domOperationCalled) {
          domOperation();
        }
        element.removeClass(NG_ANIMATE_CLASSNAME);
        success ? defer.resolve() : defer.reject();
      }
    };
  }];
}];
