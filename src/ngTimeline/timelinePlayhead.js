/*
 * parseOneTimeline
 */
var ONE_SECOND = 1000;

function gcd(a, b) {
  if (!b) return a;
  return gcd(b, a % b);
};

function scanTimelinePositions(matrix, labels, timeline) {
  var total = 0;
  angular.forEach(timeline.children, function(child) {
    var position = child.position;
    if (position === undefined) {
      var label = '0';
      var previousChild = labels[label];
      if (previousChild) {
        previousChild.chain = previousChild.chain || [];
        previousChild.chain.push(child);
      } else {
        labels[label] = child;
        position = 0;
      }
    }

    if (position >= 0) {
      var index = (position * ONE_SECOND).toString();
      matrix[index] = matrix[index] || [];
      matrix[index].push(child);
    }

    total++;
  });

  return total;
}

function findHighestCommonPositionFactor(timeline) {
  var time = 0;
  var entry;
  var queue = [timeline];
  while((entry = queue.shift()) != null) {
    if (entry.children && entry.children.length) {
      queue = queue.concat(entry.children);
    }
    if (entry.position > 0) {
      var position = parseFloat(entry.position) * ONE_SECOND;
      time = !time ? position : gcd(time, position);
    }
  }
  return time;
}

var $TimelinePlayhead = ['$interval', '$$qAnimate', function($interval, $$qAnimate) {
  var MIN_INTERVAL_TIME = 10;

  return function(timeline) {
    if (angular.isArray(timeline)) {
      timeline = { start: noop, children : timeline };
    }

    var intervalDuration = findHighestCommonPositionFactor(timeline);
    var hasPositionBasedSteps = intervalDuration > 0;
    intervalDuration = Math.max(intervalDuration, MIN_INTERVAL_TIME);

    var matrix = {};
    var labels = {};
    var count, total, time, ticker, defered;
    var started;

    return angular.extend({
      start : start,
      end : end
    });

    function end() {
      if (ticker) {
        $interval.cancel(ticker);
        ticker = null;
      }

      cancelEverything();
      started = false;
      defered.resolve();
    }

    function cancelEverything() {
      // empty for now
    }

    function start() {
      if (started) return;

      defered = $$qAnimate.defer();
      time = 0;
      count = 0;
      total = 1; //the root node is the first
      started = true;

      walkTree(timeline);

      ticker = $interval(function() {
        if (count >= total) {
          end();
          return;
        }

        tick(time.toString());
        time += intervalDuration;
      }, intervalDuration, false);

      return defered.promise;
    }

    function tick(label) {
      var entries = matrix[label] || [];
      angular.forEach(entries, function(entry) {
        entry.position = null;
        walkTree(entry);
      });
    }

    function isFutureLabel(position) {
      return position >= 0 ? position > time : !labels[position];
    }

    function trigger(node) {
      var details = node.start();
      if (!details || !details.start) {
        ready();
      } else {
        var val = details.start();
        isPromiseLike(val) ? val.then(ready) : ready();
      }

      function ready() {
        if (++count >= total) {
          end();
          return;
        }

        var parent = node.parent;
        if (parent) {
          var label = parent.label;
          if (++parent.count >= parent.total && label) {
            labels[label] = true;
            tick(label);
          }
        }
      }
    }

    function walkTree(step) {
      var queue = [step];
      next();

      function next() {
        var node = queue.pop();
        if (!node || !started) return;

        if (node.position) {
          var position = node.position .toString();
          if (isFutureLabel(position)) {
            var label = position * ONE_SECOND;
            matrix[label] = matrix[label] || [];
            matrix[label].push(node);
          } else {
            walkTree(node);
          }
        } else {
          node.count = 0;
          node.total = 0;
          var children = node.children || [];
          for (var i=children.length-1;i>=0;i--) {
            var child = children[i];
            if (child.position) {
              walkTree(child);
            } else {
              queue.push(child);
            }
            child.parent = node;
            node.total++;
            total++
          };

          var val = trigger(node);
          isPromiseLike(val) ? val.then(next) : next();
        }
      }
    }

    // 1. look at the current node
    // if (node.position future)
    //  -> future? then you orphan it and place it in the matrix
    //    -> next = next sibling
    //        CONTINUE
    //
    // if (node.position past)
    //    -> run asynchronously somehow
    //    -> next = next sibling
    //        CONTINUE
    //
    // trigger(node).then
    //    parent.count++;
    //
    //    if (node.children)
    //      next = next child
    //    else if (sibling)
    //      next = nextSibling()
    //    else
    //      if parent.count >= parent.total
    //        next = nextSibling(parent)
    //        CONTINUE
    //
    //  nextSibling(node)
    //      fire labels
    //
    // -- after loop --
  };
}];
