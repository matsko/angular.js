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
        start : function() {
          return animatorOut.start().then(function() {
            var animatorIn = prepareInAnimation();
            return animatorIn ? animatorIn.start().then(end) : end();
          });
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
          styles[key] = value + 'px';
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
          removeClass: 'out ' + startingClasses,
          delay: true,
          addClass: 'in ' + classes
        });
      }

      function getUniqueValues(a, b) {
        if (isString(a)) a = a.split(' ');
        if (isString(b)) b = b.split(' ');
        return a.filter(function(val) {
          return b.indexOf(val) === -1;
        }).join(' ');
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
        var animator = prepareAnchoredAnimation(classes, anchor['out'], anchor['in']);
        if (animator) {
          anchorAnimations.push(animator);
        }
      });

      // no point in doing anything when there are no elements to animate
      if (!fromAnimation && !toAnimation && anchorAnimations.length === 0) return;

      return {
        start : function() {
          var runner, animations = [];
          if (fromAnimation) {
            runner = fromAnimation.start().then(function() {
              fromAnimation.domOperation();
            });
            animations.push(runner);
          }

          if (toAnimation) {
            runner = toAnimation.start().then(function() {
              toAnimation.domOperation();
            });
            animations.push(runner);
          }

          forEach(anchorAnimations, function(animation) {
            animations.push(animation.start());
          });

          return $qRaf.all(animations);
        }
      }
    }

    function prepareRegularAnimation(details) {
      var element = details.element;
      var event = details.event;
      var domOperation = details.domOperation || noop;

      var options = details.options || {};
      options.event = event;

      if (event === 'enter' || event === 'move') {
        domOperation();
      }

      var runner = $animateCss(element, options);
      if (runner) {
        runner.domOperation = (event === 'leave' && domOperation) || noop;
      }

      return runner;
    }
  }]
}];
