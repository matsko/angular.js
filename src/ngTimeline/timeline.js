var isArray = angular.isArray;
var isString = angular.isString;
var forEach = angular.forEach;
var noop = angular.noop;

var ONE_SECOND = 1000;

function yieldWith(value, done) {
  return { value : value, done : done };
}

angular.module('ngTimeline', [])
  .provider('ngTimelineDriver', ['$animateProvider', function($animateProvider) {
    $animateProvider.drivers.push('ngTimelineDriver');

    this.$get = ['$timelineRegistry', '$$qAnimate', function($timelineRegistry, $$qAnimate) {
      return function(element, method, options) {
        var classes = element.attr('class');
        var timelines = $timelineRegistry.lookup(classes);
        if (!timelines.length) return;

        var started = false;
        return function() {
          if (started) {
            return yieldWith(true, true);
          }
          started = true;

          var promises = [];

          forEach(timelines, function(timeline) {
            promises.push(timeline.start());
          });

          return yieldWith($$qAnimate.all(promises));
        }
      };
    }];
  }])

  .value('noopTimeline', {
    add : noop
  })

  .factory('$timelineRegistry', [function() {
    var lookup = {};
    return {
      register : function(name, ctrl) {
        lookup[name] = ctrl;
      },
      lookup : function(names) {
        var results = [];

        names = isArray(names) ? names : names.split(' ');
        angular.forEach(names, function(name) {
          if (lookup[name]) {
            results.push(lookup[name]);
          }
        });

        return results;
      }
    };
  }])

  .factory('$qIterate', ['$$qAnimate', function($$qAnimate) {
    return function(arr, callFn) {
      var first = callFn(arr.shift());
      if (!arr.length) return first;

      var defer = $$qAnimate.defer();

      arr.reduce(function(promise, fn) {
        return promise.then(function() {
          return callFn(fn);
        });
      }, first).then(function(val) {
        return defer.resolve(val);
      });

      return defer.promise;
    }
  }])

  .controller('ngTimelineItemCtrl', ['$qIterate', '$$qAnimate', '$attrs', '$scope', '$element', '$timeout',
                             function($qIterate,   $$qAnimate,   $attrs,   $scope,   $element,   $timeout) {
    var seqItems = this.seqItems = [];
    var parallelItems = this.parallelItems = [];

    this.position = $scope.$eval($attrs.position);
    this.duration = $scope.$eval($attrs.duration);
    this.id = $element.attr('id');

    this.add = function(ctrl) {
      var position = ctrl.position || 0;
      if (position > 0) {
        parallelItems.push({
          start : function() {
            return $timeout(angular.bind(ctrl, ctrl.start), position * ONE_SECOND, false);
          }
        });
      } else {
        seqItems.push(ctrl);
      }
    };

    this.start = function() {
      var promises = [];
      forEach(parallelItems, function(ctrl) {
        promises.push(evalItem(ctrl));
      });

      if (seqItems.length) {
        promises.push($qIterate(seqItems, evalItem));
      }

      return $$qAnimate.all(promises).then(function() {
        console.log('end', $element.attr('id'))
      });

      function evalItem(item) {
        return item.start();
      };
    };
  }])

  .directive('ngTimeline', ['$timelineRegistry', 'noopTimeline', '$qIterate',
                    function($timelineRegistry,   noopTimeline,   $qIterate) {
    return {
      require: 'ngTimeline',
      controller: 'ngTimelineItemCtrl',
      link : function(scope, element, attrs, ctrl) {
        var ngTimeline = element.parent().controller('ngTimeline') || noopTimeline;

        if (attrs.name) {
          $timelineRegistry.register(attrs.name, ctrl);
        }
        ngTimeline = ngTimeline || noopTimeline;
        ngTimeline.add(ctrl);
      }
    }
  }])

  .directive('ngStep', ['$timeout', function($timeout) {
    return {
      require: ['^ngTimeline', 'ngStep'],
      controller: 'ngTimelineItemCtrl',
      link : function(scope, element, attrs, ctrls) {
        var ngTimeline = ctrls[0];
        var ctrl = ctrls[1];

        ctrl.add({ start : startAnimation });
        ngTimeline.add(ctrl);

        function startAnimation() {
          return $timeout(noop, ctrl.duration * ONE_SECOND, false);
        }
      }
    };
  }]);
