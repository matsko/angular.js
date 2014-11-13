'use strict';
/* jshint maxlen: false */

/**
 * @ngdoc module
 * @name ngSequence
 * @description
 *
 * .. WIP ...
 */
angular.module('ngSequence', [])

  .config(['$provide', function($provide) {
    var forEach = angular.forEach;
    $provide.decorator('$animate', ['$delegate', '$$q', '$$sequenceLookup',
                            function($delegate,   $$q,   $$sequenceLookup) {

      var obj = {};
      forEach(['enter', 'move'], function(method) {
        obj[method] = function(element, parentElement, afterElement) {
          return sequenceDefer(element, parentElement || afterElement.parent(), method, wrapAnimateFn(method, arguments));
        };
      });

      forEach(['leave', 'addClass', 'removeClass', 'setClass'], function(method) {
        obj[method] = function(element) {
          return sequenceDefer(element, element.parent(), method, wrapAnimateFn(method, arguments));
        };
      });

      forEach(['$$addClassImmediately', '$$removeClassImmediately',
               '$$setClassImmediately', 'enabled', 'cancel'], function(method) {
        obj[method] = function() {
          return $delegate[method].apply($delegate, arguments);
        };
      });

      return obj;

      function wrapAnimateFn(method, args) {
        return function() {
          return $delegate[method].apply($delegate, args);
        };
      };

      function sequenceDefer(element, parentElement, event, animateFn) {
        console.log(event, 'it', element[0]);
        var sequencer = $$sequenceLookup(parentElement);
        if (sequencer) {
          return sequencer.queueAnimateAnimation(element, event, animateFn);
        } else {
          return animateFn();
        }
      }
    }]);
  }])

  .factory('$sequenceCache', ['$cacheFactory', function($cacheFactory) {
    return $cacheFactory();
  }])

  .controller('ngSequenceCtrl', ['$attrs', '$sequenceCache',
                         function($attrs,   $sequenceCache) {
    this.name = $attrs.name;
    if (this.name) {
      $sequenceCache.put(this.name, this);
    }

    var steps = this.steps = [];
    this.register = function(step, actionFn) {
      step.fn = actionFn;
      steps.push(step);
    };
  }])

  .directive('ngSequence', [function() {
    return { controller : 'ngSequenceCtrl' };
  }])

  .directive('ngStep', ['$timeout', '$$q', function($timeout, $$q) {
    return {
      require : '^ngSequence',
      link : function(scope, element, attrs, sequenceCtrl) {
        sequenceCtrl.register(createCopyFromKeys(attrs.$attr, attrs));
      }
    };

    function createCopyFromKeys(keys, data) {
      var obj = {};
      angular.forEach(keys, function(v, key) {
        obj[key] = data[key];
      });
      return obj;
    }
  }])

  .directive('ngSequenceUse', ['$sequence', '$compile', function($sequence, $compile) {
    return {
      terminal: true,
      link : function(scope, element, attrs) {
        var first = true;
        scope.$watchCollection(attrs.ngSequenceUse, function(newObj, oldObj) {
          // we want the first object to be empty since angular provides an
          // indentical clone of the first object upon first digest
          var seqName = findFirstChangedKey(newObj, first ? {} : oldObj);
          first = false;
          if (!seqName) return;

          var sequence = $sequence(element, seqName, scope);
          scope.$$postDigest(function() {
            scope.$$postDigest(function() {
              sequence.start();
            });
          });
        });

        $compile(element.contents())(scope);
      }
    }

    function findFirstChangedKey(a,b) {
      var key;
      a = a || {};
      b = b || {};
      angular.forEach(a, function(value, name) {
        if (!key && a[name] && a[name] != b[name]) {
          key = name;
        }
      });
      return key;
    }
  }])

  .factory('$simpleQChain', ['$$q', '$rootScope', function($$q, $rootScope) {
    /*
     * the data here is given as an array
     * [fn1, fn2, fn3]
     *
     * or as an array of arrays
     * [
     *  [fn1, fn2],
     *  fn3
     * ]
     *
     */
    return function(fns) {
      var index = 0;
      var length = fns.length;
      return function next() {
        if (index < length) {
          var promise =  fns[index++]();
          !$rootScope.$$phase && $rootScope.$digest();
          return promise.then(next);
        }
      }
    }
  }])

  .factory('$sequence',
           ['$rootScope', '$injector', '$sequenceCache', '$simpleQChain', '$timeout', '$$q',
    function($rootScope,   $injector,   $sequenceCache,   $simpleQChain,   $timeout,   $$q) {
    var STORAGE_KEY = '$$ngSequenceInstance';
    var forEach = angular.forEach;

    return function(element, name, scope) {
      var seqTpl = $sequenceCache.get(name);
      if (!seqTpl) {
        throw new Error('The sequence ' + name + ' was not found');
      }

      var driver = $injector.get(seqTpl.driver || '$animateDriver')(seqTpl);
      var steps = seqTpl.steps;

      var startEvents = [];
      var endEvents = [];
      var startFn = driver.$start;
      var endFn = driver.$end;

      var elementLookup = [];
      var animateLookup = [];

      var stepFns = [];
      var containerNode = element[0];
      forEach(steps, function(step) {
        stepFns.push(function() {
          var action = step.action;
          var actionFn = driver[action];
          var elements = containerNode.querySelectorAll(step.selector);
          var isEmptyAction = !!actionFn;

          if (!isEmptyAction) {
            forEach(elements, function(node) {
              var elm = angular.element(node);
              if (startFn) {
                startEvents.push(function() {
                  startFn(element, elm, action);
                });
              }
              if (endFn) {
                endEvents.push(function() {
                  endFn(element, elm, action);
                });
              }
            });
          }

          var beforeFn = driver[step.before || '$before'] || angular.noop;
          var afterFn = driver[step.after || '$after'] || angular.noop;
          var stagger = step.stagger || 0;
          var fns = [];

          forEach(elements, function(node, index) {
            var animationEvent = action;
            var animationFn = actionFn;
            var stepOptions = angular.copy(step);
            var elm = angular.element(node);

            var matchingIndex = elementLookup.indexOf(node);
            if (matchingIndex >= 0) {
              var entry = animateLookup[matchingIndex];
              animationFn = entry.fn;
              animationEvent = entry.action;
            }

            var promise = processWithDelay(function() {
              beforeFn(element, elm, animationEvent);
              return animationFn(element, elm, stepOptions);
            }, stagger * index);

            promise.then(function() {
              afterFn(element, elm, animationEvent);
            });
            fns.push(promise);
          });

          return $$q.all(fns);
        });
      });

      function processWithDelay(fn, delay) {
        return delay >= 0 ? $timeout(angular.noop, delay).then(fn) : fn();
      }

      var started = true;
      var index = 0;
      var self = {
        queueAnimateAnimation : function(elm, event, fn) {
          if (startFn) {
            startFn(element, elm, event, fn);
          }

          if (endFn) {
            endEvents.push(function() {
              endFn(element, elm, event, fn);
            });
          }

          var node = elm[0] || elm;
          var index = elementLookup.length;
          elementLookup[index] = node;
          animateLookup[index] = {
            action : event,
            fn : driver[event]
          };
        },

        start : function() {
          started = true;

          forEach(startEvents, function(fn) {
            fn();
          });
          startEvents = [];

          var startChain = $simpleQChain(stepFns);
          var promise = startChain();
          promise.then(function() {
            forEach(endEvents, function(fn) {
              fn();
            });
            endEvents = [];
            element.removeData(STORAGE_KEY);
            started = false;
          });
          return promise;
        }
      }
      element.data(STORAGE_KEY, self);
      return self;
    }
  }])

  .factory('$$sequenceLookup', function() {
    return function(element) {
      return element.inheritedData('$$ngSequenceInstance');
    };
  })

  .factory('$animateDriver', ['$animate', function($animate) {
    var QUEUED_CLASS_NAME = 'ng-animate-queued';
    var SPECIFIC_QUEUED_CLASS_NAME = 'ng-{EVENT}-animate-queued';
    return function() {
      return self = {
        $start : function(container, element, event, fn) {
          if (event == 'enter') {
            element.addClass(QUEUED_CLASS_NAME);
            element.addClass(SPECIFIC_QUEUED_CLASS_NAME.replace('{EVENT}', event));
            container.append(element);
          }
        },
        $before : function(container, element, event, fn) {
          element.addClass(QUEUED_CLASS_NAME);
          element.addClass(SPECIFIC_QUEUED_CLASS_NAME.replace('{EVENT}', event));
          if (event != 'leave') {
            (angular.noop || fn)();
          }
        },
        enter : function(container, element, options) {
          options = options || {};
          options.tempClasses = options.tempClasses || '';
          options.tempClasses += ' ' + QUEUED_CLASS_NAME;
          return animate(element, 'ng-enter', options);
        },
        leave : function(container, element, options) {
          return animate(element, 'ng-leave', options);
        },
        animate : function(container, element, options) {
          return animate(element, null, options);
        },
        $after : function(container, element, event, fn) {
          if (event != 'leave') {
            element.removeClass(QUEUED_CLASS_NAME);
            element.removeClass(SPECIFIC_QUEUED_CLASS_NAME.replace('{EVENT}', event));
          }
        },
        $end : function(container, element, event, fn) {
          if (event == 'leave') {
            element.remove();
          }
        }
      };

      function animate(element, className, options) {
        options = options || {};
        return $animate.animate(element, options.from, options.to, className, options);
      }
    };
  }]);
