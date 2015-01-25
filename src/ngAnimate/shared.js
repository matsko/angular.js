'use strict';

var isArray = angular.isArray;
var isString = angular.isString;
var forEach = angular.forEach;
var noop = angular.noop;

function packageStyles(options) {
  var styles = {};
  if (options && (options.to || options.from)) {
    styles.to = options.to;
    styles.from = options.from;
  }
  return styles;
}

function yieldWith(value, done) {
  return { value : value, done : done };
}

function fixClasses(classes, fix, isPrefix) {
  var className = '';
  classes = isArray(classes)
      ? classes
      : classes && isString(classes) && classes.length
          ? classes.split(/\s+/)
          : [];
  forEach(classes, function(klass, i) {
    if (klass && klass.length > 0) {
      className += (i > 0) ? ' ' : '';
      className += isPrefix ? fix + klass
                            : klass + fix;
    }
  });
  return className;
}

function normalizeCssProp(name) {
  var prefix = '';
  if (name.substring(1,6) == 'ebkit') { // matches [wW]ebkit
    prefix = '-';
  }
  return prefix + name.replace(/[A-Z]/g, function(letter, pos) {
    return (pos ? '-' : '') + letter.toLowerCase();
  });
}

function arrayRemove(arr, val) {
  var index = arr.indexOf(val);
  if (val >= 0) {
    arr.splice(index, 1);
  }
}
