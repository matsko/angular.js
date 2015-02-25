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
var TIMING_KEY = 'TimingFunction';
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
    var val = detectedStyles[style];
    // only numerical-based values have a digit as the first value
    if (val) {
      if (val.charAt(0) >= 0) {
        val = parseMaxTime(val);
      }
      styles[prop] = val;
    }
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

function getCssTransitionDurationStyle(duration, applyOnlyDuration) {
  var style = TRANSITION_PROP;
  var value = duration + 's';
  if (applyOnlyDuration) {
    style += DURATION_KEY;
  } else {
    value += ' linear all';
  }
  return [style, value];
}

function getCssKeyframeDurationStyle(duration) {
  return [ANIMATION_PROP + DURATION_KEY, duration + 's'];
}

function getCssDelayStyle(delay, isKeyframeAnimation) {
  var prop = (isKeyframeAnimation ? ANIMATION_PROP : TRANSITION_PROP) + DELAY_KEY;
  return [prop, delay + 's'];
}

function blockTransitions(node, bool) {
  var value = bool ? 'none' : '';
  var key = TRANSITION_PROP + PROPERTY_KEY;
  applyInlineStyle(node, key, value);
  return [key, value];
}

function blockAnimations(node, bool) {
  var value = bool ? 'paused' : '';
  var key = ANIMATION_PROP + ANIMATION_PLAYSTATE_KEY;
  applyInlineStyle(node, key, value);
  return [key, value]
}

function applyInlineStyle(node, key, value) {
  if (arguments.length == 2) {
    value = key[1];
    key = key[0];
  }
  node.style[key] = value;
}

