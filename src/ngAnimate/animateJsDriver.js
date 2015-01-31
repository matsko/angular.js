'use strict';

var $NgAnimateJsDriverProvider = ['$animateProvider', function($animateProvider) {
  $animateProvider.drivers.push('ngAnimateJsDriver');

  var selectors = $animateProvider.$$selectors;
  this.$get = ['$injector', '$$qAnimate', function($injector, $$qAnimate) {
    return function(element, method, options) {
      var classes = element.attr('class');

      options = options || {};
      var domOperation = options.domOperation || noop;

      // the lookupAnimations function returns a series of animation objects that are
      // matched up with one or more of the CSS classes. These animation objects are
      // defined via the module.animation factory function.
      var animations = lookupAnimations(classes);
      if (animations.length === 0) return;

      var afterFn, beforeFn;
      if (method == 'leave') {
        beforeFn = 'leave';
        afterFn = 'afterLeave';
      } else {
        beforeFn = 'before' + method.charAt(0).toUpperCase() + method.substr(1);
        afterFn = method;
      }

      var cancelFn = noop;

      var before = packageAnimations(element, method, options, animations, beforeFn);
      var after  = packageAnimations(element, method, options, animations, afterFn);
      if (!before && !after) return;

      var domOperationCalled = false;
      return {
        cancel : function() {
          cancelFn();
        },
        next : function(index, previousData) {
          if (before) {
            var result = before();
            before = null;
            return yieldWith(result);
          }

          if(!domOperationCalled) {
            domOperationCalled = true;
            domOperation();
          }

          if (after) {
            var result = after();
            after = null;
            return yieldWith(result);
          }
        }
      }
    };

    function executeAnimationFn(fn, element, method, options, onDone) {
      var classesToAdd = options.add;
      var classesToRemove = options.remove;
      var args;

      switch(method) {
        case 'setClass':
          args = [element, classesToAdd, classesToRemove, onDone]
          break;

        case 'addClass':
          args = [element, classesToAdd, onDone]
          break;

        case 'removeClass':
          args = [element, classesToRemove, onDone]
          break;

        default:
          args = onDone ? [element, onDone] : [element]
          break;
      }

      return fn.apply(fn, args);
    }

    function packageAnimations(element, method, options, animations, fnName) {
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
              return executeAnimationFn(animation, element, method, options);
            });
          } else {
            // note that all of these animations should run in parallel
            asyncOperations.push(function() {
              var defer = $$qAnimate.defer();
              executeAnimationFn(animation, element, method, options, function(result) {
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
      classes = classes.split(' ');
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
}];
