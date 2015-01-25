'use strict';

var $NgStepDirective = ['$$qAnimate', function($$qAnimate) {
  return {
    require: ['^ngTimeline', 'ngStep'],
    controller: 'ngTimelineItemController',
    link : function(scope, element, attrs, ctrls) {
      var ngTimeline = ctrls[0];
      var ctrl = ctrls[1];

      ctrl.add({ start : startAnimation });
      ngTimeline.add(ctrl);

      function startAnimation(rootElement) {
        var driver = ngTimeline.getDriver();
        var targets = attrs.selector
          ? rootElement[0].querySelectorAll(attrs.selector)
          : [rootElement];

        var promises = [];
        angular.forEach(targets, function(target) {
          promises.push(driver.step(angular.element(target), cloneAttrs(attrs)));
        });

        return $$qAnimate.all(promises);
      }
    }
  };

  function cloneAttrs(attrs) {
    var copy = {};
    angular.forEach(attrs, function(value, key) {
      if (key.charAt(0) != '$') {
        copy[key] = value;
      }
    });
    return copy;
  }
}];
