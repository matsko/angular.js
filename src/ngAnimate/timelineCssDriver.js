var $ngTimelineCssDriverProvider = [function() {
  this.$get = ['$$qAnimate', '$animateCSS', '$rootScope',
       function($$qAnimate,   $animateCSS,   $rootScope) {
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
      var animator = $animateCSS(element, method, options);
      if (!animator) {
        domOperation();
        return false;
      }

      return $$qAnimate.promise(function(defered) {
        $animateCSS.waitUntilQuiet().then(function() {
          domOperation();
          animator.start().then(function() {
            defered.resolve();
          });
        });
      });
    }
  }]
}];
