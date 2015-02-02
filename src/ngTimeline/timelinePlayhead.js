/*
 * parseOneTimeline
 */
var ONE_SECOND = 1000;

function gcd(a, b) {
  if (!b) return a;
  return gcd(b, a % b);
};

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
    intervalDuration = 100;
    var hasPositionBasedSteps = intervalDuration > 0;
    intervalDuration = Math.max(intervalDuration, MIN_INTERVAL_TIME);

    var matrix = {};
    var labels = {};
    var futureLabels = {};
    var count, total, time, ticker, defered;
    var started;

    return angular.extend({
      start : start,
      end : end
    });

    function end(failed) {
      if (ticker) {
        $interval.cancel(ticker);
        ticker = null;
      }

      cancelEverything();
      started = false;
      failed ? defered.reject() : defered.resolve();
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
      return position >= 0 ? position > time : !(labels[position] || {}).complete;
    }

    function trigger(node) {
      var val = node.start();
      if (val && !isPromiseLike(val)) {
        if (!isFunction(val) && val.start) {
          if (val.duration && node.label) {
            node.duration = val.duration;
            resolveFutureLabelDetails(node.label, node.duration);
          }
          val = val.start;
        }
        val = val ? val() : val;
      }

      if (val === false) {
        end(true);
        return;
      }

      if (isPromiseLike(val)) {
        return val.then(ready, function() {
          end(true);
        });
      } else {
        // there is no return value or it is not a promise so we just continue as normal
        ready();
      }

      function ready() {
        if (++count >= total) {
          end();
          return;
        }

        var label = node.label;

        // only leaf nodes can consider themselves done
        // when a operation ends on here since no other
        // nodes will send the message over
        if (label && node.total == 0) {
          markLabelAsComplete(label);
        }

        var parent = node.parent;
        if (parent) {
          parent.count++;
          label = parent.label;
          if (label && parent.count >= parent.total) {
            markLabelAsComplete(label);
          }
        }
      }
    }

    function resolveFutureLabelDetails(label, duration) {
      var nodes = futureLabels[label];
      if (!nodes) return;

      delete futureLabels[label];

      forEach(nodes, function(entry) {
        var finalDuration = (time + duration + entry.offset) * ONE_SECOND;
        if (isFutureLabel(finalDuration)) {
          finalDuration = finalDuration.toString();
          matrix[finalDuration] = matrix[finalDuration] || [];
          matrix[finalDuration].push(entry.node);
        } else {
          walkTree(entry.node);
        }
      });
    }

    function placeWaitOnLabel(position, node) {
      var label = position;
      if (position >= 0) { //numerical
        label = position * ONE_SECOND;
      } else {
        var hasOffset = position.match(/(.+?)([+-])(\d+)$/);
        if (hasOffset) {
          var labelName = hasOffset[1];
          var subtract = hasOffset[2].charAt(0) == '-';
          var offset = parseFloat(hasOffset[3]);
          offset = subtract ? -offset : offset;

          // this label doesn't exist yet, but it will be created once the right
          // animation is run and once it has it's own duration
          var existingNode = labels[labelName];
          if (!existingNode) {
            futureLabels[labelName] = futureLabels[labelName] || [];
            futureLabels[labelName].push({ node: node, offset : offset });
            return;
          }

          label = existingNode.duration + offset;
        }
      }

      matrix[label] = matrix[label] || [];
      matrix[label].push(node);
    }

    function markLabelAsComplete(label) {
      labels[label] = labels[label] || {};
      labels[label].complete = true;
      tick(label);
    }

    function walkTree(step) {
      var queue = [step];
      next();

      function next() {
        var node = queue.pop();
        if (!node || !started) return;

        if (node.label) {
          labels[node.label] = node;
        }

        if (node.position) {
          var position = node.position.toString();
          isFutureLabel(position)
              ? placeWaitOnLabel(position, node)
              : walkTree(node);
        } else {
          node.count = 0;
          node.total = 0;
          var children = node.children || [];
          if (children.length) {
            // timeline nodes are allowed to have an optional
            // start function, but steps are not
            node.start = node.start || noop;
          }
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
  };
}];
