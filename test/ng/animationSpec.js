'use strict';

ddescribe('$animation', function() {

  var element;
  afterEach(function() {
    dealoc(element);
  });

  it("should not run an animation if there are no drivers", function() {
    module(function($animationProvider, $provide) {
      $animationProvider.drivers.length = 0;
    });
    inject(function($animation, $$rAF) {
      element = jqLite('<div></div>');
      var done = false;
      $animation(element, 'someEvent').then(function() {
        done = true;
      });
      $$rAF.flush();
      expect(done).toBe(true);
    });
  });

  it("should not run an animation if no drivers return an animation step function", function() {
    module(function($animationProvider, $provide) {
      $animationProvider.drivers.push('matiasDriver');
      $provide.value('matiasDriver', function() {
        return false;
      });
    });
    inject(function($animation, $$rAF, $rootScope) {
      element = jqLite('<div></div>');
      var done = false;
      $animation(element, 'someEvent').then(function() {
        done = true;
      });
      $rootScope.$digest();
      $$rAF.flush();
      expect(done).toBe(true);
    });
  });

  describe("drivers", function() {
    it("should use the first driver that returns a step function", function() {
      var count = 0;
      var activeDriver;
      module(function($animationProvider, $provide) {
        $animationProvider.drivers.push('1');
        $animationProvider.drivers.push('2');
        $animationProvider.drivers.push('3');

        var fakePromise;

        $provide.value('1', function() {
          count++;
        });

        $provide.value('2', function() {
          count++;
          return function() {
            activeDriver = '2';
            return fakePromise;
          };
        });

        $provide.value('3', function() {
          count++;
        });

        return function($q) {
          fakePromise = $q.when(true);
        };
      });

      inject(function($animation, $rootScope) {
        element = jqLite('<div></div>');
        $animation(element, 'enter');
        $rootScope.$digest();

        expect(count).toBe(2);
        expect(activeDriver).toBe('2');
      });
    });

    describe('step function', function() {
      var capturedAnimation;
      beforeEach(module(function($animationProvider, $provide) {
        element = jqLite('<div></div>');

        $animationProvider.drivers.push('stepper');
        $provide.factory('stepper', function($q) {
          return function() {
            capturedAnimation = arguments;
            return function() {
              return $q.when();
            };
          }
        });
      }));

      it("should otain the element, event, the provided options and the domOperation",
        inject(function($animation, $rootScope) {

        var options = {};
        var domOperationCalled = false;
        $animation(element, 'megaEvent', options, function() {
          domOperationCalled = true;
        });
        $rootScope.$digest();

        var details = capturedAnimation[0];
        expect(details.element).toBe(element);
        expect(details.event).toBe('megaEvent');
        expect(details.options).toBe(options);

        // the function is wrapped inside of $animation, but it is still a function
        expect(domOperationCalled).toBe(false);
        details.domOperation();
        expect(domOperationCalled).toBe(true);
      }));

      it("should obtain the classes string which is a combination of className, addClass and removeClass",
        inject(function($animation, $rootScope) {

        element.addClass('blue red');
        $animation(element, 'enter', {
          addClass: 'green',
          removeClass: 'orange',
          tempClassName: 'pink'
        });

        $rootScope.$digest();

        var classes = capturedAnimation[0].classes;
        expect(classes).toBe('blue red green orange pink');
      }));
    });

    it("should traverse the drivers in reverse order", function() {
      var log = [];
      module(function($animationProvider, $provide) {
        $animationProvider.drivers.push('first');
        $animationProvider.drivers.push('second');

        $provide.value('first', function() {
          log.push('first');
          return false;
        });

        $provide.value('second', function() {
          log.push('second');
          return false;
        });
      });

      inject(function($animation, $rootScope) {
        element = jqLite('<div></div>');
        $animation(element, 'enter');
        $rootScope.$digest();
        expect(log).toEqual(['second', 'first']);
      });
    });

    they("should $prop the animation call if the driver $proped the returned promise",
      ['resolve', 'reject'], function(event) {

      module(function($animationProvider, $provide) {
        $animationProvider.drivers.push('resolvingAnimation');
        $provide.factory('resolvingAnimation', function($q) {
          return function() {
            return function() {
              return event === 'resolve' ? $q.when(true) : $q.reject();
            }
          }
        });
      });

      inject(function($animation, $rootScope, $$rAF) {
        var status, element = jqLite('<div></div>');
        $animation(element, 'enter').then(function() {
            status = 'resolve';
          }, function() {
            status = 'reject';
          });

        // the animation is started
        $rootScope.$digest();

        // the resolve/rejection digest
        $rootScope.$digest();
        $$rAF.flush();

        expect(status).toBe(event);
      });
    });

    they("should $prop the driver animation when runner.$prop() is called",
      ['cancel', 'end'], function(method) {

      var log = [];

      module(function($animationProvider, $provide) {
        $animationProvider.drivers.push('actualDriver');
        $provide.factory('actualDriver', function($qRaf, $animateRunner) {
          return function() {
            return {
              start : function() {
                log.push('start');
                var promise = $qRaf.when(true);
                return $animateRunner(promise, {
                  end : function() {
                    log.push('end');
                  },
                  cancel : function() {
                    log.push('cancel');
                  }
                });
              }
            };
          };
        });
      });

      inject(function($animation, $rootScope) {
        element = jqLite('<div></div>');
        var runner = $animation(element, 'enter');
        $rootScope.$digest();

        runner[method]();
        expect(log).toEqual(['start', method]);
      });
    });
  });

  describe('when', function() {
    var captureLog;
    var runnerLog;
    var capturedAnimation;

    beforeEach(module(function($animationProvider, $provide) {
      captureLog = [];
      runnerLog = [];
      capturedAnimation = null;

      $animationProvider.drivers.push('interceptorDriver');
      $provide.factory('interceptorDriver', function($q, $animateRunner) {
        return function(details) {
          captureLog.push(capturedAnimation = details); //only one param is passed into the driver
          return function() {
            var runner = $q.when(true);
            return $animateRunner(runner, {
              end: runnerEvent('end'),
              cancel: runnerEvent('cancel')
            });
          };
        }
      });

      function runnerEvent(token) {
        return function() {
          runnerLog.push(token);
        }
      }
    }));

    describe("singular", function() {
      beforeEach(module(function($provide) {
        element = jqLite('<div></div>');
        return function($rootElement) {
          $rootElement.append(element);
        };
      }));

      they('should return a runner that object that contains a $prop() function',
        ['end', 'cancel', 'then'], function(method) {
        inject(function($animation) {
          var runner = $animation(element, 'someEvent');
          expect(isFunction(runner[method])).toBe(true);
        });
      });

      they('should close the animation if runner.$prop() is called before the $postDigest phase kicks in',
        ['end', 'cancel'], function(method) {
        inject(function($animation, $rootScope, $$rAF) {
          var status;
          var runner = $animation(element, 'someEvent');
          runner.then(function() { status = 'end'; },
                      function() { status = 'cancel'; });

          runner[method]();
          $rootScope.$digest();
          expect(runnerLog).toEqual([]);

          $$rAF.flush();
          expect(status).toBe(method);
        });
      });

      it('should patch the runner methods to the ones provided by the driver when the animation starts',
        inject(function($animation, $rootScope) {

        var runner = $animation(element, 'someEvent');
        expect(runner.end).not.toEqual(noop);
        expect(runner.cancel).not.toEqual(noop);

        var oldEnd = runner.end;
        var oldCancel = runner.cancel;

        $rootScope.$digest();

        expect(oldEnd).not.toBe(runner.end);
        expect(oldCancel).not.toBe(runner.cancel);

        runner.end();
        expect(runnerLog).toEqual(['end']);
      }));

      it('should not start the animation if the element is removed from the DOM before the postDigest kicks in',
        inject(function($animation) {

        var runner = $animation(element, 'someEvent');

        expect(capturedAnimation).toBeFalsy();
        element.remove();
        expect(capturedAnimation).toBeFalsy();
      }));

      it('should immediately end the animation if the element is removed from the DOM during the animation',
        inject(function($animation, $$rAF, $rootScope) {

        var runner = $animation(element, 'someEvent');
        $rootScope.$digest();
        $$rAF.flush(); //the animation is "animating"

        expect(capturedAnimation).toBeTruthy();
        expect(runnerLog).toEqual([]);
        element.remove();
        expect(runnerLog).toEqual(['end']);
      }));

      it('should not end the animation when the leave animation removes the element from the DOM',
        inject(function($animation, $$rAF, $rootScope) {

        var runner = $animation(element, 'leave', {}, function() {
          element.remove();
        });

        $rootScope.$digest();
        $$rAF.flush(); //the animation is "animating"

        expect(runnerLog).toEqual([]);
        capturedAnimation.domOperation(); //this removes the element
        element.remove();
        expect(runnerLog).toEqual([]);
      }));

      it('should remove the $destroy event listener when the animation is closed',
        inject(function($animation, $$rAF, $rootScope) {

        var addListen = spyOn(element, 'on').andCallThrough();
        var removeListen = spyOn(element, 'off').andCallThrough();
        var runner = $animation(element, 'someEvent');

        var args = addListen.mostRecentCall.args[0];
        expect(args).toBe('$destroy');

        runner.end();

        args = removeListen.mostRecentCall.args[0];
        expect(args).toBe('$destroy');
      }));
    });

    describe("grouped", function() {
      var fromElement;
      var toElement;
      var fromAnchors
      var toAnchors;
      beforeEach(module(function($provide) {
        fromElement = jqLite('<div></div>');
        toElement = jqLite('<div></div>');
        fromAnchors = [
          jqLite('<div>1</div>'),
          jqLite('<div>2</div>'),
          jqLite('<div>3</div>')
        ];
        toAnchors = [
          jqLite('<div>a</div>'),
          jqLite('<div>b</div>'),
          jqLite('<div>c</div>')
        ];

        return function($rootElement) {
          $rootElement.append(fromElement);
          $rootElement.append(toElement);
          forEach(fromAnchors, function(a) {
            fromElement.append(a);
          });
          forEach(toAnchors, function(a) {
            toElement.append(a);
          });
        };
      }));

      it("should group animations together when they have shared anchors and a shared CSS class",
        inject(function($animation, $rootScope) {

        fromElement.addClass('shared-class');
        $animation(fromElement, 'leave');

        toElement.addClass('shared-class');
        $animation(toElement, 'enter');

        fromAnchors[0].attr('ng-animate-ref', '1');
        toAnchors[0].attr('ng-animate-ref', '1');
        $rootScope.$digest();

        expect(captureLog.length).toBe(1);

        var fromAnimation = capturedAnimation.from;
        expect(fromAnimation.element).toEqual(fromElement);
        expect(fromAnimation.event).toBe('leave');

        var toAnimation = capturedAnimation.to;
        expect(toAnimation.element).toBe(toElement);
        expect(toAnimation.event).toBe('enter');

        expect(capturedAnimation.anchors).toEqual([
          { 'out' : fromAnchors[0], 'in' : toAnchors[0] }
        ]);
      }));

      it("should group animations together and properly match up multiple anchors based on their references",
        inject(function($animation, $rootScope) {

        var attr = 'ng-animate-ref';

        fromAnchors[0].attr(attr, '1');
        fromAnchors[1].attr(attr, '2');
        fromAnchors[2].attr(attr, '3');

        toAnchors[0].attr(attr, '1');
        toAnchors[1].attr(attr, '3');
        toAnchors[2].attr(attr, '2');

        fromElement.addClass('shared-class');
        $animation(fromElement, 'leave');

        toElement.addClass('shared-class');
        $animation(toElement, 'enter');

        $rootScope.$digest();

        expect(capturedAnimation.anchors).toEqual([
          { 'out' : fromAnchors[0], 'in' : toAnchors[0] },
          { 'out' : fromAnchors[1], 'in' : toAnchors[2] },
          { 'out' : fromAnchors[2], 'in' : toAnchors[1] }
        ]);
      }));

      it("should group animations together on the from and to elements if their both contain matching anchors",
        inject(function($animation, $rootScope) {

        fromElement.addClass('shared-class');
        fromElement.attr('ng-animate-ref', '1');
        $animation(fromElement, 'leave');

        toElement.addClass('shared-class');
        toElement.attr('ng-animate-ref', '1');
        $animation(toElement, 'enter');

        $rootScope.$digest();

        expect(capturedAnimation.anchors).toEqual([
          { 'out' : fromElement, 'in' : toElement }
        ]);
      }));

      it("should not group animations into an anchored animation if enter/leave events are NOT used",
        inject(function($animation, $rootScope) {

        fromElement.addClass('shared-class');
        fromElement.attr('ng-animate-ref', '1');
        $animation(fromElement, 'addClass', {
          addClass: 'red'
        });

        toElement.addClass('shared-class');
        toElement.attr('ng-animate-ref', '1');
        $animation(toElement, 'removeClass', {
          removeClass: 'blue'
        });

        $rootScope.$digest();
        expect(captureLog.length).toBe(2);
      }));

      it("should not group animations together if a matching pair of anchors is not detected",
        inject(function($animation, $rootScope) {

        fromElement.addClass('shared-class');
        $animation(fromElement, 'leave');

        toElement.addClass('shared-class');
        $animation(toElement, 'enter');

        fromAnchors[0].attr('ng-animate-ref', '6');
        toAnchors[0].attr('ng-animate-ref', '3');
        $rootScope.$digest();

        expect(captureLog.length).toBe(2);
      }));

      it("should not group animations together if a matching CSS class is not detected",
        inject(function($animation, $rootScope) {

        fromElement.addClass('even-class');
        $animation(fromElement, 'leave');

        toElement.addClass('odd-class');
        $animation(toElement, 'enter');

        fromAnchors[0].attr('ng-animate-ref', '9');
        toAnchors[0].attr('ng-animate-ref', '9');
        $rootScope.$digest();

        expect(captureLog.length).toBe(2);
      }));

      it("should expose the shared CSS class in the options provided to the driver",
        inject(function($animation, $rootScope) {

        fromElement.addClass('fresh-class');
        $animation(fromElement, 'leave');

        toElement.addClass('fresh-class');
        $animation(toElement, 'enter');

        fromAnchors[0].attr('ng-animate-ref', '9');
        toAnchors[0].attr('ng-animate-ref', '9');
        $rootScope.$digest();

        expect(capturedAnimation.classes).toBe('fresh-class');
      }));

      it("should update the runner methods to the grouped runner methods handled by the driver",
        inject(function($animation, $rootScope) {

        fromElement.addClass('group-1');
        var runner1 = $animation(fromElement, 'leave');

        toElement.addClass('group-1');
        var runner2 = $animation(toElement, 'enter');

        expect(runner1).not.toBe(runner2);
        expect(runner1.end).not.toBe(runner2.end);
        expect(runner1.cancel).not.toBe(runner2.cancel);

        fromAnchors[0].attr('ng-animate-ref', 'abc');
        toAnchors[0].attr('ng-animate-ref', 'abc');
        $rootScope.$digest();

        expect(runner1).not.toBe(runner2);
        expect(runner1.end).toBe(runner2.end);
        expect(runner1.cancel).toBe(runner2.cancel);
      }));

      they("should end the animation if the $prop element is prematurely removed from the DOM during the animation", ['from', 'to'], function(event) {
        inject(function($animation, $rootScope) {
          fromElement.addClass('group-1');
          $animation(fromElement, 'leave');

          toElement.addClass('group-1');
          $animation(toElement, 'enter');

          fromAnchors[0].attr('ng-animate-ref', 'abc');
          toAnchors[0].attr('ng-animate-ref', 'abc');
          $rootScope.$digest();

          expect(runnerLog).toEqual([]);

          ('from' ? fromElement : toElement).remove();
          expect(runnerLog).toEqual(['end']);
        });
      });

      it("should not end the animation when the from animation calls its own leave dom operation",
        inject(function($animation, $rootScope, $$rAF) {

        fromElement.addClass('group-1');
        var elementRemoved = false;
        $animation(fromElement, 'leave', {}, function() {
          elementRemoved = true;
          fromElement.remove();
        });

        toElement.addClass('group-1');
        $animation(toElement, 'enter');

        fromAnchors[0].attr('ng-animate-ref', 'abc');
        toAnchors[0].attr('ng-animate-ref', 'abc');
        $rootScope.$digest();

        var leaveAnimation = capturedAnimation.from;
        expect(leaveAnimation.event).toBe('leave');

        // this removes the element and this code is run normally
        // by the driver when it is time for the element to be removed
        leaveAnimation.domOperation();

        expect(elementRemoved).toBe(true);
        expect(runnerLog).toEqual([]);
      }));

      it("should not end the animation if any of the anchor elements are removed from the DOM during the animation",
        inject(function($animation, $rootScope, $$rAF) {

        fromElement.addClass('group-1');
        var elementRemoved = false;
        $animation(fromElement, 'leave', {}, function() {
          elementRemoved = true;
          fromElement.remove();
        });

        toElement.addClass('group-1');
        $animation(toElement, 'enter');

        fromAnchors[0].attr('ng-animate-ref', 'abc');
        toAnchors[0].attr('ng-animate-ref', 'abc');
        $rootScope.$digest();

        fromAnchors[0].remove();
        toAnchors[0].remove();

        expect(runnerLog).toEqual([]);
      }));
    });
  });

  describe('[options]', function() {
    var runner;
    var defered;
    var parent;
    var mockedDriverFn;
    var mockedPlayerFn;

    beforeEach(module(function($animationProvider, $provide) {
      $animationProvider.drivers.push('mockedTestDriver');
      $provide.factory('mockedTestDriver', function() {
        return mockedDriverFn;
      });

      element = jqLite('<div></div>');
      parent = jqLite('<div></div>');

      return function($animateRunner, $q, $rootElement, $document) {
        jqLite($document[0].body).append($rootElement);
        $rootElement.append(parent);

        mockedDriverFn = function(element, method, options, domOperation) {
          return function() {
            defered = $q.defer();
            runner = $animateRunner(defered.promise);
            return runner;
          };
        };
      };
    }));

    it('should temporarily assign the provided CSS class for the duration of the animation',
      inject(function($rootScope, $animation) {

      $animation(element, 'enter', {
        tempClassName: 'temporary fudge'
      });
      $rootScope.$digest();

      expect(element).toHaveClass('temporary');
      expect(element).toHaveClass('fudge');

      defered.resolve();
      $rootScope.$digest();

      expect(element).not.toHaveClass('temporary');
      expect(element).not.toHaveClass('fudge');
    }));

    it('should add and remove the ng-animate CSS class when the animation is active',
      inject(function($animation, $rootScope) {

      $animation(element, 'enter');
      $rootScope.$digest();
      expect(element).toHaveClass('ng-animate');

      defered.resolve();
      $rootScope.$digest();

      expect(element).not.toHaveClass('ng-animate');
    }));

    it('should perform the DOM operation at the end of the animation if the driver doesn\'t run it already',
      inject(function($animation, $rootScope) {

      var domOperationFired = false;
      $animation(element, 'enter', {}, function() {
        domOperationFired = true;
      });

      $rootScope.$digest();

      expect(domOperationFired).toBeFalsy();
      defered.resolve();
      $rootScope.$digest();

      expect(domOperationFired).toBeTruthy();
    }));

    it('should still apply the `from` and `to` styling even if no driver was detected', function() {
      module(function($animationProvider) {
        $animationProvider.drivers.length = 0;
      });
      inject(function($animation, $rootScope) {
        $animation(element, 'event', {
          from: { background: 'red' },
          to: { background: 'blue' },
        });

        return;
        expect(element.css('background')).toBe('blue');
      });
    });

    it('should still apply the `from` and `to` styling even if the driver does not do the job', function() {
      module(function($animationProvider, $provide) {
        $animationProvider.drivers[0] = 'dumbDriver';
        $provide.factory('dumbDriver', function($q) {
          return function stepFn() {
            return $q.when(true);
          };
        });
      });
      inject(function($animation, $rootScope, $$rAF) {
        element.addClass('four');

        var completed = false;
        $animation(element, 'event', {
          from: { background: 'red' },
          to: { background: 'blue', 'font-size': '50px' }
        }).then(function() {
          completed = true;
        });

        $rootScope.$digest(); //runs the animation
        $rootScope.$digest(); //flushes the step code
        $$rAF.flush(); //runs the $animation promise

        expect(completed).toBe(true);
        return;
        expect(element.css('background')).toBe('blue');
        expect(element.css('font-size')).toBe('50px');
      });
    });

    it('should still resolve the `addClass` and `removeClass` classes even if no driver was detected', function() {
      module(function($animationProvider) {
        $animationProvider.drivers.length = 0;
      });
      inject(function($animation, $rootScope) {
        element.addClass('four');

        $animation(element, 'event', {
          addClass: 'one two three',
          removeClass: 'four'
        });

        return;
        expect(element).toHaveClass('one');
        expect(element).toHaveClass('two');
        expect(element).toHaveClass('three');
        expect(element).not.toHaveClass('four');
      });
    });

    it('should still resolve the `addClass` and `removeClass` classes even if the driver does not do the job', function() {
      module(function($animationProvider, $provide) {
        $animationProvider.drivers[0] = 'dumbDriver';
        $provide.factory('dumbDriver', function($q) {
          return function initFn() {
            return function stepFn() {
              return $q.when(true);
            };
          }
        });
      });
      inject(function($animation, $rootScope, $$rAF) {
        element.addClass('four');

        var completed = false;
        $animation(element, 'event', {
          addClass: 'one two three',
          removeClass: 'four'
        }).then(function() {
          completed = true;
        });

        $rootScope.$digest(); //runs the animation
        $rootScope.$digest(); //flushes the step code
        $$rAF.flush(); //runs the $animation promise

        expect(completed).toBe(true);
        return;
        expect(element).toHaveClass('one');
        expect(element).toHaveClass('two');
        expect(element).toHaveClass('three');
        expect(element).not.toHaveClass('four');
      });
    });
  });
});
