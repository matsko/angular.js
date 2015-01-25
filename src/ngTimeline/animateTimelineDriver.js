var $NgTimelineDriverProvider = ['$animateProvider', function($animateProvider) {
  $animateProvider.drivers.push('ngTimelineDriver');
  this.$get = ['$timelineRegistry', '$$qAnimate',
       function($timelineRegistry,   $$qAnimate) {

    return function(element, method, options) {
      var classes = element.attr('class');
      var timelines = $timelineRegistry.lookup(classes);

      var domOperation = options.domOperation || noop;
      if (method != 'leave') {
        domOperation();
      }

      if (!timelines.length) return;

      var started = false;
      return function() {
        if (started) {
          return yieldWith(true, true);
        }
        started = true;

        var promises = [];

        forEach(timelines, function(timeline) {
          promises.push(timeline.start(element));
        });

        return yieldWith($$qAnimate.all(promises));
      }
    };
  }];
}];
