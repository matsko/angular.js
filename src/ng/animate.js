'use strict';

/*
 * enter/move/leave
 * addClass/removeClass/setClass
 *
 * merge into one animation
 * then disable the animation (blanket)
 *
 * call the driver with the combined animations
 */

var $animateMinErr = minErr('ngAnimate');

var NG_ANIMATE_CLASSNAME = 'ng-animate';

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

  var animationsEnabled = true;

  this.$get = ['$animateQueue', '$$jqLite', function($animateQueue, $$jqLite) {
    return {

      enabled : function() {
        return $animateQueue.enabled.apply($animateQueue, arguments);
      },

      enter : function(element, parent, after, options) {
        parent = parent || after.parent();
        return $animateQueue.push(element, parent, 'enter', options, domEnter);

        function domEnter() {
          after ? after.after(element) : parent.append(element);
        }
      },

      move : function(element, parent, after, options) {
        parent = parent || after.parent();
        return $animateQueue.push(element, parent, 'move', options, domMove);

        function domMove() {
          after ? after.after(element) : parent.append(element);
        }
      },

      leave : function(element, options) {
        return $animateQueue.push(element, element.parent(), 'leave', options, domLeave);

        function domLeave() {
          element.remove();
        }
      },

      addClass : function(element, className, options) {
        options = options || {};
        options.addClass = className;
        return $animateQueue.push(element, element.parent(), 'addClass', options, domAddClass);

        function domAddClass() {
          $$jqLite.addClass(element, className);
        }
      },

      removeClass : function(element, className, options) {
        options = options || {};
        options.removeClass = className;
        return $animateQueue.push(element, element.parent(), 'removeClass', options, domRemoveClass);

        function domRemoveClass() {
          $$jqLite.removeClass(element, className);
        }
      },

      setClass : function(element, add, remove, options) {
        options = options || {};
        options.addClass = add;
        options.removeClass = remove;
        return $animateQueue.push(element, element.parent(), 'setClass', options, domSetClass);

        function domSetClass() {
          add    && $$jqLite.addClass(element, add);
          remove && $$jqLite.removeClass(element, remove);
        }
      }
    };
  }];
}];

