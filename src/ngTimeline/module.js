'use strict';

angular.module('ngTimeline', [])

  .value('noopTimeline', {
    add : noop,
    driver : noop,
    element: noop
  })

  .factory('$timelinePlayhead', $TimelinePlayhead)

  .factory('$timeline', $Timeline)

  .controller('ngTimelineItemController', $TimelineItemController)

  .directive('ngTimeline', $NgTimelineDirective)

  .directive('ngStep', $NgStepDirective);
