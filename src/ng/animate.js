'use strict';

var $animateMinErr = minErr('ngAnimate');

function $AnimateRunnerProvider() {
  this.$get = [function() {
    // there is a lot of variable switching going on here. The main idea
    // is that the runner can be "updated" later on without having to create
    // a new variable. The driver that is given will apply it's new methods to
    // the pre-existing runner/promise object.
    return function(obj, driver) {
      driver = driver || {};
      obj.next     = driver.next   || obj.next   || noop;
      obj.end      = driver.end    || obj.end    || noop;
      obj.pause    = driver.pause  || obj.pause  || noop;
      obj.resume   = driver.resume || obj.resume || noop;
      obj.cancel   = driver.cancel || obj.cancel || noop;
      obj.progress = obj.progress  || noop;
      return obj;
    };
  }];
}

var $AnimateProvider = ['$provide', function($provide) {
  this.drivers = [];
  this.$$selectors = [];
  this.register = function(name, factory) {
    var key = name + '-animation';
    if (name && name.charAt(0) != '.') throw $animateMinErr('notcsel',
        "Expecting class selector starting with '.' got '{0}'.", name);
    this.$$selectors[name.substr(1)] = key;
    $provide.factory(key, factory);
  };

  this.$get = ['$animateQueue', '$$jqLite', function($animateQueue, $$jqLite) {
    return {
      enter : function(element, parent, after, options) {
        return $animateQueue.push(element, ['enter', options, insert]);

        function insert() {
          after ? after.after(element) : parent.append(element);
        }
      },

      move : function(element, parent, after, options) {
        return $animateQueue.push(element, ['move', options, move]);

        function move() {
          after ? after.after(element) : parent.append(element);
        }
      },

      leave : function(element, options) {
        return $animateQueue.push(element, ['leave', options, remove]);

        function remove() {
          element.remove();
        }
      },

      addClass : function(element, className, options) {
        options = options || {};
        options.add = className;
        return $animateQueue.push(element, ['addClass', options, addClass]);

        function addClass() {
          $$jqLite.addClass(element, className);
        }
      },

      removeClass : function(element, className, options) {
        options = options || {};
        options.add = className;
        return $animateQueue.push(element, ['removeClass', options, removeClass]);

        function removeClass() {
          $$jqLite.removeClass(element, className);
        }
      },

      setClass : function(element, add, remove, options) {
        options = options || {};
        options.add = add;
        options.remove = remove;
        return $animateQueue.push(element, ['setClass', options, setClass]);

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
      var defered = $$qAnimate.defer();
      var args = [element].concat(details);

      // we create a fake runner with a working promise.
      // These methods will become available after the digest has passed
      var runner = $animateRunner(defered.promise);

      $rootScope.$$postDigest(function() {
        var realRunner = $animateSequence.apply($animateSequence, args).then(
          function() { defered.resolve(); },
          function() { defered.reject(); }
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

  this.$get = ['$$qAnimate', '$injector', '$animateRunner', '$timeline', '$timelinePlayhead',
       function($$qAnimate,   $injector,   $animateRunner,   $timeline,   $timelinePlayhead) {

    return function(element, method, options, domOperation) {
      options = options || {};

      var _domOperation = domOperation || noop;
      var domOperationCalled = false;
      options.domOperation = domOperation = function() {
        if (!domOperationCalled) {
          _domOperation();
          domOperationCalled = true;
        }
      }

      var defered = $$qAnimate.defer();
      var runner = $animateRunner(defered.promise);

      var player, driver = getDriver(element, method, domOperation, options);
      if (driver) {
        var tree;
        var tl = $timeline.query(element);
        if (tl) {
          tree = tl(element, driver, options);
        } else {
          tree = driver.createDefaultTimeline(element, method, domOperation, options);
        }

        player = $timelinePlayhead(tree);
        start();
      } else {
        close();
      }

      return runner;

      function getDriver(element, method, domOperation, options) {
        var drivers = $animateProvider.drivers;

        // we loop in reverse order since the more general drivers (like CSS and JS)
        // may attempt more elements, but custom drivers has more requirements.
        for (var i = drivers.length - 1; i >= 0; i--) {
          var driverName = drivers[i--];
          if (!$injector.has(driverName)) continue;

          var factory = $injector.get(driverName);
          var driver = factory(element, method, domOperation, options);
          if (driver) {
            return driver;
          }
        }
      }

      function start() {
        element.addClass(NG_ANIMATE_CLASSNAME);

        var playerRunner = player.start();
        $animateRunner(runner, playerRunner);

        playerRunner.then(function() {
          close(true);
        }, function() {
          close(false);
        });
      }

      function close(success) {
        if (!domOperationCalled) {
          domOperation();
        }
        element.removeClass(NG_ANIMATE_CLASSNAME);
        success ? defered.resolve() : defered.reject();
      }
    };
  }];
}];
