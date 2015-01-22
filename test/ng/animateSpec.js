ddescribe("animations", function() {

  var element;
  afterEach(function() {
    dealoc(element);
  });

  describe("drivers", function() {
    it("should allow custom drivers to be registered", function() {
      var spy = jasmine.createSpy();
      module(function($animateProvider, $provide) {
        $provide.value('customDriver', function(element, method) {
          spy(element, method);
          return angular.noop;
        });
        $animateProvider.drivers.push('customDriver');
      });
      inject(function($animateSequence) {
        element = angular.element('<div></div>');
        $animateSequence(element, 'some-method');

        var args  = spy.mostRecentCall.args;
        var elm = args[0];
        var method = args[1];

        expect(method).toBe('some-method');
        expect(elm[0]).toBe(element[0]);
      });
    });

    describe("driver.next()", function() {
      var driverFn;
      element = angular.element('<div></div>');

      beforeEach(module(function($animateProvider, $provide) {
        $provide.value('driver', function() {
          return function() {
            return driverFn.apply(driverFn, arguments);
          };
        });
        $animateProvider.drivers.push('driver');
      }));

      it("should synchronously continue running when true is returned and then resolve when nothing is returned",
        inject(function($animateSequence, $$rAF) {

        var calls = 0;
        driverFn = function(index, data) {
          if (++calls < 5) {
            return true;
          }
        };

        var resolved, rejected;
        $animateSequence(element, 'some-method').then(
          function() { resolved = true; },
          function() { rejected = true; }
        );

        $$rAF.flush();

        expect(calls).toBe(5);
        expect(resolved).toBe(true);
        expect(rejected).not.toBe(true);
      }));

      it("should synchronously stop and then reject if `false` is returned",
        inject(function($animateSequence, $$rAF) {

        var calls = 0;
        driverFn = function(index, data) {
          calls++;
          return false;
        };

        var resolved, rejected;
        $animateSequence(element, 'some-method').then(
          function() { resolved = true; },
          function() { rejected = true; }
        );

        $$rAF.flush();

        expect(calls).toBe(1);
        expect(resolved).not.toBe(true);
        expect(rejected).toBe(true);
      }));

      it("should synchronously stop and then resolve if nothing is returned",
        inject(function($animateSequence, $$rAF) {

        var calls = 0;
        driverFn = function(index, data) {
          calls++;
        };

        var resolved, rejected;
        $animateSequence(element, 'some-method').then(
          function() { resolved = true; },
          function() { rejected = true; }
        );

        $$rAF.flush();

        expect(calls).toBe(1);
        expect(resolved).toBe(true);
        expect(rejected).not.toBe(true);
      }));

      it("should asynchronously resolve if a promise is returned",
        inject(function($animateSequence, $rootScope, $q, $$rAF) {

        var calls = 0;
        var defer = $q.defer();
        driverFn = function(index, data) {
          calls++;
          return calls < 2 ? defer.promise : null;
        };

        var resolved, rejected;
        $animateSequence(element, 'some-method').then(
          function() { resolved = true; },
          function() { rejected = true; }
        );

        defer.resolve();
        $$rAF.flush();
        $rootScope.$digest();

        expect(calls).toBe(2);
        expect(resolved).toBe(true);
        expect(rejected).not.toBe(true);
      }));

      it("should asynchronously reject and close if a promise is returned",
        inject(function($animateSequence, $rootScope, $q, $$rAF) {

        var calls = 0;
        var defer = $q.defer();
        driverFn = function(index, data) {
          calls++;
          return defer.promise;
        };

        var resolved, rejected;
        $animateSequence(element, 'some-method').then(
          function() { resolved = true; },
          function() { rejected = true; }
        );

        defer.reject();
        $$rAF.flush();
        $rootScope.$digest();

        expect(calls).toBe(1);
        expect(resolved).not.toBe(true);
        expect(rejected).toBe(true);
      }));

    });

    it("should query the drivers in reverse order and only use the first driver which returns something", function() {
      var capturedDriver;
      module(function($animateProvider, $provide) {
        $provide.value('first', function() {
          return function(done, index, data) {
            capturedDriver = 'first';
          };
        });

        $provide.value('second', function() {
          return function(index) {
            capturedDriver = 'second';
          };
        });

        $animateProvider.drivers.push('second');
        $animateProvider.drivers.push('first');
      });

      inject(function($animateSequence) {
        element = angular.element('<div></div>');
        $animateSequence(element, 'some-method');

        expect(capturedDriver).toBe('first');
      });
    });
  });
});
