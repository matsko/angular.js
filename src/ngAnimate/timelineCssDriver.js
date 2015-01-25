var $ngTimelineCssDriverProvider = [function() {
  this.$get = ['$$qAnimate', '$animateCss', '$rootScope',
       function($$qAnimate,   $animateCss,   $rootScope) {
    var self;
    return self = {
      step : function(element, attributes) {
        delete attributes.to;
        delete attributes.from;
        attributes.add = attributes.addClass;
        attributes.removeClass = attributes.removeClass;
        attributes.to = attributes.styles && $rootScope.$eval(attributes.styles);
        return animate(element, 'setClass', attributes, function() {
          attributes.addClass && element.addClass(attributes.addClass);
          attributes.removeClass && element.removeClass(attributes.removeClass);
        });
      }
    }

    function animate(element, method, options, domOperation) {
      var animator = $animateCss(element, method, options);
      if (!animator) {
        domOperation();
        return false;
      }

      return $$qAnimate.promise(function(defered) {
        $animateCss.waitUntilQuiet().then(function() {
          domOperation();
          animator.start().then(function() {
            defered.resolve();
          });
        });
      });
    }
  }]
}];
