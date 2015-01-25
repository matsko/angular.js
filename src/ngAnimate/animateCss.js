'use strict';

// Detect proper transitionend/animationend event names.
var CSS_PREFIX = '', TRANSITION_PROP, TRANSITIONEND_EVENT, ANIMATION_PROP, ANIMATIONEND_EVENT;

// If unprefixed events are not supported but webkit-prefixed are, use the latter.
// Otherwise, just use W3C names, browsers not supporting them at all will just ignore them.
// Note: Chrome implements `window.onwebkitanimationend` and doesn't implement `window.onanimationend`
// but at the same time dispatches the `animationend` event and not `webkitAnimationEnd`.
// Register both events in case `window.onanimationend` is not supported because of that,
// do the same for `transitionend` as Safari is likely to exhibit similar behavior.
// Also, the only modern browser that uses vendor prefixes for transitions/keyframes is webkit
// therefore there is no reason to test anymore for other vendor prefixes:
// http://caniuse.com/#search=transition
if (window.ontransitionend === undefined && window.onwebkittransitionend !== undefined) {
  CSS_PREFIX = '-webkit-';
  TRANSITION_PROP = 'WebkitTransition';
  TRANSITIONEND_EVENT = 'webkitTransitionEnd transitionend';
} else {
  TRANSITION_PROP = 'transition';
  TRANSITIONEND_EVENT = 'transitionend';
}

if (window.onanimationend === undefined && window.onwebkitanimationend !== undefined) {
  CSS_PREFIX = '-webkit-';
  ANIMATION_PROP = 'WebkitAnimation';
  ANIMATIONEND_EVENT = 'webkitAnimationEnd animationend';
} else {
  ANIMATION_PROP = 'animation';
  ANIMATIONEND_EVENT = 'animationend';
}

var DURATION_KEY = 'Duration';
var PROPERTY_KEY = 'Property';
var DELAY_KEY = 'Delay';
var ANIMATION_ITERATION_COUNT_KEY = 'IterationCount';
var ANIMATION_PLAYSTATE_KEY = 'PlayState';
var ELAPSED_TIME_MAX_DECIMAL_PLACES = 3;
var CLOSING_TIME_BUFFER = 1.5;
var ONE_SECOND = 1000;
var BASE_TEN = 10;

function computeCSSStyles($window, element, properties) {
  var styles = {};

  var detectedStyles = $window.getComputedStyle(element) || {};
  forEach(properties, function(style, prop) {
    styles[prop] = parseMaxTime(detectedStyles[style]);
  });

  return styles;
}

function parseMaxTime(str) {
  var maxValue = 0;
  var values = isString(str) ?
    str.split(/\s*,\s*/) :
    [];
  forEach(values, function(value) {
    maxValue = Math.max(parseFloat(value) || 0, maxValue);
  });
  return maxValue;
}

function getCssDuration(duration, isKeyframeAnimation) {
  return isKeyframeAnimation
    ? [ANIMATION_PROP + DURATION_KEY, duration + 's']
    : [TRANSITION_PROP, duration + 's linear all'];
}

function getCssDelay(delay, isKeyframeAnimation) {
  var prop = (isKeyframeAnimation ? ANIMATION_PROP : TRANSITION_PROP) + DELAY_KEY;
  return [prop, delay + 's'];
}

function blockTransitions(node, bool) {
  node.style[TRANSITION_PROP + PROPERTY_KEY] = bool ? 'none' : '';
}

function blockAnimations(node, bool) {
  node.style[ANIMATION_PROP + ANIMATION_PLAYSTATE_KEY] = bool ? 'paused' : '';
}

function Lookup() {
  var cache = {};
  return {
    flush : function() {
      cache = {};
    },

    count : function(key) {
      var entry = cache[key];
      return entry ? entry.total : 0;
    },

    get : function(key) {
      var entry = cache[key];
      return entry && entry.value;
    },

    put : function(key, value) {
      if (!cache[key]) {
        cache[key] = { total : 0 };
      }
      cache[key].total++;
      cache[key].value = value;
    }
  }
}

