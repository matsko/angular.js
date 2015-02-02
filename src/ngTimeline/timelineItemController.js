'use strict';

var $TimelineItemController = ['$scope', 'noopTimeline', '$element',
                       function($scope,   noopTimeline,   $element) {

  var ctrl = this;

  var ngTimeline = $element.parent().controller('ngTimeline') || noopTimeline;
  this.getDriver = function() {
    return ctrl.driver || ngTimeline.getDriver();
  };

  this.$element = $element;
  this.getElement = function() {
    return ctrl.element || ngTimeline.getElement();
  };

  var children = this.children = [];
  this.add = function(ctrl) {
    children.push(ctrl);
  };

  this.start = function(element) {
    return true;
  };

  ngTimeline.add(ctrl);
}];
