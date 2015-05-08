var $$animateSchedulerFactory = ['$$rAF', '$document', function($$rAF, $document) {
  var body = $document[0].body;

  var nextTasks = [];
  var pipeQueue = [];

  var self, cancelFn;
  return self = {
    pipe: function(fn) {
      if (cancelFn) cancelFn();
      pipeQueue.push(fn);
      cancelFn = $$rAF(function() {
        var width = body.clientWidth;
        for (var i = 0; i < pipeQueue.length; i++) {
          pipeQueue[i](width);
        }
        cancelFn = null;
        next();
      });
    },
    schedule: function(tree) {
      tree = isArray(tree) ? tree : [tree];
      var newTasks = process(tree);
      if (!newTasks.length) return;

      nextTasks = nextTasks.concat(newTasks);
      if (cancelFn) return;

      $$rAF(function() {
        if (!cancelFn) next();
      });
    }
  };

  function next() {
    var arr = nextTasks;
    nextTasks = [];
    self.schedule(arr);
  }

  function process(list) {
    var newItems = [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (entry.next) {
        for(var j = 0; j < entry.next.length; j++) {
          newItems.push(entry.next[j]);
        }
      }
      entry.fn();
    }
    return newItems;
  }
}];
