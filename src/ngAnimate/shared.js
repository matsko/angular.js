'use strict';

var isArray = angular.isArray;
var isString = angular.isString;
var forEach = angular.forEach;
var noop = angular.noop;

function packageStyles(options) {
  if (options && (options.to || options.from)) {
    return {
      to : options.to,
      from : options.from
    };
  }
}

function yieldWith(value, done) {
  return { value : value, done : done };
}

function suffixClasses(classes, suffix) {
  var className = '';
  classes = isArray(classes)
      ? classes
      : classes && isString(classes) && classes.length
          ? classes.split(/\s+/)
          : [];
  forEach(classes, function(klass, i) {
    if (klass && klass.length > 0) {
      className += (i > 0 ? ' ' : '') + klass + suffix;
    }
  });
  return className;
}
