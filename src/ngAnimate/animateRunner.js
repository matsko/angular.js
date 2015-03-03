var $$AnimateRunnerFactory = [function() {
  // there is a lot of variable switching going on here. The main idea
  // is that the runner can be "updated" later on without having to create
  // a new variable. The driver that is given will apply it's new methods to
  // the pre-existing runner/promise object.
  return function(obj, driver) {
    if (!isPromiseLike(obj)) throw new Error();
    driver = driver || {};
    obj.next     = driver.next   || obj.next   || noop;
    obj.end      = driver.end    || obj.end    || noop;
    obj.pause    = driver.pause  || obj.pause  || noop;
    obj.resume   = driver.resume || obj.resume || noop;
    obj.cancel   = driver.cancel || obj.cancel || noop;
    return obj;
  };
}];
