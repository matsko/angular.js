'use strict';

angular.module('ngTimeline', [])

  .value('noopTimeline', { add : noop, driver : noop })

  .value('ngTimelineNoopDriver', { step : noop })

  .factory('$timelineRegistry', $TimelineRegistry)

  .factory('$qIterate', $QIterate)

  .controller('ngTimelineItemController', $TimelineItemController)

  .directive('ngTimeline', $NgTimelineDirective)

  .directive('ngStep', $NgStepDirective)

  .provider('ngTimelineDriver', $NgTimelineDriverProvider)
