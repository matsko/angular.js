'use strict';

var $AnimateJsDriverProvider = ['$animationProvider', function($animationProvider) {
  $animationProvider.drivers.push('$$animateJsDriver');
  this.$get = [function() {
    return function(details) {
      var element = details.element;
      var event = details.event;
      var options = details.options;
      var classes = details.classes;
      return $animateJs(element, event, classes, options);
    };
  }];
}];
