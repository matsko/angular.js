'use strict';

var $AnimateJsProvider = ['$animationProvider', function($animationProvider) {
  this.$get = ['$injector', '$qRaf', '$animateRunner', function($injector, $qRaf, $animateRunner) {
    return function(element, event, classes, options) {
      // the `classes` argument is optional and if it is not used
      // then the classes will be resolved from the element's className
      // property as well as options.addClass/options.removeClass.
      if (arguments.length === 3 && isObject(classes)) {
        options = classes;
        classes = null;
      }

      options = options || {};
      if (!classes) {
        classes = element.attr('class') || '';
        if (options.addClass) {
          classes += ' ' + options.addClass;
        }
        if (options.removeClass) {
          classes += ' ' + options.removeClass;
        }
      }

      // the lookupAnimations function returns a series of animation objects that are
      // matched up with one or more of the CSS classes. These animation objects are
      // defined via the module.animation factory function. If nothing is detected then
      // we don't return anything which then makes $animation query the next driver.
      var animations = lookupAnimations(classes);
      var before, after;
      if (animations.length) {
        var afterFn, beforeFn;
        if (event == 'leave') {
          beforeFn = 'leave';
          afterFn = 'afterLeave';
        } else {
          beforeFn = 'before' + event.charAt(0).toUpperCase() + event.substr(1);
          afterFn = event;
        }

        if (event !== 'enter' && event !== 'move') {
          before = packageAnimations(element, event, options, animations, beforeFn);
        }
        after  = packageAnimations(element, event, options, animations, afterFn);
      }

      // no matching animations
      if (!before && !after) return;

      var _domOperation = options.domOperation;
      var domOperationCalled = !_domOperation;
      var domOperation = _domOperation && function() {
        domOperationCalled = true;
        _domOperation();
      };

      return {
        start: function() {
          var deferred = $qRaf.defer();

          var chain;
          var activeAnimations = [];
          if (before) {
            chain = before(activeAnimations);
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
                return after(activeAnimations);
              });
            } else {
              chain = after(activeAnimations);
            }
          }

          var animationClosed = false;

          chain = isPromiseLike(chain) ? chain : $qRaf.when(chain);
          chain = chain.then(
            function() { onComplete(); },
            function() { onComplete(true) });

          function onComplete(cancelled) {
            animationClosed = true;
            !domOperationCalled && domOperation();
            cancelled ? deferred.reject() : deferred.resolve();
          }

          return $animateRunner(deferred.promise, {
            end : function() {
              endAnimations();
            },
            cancel : function() {
              endAnimations(true);
            }
          });

          function endAnimations(cancelled) {
            if (!animationClosed) {
              forEach(activeAnimations, function(endFn) {
                endFn(cancelled);
              });
              onComplete(cancelled);
            }
          }
        }
      };
    };

    function executeAnimationFn(fn, element, event, options, onDone) {
      var classesToAdd = options.addClass;
      var classesToRemove = options.removeClass;

      var args;
      switch(event) {
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
        return noop;
      }

      // optional onEnd / onCancel callback
      return isFunction(value) ? value : noop;
    }

    function groupEventedAnimations(element, event, options, animations, fnName) {
      var operations = [];
      forEach(animations, function(ani) {
        var animation = ani[fnName];
        if (!animation) return;

        // note that all of these animations will run in parallel
        operations.push(function(activeAnimations) {
          var defer = $qRaf.defer();
          var resolved = false;
          var doneFn = noop;
          var onAnimationComplete = function(rejected) {
            if(!resolved) {
              doneFn(rejected);
              resolved = true;
            }
          };
          doneFn = executeAnimationFn(animation, element, event, options, function(result) {
            var cancelled = result === false;
            onAnimationComplete(cancelled);

            // the callback function is the only code that can resolve the animation to
            // continue forward ...
            cancelled ? defer.reject() : defer.resolve();
          });
          // ... otherwise if cancelled or ended directly then the animation chain will not continue
          activeAnimations.push(onAnimationComplete);
          return defer.promise;
        });
      });
      return operations;
    }

    function packageAnimations(element, event, options, animations, fnName) {
      var operations = groupEventedAnimations(element, event, options, animations, fnName);
      if (operations.length === 0) {
        var a,b;
        if (fnName === 'beforeSetClass') {
          a = groupEventedAnimations(element, 'removeClass', options, animations, 'beforeRemoveClass');
          b = groupEventedAnimations(element, 'addClass', options, animations, 'beforeAddClass');
        } else if (fnName === 'setClass') {
          a = groupEventedAnimations(element, 'removeClass', options, animations, 'removeClass');
          b = groupEventedAnimations(element, 'addClass', options, animations, 'addClass');
        }

        if (a) {
          operations = operations.concat(a);
        }
        if (b) {
          operations = operations.concat(b);
        }
      }

      if (operations.length === 0) return;

      return function(activeAnimations) {
        var promises = [];
        if (operations.length) {
          forEach(operations, function(animateFn) {
            promises.push(animateFn(activeAnimations));
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
