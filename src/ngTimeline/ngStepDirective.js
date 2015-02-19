'use strict';

var $NgStepDirective = ['$qRaf', '$rootScope', function($qRaf, $rootScope) {
  return {
    require: 'ngStep',
    controller: 'ngTimelineItemController',
    link : function(scope, element, attrs, ctrl) {
      ctrl.start = function() {
        var rootElement = ctrl.getElement();
        var driver = ctrl.getDriver();
        var driverFn = driver(rootElement);

        var targets = attrs.selector
          ? rootElement[0].querySelectorAll(attrs.selector)
          : [rootElement];

        var promises = [];
        angular.forEach(targets, function(target, index) {
          var startFn = driverFn(angular.element(target), cloneAttrs(attrs, $rootScope), index);
          if (startFn) {
            var runner = startFn.start();
            promises.push(runner);
          }
        });

        return $qRaf.all(promises);
      }
    }
  };

  function cloneAttrs(attrs, scope) {
    var copy = {};
    angular.forEach(attrs, function(value, key) {
      if (key.charAt(0) != '$') {
        switch(key) {
          case 'to':
          case 'from':
          case 'duration':
            copy[key] = scope.$eval(value);
          break;
          default:
            copy[key] = value;
          break;
        }
      }
    });
    return copy;
  }
}];
