'use strict';

ddescribe("animations", function() {

  var element;
  afterEach(function() {
    dealoc(element);
  });

  describe('during bootstrap', function() {
    it('should be enabled only after the first digest is fired and the postDigest queue is empty',
      inject(function($animate, $rootScope) {

      var capturedEnabledState;
      $rootScope.$$postDigest(function() {
        capturedEnabledState = $animate.enabled();
      });

      expect($animate.enabled()).toBe(false);
      $rootScope.$digest();

      expect(capturedEnabledState).toBe(false);
      expect($animate.enabled()).toBe(true);
    }));

    it('should be disabled until all pending template requests have been downloaded', function() {
      var mockTemplateRequest = {
        totalPendingRequests : 2
      };

      module(function($provide) {
        $provide.value('$templateRequest', mockTemplateRequest);
      });
      inject(function($animate, $rootScope) {
        expect($animate.enabled()).toBe(false);

        $rootScope.$digest();
        expect($animate.enabled()).toBe(false);

        mockTemplateRequest.totalPendingRequests = 0;
        $rootScope.$digest();
        expect($animate.enabled()).toBe(true);
      });
    });

    it('should stay disabled if set to be disabled even after all templates have been fully downloaded', function() {
      var mockTemplateRequest = {
        totalPendingRequests : 2
      };

      module(function($provide) {
        $provide.value('$templateRequest', mockTemplateRequest);
      });
      inject(function($animate, $rootScope) {
        $animate.enabled(false);
        expect($animate.enabled()).toBe(false);

        $rootScope.$digest();
        expect($animate.enabled()).toBe(false);

        mockTemplateRequest.totalPendingRequests = 0;
        $rootScope.$digest();
        expect($animate.enabled()).toBe(false);
      });
    });
  });

  describe('$animateRunner', function() {
    var METHODS = ['pause', 'end', 'resume', 'cancel', 'next'];

    it('should wrap the runner around a promise object', inject(function($q, $animateRunner) {
      var promise = $q.when(true);
      var runner = $animateRunner(promise);

      expect(runner.then).toBe(promise.then);
      expect(runner.finally).toBe(promise.finally);
      expect(runner.catch).toBe(promise.catch);
    }));

    it('should throw an error if a promise object is not provided', inject(function($animateRunner) {
      function theRoofIsOnFire() {
        var runner = $animateRunner({});
      }

      expect(theRoofIsOnFire).toThrow();
    }));

    it('should extend the existing object with new methods if provided at a later stage',
      inject(function($q, $animateRunner) {

      var promise = $q.when(true);
      var runner = $animateRunner(promise);

      var pauseFn = function() {
        var paused = true;
      };

      expect(runner.pause).not.toBe(pauseFn);

      var runner2 = $animateRunner(runner, { pause: pauseFn });

      expect(runner2).toBe(runner);
      expect(runner.pause).toBe(pauseFn);
    }));

    they('should expose a default (noop) $prop function', METHODS, function(method) {
      inject(function($animateRunner, $q) {
        var runner = $animateRunner($q.when(true));
        expect(runner[method]).toBe(noop);
      });
    });

    they('should allow an existing $prop function to be used in the runner', METHODS, function(method) {
      inject(function($animateRunner, $q) {
        var methodSpy = jasmine.createSpy(method);

        var runnerData = $q.when(true);
        runnerData[method] = methodSpy;
        var runner = $animateRunner(runnerData);

        expect(runner[method]).toBe(methodSpy);

        runner[method]();
        expect(methodSpy).toHaveBeenCalled();
      });
    });
  });

  describe('$animate', function() {
    var parent;
    var parent2;
    var options;
    var capturedAnimation;
    var capturedAnimationHistory;
    var overriddenAnimationRunner;
    var defaultFakeAnimationRunner;

    beforeEach(module(function($provide) {
      overriddenAnimationRunner = null;
      capturedAnimation = null;
      capturedAnimationHistory = [];

      options = {};
      $provide.value('$animation', function() {
        capturedAnimationHistory.push(capturedAnimation = arguments);
        return overriddenAnimationRunner || defaultFakeAnimationRunner;
      });

      return function($document, $rootElement, $q, $animate, $animateRunner) {
        defaultFakeAnimationRunner = $animateRunner({
          finally: noop,
          then: function() {
            return this;
          }
        });

        $animate.enabled(true);

        element = jqLite('<div class="element">element</div>');
        parent = jqLite('<div class="parent1">parent</div>');
        parent2 = jqLite('<div class="parent2">parent</div>');

        $rootElement.append(parent);
        $rootElement.append(parent2);
        jqLite($document[0].body).append($rootElement);
      }
    }));

    describe('enabled()', function() {
      it('should fully disable all animations in the application if false',
        inject(function($animate, $rootScope) {

        $animate.enabled(false);

        $animate.enter(element, parent);

        expect(capturedAnimation).toBeFalsy();
        $rootScope.$digest();
        expect(capturedAnimation).toBeFalsy();
      }));

      it('should disable all animations on the given element',
        inject(function($animate, $rootScope) {

        parent.append(element);

        $animate.enabled(element, false);
        expect($animate.enabled(element)).toBeFalsy();

        $animate.addClass(element, 'red');
        expect(capturedAnimation).toBeFalsy();
        $rootScope.$digest();
        expect(capturedAnimation).toBeFalsy();

        $animate.enabled(element, true);
        expect($animate.enabled(element)).toBeTruthy();

        $animate.addClass(element, 'blue');
        expect(capturedAnimation).toBeFalsy();
        $rootScope.$digest();
        expect(capturedAnimation).toBeTruthy();
      }));

      it('should disable all animations for a given element\'s children',
        inject(function($animate, $rootScope) {

        $animate.enabled(parent, false);

        $animate.enter(element, parent);
        expect(capturedAnimation).toBeFalsy();
        $rootScope.$digest();
        expect(capturedAnimation).toBeFalsy();

        $animate.enabled(parent, true);

        $animate.enter(element, parent);
        expect(capturedAnimation).toBeFalsy();
        $rootScope.$digest();
        expect(capturedAnimation).toBeTruthy();
      }));
    });

    it('enter() should issue an enter animation and fire the DOM operation right away before the animation kicks off', inject(function($animate, $rootScope) {
      expect(parent.children().length).toBe(0);

      $animate.enter(element, parent, null, options);

      expect(parent.children().length).toBe(1);

      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('enter');
      expect(capturedAnimation[2]).toEqual(options);
    }));

    it('move() should issue an enter animation and fire the DOM operation right away before the animation kicks off', inject(function($animate, $rootScope) {
      parent.append(element);

      expect(parent.children().length).toBe(1);
      expect(parent2.children().length).toBe(0);

      $animate.move(element, parent2, null, options);

      expect(parent.children().length).toBe(0);
      expect(parent2.children().length).toBe(1);

      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('move');
      expect(capturedAnimation[2]).toEqual(options);
    }));

    they('$prop() should insert the element adjacent to the after element if provided',
      ['enter', 'move'], function(event) {

      inject(function($animate, $rootScope) {
        parent.append(element);
        expect(parent2.next()).not.toEqual(element);
        $animate[event](element, null, parent2, options);
        expect(parent2.next()).toEqual(element);
        $rootScope.$digest();
        expect(capturedAnimation[1]).toBe(event);
      });
    });

    they('$prop() should append to the parent incase the after element is destroyed before the DOM operation is issued',
      ['enter', 'move'], function(event) {
      inject(function($animate, $rootScope) {
        parent2.remove();
        $animate[event](element, parent, parent2, options);
        expect(parent2.next()).not.toEqual(element);
        $rootScope.$digest();
        expect(capturedAnimation[1]).toBe(event);
      });
    });

    it('leave() should issue a leave animation with the correct DOM operation', inject(function($animate, $rootScope) {
      parent.append(element);
      $animate.leave(element, options);
      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('leave');
      expect(capturedAnimation[2]).toEqual(options);

      expect(element.parent().length).toBe(1);
      capturedAnimation[3]();
      expect(element.parent().length).toBe(0);
    }));

    it('addClass() should issue an addClass animation with the correct DOM operation', inject(function($animate, $rootScope) {
      parent.append(element);
      $animate.addClass(element, 'red', options);
      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('addClass');
      expect(capturedAnimation[2]).toEqual(options);

      expect(element).not.toHaveClass('red');
      capturedAnimation[3]();
      expect(element).toHaveClass('red');
    }));

    it('removeClass() should issue a removeClass animation with the correct DOM operation', inject(function($animate, $rootScope) {
      parent.append(element);
      element.addClass('blue');

      $animate.removeClass(element, 'blue', options);
      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('removeClass');
      expect(capturedAnimation[2]).toEqual(options);

      expect(element).toHaveClass('blue');
      capturedAnimation[3]();
      expect(element).not.toHaveClass('blue');
    }));

    it('setClass() should issue a setClass animation with the correct DOM operation', inject(function($animate, $rootScope) {
      parent.append(element);
      element.addClass('green');

      $animate.setClass(element, 'yellow', 'green', options);
      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('setClass');
      expect(capturedAnimation[2]).toEqual(options);

      expect(element).not.toHaveClass('yellow');
      expect(element).toHaveClass('green');
      capturedAnimation[3]();
      expect(element).toHaveClass('yellow');
      expect(element).not.toHaveClass('green');
    }));

    describe('parent animations', function() {
      it('should immediately end a pre-digest parent class-based animation if a structural child is active',
        inject(function($rootScope, $animate) {

        parent.append(element);
        var child = jqLite('<div></div>');
        $animate.addClass(parent, 'abc');

        $animate.enter(child, element);
        $rootScope.$digest();

        expect(parent).toHaveClass('abc');
      }));

      it('should immediately end a parent class-based animation if a structural child is active',
        inject(function($rootScope, $rootElement, $animate) {

        parent.append(element);
        var child = jqLite('<div></div>');

        var isCancelled = false;
        overriddenAnimationRunner = extend(defaultFakeAnimationRunner, {
          end : function() {
            isCancelled = true;
          }
        });

        $animate.addClass(parent, 'abc');
        $rootScope.$digest();

        // restore the default
        overriddenAnimationRunner = defaultFakeAnimationRunner;

        $animate.enter(child, element);
        $rootScope.$digest();

        expect(isCancelled).toBe(true);
      }));
    });

    describe('child animations', function() {
      it('should be blocked when there is an ongoing structural parent animation occurring',
        inject(function($rootScope, $rootElement, $animate) {

        parent.append(element);

        expect(capturedAnimation).toBeFalsy();
        $animate.move(parent, parent2);
        $rootScope.$digest();

        // yes the animation is going on
        expect(capturedAnimation[0]).toBe(parent);
        capturedAnimation = null;

        $animate.addClass(element, 'blue');
        $rootScope.$digest();
        expect(capturedAnimation).toBeFalsy();
      }));

      it('should be blocked when there is an ongoing structural parent animation occurring',
        inject(function($rootScope, $rootElement, $animate) {

        parent.append(element);

        expect(capturedAnimation).toBeFalsy();
        $animate.move(parent, parent2);
        $rootScope.$digest();

        // yes the animation is going on
        expect(capturedAnimation[0]).toBe(parent);
        capturedAnimation = null;

        $animate.addClass(element, 'blue');
        $rootScope.$digest();
        expect(capturedAnimation).toBeFalsy();
      }));

      it('should not be blocked when there is an ongoing class-based parent animation occurring',
        inject(function($rootScope, $rootElement, $animate) {

        parent.append(element);

        expect(capturedAnimation).toBeFalsy();
        $animate.addClass(parent, 'rogers');
        $rootScope.$digest();

        // yes the animation is going on
        expect(capturedAnimation[0]).toBe(parent);
        capturedAnimation = null;

        $animate.addClass(element, 'blue');
        $rootScope.$digest();
        expect(capturedAnimation[0]).toBe(element);
      }));

      it('should skip all pre-digest queued child animations when a parent structural animation is triggered',
        inject(function($rootScope, $rootElement, $animate) {

        parent.append(element);

        $animate.addClass(element, 'rumlow');
        $animate.move(parent, null, parent2);

        expect(capturedAnimation).toBeFalsy();
        expect(capturedAnimationHistory.length).toBe(0);
        $rootScope.$digest();

        expect(capturedAnimation[0]).toBe(parent);
        expect(capturedAnimationHistory.length).toBe(1);
      }));

      it('should end all ongoing post-digest child animations when a parent structural animation is triggered',
        inject(function($rootScope, $rootElement, $animate) {

        parent.append(element);

        $animate.addClass(element, 'rumlow');
        var isCancelled = false;
        overriddenAnimationRunner = extend(defaultFakeAnimationRunner, {
          end : function() {
            isCancelled = true;
          }
        });

        $rootScope.$digest();
        expect(capturedAnimation[0]).toBe(element);
        expect(isCancelled).toBe(false);

        // restore the default
        overriddenAnimationRunner = defaultFakeAnimationRunner;
        $animate.move(parent, null, parent2);
        $rootScope.$digest();
        expect(capturedAnimation[0]).toBe(parent);

        expect(isCancelled).toBe(true);
      }));

      it('should not end any child animations if a parent class-based animation is issued',
        inject(function($rootScope, $rootElement, $animate) {

        parent.append(element);

        var element2 = jqLite('<div>element2</div>');
        $animate.enter(element2, parent);

        var isCancelled = false;
        overriddenAnimationRunner = extend(defaultFakeAnimationRunner, {
          end : function() {
            isCancelled = true;
          }
        });

        $rootScope.$digest();
        expect(capturedAnimation[0]).toBe(element2);
        expect(isCancelled).toBe(false);

        // restore the default
        overriddenAnimationRunner = defaultFakeAnimationRunner;
        $animate.addClass(parent, 'peter');
        $rootScope.$digest();
        expect(capturedAnimation[0]).toBe(parent);

        expect(isCancelled).toBe(false);
      }));

      it('should remove the animation block on child animations once the parent animation is complete',
        inject(function($rootScope, $rootElement, $animate) {

        var doneFn;
        overriddenAnimationRunner = extend(defaultFakeAnimationRunner, {
          finally : function(fn) {
            doneFn = fn;
            return this;
          }
        });

        parent.append(element);

        $animate.enter(parent, null, parent2);
        $rootScope.$digest();
        expect(capturedAnimationHistory.length).toBe(1);

        $animate.addClass(element, 'tony');
        $rootScope.$digest();
        expect(capturedAnimationHistory.length).toBe(1);

        doneFn();

        $animate.addClass(element, 'stark');
        $rootScope.$digest();
        expect(capturedAnimationHistory.length).toBe(2);
      }));
    });

    describe('cancellations', function() {
      it('should cancel the previous animation if a follow-up structural animation takes over',
        inject(function($animate, $rootScope) {

        var enterComplete = false;
        overriddenAnimationRunner = extend(defaultFakeAnimationRunner, {
          end : function() {
            enterComplete = true;
          }
        });

        parent.append(element);
        $animate.move(element, parent2);

        $rootScope.$digest();
        expect(enterComplete).toBe(false);

        $animate.leave(element);
        $rootScope.$digest();
        expect(enterComplete).toBe(true);
      }));

      it('should issue a new runner instance if a previous structural animation was cancelled',
        inject(function($animate, $rootScope) {

        parent.append(element);

        var runner1 = $animate.move(element, parent2);
        $rootScope.$digest();

        var runner2 = $animate.leave(element);
        $rootScope.$digest();

        expect(runner1).not.toBe(runner2);
      }));
    });

    describe('should merge', function() {
      it('multiple class-based animations together into one before the digest passes', inject(function($animate, $rootScope) {
        parent.append(element);
        element.addClass('green');

        $animate.addClass(element, 'red');
        $animate.addClass(element, 'blue');
        $animate.removeClass(element, 'green');

        $rootScope.$digest();

        expect(capturedAnimation[0]).toBe(element);
        expect(capturedAnimation[1]).toBe('setClass');

        options = capturedAnimation[2];
        expect(options.addClass).toEqual('red blue');
        expect(options.removeClass).toEqual('green');

        expect(element).not.toHaveClass('red');
        expect(element).not.toHaveClass('blue');
        expect(element).toHaveClass('green');
        capturedAnimation[3]();
        expect(element).toHaveClass('red');
        expect(element).toHaveClass('blue');
        expect(element).not.toHaveClass('green');
      }));

      it('multiple class-based animations together into a single structural event before the digest passes', inject(function($animate, $rootScope) {
        element.addClass('green');

        expect(element.parent().length).toBe(0);
        $animate.enter(element, parent);
        expect(element.parent().length).toBe(1);

        $animate.addClass(element, 'red');
        $animate.removeClass(element, 'green');

        $rootScope.$digest();

        expect(capturedAnimation[0]).toBe(element);
        expect(capturedAnimation[1]).toBe('enter');

        options = capturedAnimation[2];
        expect(options.addClass).toEqual('red');
        expect(options.removeClass).toEqual('green');

        expect(element).not.toHaveClass('red');
        expect(element).toHaveClass('green');
        capturedAnimation[3]();
        expect(element).toHaveClass('red');
        expect(element).not.toHaveClass('green');
      }));

      it('should automatically cancel out class-based animations if the element already contains or doesn\' contain the applied classes',
        inject(function($animate, $rootScope) {

        parent.append(element);
        element.addClass('one three');

        $animate.addClass(element, 'one');
        $animate.addClass(element, 'two');
        $animate.removeClass(element, 'three');
        $animate.removeClass(element, 'four');

        $rootScope.$digest();

        options = capturedAnimation[2];
        expect(options.addClass).toEqual('two');
        expect(options.removeClass).toEqual('three');
      }));

      it('and skip the animation entirely if no class-based animations remain and if there is no structural animation applied',
        inject(function($animate, $rootScope) {

        parent.append(element);
        element.addClass('one three');

        $animate.addClass(element, 'one');
        $animate.removeClass(element, 'four');

        $rootScope.$digest();
        expect(capturedAnimation).toBeFalsy();
      }));

      it('but not skip the animation if it is a structural animation and if there are no classes to be animated',
        inject(function($animate, $rootScope) {

        element.addClass('one three');

        $animate.addClass(element, 'one');
        $animate.removeClass(element, 'four');
        $animate.enter(element, parent);

        $rootScope.$digest();

        expect(capturedAnimation[1]).toBe('enter');
      }));

      it('class-based animations, however it should also cancel former structural animations in the process',
        inject(function($animate, $rootScope) {

        element.addClass('green');

        $animate.enter(element, parent);
        $animate.addClass(element, 'red');
        $animate.removeClass(element, 'green');
        $animate.leave(element);

        $rootScope.$digest();

        expect(capturedAnimation[0]).toBe(element);
        expect(capturedAnimation[1]).toBe('leave');

        // $$hashKey causes comparison issues
        expect(element.parent()[0]).toEqual(parent[0]);

        options = capturedAnimation[2];
        expect(options.addClass).toEqual('red');
        expect(options.removeClass).toEqual('green');
      }));

      it('should retain the instance to the very first runner object when multiple element-level animations are issued',
        inject(function($animate, $rootScope) {

        element.addClass('green');

        var r1 = $animate.enter(element, parent);
        var r2 = $animate.addClass(element, 'red');
        var r3 = $animate.removeClass(element, 'green');

        expect(r1).toBe(r2);
        expect(r2).toBe(r3);
      }));
    });
  })

  describe('[ng-animate-children]', function() {
    var parent, element, child, capturedAnimation, captureLog;
    beforeEach(module(function($provide) {
      capturedAnimation = null;
      captureLog = [];
      $provide.factory('$animation', function($q) {
        return function(element, method, options, domOperation) {
          domOperation();
          captureLog.push(capturedAnimation = arguments);
          return $q.when(true);
        };
      });
      return function($rootElement, $document, $animate) {
        jqLite($document[0].body).append($rootElement);
        parent  = jqLite('<div class="parent"></div>');
        element = jqLite('<div class="element"></div>');
        child   = jqLite('<div class="child"></div>');
        $animate.enabled(true);
      };
    }));

    it('should allow child animations to run when the attribute is used',
      inject(function($animate, $rootScope, $rootElement, $compile) {

      $animate.enter(parent, $rootElement);
      $animate.enter(element, parent);
      $animate.enter(child, element);
      $rootScope.$digest();
      expect(captureLog.length).toBe(1);

      captureLog = [];

      parent.attr('ng-animate-children', '');
      $compile(parent)($rootScope);
      $rootScope.$digest();

      $animate.enter(parent, $rootElement);
      $rootScope.$digest();
      expect(captureLog.length).toBe(1);

      $animate.enter(element, parent);
      $animate.enter(child, element);
      $rootScope.$digest();
      expect(captureLog.length).toBe(3);
    }));

    it('should fully disallow all parallel child animations from running if `off` is used',
      inject(function($animate, $rootScope, $rootElement, $compile) {

      $rootElement.append(parent);
      parent.append(element);
      element.append(child);

      parent.attr('ng-animate-children', 'off');
      element.attr('ng-animate-children', 'on');

      $compile(parent)($rootScope);
      $compile(element)($rootScope);
      $rootScope.$digest();

      $animate.leave(parent);
      $animate.leave(element);
      $animate.leave(child);
      $rootScope.$digest();

      expect(captureLog.length).toBe(1);

      dealoc(element);
      dealoc(child);
    }));

    it('should watch to see if the ng-animate-children attribute changes',
      inject(function($animate, $rootScope, $rootElement, $compile) {

      $rootElement.append(parent);
      $rootScope.val = 'on';
      parent.attr('ng-animate-children', '{{ val }}');
      $compile(parent)($rootScope);
      $rootScope.$digest();

      $animate.enter(parent, $rootElement);
      $animate.enter(element, parent);
      $animate.enter(child, element);
      $rootScope.$digest();
      expect(captureLog.length).toBe(3);

      captureLog = [];

      $rootScope.val = 'off';
      parent.attr('ng-animate-children', '{{ val }}');
      $rootScope.$digest();

      $animate.leave(parent);
      $animate.leave(element);
      $animate.leave(child);
      $rootScope.$digest();

      expect(captureLog.length).toBe(1);

      dealoc(element);
      dealoc(child);
    }));
  });
});