function $AnimateQueueProvider() {
  var PRE_DIGEST_STATE = 1;
  var RUNNING_STATE = 2;
  var BLOCKED_STATE = 3;
  var QUEUED_STATE = 4;

  var rules = this.rules = {
    skip : [],
    cancel : [],
    join : [],
    wait : []
  };

  function isAllowed(ruleType, element, currentAnimation, previousAnimation) {
    return rules[ruleType].some(function(fn) {
      return fn(element, currentAnimation, previousAnimation);
    });
  }

  function hasAnimationClasses(options, and) {
    var a = (options.addClass || '').length;
    var b = (options.removeClass || '').length;
    return and ? a > 0 && b > 0
               : a > 0 || b > 0;
  }

  rules.join.push(function(element, newAnimation, currentAnimation) {
    // if the new animation is class-based then we can just tack that on
    return !newAnimation.structural && hasAnimationClasses(newAnimation);
  });

  rules.skip.push(function(element, newAnimation, currentAnimation) {
    // there is no need to animate anything if no classes are being added and
    // there is no structural animation that will be triggered
    return !newAnimation.structural && !hasAnimationClasses(newAnimation);
  });

  rules.skip.push(function(element, newAnimation, currentAnimation) {
    // why should we trigger a new structural animation if the element will
    // be removed from the DOM anyway?
    return currentAnimation.method == 'leave' && newAnimation.structural;
  });

  rules.cancel.push(function(element, newAnimation, currentAnimation) {
    // there can never be two structural animations running at the same time
    return currentAnimation.structural && newAnimation.structural;
  });

  rules.cancel.push(function(element, newAnimation, currentAnimation) {
    // if the previous animation is already running, but the new animation will
    // be triggered, but the new animation is structural
    return currentAnimation.state === RUNNING_STATE && newAnimation.structural;
  });

  this.$get = ['$$qAnimate', '$rootScope', '$rootElement', '$document', '$animateSequence', '$animateRunner', '$templateRequest',
       function($$qAnimate,   $rootScope,   $rootElement,   $document,   $animateSequence,   $animateRunner,   $templateRequest) {

    var animationsEnabled = null;
    var activeAnimationsLookup = new HashMap();
    var disabledElementsLookup = new HashMap();

    // Wait until all directive and route-related templates are downloaded and
    // compiled. The $templateRequest.totalPendingRequests variable keeps track of
    // all of the remote templates being currently downloaded. If there are no
    // templates currently downloading then the watcher will still fire anyway.
    var deregisterWatch = $rootScope.$watch(
      function() { return $templateRequest.totalPendingRequests; },
      function(val, oldVal) {
        if (val !== 0) return;
        deregisterWatch();

        // Now that all templates have been downloaded, $animate will wait until
        // the post digest queue is empty before enabling animations. By having two
        // calls to $postDigest calls we can ensure that the flag is enabled at the
        // very end of the post digest queue. Since all of the animations in $animate
        // use $postDigest, it's important that the code below executes at the end.
        // This basically means that the page is fully downloaded and compiled before
        // any animations are triggered.
        $rootScope.$$postDigest(function() {
          $rootScope.$$postDigest(function() {
            // we check for null directly in the event that the application already called
            // .enabled() with whatever arguments that it provided it with
            if (animationsEnabled === null) {
              animationsEnabled = true;
            }
          });
        });
      }
    );

    return {
      push : function(element, parent, method, options, domOperation) {
        return queueAnimation(element, parent, method, options, domOperation);
      },

      enabled : function(bool) {
        var argCount = arguments.length;
        if (isElement(bool)) {
          var element = bool;
          var recordExists = disabledElementsLookup.get(element);

          // if nothing is set then the animation is enabled
          bool = !recordExists;

          if (argCount > 1) {
            bool = !!arguments[1];
            if (!bool) {
              disabledElementsLookup.put(element, true);
            } else if (recordExists) {
              disabledElementsLookup.remove(element);
            }
          }
        } else if (argCount === 1) {
          animationsEnabled = !!bool;
        } else {
          bool = animationsEnabled;
        }

        return bool === true;
      }
    };

    function queueAnimation(element, parent, method, options, domOperation) {
      options = options || {};

      options.addClass = isArray(options.addClass)
          ? options.addClass.join(' ')
          : options.addClass;

      options.removeClass = isArray(options.removeClass)
          ? options.removeClass.join(' ')
          : options.removeClass;

      domOperation = domOperation || noop;

      // we create a fake runner with a working promise.
      // These methods will become available after the digest has passed
      var defered = $$qAnimate.defer();
      var runner = $animateRunner(defered.promise);

      var isStructural = ['enter', 'move', 'leave'].indexOf(method) >= 0;
      var existingAnimation = activeAnimationsLookup.get(element) || {};
      var existingAnimationExists = !!existingAnimation.state;

      // this is a hard disable of all animations for the application or on
      // the element itself, therefore  there is no need to continue further
      // past this point if not enabled
      var skipAnimations = !animationsEnabled || disabledElementsLookup.get(element);

      // there is no point in traversing the same collection of parent ancestors if a followup
      // animation will be run on the same element that already did all that checking work
      if (!skipAnimations && (!existingAnimationExists || existingAnimation.state != PRE_DIGEST_STATE)) {
        skipAnimations = !areAnimationsAllowed(element, parent);
      }

      if (skipAnimations) {
        applyAnimationOptions(element, options);
        domOperation();
        defered.resolve();
        return runner;
      }

      if (isStructural) {
        closeChildAnimations(element);
      }

      // the counter keeps track of cancelled animations
      var newAnimation = {
        structural : isStructural,
        method : method,
        options : options,
        parent : parent || existingAnimation.parent,
        domOperation : domOperation,
        runner : runner
      };

      if (existingAnimationExists) {
        var skipAnimationFlag = isAllowed('skip', element, newAnimation, existingAnimation);
        if (skipAnimationFlag) {
          existingAnimation.options = mergeAnimationOptions(element, existingAnimation.options, options);
          existingAnimation.domOperation = mergeAnimationDomOperations(existingAnimation.domOperation, domOperation);
          return;
        }

        var waitAnimationFlag = isAllowed('wait', element, newAnimation, existingAnimation);
        if (waitAnimationFlag) {
          // wait until the next animation is ready
        }

        var cancelAnimationFlag = isAllowed('cancel', element, newAnimation, existingAnimation);
        if (cancelAnimationFlag) {
          if (existingAnimation.state === RUNNING_STATE) {
            existingAnimation.runner.end();
          } else {
            newAnimation.options = mergeAnimationOptions(element, existingAnimation.options, options);
          }
        } else {
          var joinAnimationFlag = isAllowed('join', element, newAnimation, existingAnimation);
          if (joinAnimationFlag) {
            method = newAnimation.method = existingAnimation.method;

            options = newAnimation.options = mergeAnimationOptions(element, existingAnimation.options, options);

            // we can't mixup multiple calls to leave + enter + leave... Are you crazy?
            // this only works for class-based animations
            if (!isStructural) {
              domOperation = newAnimation.domOperation = mergeAnimationDomOperations(existingAnimation.domOperation, domOperation);
            }
          }
        }
      }
      else {
        options = mergeAnimationOptions(element, options, {});
      }

      var counter = (existingAnimation.counter || 0) + 1;
      newAnimation.counter = counter;
      markElementAnimationState(element, PRE_DIGEST_STATE, newAnimation);

      $rootScope.$$postDigest(function() {
        var details = activeAnimationsLookup.get(element);
        var animationCancelled = !details;

        // this means that the previous animation was cancelled
        // even if the follow-up animation is the same event
        if (animationCancelled
             || details.counter !== counter
             || (!details.structural && !hasAnimationClasses(details.options))) {
          // if another animation did not take over then we need
          // to make sure that the domOperation and options are
          // handled accordingly
          if (animationCancelled) {
            applyAnimationOptions(element, details.options);
          }

          // if the event changed from something like enter to leave then we do
          // it, otherwise if it's the same then the end result will be the same too
          if (animationCancelled || (isStructural && details.method !== method)) {
            domOperation();
          }

          return details.runner;
        }

        // this combined multiple class to addClass / removeClass into a setClass event
        // so long as a structural event did not take over the animation
        method = !details.structural && hasAnimationClasses(details.options, true)
            ? 'setClass'
            : details.method;

        markElementAnimationState(element, RUNNING_STATE);
        var realRunner = $animateSequence(element, method, details.options, details.domOperation);
        realRunner.then(
            function() { defered.resolve(); },
            function() { defered.reject(); }
          ).finally(function() {
            clearElementAnimationState(element);
          });

        // this will update the runner's flow-control events based on
        // the `realRunner` object.
        $animateRunner(runner, realRunner);
      });

      return runner;
    }

    function closeChildAnimations(element) {
      var children = element[0].getElementsByClassName(NG_ANIMATE_CLASSNAME);
      forEach(children, function(child) {
        var details = activeAnimationsLookup.get(child);
        details.runner.end();
      });
    }

    function clearElementAnimationState(element) {
      activeAnimationsLookup.remove(element);
    }

    function applyAnimationOptions(element, options) {
      //$animateSequence.$$closeAnimation(element, options);
    }

    function isMatchingElement(elm1, elm2) {
      return elm1[0] == elm2[0];
    }

    function areAnimationsAllowed(element, parent) {
      var bodyElement = jqLite($document[0].body);
      var bodyElementDetected = false;
      var rootElementDetected = isMatchingElement(parent, $rootElement);

      parent = rootElementDetected
        ? element
        : parent || element.parent();

      if (!parent) return false;

      while(parent && parent.length) {
        var details = activeAnimationsLookup.get(parent) || {};
        // either an enter, leave or move animation will commence
        // therefore we can't allow any animations to take place
        // but if a parent animation is class-based then that's ok
        if (details.structural || disabledElementsLookup.get(parent)) {
          return false;
        }

        if (!rootElementDetected) {
          // angular doesn't want to attempt to animate elements outside of the application
          // therefore we need to ensure that the rootElement is an ancestor of the current element
          rootElementDetected = isMatchingElement(parent, $rootElement);
        } else if (isMatchingElement(parent, bodyElement)) {
          // we also need to ensure that the element is or will be apart of the body element
          // otherwise it is pointless to even issue an animation to be rendered
          bodyElementDetected = true;
          break;
        }

        parent = parent.parent();
      }

      return rootElementDetected && bodyElementDetected;
    }

    function splitClasses(classes) {
      if (isString(classes)) {
        classes = classes.split(' ');
      }

      var obj = {};
      forEach(classes, function(klass) {
        // sometimes the split leaves empty string values
        // incase extra spaces were applied to the options
        if (klass.length) {
          obj[klass] = true;
        }
      });
      return obj;
    }

    function resolveAnimationClasses(existing, toAdd, toRemove) {
      var flags = {};
      existing = splitClasses(existing);

      toAdd = splitClasses(toAdd);
      forEach(toAdd, function(value, key) {
        if (!existing[key]) {
          flags[key] = 1;
        }
      });

      toRemove = splitClasses(toRemove);
      forEach(toRemove, function(value, key) {
        if (existing[key]) {
          if (flags[key] === 1) {
            delete flags[key];
          } else {
            flags[key] = -1;
          }
        }
      });

      var classes = {
        addClass : '',
        removeClass : ''
      };

      forEach(flags, function(val, klass) {
        var prop = val === 1 ? 'addClass' : 'removeClass';
        if (classes[prop].length) {
          classes[prop] += ' ';
        }
        classes[prop] += klass;
      });

      return classes;
    }

    function mergeAnimationOptions(element, aOptions, bOptions) {
      var options = extend({}, aOptions, bOptions);

      var toAdd = (aOptions.addClass || '') + ' ' + (bOptions.addClass || '');
      var toRemove = (aOptions.removeClass || '') + ' ' + (bOptions.removeClass || '');
      var classes = resolveAnimationClasses(element.attr('class'), toAdd, toRemove);

      if (classes.addClass) {
        options.addClass = classes.addClass;
      } else {
        delete options.addClass;
      }

      if (classes.removeClass) {
        options.removeClass = classes.removeClass;
      } else {
        delete options.removeClass;
      }
      return options;
    }

    function mergeAnimationDomOperations(domOperation1, domOperation2) {
      if (!domOperation1 || domOperation1 === noop) return domOperation2;
      if (!domOperation2 || domOperation2 === noop) return domOperation1;
      return function() {
        domOperation1();
        domOperation2();
      };
    }

    function markElementAnimationState(element, state, details) {
      details = details || {};
      details.state = state;
      var oldValue = activeAnimationsLookup.get(element);
      if (oldValue) {
        oldValue = extend(oldValue, details);
      } else {
        oldValue = details;
      }
      activeAnimationsLookup.put(element, details);
    }
  }];
}

var $AnimateSequenceProvider = ['$animateProvider', function($animateProvider) {
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
        // may attempt more elements, but custom drivers are more particular
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
