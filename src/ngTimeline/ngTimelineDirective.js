'use strict';

var $NgTimelineDirective = ['$timeline', function($timeline) {
  return {
    require: 'ngTimeline',
    controller: 'ngTimelineItemController',
    link : function(scope, element, attrs, ctrl) {
      var isRoot = !!attrs.matchClass;
      if (isRoot) {
        $timeline.register(attrs.matchClass, ctrl);
      }
    }
  }
}];
