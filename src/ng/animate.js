'use strict';

var $animateMinErr = minErr('ngAnimate');

function mergeClasses(a,b) {
  if (!a && !b) return '';
  if (!a) return b;
  if (!b) return a;
  if (isArray(a)) a = a.join(' ');
  if (isArray(b)) b = b.join(' ');
  return a + ' ' + b;
}

// this is prefixed with Core since it conflicts with
// the animateProvider defined in ngAnimate/animate.js
var $$CoreAnimateQueueProvider = [function() {
  this.$get = ['$qRaf', '$$animateOptions', function($qRaf, $$animateOptions) {
    return {
      enabled: noop,

      push: function(element, event, options, domOperation) {
        if (domOperation) {
          domOperation();
        }
        if (options) {
          options = $$animateOptions(element, options);
          options.$applyClasses();
          options.$applyStyles();
        }
        return $qRaf.when(true);
      }
    }
  }];
}];

var $AnimateProvider = [function() {
  this.$get = ['$$animateQueue', '$$jqLite', function($$animateQueue, $$jqLite) {
    function domInsert(element, parent, after) {
      // if for some reason the previous element was removed
      // from the dom sometime before this code runs then let's
      // just stick to using the parent element as the anchor
      if (after && after.parent().length == 0) {
        after = null;
      }
      after ? after.after(element) : parent.prepend(element);
    };

    return {
      enabled: function() {
        return $$animateQueue.enabled.apply($$animateQueue, arguments);
      },

      enter : function(element, parent, after, options) {
        parent = parent || after.parent();
        domInsert(element, parent, after);
        return $$animateQueue.push(element, 'enter', options);
      },

      move : function(element, parent, after, options) {
        parent = parent || after.parent();
        domInsert(element, parent, after);
        return $$animateQueue.push(element, 'move', options);
      },

      leave: function(element, options) {
        return $$animateQueue.push(element, 'leave', options, function() {
          element.remove();
        });
      },

      addClass: function(element, className, options) {
        options = options || {};
        options.addClass = mergeClasses(options.addclass, className);
        return $$animateQueue.push(element, 'addClass', options);
      },

      removeClass: function(element, className, options) {
        options = options || {};
        options.removeClass = mergeClasses(options.removeClass, className);
        return $$animateQueue.push(element, 'removeClass', options);
      },

      setClass: function(element, add, remove, options) {
        options = options || {};
        options.addClass = mergeClasses(options.addClass, add);
        options.removeClass = mergeClasses(options.removeClass, remove);
        return $$animateQueue.push(element, 'setClass', options);
      },

      animate: function(element, from, to, className, options) {
        options = options || {};
        options.from = options.from ? extend(options.from, from) : from;
        options.to   = options.to   ? extend(options.to, to)     : to;

        var className = className || 'ng-inline-animate';
        options.tempClassName = mergeClasses(options.tempClassName, className);
        return $$animateQueue.push(element, 'animate', options);
      }
    };
  }];
}];
