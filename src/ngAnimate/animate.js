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

            if(!domOperationCalled) {
              domOperationCalled = true;
              domOperation();
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

          return promises.length ? $$qAnimate.all(promises) : true;
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
