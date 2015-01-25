'use strict';

var isArray = angular.isArray;
var isString = angular.isString;
var isFunction = angular.isFunction;
var forEach = angular.forEach;
var noop = angular.noop;

var ONE_SECOND = 1000;

function isPromiseLike(p) {
  return p && isFunction(p.then);
}

function yieldWith(value, done) {
  return { value : value, done : done };
}

function buildTimelineDriverName(name) {
  var driver = name ? name.charAt(0).toUpperCase() + name.substr(1)
                    : 'Noop';
  return 'ngTimeline' + driver + 'Driver';
}
