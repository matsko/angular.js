var $NgAnimateCssDriverProvider = ['$animateProvider', function($animateProvider) {
  $animateProvider.drivers.push('ngAnimateCssDriver');

  this.$get = ['$$qAnimate', '$animateCss', '$rootScope',
       function($$qAnimate,   $animateCss,   $rootScope) {

    return function(element, event, domOperation, options) {
      init.createDefaultTimeline = function(element) {
        var animateStepFn = init(element);
        return [{
          start : function() {
            return animateStepFn(element, options);
          }
        }];
      };

      return init;

      function init(rootElement) {
        if (event == 'enter' || event == 'move') {
          domOperation();
        }

        return function stepFn(element, options, index) {
          options = options || {};
          options.event = event;
          options.staggerIndex = index;
          return $animateCss(element, options);
        }
      };
    }
  }]
}];
