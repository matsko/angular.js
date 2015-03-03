'use strict';

var $$AnimateOptionsFactory = ['$$jqLite', function($$jqLite) {
  var KEY = '$$animate';

  return function(element, options) {
    options = options || {};
    if (options.$$element === element) return options;

    return extend({
      $$element: element,

      $merge: function(newOptions) {
        mergeOptions(element, this, newOptions);
        return this;
      },

      $domOperation: function() {
        var domOperation = this.$use('domOperation');
        (domOperation || noop)();
      },

      $applyClasses: function(key) {
        var addClass = this.$use('addClass');
        if (addClass) {
          $$jqLite.addClass(element, addClass);
        }

        var removeClass = this.$use('removeClass');
        if (removeClass) {
          $$jqLite.removeClass(element, removeClass);
        }
      },

      $applyStyles: function(from, to) {
        from = isDefined(from) ? from : true;
        if (from) {
          var fromStyles = this.$use('from');
          if (fromStyles) {
            element.css(fromStyles);
          }
        }

        to = isDefined(to) ? to : true;
        if (to) {
          var toStyles = this.$use('to');
          if (toStyles) {
            element.css(toStyles);
          }
        }
      },

      $use: function(key) {
        var usedKey = '$' + key + 'Used';
        if (!this[usedKey]) {
          this[usedKey] = true;
          return this[key];
        }
      },

      $used: function(key) {
        return this['$' + key + 'Used'];
      }
    }, options);
  };

  function splitClasses(classes) {
    if (isString(classes)) {
      classes = classes.split(' ');
    }

    var obj = {};
    forEach(classes, function(klass) {
      // sometimes the split leaves empty string values
      // incase extra spaces were applied to the options
      if (klass.length) {
        obj[klass] = true;
      }
    });
    return obj;
  }

  function resolveClasses(existing, toAdd, toRemove) {
    var flags = {};
    existing = splitClasses(existing);

    toAdd = splitClasses(toAdd);
    forEach(toAdd, function(value, key) {
      if (!existing[key]) {
        flags[key] = 1;
      }
    });

    toRemove = splitClasses(toRemove);
    forEach(toRemove, function(value, key) {
      if (existing[key]) {
        if (flags[key] === 1) {
          delete flags[key];
        } else {
          flags[key] = -1;
        }
      }
    });

    var classes = {
      addClass : '',
      removeClass : ''
    };

    forEach(flags, function(val, klass) {
      var prop = val === 1 ? 'addClass' : 'removeClass';
      if (classes[prop].length) {
        classes[prop] += ' ';
      }
      classes[prop] += klass;
    });

    return classes;
  }

  function mergeOptions(element, target, newOptions) {
    newOptions = newOptions || {};

    var toAdd = (target.addClass || '') + ' ' + (newOptions.addClass || '');
    var toRemove = (target.removeClass || '') + ' ' + (newOptions.removeClass || '');
    var classes = resolveClasses(element.attr('class'), toAdd, toRemove);

    forEach(newOptions, function(value, name) {
      if (name.charAt(0) !== '$') {
        target[name] = value;
      }
    });

    if (classes.addClass) {
      target.addClass = classes.addClass;
    } else {
      delete target.addClass;
    }

    if (classes.removeClass) {
      target.removeClass = classes.removeClass;
    } else {
      delete target.removeClass;
    }
  }
}];
