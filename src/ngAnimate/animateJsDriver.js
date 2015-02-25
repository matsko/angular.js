'use strict';

var $AnimateJsDriverProvider = ['$animationProvider', function($animationProvider) {
  $animationProvider.drivers.push('$$animateJsDriver');
  this.$get = ['$injector', '$qRaf', function($injector, $qRaf) {
    return function(element, method, classes) {
      classes = classes || element.attr('class') || '';
      // the lookupAnimations function returns a series of animation objects that are
      // matched up with one or more of the CSS classes. These animation objects are
      // defined via the module.animation factory function. If nothing is detected then
      // we don't return anything which then makes $animation query the next driver.
      var animations = lookupAnimations(classes);
      var before, after;
      if (animations.length) {
        var afterFn, beforeFn;
        if (method == 'leave') {
          beforeFn = 'leave';
          afterFn = 'afterLeave';
        } else {
          beforeFn = 'before' + method.charAt(0).toUpperCase() + method.substr(1);
          afterFn = method;
        }

        before = packageAnimations(element, method, animations, beforeFn);
        after  = packageAnimations(element, method, animations, afterFn);
      }

      // no matching animations
      if (!before && !after) return;

      return function(details) {
        var cancelFn = noop;
        var _domOperation = details.domOperation;
        var domOperationCalled = !_domOperation;
        var domOperation = _domOperation && function() {
          domOperationCalled = true;
          _domOperation();
        };

        var options = details.options || {};

        return {
          cancel : function() {
            cancelFn();
          },
          start : function() {
            var chain;
            if (before) {
              chain = before(options);
            }

            if (domOperation) {
              if (isPromiseLike(chain)) {
                chain = chain.then(domOperation);
              } else {
                domOperation();
              }
            }

            if (after) {
              if (isPromiseLike(chain)) {
                chain = chain.then(function() {
                  return after(options);
                });
              } else {
                chain = after(options);
              }
            }

            chain = isPromiseLike(chain) ? chain : $qRaf.when(chain);
            return chain.finally(function() {
              !domOperationCalled && domOperation();
            });
          }
        }
      }
    };

    function executeAnimationFn(fn, element, method, options, onDone) {
      var classesToAdd = options.addClass;
      var classesToRemove = options.removeClass;

      var args;
      switch(method) {
        case 'animate':
          args = [element, options.from, options.to, onDone];
          break;

        case 'setClass':
          args = [element, classesToAdd, classesToRemove, onDone];
          break;

        case 'addClass':
          args = [element, classesToAdd, onDone];
          break;

        case 'removeClass':
          args = [element, classesToRemove, onDone];
          break;

        default:
          args = onDone ? [element, onDone] : [element];
          break;
      }

      args.push(options);

      var value = fn.apply(fn, args);
      if (isPromiseLike(value)) {
        value.then(onDone, function() {
          onDone(false);
        });
      }
    }

    function groupEventedAnimations(element, method, animations, fnName) {
      var asyncOperations = [];
      var syncOperations = [];
      angular.forEach(animations, function(ani) {
        var animation = ani[fnName];
        if (animation) {
          // beforeMove and beforeEnter MUST be synchronous. This ensures that
          // the DOM operation happens at the right time for things to work properly
          var syncAnimation = fnName == 'beforeEnter' || fnName == 'beforeMove';
          if (syncAnimation) {
            syncOperations.push(function(options) {
              return executeAnimationFn(animation, element, method, options);
            });
          } else {
            // note that all of these animations should run in parallel
            asyncOperations.push(function(options) {
              var defer = $qRaf.defer();
              executeAnimationFn(animation, element, method, options, function(result) {
                result === false ? defer.reject() : defer.resolve();
              });
              return defer.promise;
            });
          }
        }
      });

      return (syncOperations.length || asyncOperations.length) && [syncOperations, asyncOperations];
    }

    function packageAnimations(element, method, animations, fnName) {
      var operations = groupEventedAnimations(element, method, animations, fnName);
      var syncOperations = [];
      var asyncOperations = [];

      if (!operations) {
        var a,b;
        if (fnName === 'beforeSetClass') {
          a = groupEventedAnimations(element, 'removeClass', animations, 'beforeRemoveClass');
          b = groupEventedAnimations(element, 'addClass', animations, 'beforeAddClass');
        } else if (fnName === 'setClass') {
          a = groupEventedAnimations(element, 'removeClass', animations, 'removeClass');
          b = groupEventedAnimations(element, 'addClass', animations, 'addClass');
        }
        if (a) {
          syncOperations = syncOperations.concat(a[0]);
          asyncOperations = asyncOperations.concat(a[1]);
        }
        if (b) {
          syncOperations = syncOperations.concat(b[0]);
          asyncOperations = asyncOperations.concat(b[1]);
        }
      } else {
        syncOperations = operations[0];
        asyncOperations = operations[1];
      }

      if (!syncOperations.length && !asyncOperations.length) return;

      return function(options) {
        angular.forEach(syncOperations, function(op) {
          op(options);
        });

        var promises = [];
        if (asyncOperations.length) {
          angular.forEach(asyncOperations, function(op) {
            promises.push(op(options));
          });
        }
        return promises.length ? $qRaf.all(promises) : true;
      };
    }

    function lookupAnimations(classes) {
      classes = isArray(classes) ? classes : classes.split(' ');
      var matches = [], flagMap = {};
      for (var i=0; i < classes.length; i++) {
        var klass = classes[i],
            animationFactory = $animationProvider.$$registeredAnimations[klass];
        if (animationFactory && !flagMap[klass]) {
          matches.push($injector.get(animationFactory));
          flagMap[klass] = true;
        }
      }
      return matches;
    }
  }];
}];
