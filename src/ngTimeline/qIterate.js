'use strict';

var $QIterate = ['$$qAnimate', function($$qAnimate) {
  return function(arr, callFn) {
    var first = callFn(arr.shift());
    if (!arr.length) return first;

    var defer = $$qAnimate.defer();

    arr.reduce(function(promise, fn) {
      return promise.then(function() {
        return callFn(fn);
      });
    }, first).then(function(val) {
      return defer.resolve(val);
    });

    return defer.promise;
  }
}];
