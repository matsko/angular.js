var $AnimateViewPortProvider = [function() {
  this.$get = ['$animate', function($animate) {
    return function(element) {
      return {
        async : true,
        enter : function(parent, after, options) {
          return $animate.enter(element, after, options);
        },
        leave : function(options) {
          return $animate.leave(options);
        }
      }
    }
  }];
}];
