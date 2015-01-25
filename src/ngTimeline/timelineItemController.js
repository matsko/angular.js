'use strict';

var $TimelineItemController =
         ['$qIterate', '$$qAnimate', '$attrs', '$scope', '$element', '$timeout',
  function($qIterate,   $$qAnimate,   $attrs,   $scope,   $element,   $timeout) {

  var seqItems = this.seqItems = [];
  var parallelItems = this.parallelItems = [];

  this.position = $scope.$eval($attrs.position);
  this.duration = $scope.$eval($attrs.duration);
  this.id = $element.attr('id');

  this.add = function(ctrl) {
    var position = ctrl.position || 0;
    if (position > 0) {
      parallelItems.push({
        start : function(element) {
          return $timeout(function() {
            ctrl.start(element);
          }, position * ONE_SECOND, false);
        }
      });
    } else {
      seqItems.push(ctrl);
    }
  };

  this.start = function(element) {
    var promises = [];

    forEach(parallelItems, function(ctrl) {
      promises.push(evalItem(ctrl));
    });

    if (seqItems.length) {
      promises.push($qIterate(seqItems, evalItem));
    }

    return $$qAnimate.all(promises);

    function evalItem(item) {
      return item.start(element);
    };
  };
}];
