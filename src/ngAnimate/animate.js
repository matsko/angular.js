angular.module('ngAnimate', [])

  .config(['$animateProvider', function($animateProvider) {
    $animateProvider.drivers.push('ngAnimateJSDriver');
    $animateProvider.drivers.push('ngAnimateCSSDriver');
  }])

  //this private service is only used within CSS-enabled animations
  //IE8 + IE9 do not support rAF natively, but that is fine since they
  //also don't support transitions and keyframes which means that the code
  //below will never be used by the two browsers.
  .factory('$$animateReflow', ['$$rAF', '$document', function($$rAF, $document) {
    var bod = $document[0].body;
    return function(fn) {
      //the returned function acts as the cancellation function
      return $$rAF(function() {
        //the line below will force the browser to perform a repaint
        //so that all the animated elements within the animation frame
        //will be properly updated and drawn on screen. This is
        //required to perform multi-class CSS based animations with
        //Firefox. DO NOT REMOVE THIS LINE.
        var a = bod.offsetWidth + 1;
        fn();
      });
    };
  }])

  .factory('ngAnimateCSSDriver', ['$qAnimate', function($qAnimate) {
    return function(element, method, classes, before, after) {
      return;
      function prepare(fn) {
        element.addClass('ng-' + method);
        fn();
      }

      function animate(fn) {
        element.addClass('ng-' + method + '-active');
        fn();
      }

      function close() {
        element.removeClass('ng-' + method);
        element.removeClass('ng-' + method + '-active');
      }

      before.push(prepare);
      after.push(animate);
      after.push(close);
    }
  }])

  .provider('ngAnimateJSDriver', ['$animateProvider', function($animateProvider) {
    var selectors = $animateProvider.$$selectors;
    this.$get = ['$injector', '$$qAnimate', function($injector, $$qAnimate) {
      return function(element, method, classes, add, remove, options, domOperation) {
        var animations = lookupAnimations(classes);
        if (animations.length == 0) return;

        var beforeFn = 'before' + method.charAt(0).toUpperCase() + method.substr(1);
        var afterFn = method;

        if (method == 'leave') {
          beforeFn = afterFn;
          afterFn = null;
        }

        var after, before = packageAnimations(element, method, beforeFn, add, remove, options, animations);
        if (afterFn) {
          after = packageAnimations(element, method, afterFn, add, remove, options, animations);
        }

        var domOperationCalled = false;
        return {
          next : function(index, previousData) {
            if (before) {
              var result = before();
              before = null;
              return result;
            }

<<<<<<< HEAD
            var cache = element.data(STORAGE_KEY);
            element.removeData(STORAGE_KEY);

            var state = element.data(NG_ANIMATE_STATE) || {};
            var classes = resolveElementClasses(element, cache, state.active);
            return !classes
              ? done()
              : performAnimation('setClass', classes, element, parentElement, null, function() {
                  if (classes[0]) $delegate.$$addClassImmediately(element, classes[0]);
                  if (classes[1]) $delegate.$$removeClassImmediately(element, classes[1]);
                }, cache.options, done);
          });
        },

        /**
         * @ngdoc method
         * @name $animate#cancel
         * @kind function
         *
         * @param {Promise} animationPromise The animation promise that is returned when an animation is started.
         *
         * @description
         * Cancels the provided animation.
        */
        cancel: function(promise) {
          promise.$$cancelFn();
        },

        /**
         * @ngdoc method
         * @name $animate#enabled
         * @kind function
         *
         * @param {boolean=} value If provided then set the animation on or off.
         * @param {DOMElement=} element If provided then the element will be used to represent the enable/disable operation
         * @return {boolean} Current animation state.
         *
         * @description
         * Globally enables/disables animations.
         *
        */
        enabled: function(value, element) {
          switch (arguments.length) {
            case 2:
              if (value) {
                cleanup(element);
              } else {
                var data = element.data(NG_ANIMATE_STATE) || {};
                data.disabled = true;
                element.data(NG_ANIMATE_STATE, data);
              }
            break;

            case 1:
              rootAnimateState.disabled = !value;
            break;

            default:
              value = !rootAnimateState.disabled;
            break;
          }
          return !!value;
         }
      };

      /*
        all animations call this shared animation triggering function internally.
        The animationEvent variable refers to the JavaScript animation event that will be triggered
        and the className value is the name of the animation that will be applied within the
        CSS code. Element, `parentElement` and `afterElement` are provided DOM elements for the animation
        and the onComplete callback will be fired once the animation is fully complete.
      */
      function performAnimation(animationEvent, className, element, parentElement, afterElement, domOperation, options, doneCallback) {
        var noopCancel = noop;
        var runner = animationRunner(element, animationEvent, className, options);
        if (!runner) {
          fireDOMOperation();
          fireBeforeCallbackAsync();
          fireAfterCallbackAsync();
          closeAnimation();
          return noopCancel;
        }

        animationEvent = runner.event;
        className = runner.className;
        var elementEvents = angular.element._data(runner.node);
        elementEvents = elementEvents && elementEvents.events;

        if (!parentElement) {
          parentElement = afterElement ? afterElement.parent() : element.parent();
        }

        //skip the animation if animations are disabled, a parent is already being animated,
        //the element is not currently attached to the document body or then completely close
        //the animation if any matching animations are not found at all.
        //NOTE: IE8 + IE9 should close properly (run closeAnimation()) in case an animation was found.
        if (animationsDisabled(element, parentElement)) {
          fireDOMOperation();
          fireBeforeCallbackAsync();
          fireAfterCallbackAsync();
          closeAnimation();
          return noopCancel;
        }

        var ngAnimateState  = element.data(NG_ANIMATE_STATE) || {};
        var runningAnimations     = ngAnimateState.active || {};
        var totalActiveAnimations = ngAnimateState.totalActive || 0;
        var lastAnimation         = ngAnimateState.last;
        var skipAnimation = false;

        if (totalActiveAnimations > 0) {
          var animationsToCancel = [];
          if (!runner.isClassBased) {
            if (animationEvent == 'leave' && runningAnimations['ng-leave']) {
              skipAnimation = true;
            } else {
              //cancel all animations when a structural animation takes place
              for (var klass in runningAnimations) {
                animationsToCancel.push(runningAnimations[klass]);
              }
              ngAnimateState = {};
              cleanup(element, true);
            }
          } else if (lastAnimation.event == 'setClass') {
            animationsToCancel.push(lastAnimation);
            cleanup(element, className);
          } else if (runningAnimations[className]) {
            var current = runningAnimations[className];
            if (current.event == animationEvent) {
              skipAnimation = true;
            } else {
              animationsToCancel.push(current);
              cleanup(element, className);
            }

            if (after) {
              var result = after();
              after = null;
              return result;
            }
          }
        }
      };

      function executeAnimationFn(fn, element, method, add, remove, options, onDone) {
        var args = [element];
        if (method == 'setClass') {
          args.push(add);
          args.push(remove);
        } else if (method == 'addClass' || method == 'removeClass') {
          args.push(add || remove);
        }
        if (onDone) {
          args.push(onDone);
        }
        args.push(options);

        return fn.apply(fn, args);
      }

      function packageResult(value, done) {
        return { value : value, done : done };
      }

      function packageAnimations(element, method, fnName, add, remove, options, animations) {
        var asyncOperations = [];
        var syncOperations = [];
        angular.forEach(animations, function(ani) {
          var animation = ani[fnName];
          if (animation) {
            // beforeMove and beforeEnter MUST be synchronous. This ensures that
            // the DOM operation happens at the right time for things to work properly
            var syncAnimation = fnName == 'beforeEnter' || fnName == 'beforeMove';
            if (syncAnimation) {
              syncOperations.push(function() {
                var result = executeAnimationFn(animation, element, method, add, remove, options);
                return result === false ? false : result;
              });
            } else {
              asyncOperations.push(function() {
                var defer = $$qAnimate.defer();
                executeAnimationFn(animation, element, method, add, remove, options, function(result) {
                  result === false ? defer.reject() : defer.resolve();
                });
                return defer.promise;
              });
            }
          }
        });

        if (!syncOperations.length && !asyncOperations.length) return;

        return function() {
          angular.forEach(syncOperations, function(op) {
            op();
          });

          var promises = [];
          if (asyncOperations.length) {
            angular.forEach(asyncOperations, function(op) {
              promises.push(op());
            });
          }

          return packageResult(promises.length ? $$qAnimate.all(promises) : true);
        };
      }

      function lookupAnimations(classes) {
        var matches = [], flagMap = {};
        for (var i=0; i < classes.length; i++) {
          var klass = classes[i],
              selectorFactoryName = selectors[klass];
          if (selectorFactoryName && !flagMap[klass]) {
            matches.push($injector.get(selectorFactoryName));
            flagMap[klass] = true;
          }
        }
        return matches;
      }
    }];
  }]);
