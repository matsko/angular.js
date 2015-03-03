'use strict';

var NG_ANIMATE_ATTR_NAME = 'data-ng-animate';
var NG_ANIMATE_CHILDREN_DATA = '$$ngAnimateChildren';
var ELEMENT_NODE = 1;
var COMMENT_NODE = 8;

var $$AnimateQueueProvider = [function() {
  var PRE_DIGEST_STATE = 1;
  var RUNNING_STATE = 2;

  var rules = this.rules = {
    skip : [],
    cancel : [],
    join : []
  };

  function isAllowed(ruleType, element, currentAnimation, previousAnimation) {
    return rules[ruleType].some(function(fn) {
      return fn(element, currentAnimation, previousAnimation);
    });
  }

  function hasAnimationClasses(options, and) {
    var a = (options.addClass || '').length > 0;
    var b = (options.removeClass || '').length > 0;
    return and ? a && b : a || b;
  }

  rules.join.push(function(element, newAnimation, currentAnimation) {
    // if the new animation is class-based then we can just tack that on
    return !newAnimation.structural && hasAnimationClasses(newAnimation);
  });

  rules.skip.push(function(element, newAnimation, currentAnimation) {
    // there is no need to animate anything if no classes are being added and
    // there is no structural animation that will be triggered
    return !newAnimation.structural && !hasAnimationClasses(newAnimation);
  });

  rules.skip.push(function(element, newAnimation, currentAnimation) {
    // why should we trigger a new structural animation if the element will
    // be removed from the DOM anyway?
    return currentAnimation.event == 'leave' && newAnimation.structural;
  });

  rules.cancel.push(function(element, newAnimation, currentAnimation) {
    // there can never be two structural animations running at the same time
    return currentAnimation.structural && newAnimation.structural;
  });

  rules.cancel.push(function(element, newAnimation, currentAnimation) {
    // if the previous animation is already running, but the new animation will
    // be triggered, but the new animation is structural
    return currentAnimation.state === RUNNING_STATE && newAnimation.structural;
  });

  this.$get = ['$qRaf', '$rootScope', '$rootElement', '$document', '$$HashMap',
               '$$animation', '$$animateRunner', '$templateRequest', '$$animateOptions',
       function($qRaf,   $rootScope,   $rootElement,   $document,   $$HashMap,
                $$animation,   $$animateRunner,   $templateRequest,   $$animateOptions) {

    var activeAnimationsLookup = new $$HashMap();
    var disabledElementsLookup = new $$HashMap();

    var animationsEnabled = null;

    // Wait until all directive and route-related templates are downloaded and
    // compiled. The $templateRequest.totalPendingRequests variable keeps track of
    // all of the remote templates being currently downloaded. If there are no
    // templates currently downloading then the watcher will still fire anyway.
    var deregisterWatch = $rootScope.$watch(
      function() { return $templateRequest.totalPendingRequests; },
      function(val, oldVal) {
        if (val !== 0) return;
        deregisterWatch();

        // Now that all templates have been downloaded, $animate will wait until
        // the post digest queue is empty before enabling animations. By having two
        // calls to $postDigest calls we can ensure that the flag is enabled at the
        // very end of the post digest queue. Since all of the animations in $animate
        // use $postDigest, it's important that the code below executes at the end.
        // This basically means that the page is fully downloaded and compiled before
        // any animations are triggered.
        $rootScope.$$postDigest(function() {
          $rootScope.$$postDigest(function() {
            // we check for null directly in the event that the application already called
            // .enabled() with whatever arguments that it provided it with
            if (animationsEnabled === null) {
              animationsEnabled = true;
            }
          });
        });
      }
    );

    function extractElementNode(element) {
      for (var i = 0; i < element.length; i++) {
        var elm = element[i];
        if (elm.nodeType == ELEMENT_NODE) {
          return elm;
        }
      }
    }

    function stripCommentsFromElement(element) {
      if (element.length === 0) return [];

      // there is no point of stripping anything if the element
      // is the only element within the jqLite wrapper.
      // (it's important that we retain the element instance.)
      if (element.length === 1) {
        return element[0].nodeType === ELEMENT_NODE && element;
      } else {
        return angular.element(extractElementNode(element));
      }
    }

    return {
      push : function(element, event, options, domOperation) {
        element = stripCommentsFromElement(element);
        options = options || {};
        options.domOperation = domOperation;
        return queueAnimation(element, event, options);
      },

      enabled : function(bool) {
        var argCount = arguments.length;
        if (isElement(bool)) {
          var element = bool;
          var node = element.length ? element[0] : element;
          var recordExists = disabledElementsLookup.get(node);

          // if nothing is set then the animation is enabled
          bool = !recordExists;

          if (argCount > 1) {
            bool = !!arguments[1];
            if (!bool) {
              disabledElementsLookup.put(node, true);
            } else if (recordExists) {
              disabledElementsLookup.remove(node);
            }
          }
        } else if (argCount === 1) {
          animationsEnabled = !!bool;
        } else {
          bool = animationsEnabled;
        }

        return bool === true;
      }
    };

    function queueAnimation(element, event, options) {
      options = $$animateOptions(element, options);
      var node = element[0];
      var parent = element.parent();

      // we create a fake runner with a working promise.
      // These methods will become available after the digest has passed
      var defered = $qRaf.defer();
      var runner = $$animateRunner(defered.promise);

      // there are situations where a directive issues an animation for
      // a jqLite wrapper that contains only comment nodes... If this
      // happens then there is no way we can perform an animation
      if (!node) {
        defered.resolve();
        return runner;
      }

      if (isArray(options.addClass)) {
        options.addClass = options.addClass.join(' ');
      }

      if (isArray(options.removeClass)) {
        options.removeClass = options.removeClass.join(' ');
      }

      var isStructural = ['enter', 'move', 'leave'].indexOf(event) >= 0;
      var existingAnimation = activeAnimationsLookup.get(node) || {};
      var existingAnimationExists = !!existingAnimation.state;

      // this is a hard disable of all animations for the application or on
      // the element itself, therefore  there is no need to continue further
      // past this point if not enabled
      var skipAnimations = !animationsEnabled || disabledElementsLookup.get(node);

      // there is no point in traversing the same collection of parent ancestors if a followup
      // animation will be run on the same element that already did all that checking work
      if (!skipAnimations && (!existingAnimationExists || existingAnimation.state != PRE_DIGEST_STATE)) {
        skipAnimations = !areAnimationsAllowed(element, parent);
      }

      if (skipAnimations) {
        close();
        return runner;
      }

      if (isStructural) {
        closeChildAnimations(element);
      }

      var newAnimation = {
        structural: isStructural,
        element: element,
        event: event,
        options: options,
        parent: parent || existingAnimation.parent,
        runner: runner
      };

      if (existingAnimationExists) {
        var skipAnimationFlag = isAllowed('skip', element, newAnimation, existingAnimation);
        if (skipAnimationFlag) {
          existingAnimation.options.$merge(options);
          return existingAnimation.runner;
        }

        var cancelAnimationFlag = isAllowed('cancel', element, newAnimation, existingAnimation);
        if (cancelAnimationFlag) {
          if (existingAnimation.state === RUNNING_STATE) {
            existingAnimation.runner.end();
          } else {
            newAnimation.options.$merge(existingAnimation.options);
          }
        } else {
          // a joined animation means that this animation will take over the existing one
          // so an example would involve a leave animation taking over an enter. Then when
          // the postDigest kicks in the enter will be ignored.
          var joinAnimationFlag = isAllowed('join', element, newAnimation, existingAnimation);
          if (joinAnimationFlag) {
            event = newAnimation.event = existingAnimation.event;
            options = newAnimation.options.$merge(options);
          }
        }
      }
      else {
        // a call to merge just normalizes the CSS classes on the options object
        // normalization in this case means that it removes redundant CSS classes that
        // already exist (addClass) or do not exist (removeClass) on the element
        options.$merge({});
      }

      closeParentClassBasedAnimations(parent);

      // the counter keeps track of cancelled animations
      var counter = (existingAnimation.counter || 0) + 1;
      newAnimation.counter = counter;

      markElementAnimationState(element, PRE_DIGEST_STATE, newAnimation);

      $rootScope.$$postDigest(function() {
        var details = activeAnimationsLookup.get(node);
        var animationCancelled = !details;

        // this means that the previous animation was cancelled
        // even if the follow-up animation is the same event
        if (animationCancelled
             || details.counter !== counter
             || (!details.structural && !hasAnimationClasses(details.options))) {
          // if another animation did not take over then we need
          // to make sure that the domOperation and options are
          // handled accordingly
          if (animationCancelled) {
            options.$applyClasses();
            options.$applyStyles();
          }

          // if the event changed from something like enter to leave then we do
          // it, otherwise if it's the same then the end result will be the same too
          if (animationCancelled || (isStructural && details.event !== event)) {
            options.$domOperation();
          }

          return;
        }

        // this combined multiple class to addClass / removeClass into a setClass event
        // so long as a structural event did not take over the animation
        event = !details.structural && hasAnimationClasses(details.options, true)
            ? 'setClass'
            : details.event;

        closeParentClassBasedAnimations(details.parent);

        markElementAnimationState(element, RUNNING_STATE);
        var realRunner = $$animation(element, event, details.options);
        realRunner.then(
            function() { close(); },
            function() { close(true); }
          )['finally'](function() {
            var details = activeAnimationsLookup.get(node);
            if (details && details.counter === counter) {
              clearElementAnimationState(element);
            }
          });

        // this will update the runner's flow-control events based on
        // the `realRunner` object.
        $$animateRunner(runner, realRunner);
      });

      return runner;

      function close(reject) {
        options.$applyClasses();
        options.$applyStyles();
        options.$domOperation();
        reject ? defered.reject() : defered.resolve();
      }
    }

    function closeChildAnimations(element) {
      var node = element[0];
      var children = node.querySelectorAll('[' + NG_ANIMATE_ATTR_NAME + ']');
      forEach(children, function(child) {
        var state = parseInt(child.getAttribute(NG_ANIMATE_ATTR_NAME));
        var details = activeAnimationsLookup.get(child);
        switch (state) {
          case RUNNING_STATE:
            details.runner.end();
            // follow through
          case PRE_DIGEST_STATE:
            if (details) {
              activeAnimationsLookup.remove(child);
            }
            break;
        }
      });
    }

    function clearElementAnimationState(element) {
      element = element.length ? element[0] : element;
      element.removeAttribute(NG_ANIMATE_ATTR_NAME);
      activeAnimationsLookup.remove(element);
    }

    function isMatchingElement(a,b) {
      a = a.length ? a[0] : a;
      b = b.length ? b[0] : b;
      return a === b;
    }

    function closeParentClassBasedAnimations(startingElement) {
      var parentNode = startingElement[0];
      do {
        if (!parentNode || parentNode.nodeType !== ELEMENT_NODE) break;

        var details = activeAnimationsLookup.get(parentNode);
        if (details) {
          examineParentAnimation(parentNode, details);
        }

        parentNode = parentNode.parentNode;
      } while(true);

      // since animations are detected from CSS classes, we need to flush all parent
      // class-based animations so that the parent classes are all present for child
      // animations to properly function (otherwise any CSS selectors may not work)
      function examineParentAnimation(node, animationDetails) {
        // enter/leave/move always have priority
        if (animationDetails.structural) return;

        if (animationDetails.state === RUNNING_STATE) {
          animationDetails.runner.end();
        }
        clearElementAnimationState(node);
      }
    }

    function areAnimationsAllowed(element, parent) {
      var bodyElement = jqLite($document[0].body);
      var bodyElementDetected = false;
      var rootElementDetected = false;
      var parentAnimationDetected = false;
      var animateChildren;

      while(parent && parent.length) {
        var parentNode = parent[0];
        if (parentNode.nodeType !== ELEMENT_NODE) {
          // no point in inspecting the #document element
          break;
        }

        var details = activeAnimationsLookup.get(parentNode) || {};
        // either an enter, leave or move animation will commence
        // therefore we can't allow any animations to take place
        // but if a parent animation is class-based then that's ok
        if (!parentAnimationDetected) {
          parentAnimationDetected = details.structural || disabledElementsLookup.get(parentNode);
        }

        if (isUndefined(animateChildren) || animateChildren === true) {
          var value = parent.data(NG_ANIMATE_CHILDREN_DATA);
          if (isDefined(value)) {
            animateChildren = value;
          }
        }

        if (!rootElementDetected) {
          // angular doesn't want to attempt to animate elements outside of the application
          // therefore we need to ensure that the rootElement is an ancestor of the current element
          rootElementDetected = isMatchingElement(parent, $rootElement);
        }

        if (!bodyElementDetected) {
          // we also need to ensure that the element is or will be apart of the body element
          // otherwise it is pointless to even issue an animation to be rendered
          bodyElementDetected = isMatchingElement(parent, bodyElement);
        }

        parent = parent.parent();
      }

      var allowAnimation = !parentAnimationDetected || animateChildren;
      return allowAnimation && rootElementDetected && bodyElementDetected;
    }

    function markElementAnimationState(element, state, details) {
      details = details || {};
      details.state = state;

      element = element.length ? element[0] : element;
      element.setAttribute(NG_ANIMATE_ATTR_NAME, state);

      var oldValue = activeAnimationsLookup.get(element);
      var newValue = oldValue
          ? extend(oldValue, details)
          : details;
      activeAnimationsLookup.put(element, newValue);
    }
  }];
}];