var $animateCssProvider = ['$animateProvider', function($animateProvider) {
  var gcsLookup = new Lookup();
  var gcsStaggerLookup = new Lookup();
  this.$get = ['$window', '$$jqLite', '$$qAnimate', '$timeout', '$$rAF',
       function($window,   $$jqLite,   $$qAnimate,   $timeout,   $$rAF) {

    var parentCounter = 0;
    function gcsHashFn(node, extraClasses) {
      var KEY = "$$ngAnimateParentKey";
      var parentNode = node.parentNode;
      var parentID = parentNode[KEY] || (parentNode[KEY] = ++parentCounter);
      return parentID + '-' + node.getAttribute('class') + '-' + extraClasses;
    }

    function computeCachedCSSStyles(node, className, cacheKey, properties) {
      var timings = gcsLookup.get(cacheKey);

      if (!timings) {
        timings = computeCSSStyles($window, node, properties);
        if (timings.animationIterationCount) {
          timings.animationIterationCount = parseInt(timings.animationIterationCount || 1, BASE_TEN);
        }
      }

      // we keep putting this in multiple times even though the value and the cacheKey are the same
      // because we're keeping an interal tally of how many duplicate animations are detected.
      gcsLookup.put(cacheKey, timings);
      return timings;
    }

    function computeCachedCSSStaggerStyles(node, className, cacheKey, properties) {
      var stagger = {};
      var isRepeated = gcsLookup.count(cacheKey) > 0;

      if (isRepeated) {
        var staggerCacheKey = cacheKey + '-stagger';
        stagger = gcsStaggerLookup.get(staggerCacheKey);

        if (!stagger) {
          var staggerClassName = suffixClasses(className, '-stagger');

          $$jqLite.addClass(node, staggerClassName);

          stagger = computeCSSStyles($window, node, properties);

          $$jqLite.removeClass(node, staggerClassName);

          gcsStaggerLookup.put(staggerCacheKey, stagger);
        }
      }

      return stagger;
    }

    var lastRafRequest, rafDefered;
    init.waitUntilQuiet = function() {
      if (lastRafRequest) {
        lastRafRequest(); //cancels the request
      }
      if (!rafDefered) {
        rafDefered = $$qAnimate.defer();
      }
      lastRafRequest = $$rAF(function() {
        gcsLookup.flush();
        gcsStaggerLookup.flush();
        var defered = rafDefered;
        rafDefered = null;
        defered.resolve();
      });
      return rafDefered.promise;
    };

    return init;

    function init(element, method, options) {
      var node = element[0];
      var temporaryStyles = [];
      var classes = element.attr('class');

      options = options || {};
      var styles = packageStyles(options);

      var enterOrMove = method == 'enter' || method == 'move';
      var structural = enterOrMove || method == 'leave';
      var setupClasses = structural
          ? 'ng-' + method
          : (suffixClasses(options.add, '-add') + ' ' +
             suffixClasses(options.remove, '-remove')).trim();

      var fullClassName =  classes + ' ' + setupClasses;
      var activeClasses = suffixClasses(setupClasses, '-active');
      var cacheKey = gcsHashFn(node, fullClassName);

      var stagger = computeCachedCSSStaggerStyles(node, fullClassName, cacheKey, {
        transitionDelay: TRANSITION_PROP + DELAY_KEY,
        animationDelay:  ANIMATION_PROP  + DELAY_KEY
      });

      $$jqLite.addClass(element, setupClasses);

      var timings = computeCachedCSSStyles(node, fullClassName, cacheKey, {
        transitionDuration:      TRANSITION_PROP + DURATION_KEY,
        transitionDelay:         TRANSITION_PROP + DELAY_KEY,
        animationDuration:       ANIMATION_PROP  + DURATION_KEY,
        animationDelay:          ANIMATION_PROP  + DELAY_KEY,
        animationIterationCount: ANIMATION_PROP  + ANIMATION_ITERATION_COUNT_KEY
      });

      var isKeyframeAnimation = timings.animationTransition == 0 && timings.animationDuration > 0;
      var maxDelayTime = Math.max(timings.animationDelay, timings.transitionDelay) * ONE_SECOND;
      var maxDuration = Math.max(
        timings.animationDuration * timings.animationIterationCount,
        timings.transitionDuration);

      var durationStyle;
      if (options.duration >= 0) {
        maxDuration = parseFloat(options.duration);
        timings[isKeyframeAnimation ? 'animationDuration' : 'transitionDuration'] = maxDuration;
        durationStyle = getCssDuration(maxDuration, isKeyframeAnimation);
        node.style[durationStyle[0]] = durationStyle[1];
        temporaryStyles.push(durationStyle[0]);
      }

      var delayStyle;
      if (options.delay >= 0) {
        var maxDelay = parseFloat(options.delay);
        maxDelayTime = maxDelay * 1000;
        delayStyle = getCssDelay(maxDelay, isKeyframeAnimation);
        timings[isKeyframeAnimation ? 'animationDelay' : 'transitionDelay'] = maxDelay;
        temporaryStyles.push(delayStyle[0]);
      }

      if (maxDuration === 0) {
        if (options && (options.from || options.to)) {
          var styles = angular.extend({}, options.from, options.to);
          element.css(styles);
        }
        close();
        return false;
      }

      var itemIndex = stagger ? gcsLookup.count(cacheKey) - 1 : 0;
      var blockTransition = styles || (structural && timings.transitionDuration > 0);
      var blockAnimation = timings.animationDuration > 0 &&
                           stagger.animationDelay > 0 &&
                           stagger.animationDuration === 0;

      var playPause = function(bool) {
        if (timings.transitionDuration) {
          blockTransitions(node, false);
        }

        if (timings.animationDuration) {
          blockAnimations(node, false);
        }
      }

      if (blockTransition) {
        if (styles && styles.from) {
          element.css(styles.from);
        }
        blockTransitions(node, false);
      }

      if (blockAnimation) {
        blockAnimations(node, false);
      }

      return {
        start : start,
        resume : function() {
          playPause(true);
        },
        pause : function() {
          playPause(false);
        }
      };

      function close() {
        $$jqLite.removeClass(element, setupClasses);
        $$jqLite.removeClass(element, activeClasses);

        angular.forEach(temporaryStyles, function(style) {
          node.style.removeProperty(style);
        });
      }

      function start() {
        var events = [];

        if (timings.animationDuration > 0) { events.push(ANIMATIONEND_EVENT); }
        if (timings.transitionDuration > 0) { events.push(TRANSITIONEND_EVENT); }
        if (blockTransition) { blockTransitions(node, false); }
        if (blockAnimation) { blockAnimations(node, false); }
        if (durationStyle) { node.style[durationStyle[0]] = durationStyle[1]; }
        if (delayStyle) { node.style[delayStyle[0]] = delayStyle[1]; }

        var defered = $$qAnimate.defer();
        var startTime = Date.now();
        element.on(events.join(' '), onAnimationProgress);

        var maxStagger = itemIndex && Math.max(stagger.animationDelay, stagger.transitionDelay);
        if (maxStagger) {
          var staggerWaitDelay = Math.floor(maxStagger * itemIndex * ONE_SECOND);
          $timeout(function() {
            startAnimation(true);
          }, staggerWaitDelay, false);
        } else {
          startAnimation();
        }

        return defered.promise;

        function startAnimation(hasStagger) {
          $$jqLite.addClass(element, activeClasses);

          if (options && options.to) {
            element.css(options.to);
          }
        }

        function onAnimationProgress(event) {
          event.stopPropagation();
          var ev = event.originalEvent || event;
          var timeStamp = ev.$manualTimeStamp || ev.timeStamp || Date.now();

          /* Firefox (or possibly just Gecko) likes to not round values up
           * when a ms measurement is used for the animation */
          var elapsedTime = parseFloat(ev.elapsedTime.toFixed(ELAPSED_TIME_MAX_DECIMAL_PLACES));

          /* $manualTimeStamp is a mocked timeStamp value which is set
           * within browserTrigger(). This is only here so that tests can
           * mock animations properly. Real events fallback to event.timeStamp,
           * or, if they don't, then a timeStamp is automatically created for them.
           * We're checking to see if the timeStamp surpasses the expected delay,
           * but we're using elapsedTime instead of the timeStamp on the 2nd
           * pre-condition since animations sometimes close off early */
          if (Math.max(timeStamp - startTime, 0) >= maxDelayTime && elapsedTime >= maxDuration) {
            onComplete();
          }
        }

        function onComplete() {
          close();
          defered.resolve();
        }
      };
    }
  }]
}];
