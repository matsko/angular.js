'use strict';

angular.module('ngTimeline', [])

  .value('noopTimeline', { add : noop, driver : noop })

  .value('ngTimelineNoopDriver', { step : noop })

  .factory('$timelinePlayhead', $TimelinePlayhead)

  .factory('$timelineRegistry', $TimelineRegistry)

  .factory('$qIterate', $QIterate)

  .controller('ngTimelineItemController', $TimelineItemController)

  .directive('ngTimeline', $NgTimelineDirective)

  .directive('ngStep', $NgStepDirective);
