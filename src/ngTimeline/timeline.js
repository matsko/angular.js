var $Timeline = [function() {
  var lookup = {};
  return {
    register : function(name, timelineTree) {
      lookup[name] = function(element, driver, baseOptions) {
        timelineTree.driver = driver;
        timelineTree.element = element;
        return timelineTree;
      }
    },
    query : function(element) {
      var classes = element.attr('class').split(/\s+/);
      for (var i=0;i<classes.length;i++) {
        var klass = classes[i];
        if (lookup[klass]) {
          return lookup[klass];
        }
      }
    }
  };
}];
