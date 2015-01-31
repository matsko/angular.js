var $TimelineProvider = [function() {
  this.$get = ['$q', function($q) {
    return {
      query : function() {
        return false;
      }
    };
  }];
}];

var $TimelinePlayheadProvider = [function() {
  this.$get = ['$$qAnimate', function($$qAnimate) {
    return function(timeline) {
      var defered;
      var queue = !isArray(timeline)
          ? (timeline.children || [timeline])
          : timeline;

      return {
        start: start,
        cancel: function() {
          close(false)
        },
        end: function() {
          close(true)
        }
      };

      function start() {
        defered = $$qAnimate.defer();
        next();
        return defered.promise;
      }

      function close() {
        defered.resolve();
      }

      function next() {
        var result;
        if (queue.length) {
          result = queue.shift();
          result = result && result.start();
        }

        if (!result) {
          close(true);
          return;
        }

        var value = result.start();
        if (isPromiseLike(value)) {
          // this will force a wait for one reflow which in turn
          // ensures that the animation step is asynchronous. If
          // a promise is not returned then we rely on user calling
          // the callback function to end the animation.
          value.then(tick, function() { tick(false); });
        } else {
          //synchronous animation flow
          tick(value);
        }

        function tick(data) {
          if (data === false) {
            close(false);
            return;
          }
          next(data);
        }
      }
    }
  }];
}];
