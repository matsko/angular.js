'use strict';

var $NgTimelineDirective =
         ['$timelineRegistry', 'noopTimeline', '$injector',
  function($timelineRegistry,   noopTimeline,   $injector) {

  return {
    require: 'ngTimeline',
    controller: 'ngTimelineItemController',
    link : function(scope, element, attrs, ctrl) {
      var ngTimeline = element.parent().controller('ngTimeline') || noopTimeline;

      // TODO(matias): use match-class
      var isRoot = !!attrs.matchClass;
      if (isRoot) {
        var driverName = buildTimelineDriverName(attrs.driver);
        ctrl.driver = $injector.get(driverName);
        $timelineRegistry.register(attrs.matchClass, ctrl);
      }

      ctrl.getDriver = function() {
        return ctrl.driver || ngTimeline.getDriver();
      };

      ngTimeline.add(ctrl);
    }
  }
}];
