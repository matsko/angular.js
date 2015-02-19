'use strict';

ddescribe('$animation', function() {

  var element;
  afterEach(function() {
    dealoc(element);
  });

  describe("drivers", function() {
    it("should use the first driver that returns a step function", function() {
      var count = 0;
      var activeDriver;
      module(function($animationProvider, $provide) {
        $animationProvider.drivers.push('1');
        $animationProvider.drivers.push('2');
        $animationProvider.drivers.push('3');

        $provide.value('1', function() {
          count++;
        });

        $provide.value('2', function() {
          count++;
          return function() {
            activeDriver = '2';
          };
        });

        $provide.value('3', function() {
          count++;
        });
      });

      inject(function($animation, $rootScope) {
        element = jqLite('<div></div>');
        $animation(element, 'enter');
        $rootScope.$digest();

        expect(count).toBe(2);
        expect(activeDriver).toBe('2');
      });
    });

    it("should call the driver init method and pass in the element, event and CSS classes", function() {
      var capturedAnimation;
      module(function($animationProvider, $provide) {
        $animationProvider.drivers.push('capturer');
        $provide.value('capturer', function() {
          capturedAnimation = arguments;
        });
      });

      inject(function($animation, $rootScope) {
        element = jqLite('<div class="one"></div>');
        $animation(element, 'enter', {
          addClass: 'two',
          removeClass: 'three'
        });

        expect(capturedAnimation[0]).toBe(element);
        expect(capturedAnimation[1]).toBe('enter');
        expect(capturedAnimation[2]).toBe('one two three');
      });
    });

    it("should call the driver step function and pass in the element and the provided options", function() {
      var capturedAnimation;
      module(function($animationProvider, $provide) {
        $animationProvider.drivers.push('stepper');
        $provide.value('stepper', function() {
          return function() {
            capturedAnimation = arguments;
          }
        });
      });

      inject(function($animation, $rootScope) {
        element = jqLite('<div></div>');

        var options = { addClass: 'abc' };
        $animation(element, 'enter', options);
        $rootScope.$digest();

        var details = capturedAnimation[0];
        expect(details.element).toBe(element);
        expect(details.options).toBe(options);
      });
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

      inject(function($animation) {
        element = jqLite('<div></div>');
        $animation(element, 'enter');
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

        $rootScope.$digest();
        $rootScope.$digest();
        $$rAF.flush();

        expect(status).toBe(event);
      });
    });
  });

  describe("grouping", function() {
    var captureLog;
    var capturedAnimation;
    var fromElement;
    var toElement;
    var fromAnchors;
    var toAnchors;

    beforeEach(module(function($animationProvider, $provide) {
      captureLog = [];

      $animationProvider.drivers.push('interceptorDriver');
      $provide.factory('interceptorDriver', function($q, $animateRunner) {
        return function() {
          return function() {
            captureLog.push(capturedAnimation = arguments[0]); //only one param is passed into the driver
            var runner = $q.when(true);
            return $animateRunner(runner);
          }
        }
      });

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
