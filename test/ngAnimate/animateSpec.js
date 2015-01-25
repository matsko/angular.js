describe("ngAnimate", function() {

  beforeEach(module('ngAnimate'));

  describe("ngAnimateJsDriver", function() {
    describe("events", function() {
      var animations, runAnimation, element, log;
      beforeEach(module(function($animateProvider) {
        element = angular.element('<div class="test-animation"></div>');
        animations = {};
        log = [];

        $animateProvider.register('.test-animation', function() {
          return animations;
        });

        return function(ngAnimateJsDriver) {
          runAnimation = function(method, done) {
            var driver = ngAnimateJsDriver(element, method, {
              domOperation: function() {
                log.push('dom ' + method);
              }
            });

            tick();

            function tick() {
              var result = driver.next();
              if (result && !result.done) {
                var value = result.value;
                if (value.then) {
                  value.then(tick);
                } else {
                  tick();
                }
              } else {
                (done || angular.noop)();
              }
            }
          };
        };
      }));

      describe("enter", function() {
        it("should synchronously render the beforeEnter animation", inject(function() {
          animations.beforeEnter = function(element, done) {
            log.push('before enter');
            expect(done).toBeFalsy();
          };

          runAnimation('enter', function() {
            log.push('complete');
          });

          expect(log).toEqual(['before enter', 'dom enter', 'complete']);
        }));

        it("should asynchronously render the enter animation", inject(function($$rAF) {
          animations.enter = function(element, done) {
            log.push('after enter');
            done();
          };
          runAnimation('enter', function() {
            log.push('complete');
          });

          expect(log).toEqual(['dom enter', 'after enter']);
          $$rAF.flush();

          expect(log).toEqual(['dom enter', 'after enter', 'complete']);
        }));
      });

      describe("move", function() {
        it("should synchronously render the beforemove animation", inject(function() {
          animations.beforeMove = function(element, done) {
            log.push('before move');
            expect(done).toBeFalsy();
          };

          runAnimation('move', function() {
            log.push('complete');
          });

          expect(log).toEqual(['before move', 'dom move', 'complete']);
        }));

        it("should asynchronously render the move animation", inject(function($$rAF) {
          animations.move = function(element, done) {
            log.push('after move');
            done();
          };
          runAnimation('move', function() {
            log.push('complete');
          });

          expect(log).toEqual(['dom move', 'after move']);
          $$rAF.flush();

          expect(log).toEqual(['dom move', 'after move', 'complete']);
        }));
      });

      describe("leave", function() {
        it("should asynchronously render the leave animation", inject(function($$rAF) {
          animations.leave = function(element, done) {
            log.push('before leave');
            done();
          };
          runAnimation('leave', function() {
            log.push('complete');
          });

          expect(log).toEqual(['before leave']);
          $$rAF.flush();

          expect(log).toEqual(['before leave', 'dom leave', 'complete']);
        }));
      });

      describe("addClass", function() {
        it("should asynchronously render the beforeAddClass animation", inject(function($$rAF) {
          animations.beforeAddClass = function(element, className, done) {
            log.push('before addClass');
            done();
          };

          runAnimation('addClass');
          expect(log).toEqual(['before addClass']);
          $$rAF.flush();

          expect(log).toEqual(['before addClass', 'dom addClass']);
        }));

        it("should asynchronously render the addClass animation", inject(function($$rAF) {
          animations.addClass = function(element, className, done) {
            log.push('after addClass');
            done();
          };

          runAnimation('addClass', function() {
            log.push('complete');
          });

          expect(log).toEqual(['dom addClass', 'after addClass']);
          $$rAF.flush();

          expect(log).toEqual(['dom addClass', 'after addClass', 'complete']);
        }));
      });

      describe("removeClass", function() {
        it("should asynchronously render the beforeRemoveClass animation", inject(function($$rAF) {
          animations.beforeRemoveClass = function(element, className, done) {
            log.push('before removeClass');
            done();
          };

          runAnimation('removeClass');
          expect(log).toEqual(['before removeClass']);
          $$rAF.flush();

          expect(log).toEqual(['before removeClass', 'dom removeClass']);
        }));

        it("should asynchronously render the removeClass animation", inject(function($$rAF) {
          animations.removeClass = function(element, className, done) {
            log.push('after removeClass');
            done();
          };

          runAnimation('removeClass', function() {
            log.push('complete');
          });

          expect(log).toEqual(['dom removeClass', 'after removeClass']);
          $$rAF.flush();

          expect(log).toEqual(['dom removeClass', 'after removeClass', 'complete']);
        }));
      });

      describe("setClass", function() {
        it("should asynchronously render the beforeRemoveClass animation", inject(function($$rAF) {
          animations.beforeSetClass = function(element, add, remove, done) {
            log.push('before setClass');
            done();
          };

          runAnimation('setClass');
          expect(log).toEqual(['before setClass']);
          $$rAF.flush();

          expect(log).toEqual(['before setClass', 'dom setClass']);
        }));

        it("should asynchronously render the setClass animation", inject(function($$rAF) {
          animations.setClass = function(element, add, remove, done) {
            log.push('after setClass');
            done();
          };

          runAnimation('setClass', function() {
            log.push('complete');
          });

          expect(log).toEqual(['dom setClass', 'after setClass']);
          $$rAF.flush();

          expect(log).toEqual(['dom setClass', 'after setClass', 'complete']);
        }));
      });
    });
  });
});
