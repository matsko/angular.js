angular.module('ngAnimateLayout', ['ngAnimate'])

  .factory('$animateViewPort', ['$$animateSequence', '$animate', '$$animateChildren',
                        function($$animateSequence,   $animate,   $$animateChildren) {
    var pendingClassName = 'ng-queued';

    return function(element) {
      // this flag needs to be set such that all child animations can work
      $$animateChildren(element, true);

      var animationCtrl;
      var animationElement = element[0].querySelector('.ng-animation');
      if (animationElement) {
        animationCtrl = animationElement.data('$ngAnimationController');
      }
      var animationCtrl = animationCtrl || {};

      return {
        enter : function(parent, after, options) {
          var steps = animationCtrl.enter || [];
          if (steps.length) {
            var startSequence = enterAnimation(element, steps.enter);
            return enter().then(function() {
              return startSequence();
            });
          } else {
            return enter();
          }

          function enter() {
            return $animate.enter(element, parent, after, options);
          }
        },
        leave : function(options) {
          var steps = animationCtrl.leave || [];
          return steps.length
            ? leaveAnimation(element, steps)().then(leave)
            : leave();

          function leave() {
            return $animate.leave(element, options);
          }
        }
      }
    }

    function enterAnimation(container, steps) {
      angular.forEach(steps, function(step) {
        var elements = container[0].querySelectorAll(step.selector) || [];
        angular.forEach(elements, function(element) {
          angular.element(element).addClass(pendingClassName);
        });
      });
      return $$animateSequence(container, steps, function(element, step, index) {
        // this is a fake animation event to emulate an enter animation
        return $animate.animate(element, step.from, step.to, 'ng-enter', pendingClassName);
      })
    }

    function leaveAnimation(container, steps) {
      return $$animateSequence(container, steps, function(element, step, index) {
        element[0].$$NG_REMOVED = true;
        element.addClass(pendingClassName);
        // this is a fake animation event to emulate a leave animation. By doing this we
        // avoid reordering the DOM when the animations are complete since leave deletes nodes
        return $animate.animate(element, step.from, step.to, 'ng-leave', 'ng-animate-leave');
      })
    }
  }])

  .factory('$$animateSequence', ['$$q', '$timeout', '$filter',
                         function($$q,   $timeout,   $filter) {
    return function(container, steps, animateFn) {
      var sequence = [];
      angular.forEach(steps, function(step) {
        var stagger = step.stagger || 0;
        var elements = container[0].querySelectorAll(step.selector);
        if (step.filter) {
          elements = $filter(step.filter)(elements);
        }
        sequence.push(function() {
          var promises = [];
          angular.forEach(elements, function(element, index) {
            if (!element || element.$$NG_REMOVED) { return };
            element = angular.element(element);
            var delay = stagger * index;
            var promise = delay
              ? $timeout(angular.noop, delay, true).then(animate)
              : animate();

            promises.push(promise);
            function animate() {
              return animateFn(element, step, index);
            }
          });
          return $$q.all(promises);
        });
      });

      return function chainPromises() {
        var promise;
        angular.forEach(sequence, function(entry) {
          promise = promise ? promise.then(entry) : entry();
        });
        return promise;
      }
    }

  }])

  .factory('$$animateTemplates', ['$cacheFactory', function($cacheFactory) {
    return $cacheFactory();
  }])

  .factory('$$findSequenceOrGroup', function() {
    return function(element) {
      var parent = element;
      while((parent = parent.parent()).length == 1) {
        if (!parent.data('$animateDirective')) break;

        var ctrl = parent.data('$ngAnimateSequenceController') ||
                   parent.data('$ngAnimateGroupController');
        if (ctrl) {
          return ctrl;
        }
      }
    };
  })

  .directive('ngAnimation', ['$$animateTemplates', function($$animateTemplates) {
    return {
      controllerAs: 'animation',
      controller : ['$attrs', '$element', function($attrs, $element) {
        $element.addClass('ng-animation');
        if ($attrs.id) {
          $$animateTemplates.put($attrs.id, this);
        }
      }]
    };
  }])

  .directive('ngAnimateSequence', [function($$animateTemplates) {
    return {
      controllerAs: 'animateSequence',
      controller : ['$element', '$attrs', function($element, $attrs) {
        $element.data('$animateDirective', true);

        var animationCtrl = $element.inheritedData('$ngAnimationController');

        this.event = $attrs.on;
        var self = animationCtrl[this.event] = this;
        this.steps = [];
        this.register = function(data) {
          self.steps.push(data);
        };
      }]
    };
  }])

  .directive('ngAnimateGroup', ['$$findSequenceOrGroup', function($$findSequenceOrGroup) {
    return {
      controller : ['$element', '$attrs', function($element, $attrs) {
        $element.data('$animateDirective', true);

        var parent = $$findSequenceOrGroup($element);
        var group = $attrs;
        group.steps = [];

        parent.register(group);
        this.register = function(data) {
          group.steps.push(data);
        }
      }]
    }
  }])

  .directive('ngAnimate', ['$$findSequenceOrGroup', function($$findSequenceOrGroup) {
    return {
      link : function($scope, element, $attrs) {
        $$findSequenceOrGroup(element).register($attrs);
        element.data('$animateDirective', true);
      }
    }
  }]);
