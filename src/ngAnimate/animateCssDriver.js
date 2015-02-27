var $AnimateCssDriverProvider = ['$animationProvider', function($animationProvider) {
  $animationProvider.drivers.push('$$animateCssDriver');

  var NG_ANIMATE_SHIM_CLASS_NAME = 'ng-animate-shim';
  var NG_ANIMATE_ANCHOR_CLASS_NAME = 'ng-animate-anchor';
  var NG_ANIMATE_ANCHOR_SUFFIX = '-anchor';

  this.$get = ['$qRaf', '$animateCss', '$rootScope', '$animateRunner', '$rootElement', '$document',
       function($qRaf,   $animateCss,   $rootScope,   $animateRunner,   $rootElement,   $document) {

    var bodyNode = $document[0].body;
    var rootNode = $rootElement[0];

    var rootBodyElement = jqLite(bodyNode.parentNode === rootNode ? bodyNode : rootNode);

    return function(details) {
      return details.from && details.to
          ? prepareTransitionAnimation(details.from, details.to, details.classes, details.anchors)
          : prepareRegularAnimation(details);
    };

    function filterCssClasses(classes) {
      //remove all the `ng-` stuff
      return classes.replace(/\bng-\S+\b/g, '');
    }

    function getUniqueValues(a, b) {
      if (isString(a)) a = a.split(' ');
      if (isString(b)) b = b.split(' ');
      return a.filter(function(val) {
        return b.indexOf(val) === -1;
      }).join(' ');
    }

    function prepareAnchoredAnimation(classes, outAnchor, inAnchor) {
      var clone = jqLite(outAnchor[0].cloneNode(true));
      var startingClasses = filterCssClasses(clone.attr('class') || '');
      var anchorClasses = pendClasses(classes, NG_ANIMATE_ANCHOR_SUFFIX);

      outAnchor.addClass(NG_ANIMATE_SHIM_CLASS_NAME);
      inAnchor.addClass(NG_ANIMATE_SHIM_CLASS_NAME);

      clone.addClass(NG_ANIMATE_ANCHOR_CLASS_NAME);
      clone.addClass(anchorClasses);

      rootBodyElement.append(clone);

      var animatorOut = prepareOutAnimation();
      if (!animatorOut) return end();

      return {
        start: function() {
          var currentAnimation = animatorOut.start();
          promise = currentAnimation.then(function() {
            currentAnimation = null;
            var animatorIn = prepareInAnimation();
            if (animatorIn) {
              currentAnimation = animatorIn.start();
              return currentAnimation.then(function() {
                currentAnimation = null;
                end();
              });
            }
            // in the event that there is no `in` animation
            end();
          });

          return $animateRunner(promise, {
            end: endFn,
            cancel: endFn
          });

          function endFn() {
            if(currentAnimation) currentAnimation.end();
          }
        }
      };

      function calculateAnchorStyles(anchor) {
        var styles = {};
        forEach(anchor[0].getBoundingClientRect(), function(value, key) {
          switch(key) {
            case 'right':
            case 'bottom':
              return;
              break;

            case 'top':
              value += bodyNode.scrollTop;
              break;
            case 'left':
              value += bodyNode.scrollLeft;
              break;
          }
          styles[key] = Math.floor(value) + 'px';
        });
        return styles;
      }

      function prepareOutAnimation() {
        return $animateCss(clone, {
          addClass: 'out',
          delay: true,
          from: calculateAnchorStyles(outAnchor)
        });
      }

      function prepareInAnimation() {
        var endingClasses = filterCssClasses(inAnchor.attr('class'));
        var classes = getUniqueValues(endingClasses, startingClasses);
        return $animateCss(clone, {
          to: calculateAnchorStyles(inAnchor),
          addClass: 'in ' + classes,
          removeClass: 'out ' + startingClasses,
          delay: true
        });
      }

      function end() {
        clone.remove();
        outAnchor.removeClass(NG_ANIMATE_SHIM_CLASS_NAME);
        inAnchor.removeClass(NG_ANIMATE_SHIM_CLASS_NAME);
      }
    }

    function prepareTransitionAnimation(from, to, classes, anchors) {
      var fromAnimation = prepareRegularAnimation(from);
      var toAnimation = prepareRegularAnimation(to);

      var anchorAnimations = [];
      forEach(anchors, function(anchor) {
        var outElement = anchor['out'];
        var inElement = anchor['in'];
        var animator = prepareAnchoredAnimation(classes, outElement, inElement);
        if (animator) {
          anchorAnimations.push(animator);
        }
      });

      // no point in doing anything when there are no elements to animate
      if (!fromAnimation && !toAnimation && anchorAnimations.length === 0) return;

      return {
        start : function() {
          var animations = [];

          if (fromAnimation) {
            animations.push(fromAnimation.start());
          }

          if (toAnimation) {
            animations.push(toAnimation.start());
          }

          forEach(anchorAnimations, function(animation) {
            animations.push(animation.start());
          });

          var promise = $qRaf.all(animations);
          return $animateRunner(promise, {
            end: endFn,
            cancel: endFn // CSS-driven animations cannot be cancelled, only ended
          });

          function endFn() {
            forEach(animations, function(animation) {
              animation.end();
            });
          }
        }
      }
    }

    function prepareRegularAnimation(details) {
      var element = details.element;
      var options = details.options || {};

      // we special case the leave animation since we want to ensure that
      // the element is removed as soon as the animation is over. Otherwise
      // a flicker might appear or the element may not be removed at all
      options.event = details.event;
      if (options.event === 'leave' && details.domOperation) {
        options.onDone = details.domOperation;
      }

      return $animateCss(element, options);
    }
  }]
}];
