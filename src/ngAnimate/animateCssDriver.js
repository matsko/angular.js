'use strict';

var $ngAnimateCssDriverProvider = ['$animateProvider', function($animateProvider) {
  $animateProvider.drivers.push('ngAnimateCssDriver');

  this.$get = ['$animateCSS', function($animateCSS) {
    return function(element, method, options) {
      var state = 'prepare-animate';
      var animator = {
        pause : noop,
        resume : noop,
        cancel : noop,
        start : noop
      };

      return {
        pause : function() {
          state = 'paused';
          animator.pause();
        },

        resume : function() {
          resumeFn();
          animator.resume();
        },

        end : function() {
          state = 'completed';
          this.next();
        },

        cancel : function() {
          state = 'cancelled';
          this.next();
        },

        next : function() {
          var result = true;
          switch (state) {
            case 'prepare-animate':
              animator = $animateCSS(element, method, options);
              if (animator) {
                result = $animateCSS.waitUntilQuiet();
                state = 'start-animate';
              } else {
                state = 'complete';
              }
              break;

            case 'start-animate':
              if (!structural) {
                domOperation();
              }
              result = animator.start();
              if (result) {
                state = 'animating';
                result.finally(function() {
                  state = 'complete';
                });
              } else {
                state = 'complete';
              }
              break;

            case 'cancelled':
              result = false;
              // allow fall-through
            case 'complete':
              if (method == 'leave') {
                domOperation();
              }
              state = 'closed';
              break;
          }

          return yieldWith(result, state == 'closed');
        }
      };
    }
  }];
}];
