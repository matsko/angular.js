var $AnimationProvider = ['$provide', function($provide) {
  var NG_ANIMATE_CLASSNAME = 'ng-animate';
  var NG_ANIMATE_REF_ATTR = 'ng-animate-ref';

  var $$drivers = this.drivers = [];

  this.$$registeredAnimations = [];
  this.register = function(name, factory) {
    var key = name + '-animation';
    if (name && name.charAt(0) != '.') throw $animateMinErr('notcsel',
        "Expecting class selector starting with '.' got '{0}'.", name);
    this.$$registeredAnimations[name.substr(1)] = key;
    $provide.factory(key, factory);
  };

  var RUNNER_STORAGE_KEY = '$animationRunner';

  function setRunner(element, runner) {
    element.data(RUNNER_STORAGE_KEY, runner);
  };

  function removeRunner(element) {
    element.removeData(RUNNER_STORAGE_KEY);
  }

  function getRunner(element) {
    return element.data(RUNNER_STORAGE_KEY);
  };

  this.$get = ['$qRaf', '$injector', '$animateRunner', '$rootScope',
       function($qRaf,   $injector,   $animateRunner,   $rootScope) {

    var animationQueue = [];

    return function(element, event, options, domOperation) {
      options = options || {};
      var _domOperation = domOperation || noop;
      var domOperationCalled = false;
      options.domOperation = domOperation = function() {
        if (!domOperationCalled) {
          domOperationCalled = true;
          _domOperation();
        }
      }

      var deferred = $qRaf.defer();

      // there is no animation at the current moment, however
      // these runner methods will get later updated with the
      // methods leading into the driver's end/cancel methods
      // for now they just stop the animation from starting
      var endFnFactory = function(cancelled) {
        return function() {
          close(cancelled);
        };
      };

      var runner = $animateRunner(deferred.promise,
        { end: endFnFactory(), cancel: endFnFactory(true) }
      );

      if (!$$drivers.length) {
        close();
        return runner;
      }

      setRunner(element, runner);

      var classes = mergeClasses(element.attr('class'), mergeClasses(options.addClass, options.removeClass));
      var tempClassName = options.tempClassName;
      if (tempClassName) {
        classes += ' ' + tempClassName;
      }

      animationQueue.push({
        // this data is used by the postDigest code and passed into
        // the driver step function
        element: element,
        classes: classes,
        event: event,
        options: options,
        domOperation: domOperation,

        // these methods are used as scoped reference points by
        // the animator loop and they are not passed into the driver
        start: start,
        close: close
      });

      element.on('$destroy', handleDestroyedElement);

      // we only want there to be one function called within the post digest
      // block. This way we can group animations for all the animations that
      // were apart of the same postDigest flush call.
      if (animationQueue.length > 1) return runner;

      $rootScope.$$postDigest(function() {
        var animations = [];
        forEach(animationQueue, function(entry) {
          // the element was destroyed early on which removed the runner
          // form its storage. This means we can't animate this element
          // at all and it already has been closed due to destruction.
          if (getRunner(entry.element)) {
            animations.push(entry);
          }
        });

        // now any future animations will be in another postDigest
        animationQueue.length = 0;

        forEach(groupAnimations(animations), function(animationEntry) {
          var startFn = animationEntry.start;
          var closeFn = animationEntry.close;
          delete animationEntry.start;
          delete animationEntry.close;

          var operation = invokeFirstDriver(animationEntry);
          var startAnimation = operation && (isFunction(operation) ? operation : operation.start);
          if (!startAnimation) {
            closeFn();
          } else {
            startFn();
            var animationRunner = startAnimation();
            animationRunner.then(function() {
              closeFn();
            }, function() {
              closeFn(true);
            });

            updateAnimationRunners(animationEntry, animationRunner);
          }
        });
      });

      return runner;

      function getAnchorNodes(node) {
        var SELECTOR = '[' + NG_ANIMATE_REF_ATTR + ']';
        return node.hasAttribute(NG_ANIMATE_REF_ATTR)
              ? [node]
              : node.querySelectorAll(SELECTOR);
      }

      function groupAnimations(animations) {
        var preparedAnimations = [];
        var refLookup = {};
        forEach(animations, function(animation, index) {
          var element = animation.element;
          var node = element[0];
          var event = animation.event;
          var enterOrMove = ['enter', 'move'].indexOf(event) >= 0;
          var structural = enterOrMove || event === 'leave';
          var anchorNodes = structural ? getAnchorNodes(node) : [];

          if (anchorNodes.length) {
            var direction = enterOrMove ? 'to' : 'from';

            forEach(anchorNodes, function(anchor) {
              var key = anchor.getAttribute(NG_ANIMATE_REF_ATTR);
              refLookup[key] = refLookup[key] || {};
              refLookup[key][direction] = {
                animationID: index,
                element: jqLite(anchor)
              };
            });
          } else {
            preparedAnimations.push(animation);
          }
        });

        var usedIndicesLookup = {};
        var anchorGroups = {};
        forEach(refLookup, function(operations, key) {
          var from = operations.from;
          var to = operations.to;

          if (!from || !to) {
            // only one of these is set therefore we can't have an
            // anchor animation since all three pieces are required
            var index = from ? from.animationID : to.animationID;
            var indexKey = index.toString();
            if (!usedIndicesLookup[indexKey]) {
              usedIndicesLookup[indexKey] = true;
              preparedAnimations.push(animations[index]);
            }
            return;
          }

          var fromAnimation = animations[from.animationID];
          var toAnimation = animations[to.animationID];
          var lookupKey = from.animationID.toString();
          if (!anchorGroups[lookupKey]) {
            var group = anchorGroups[lookupKey] = {
              start: function() {
                fromAnimation.start();
                toAnimation.start();
              },
              close: function() {
                fromAnimation.close();
                toAnimation.close();
              },
              classes: cssClassesIntersection(fromAnimation.classes, toAnimation.classes),
              from: fromAnimation,
              to: toAnimation,
              anchors: []
            }

            // the anchor animations require that the from and to elements both have atleast
            // one shared CSS class which effictively marries the two elements together to use
            // the same animation driver and to properly sequence the anchor animation.
            if (group.classes.length) {
              preparedAnimations.push(group);
            } else {
              preparedAnimations.push(fromAnimation);
              preparedAnimations.push(toAnimation);
            }
          }

          anchorGroups[lookupKey].anchors.push({
            'out' : from.element, 'in' : to.element
          });
        });

        return preparedAnimations;
      }

      function cssClassesIntersection(a,b) {
        a = a.split(' ');
        b = b.split(' ');
        var matches = [];

        for (var i = 0; i < a.length; i++) {
          for (var j = 0; j < b.length; j++) {
            var aa = a[i];
            if (aa.substring(0,3) !== 'ng-' && aa === b[j]) {
              matches.push(aa);
            }
          }
        }

        return matches.join(' ');
      }

      function invokeFirstDriver(details) {
        // we loop in reverse order since the more general drivers (like CSS and JS)
        // may attempt more elements, but custom drivers are more particular
        for (var i = $$drivers.length - 1; i >= 0; i--) {
          var driverName = $$drivers[i];
          if (!$injector.has(driverName)) continue;

          var factory = $injector.get(driverName);
          var driver = factory(details);
          if (driver) {
            return driver;
          }
        }
      }

      function start() {
        element.addClass(NG_ANIMATE_CLASSNAME);
        if (tempClassName) {
          element.addClass(tempClassName);
        }
      }

      function updateAnimationRunners(animation, newRunner) {
        if (animation.from && animation.to) {
          update(animation.from.element);
          update(animation.to.element);
        } else {
          update(animation.element);
        }

        function update(element) {
          $animateRunner(getRunner(element), newRunner);
        }
      }

      function handleDestroyedElement() {
        var runner = getRunner(element);
        // a special case for leave animations since when the element
        // is destroyed then the underlying animation is closed anyway
        if (runner && (event !== 'leave' || !domOperationCalled)) {
          runner.end();
        }
      }

      function close(failure) {
        element.off('$destroy', handleDestroyedElement);
        removeRunner(element);

        if (!domOperationCalled) {
          domOperation();
        }

        if (tempClassName) {
          element.removeClass(tempClassName);
        }

        element.removeClass(NG_ANIMATE_CLASSNAME);
        failure ? deferred.reject() : deferred.resolve();
      }
    };
  }];
}];