function LocalCacheLookup() {
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

var $AnimateCssProvider = ['$animateProvider', function($animateProvider) {
  var gcsLookup = new LocalCacheLookup();
  var gcsStaggerLookup = new LocalCacheLookup();
  this.$get = ['$window', '$$jqLite', '$qRaf', '$timeout', '$$rAF', '$animateRunner', '$document',
       function($window,   $$jqLite,   $qRaf,   $timeout,   $$rAF,   $animateRunner,   $document) {

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
          var staggerClassName = pendClasses(className, '-stagger');

          $$jqLite.addClass(node, staggerClassName);

          stagger = computeCSSStyles($window, node, properties);

          $$jqLite.removeClass(node, staggerClassName);

          gcsStaggerLookup.put(staggerCacheKey, stagger);
        }
      }

      return stagger;
    }

    var cancelLastRafRequest, rafDefered, bod = $document[0].body;
    function waitUntilQuiet() {
      if (cancelLastRafRequest) {
        cancelLastRafRequest(); //cancels the request
      }
      if (!rafDefered) {
        rafDefered = $qRaf.defer();
      }
      cancelLastRafRequest = $$rAF(function() {
        gcsLookup.flush();
        gcsStaggerLookup.flush();

        //the line below will force the browser to perform a repaint so
        //that all the animated elements within the animation frame will
        //be properly updated and drawn on screen. This is required to
        //ensure that the the preparation animation is properly flushed so that
        //the active state picks up from there. DO NOT REMOVE THIS LINE.
        var a = bod.offsetWidth + 1;

        var defered = rafDefered;
        rafDefered = null;
        defered.resolve();
      });
      return rafDefered.promise;
    };

    return init;

    function computeTimings(node, className, cacheKey) {
      var timings = computeCachedCSSStyles(node, className, cacheKey, {
        transitionDuration:      TRANSITION_PROP + DURATION_KEY,
        transitionDelay:         TRANSITION_PROP + DELAY_KEY,
        transitionProperty:      TRANSITION_PROP + PROPERTY_KEY,
        animationDuration:       ANIMATION_PROP  + DURATION_KEY,
        animationDelay:          ANIMATION_PROP  + DELAY_KEY,
        animationIterationCount: ANIMATION_PROP  + ANIMATION_ITERATION_COUNT_KEY
      });

      timings.maxDelay = Math.max(timings.animationDelay, timings.transitionDelay);
      timings.maxDuration = Math.max(
          timings.animationDuration * timings.animationIterationCount,
          timings.transitionDuration);

      return timings;
    }

    function init(element, options) {
      var node = element[0];
      var temporaryStyles = [];
      var classes = element.attr('class');
      var styles = packageStyles(options);
      var animationClosed;
      var animationPaused;
      var animationCompleted;
      var defered;

      if (options.duration === 0) {
        close();
        return;
      }

      options = options || {};
      var method = options.event && isArray(options.event)
            ? options.event.join(' ')
            : options.event;
      var structural = method && [' addClass ',' removeClass '].indexOf(' ' + method + ' ') == -1;

      var structuralClassName = '';
      var addRemoveClassName = '';

      if (structural) {
        structuralClassName = pendClasses(method, 'ng-', true);
      }

      if (options.addClass) {
        addRemoveClassName += pendClasses(options.addClass, '-add');
      }

      if (options.removeClass) {
        if (addRemoveClassName.length) {
          addRemoveClassName += ' ';
        }
        addRemoveClassName += pendClasses(options.removeClass, '-remove');
      }

      var setupClasses = [structuralClassName, addRemoveClassName].join(' ').trim();
      var fullClassName =  classes + ' ' + setupClasses;
      var activeClasses = pendClasses(setupClasses, '-active');
      var hasStyles = styles.to && Object.keys(styles.to).length > 0;

      // there is no way we can trigger an animation since no styles or
      // no classes are being applied which would then trigger a transition
      if (!hasStyles && !setupClasses) {
        close();
        return false;
      }

      var cacheKey, stagger;
      if (options.stagger > 0) {
        var staggerVal = parseFloat(options.stagger);
        stagger = {
          transitionDelay: staggerVal,
          animationDelay: staggerVal,
          transitionDuration: 0,
          animationDuration: 0
        };
      } else {
        cacheKey = gcsHashFn(node, fullClassName);
        stagger = computeCachedCSSStaggerStyles(node, setupClasses, cacheKey, {
          transitionDelay:    TRANSITION_PROP + DELAY_KEY,
          transitionDuration: TRANSITION_PROP + DURATION_KEY,
          animationDelay:     ANIMATION_PROP  + DELAY_KEY,
          animationDuration:  ANIMATION_PROP  + DURATION_KEY
        });
      }

      $$jqLite.addClass(element, setupClasses);

      if (options.transitionStyle) {
        var transitionStyle = [TRANSITION_PROP, options.transitionStyle]
        applyInlineStyle(node, transitionStyle);
        temporaryStyles.push(transitionStyle);
      }

      if (options.duration >= 0) {
        var applyOnlyDuration = node.style[TRANSITION_PROP].length > 0;
        var durationStyle = getCssTransitionDurationStyle(options.duration, applyOnlyDuration);

        // we set the duration so that it will be picked up by getComputedStyle later
        applyInlineStyle(node, durationStyle);
        temporaryStyles.push(durationStyle);
      }

      if (options.keyframeStyle) {
        var keyframeStyle = [ANIMATION_PROP, options.keyframeStyle]
        applyInlineStyle(node, keyframeStyle);
        temporaryStyles.push(keyframeStyle);
      }

      var timings = computeTimings(node, fullClassName, cacheKey);
      var maxDelay = timings.maxDelay;
      var maxDuration = timings.maxDuration;

      var flags = {};
      flags.hasTransitions          = timings.transitionDuration > 0;
      flags.hasAnimations           = timings.animationDuration > 0;
      flags.hasTransitionAll        = flags.hasTransitions && timings.transitionProperty == 'all';
      flags.applyStyles             = hasStyles && maxDuration > 0;
      flags.applyTransitionDuration = hasStyles && (
                                        (flags.hasTransitions && !flags.hasTransitionAll)
                                         || (flags.hasAnimations && !flags.hasTransitions));
      flags.applyAnimationDuration   = options.duration && flags.hasAnimations;
      flags.applyTransitionDelay     = options.delay >= 0 && (flags.applyTransitionDuration || flags.hasTransitions);
      flags.applyAnimationDelay      = options.delay >= 0 && flags.hasAnimations;
      flags.recalculateTimingStyles  = addRemoveClassName.length > 0;

      if (flags.applyTransitionDuration || flags.applyAnimationDuration) {
        maxDuration = options.duration ? parseFloat(options.duration) : maxDuration;

        if (flags.applyTransitionDuration) {
          flags.hasTransitions = true;
          timings.transitionDuration = maxDuration;
          var applyOnlyDuration = node.style[TRANSITION_PROP].length > 0;
          temporaryStyles.push(getCssTransitionDurationStyle(maxDuration, applyOnlyDuration));
        }

        if (flags.applyAnimationDuration) {
          flags.hasAnimations = true;
          timings.animationDuration = maxDuration;
          temporaryStyles.push(getCssKeyframeDurationStyle(maxDuration));
        }
      }

      if (flags.applyTransitionDelay || flags.applyAnimationDelay) {
        maxDelay = typeof options.delay !== "boolean" && options.delay >= 0 ? parseFloat(options.delay) : maxDelay;

        if (flags.applyTransitionDelay) {
          timings.transitionDelay = maxDelay;
          temporaryStyles.push(getCssDelayStyle(maxDelay));
        }

        if (flags.applyAnimationDelay) {
          timings.animationDelay = maxDelay;
          temporaryStyles.push(getCssDelayStyle(maxDelay, true));
        }
      }

      flags.transitionClassBlock = timings.transitionProperty === 'none' &&
                                   timings.transitionDuration === 0;

      // there may be a situation where a structural animation is combined together
      // with CSS classes that need to resolve before the animation is computed.
      // However this means that there is no explicit CSS code to block the animation
      // from happening (by setting 0s none in the class name). If this is the case
      // we need to apply the classes before the first rAF so we know to continue if
      // there actually is a detected transition or keyframe animation
      var applyClassesEarly = maxDuration === 0
                               && structural
                               && addRemoveClassName.length > 0
                               && !flags.transitionClassBlock;

      if (applyClassesEarly) {
        applyClasses();

        // no need to calculate this anymore
        flags.recalculateTimingStyles = false;

        fullClassName = node.className + ' ' + setupClasses;
        cacheKey = gcsHashFn(node, fullClassName);

        timings = computeTimings(node, fullClassName, cacheKey);
        maxDelay = timings.maxDelay;
        maxDuration = timings.maxDuration;
      }

      if (maxDuration === 0 && !flags.recalculateTimingStyles) {
        close();
        return false;
      }

      var maxDelayTime = maxDelay * ONE_SECOND;
      var maxDurationTime = maxDuration * ONE_SECOND;

      var itemIndex = stagger
          ? options.staggerIndex >= 0
              ? options.staggerIndex
              : gcsLookup.count(cacheKey) - 1
          : 0;
      if (!options.skipBlocking) {
        flags.blockTransition = hasStyles || (structural && timings.transitionDuration > 0);
        flags.blockAnimation = timings.animationDuration > 0 &&
                               stagger.animationDelay > 0 &&
                               stagger.animationDuration === 0;
      }

      if (flags.blockTransition) {
        applyStyles(true, false);
      }
      applyBlocking(true);

      return {
        start: function() {
          if (animationClosed) return;

          defered = $qRaf.defer();
          waitUntilQuiet().then(function() {
            start(defered);
          });

          // we don't have access to pause/resume the animation
          // since it hasn't run yet. AnimateRunner will therefore
          // set noop functions for resume and pause and they will
          // later be overridden once the animation is triggered
          return $animateRunner(defered.promise, {
            end: endFn,
            cancel: cancelFn
          });
        },
        end: endFn,
        cancel: cancelFn,
        duration: maxDuration,
        delay: maxDelay,
        transitions: timings.transitionDuration > 0,
        keyframes: timings.animationDuration > 0
      };

      function endFn() {
        close();
      }

      function cancelFn() {
        close(true);
      }

      function close(rejected) {
        // if the promise has been called already then we shouldn't close
        // the animation again
        if (animationClosed || (animationCompleted && animationPaused)) return;
        animationClosed = true;
        animationPaused = false;

        $$jqLite.removeClass(element, setupClasses);
        $$jqLite.removeClass(element, activeClasses);

        forEach(temporaryStyles, function(entry) {
          // There is only one way to remove inline style properties entirely from elements.
          // By using `removeProperty` this works, but we need to convert camel-cased CSS
          // styles down to hyphenated values.
          node.style.removeProperty(normalizeCssProp(entry[0]));
        });

        applyClasses();
        applyStyles(true, true);

        // if the preparation function fails then the promise is not setup
        if (defered) {
          rejected ? defered.reject() : defered.resolve();
        }
      }

      function applyClasses() {
        if (options.addClass) {
          element.addClass(options.addClass);
          delete options.addClass;
        }

        if (options.removeClass) {
          element.removeClass(options.removeClass);
          delete options.removeClass;
        }
      }

      function applyStyles(from, to) {
        if (from && styles.from) {
          element.css(styles.from);
          delete styles.from;
        }

        if (to && styles.to) {
          element.css(styles.to);
          delete styles.to;
        }
      }

      function applyBlocking(on) {
        if (flags.blockTransition) {
          blockTransitions(node, on);
        }

        if (flags.blockAnimation) {
          blockAnimations(node, on);
        }
      }

      function start() {
        if (animationClosed) return;

        var startTime, events = [];
        var playPause = function(bool) {
          if (!animationCompleted) {
            animationPaused = !bool;
            if (timings.animationDuration) {
              var value = blockAnimations(node, animationPaused);
              animationPaused
                  ? temporaryStyles.push(value)
                  : arrayRemove(temporaryStyles, value);
            }
          } else if (animationPaused && bool) {
            animationPaused = false;
            close();
          }
        };

        // checking the stagger duration prevents an accidently cascade of the CSS delay style
        // being inherited from the parent. If the transition duration is zero then we can safely
        // rely that the delay value is an intential stagger delay style.
        var maxStagger = itemIndex > 0
                         && ((timings.transitionDuration && stagger.transitionDuration === 0) ||
                            (timings.animationDuration && stagger.animationDuration === 0))
                         && Math.max(stagger.animationDelay, stagger.transitionDelay);
        if (maxStagger) {
          $timeout(triggerAnimationStart,
                   Math.floor(maxStagger * itemIndex * ONE_SECOND),
                   false);
        } else {
          triggerAnimationStart();
        }

        // this will decorate the existing promise runner with pause/resume methods
        $animateRunner(defered.promise, {
          resume: function() {
            playPause(true);
          },
          pause: function() {
            playPause(false);
          }
        });

        return defered.promise;

        function triggerAnimationStart() {
          // just incase a stagger animation kicks in when the animation
          // itself was cancelled entirely
          if (animationClosed) return;

          applyBlocking(false);

          forEach(temporaryStyles, function(entry) {
            var key = entry[0];
            var value = entry[1];
            node.style[key] = value;
          });

          applyClasses();
          $$jqLite.addClass(element, activeClasses);

          if (flags.recalculateTimingStyles) {
            fullClassName = node.className + ' ' + setupClasses;
            cacheKey = gcsHashFn(node, fullClassName);

            timings = computeTimings(node, fullClassName, cacheKey);
            maxDelay = timings.maxDelay;
            maxDuration = timings.maxDuration;
            maxDelayTime = maxDelay * ONE_SECOND;
            maxDurationTime = maxDuration * ONE_SECOND;

            if (maxDuration === 0) {
              close();
              return;
            }

            flags.hasTransitions = timings.transitionDuration > 0;
            flags.hasAnimations = timings.animationDuration > 0;
          }

          if (options.easing) {
            var easeProp, easeVal = options.easing;
            if (flags.hasTransitions) {
              easeProp = TRANSITION_PROP + TIMING_KEY;
              temporaryStyles.push([easeProp, easeVal]);
              node.style[easeProp] = easeVal;
            }
            if (flags.hasAnimations) {
              easeProp = ANIMATION_PROP + TIMING_KEY;
              temporaryStyles.push([easeProp, easeVal]);
              node.style[easeProp] = easeVal;
            }
          }

          if (timings.transitionDuration) {
            events.push(TRANSITIONEND_EVENT);
          }

          if (timings.animationDuration) {
            events.push(ANIMATIONEND_EVENT);
          }

          startTime = Date.now();
          element.on(events.join(' '), onAnimationProgress);
          $timeout(onAnimationExpired, maxDelayTime + CLOSING_TIME_BUFFER * maxDurationTime);

          applyStyles(false, true);
        }

        function onAnimationExpired() {
          // although an expired animation is a failed animation, getting to
          // this outcome is very easy if the CSS code screws up. Therefore we
          // should still continue normally as if the animation completed correctly
          close();
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
            // we set this flag to ensure that if the transition is paused then, when resumed,
            // the animation will automatically close itself since transitions cannot be paused.
            animationCompleted = true;
            close();
          }
        }
      };
    }
  }]
}];
