describe("$$animateCssDriver", function() {

  function int(x) {
    return parseInt(x, 10);
  }

  function hasAll(array, vals) {
    for(var i=0;i<vals.length;i++) {
      if (array.indexOf(vals[i]) === -1) return false;
    }
    return true;
  }

  beforeEach(module('ngAnimate'));

  var element;
  var ss;
  afterEach(function() {
    dealoc(element);
    if (ss) {
      ss.destroy();
    }
  });

  var capturedAnimation;
  var captureLog;
  var driver;
  var element;
  var captureFn;
  beforeEach(module(function($provide) {
    capturedAnimation = null;
    captureLog = [];
    captureFn = noop;

    $provide.factory('$animateCss', function($$qAnimate, $animateRunner) {
      return function() {
        var defered = $$qAnimate.defer();

        capturedAnimation = arguments
        captureFn.apply(null, arguments);
        captureLog.push({
          element: arguments[0],
          args: arguments,
          defered: defered
        });

        var runner = $animateRunner(defered.promise);

        return {
          start : function() {
            return runner;
          }
        };
      }
    });

    element = jqLite('<div></div>');

    return function($$animateCssDriver, $q, $animateRunner, $document, $window) {
      driver = $$animateCssDriver();
      ss = createMockStyleSheet($document, $window);
    };
  }));

  describe("regular animations", function() {
    it("should render an animation on the given element", inject(function() {
      driver({ element: element });
      expect(capturedAnimation[0]).toBe(element);
    }));

    it("should return an object with a start function", inject(function() {
      var runner = driver({ element: element });
      expect(isFunction(runner.start)).toBeTruthy();
    }));

    they("should call the DOM operation right away if an $prop animation is run",
      ['enter', 'move'], function(event) {

      inject(function() {
        var spy = jasmine.createSpy();
        driver({
          element: element,
          event: 'leave',
          domOperation: spy
        });
        expect(spy).not.toHaveBeenCalled();

        driver({
          element: element,
          event: event,
          domOperation: spy
        });
        expect(spy).toHaveBeenCalled();
      });
    });
  });

  describe("anchored animations", function() {
    var from, to;
    beforeEach(module(function() {
      return function($rootElement, $document) {
        from = element;
        to = jqLite('<div></div>');
        fromAnimation = { element: from, event: 'enter' };
        toAnimation = { element: to, event: 'leave' };
        $rootElement.append(from);
        $rootElement.append(to);

        // we need to do this so that style detection works
        jqLite($document[0].body).append($rootElement);
      };
    }));

    it("should not return anything if no animation is detected", function() {
      module(function($provide) {
        $provide.value('$animateCss', noop);
      });
      inject(function() {
        var runner = driver({
          from: fromAnimation,
          to: toAnimation
        });
        expect(runner).toBeFalsy();
      });
    });

    it("should return a start method", inject(function() {
      var runner = driver({
        from: fromAnimation,
        to: toAnimation
      });
      expect(isFunction(runner.start)).toBeTruthy();
    }));

    it("should render an animation on both the from and to elements", inject(function() {
      captureFn = function(element, details) {
        element.addClass(details.event);
      };

      var runner = driver({
        from: fromAnimation,
        to: toAnimation
      });

      expect(captureLog.length).toBe(2);
      expect(fromAnimation.element).toHaveClass('enter');
      expect(toAnimation.element).toHaveClass('leave');
    }));

    it("should start the animations on the from and to elements in parallel", function() {
      var animationLog = [];
      module(function($provide) {
        $provide.factory('$animateCss', function($q) {
          return function(element, details) {
            return {
              start : function() {
                animationLog.push([element, details.event]);
                return $q.when(true); //fake promise
              }
            }
          }
        });
      });
      inject(function() {
        var runner = driver({
          from: fromAnimation,
          to: toAnimation
        });

        expect(animationLog.length).toBe(0);
        runner.start();
        expect(animationLog).toEqual([
          [fromAnimation.element, 'enter'],
          [toAnimation.element, 'leave']
        ]);
      });
    });

    it("should start an animation for each anchor", inject(function() {
      var o1 = jqLite('<div></div>');
      from.append(o1);
      var o2 = jqLite('<div></div>');
      from.append(o2);
      var o3 = jqLite('<div></div>');
      from.append(o3);

      var i1 = jqLite('<div></div>');
      to.append(i1);
      var i2 = jqLite('<div></div>');
      to.append(i2);
      var i3 = jqLite('<div></div>');
      to.append(i3);

      var anchors = [
        { 'out': o1, 'in': i1, classes: 'red' },
        { 'out': o2, 'in': i2, classes: 'blue' },
        { 'out': o2, 'in': i2, classes: 'green' }
      ];

      var runner = driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: anchors
      });

      expect(captureLog.length).toBe(5);
    }));

    it("should create a clone of the starting element for each anchor animation", inject(function() {
      var o1 = jqLite('<div class="out1"></div>');
      from.append(o1);
      var o2 = jqLite('<div class="out2"></div>');
      from.append(o2);

      var i1 = jqLite('<div class="in1"></div>');
      to.append(i1);
      var i2 = jqLite('<div class="in2"></div>');
      to.append(i2);

      var anchors = [
        { 'out': o1, 'in': i1 },
        { 'out': o2, 'in': i2 }
      ];

      var runner = driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: anchors
      });

      var a2 = captureLog.pop().element;
      var a1 = captureLog.pop().element;

      expect(a1).not.toEqual(o1);
      expect(a1.attr('class')).toMatch(/\bout1\b/);
      expect(a2).not.toEqual(o2);
      expect(a2.attr('class')).toMatch(/\bout2\b/);
    }));

    it("should create a clone of the starting element and place it at the end of the $rootElement container",
    inject(function($rootElement) {
      //stick some garbage into the rootElement
      $rootElement.append(jqLite('<div></div>'));
      $rootElement.append(jqLite('<div></div>'));
      $rootElement.append(jqLite('<div></div>'));

      var fromAnchor = jqLite('<div class="out"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div class="in"></div>');
      to.append(toAnchor);

      var runner = driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'in': fromAnchor,
          'out': toAnchor
        }]
      });

      var anchor = captureLog.pop().element;
      var anchorNode = anchor[0];
      var contents = $rootElement.contents();

      expect(contents.length).toBeGreaterThan(1);
      expect(contents[contents.length - 1]).toEqual(anchorNode);
    }));

    it("should first do an addClass('out') animation on the cloned anchor", inject(function($rootElement) {
      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      var runner = driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      });

      var anchorDetails = captureLog.pop().args[1];
      expect(anchorDetails.addClass).toBe('out');
      expect(anchorDetails.event).toBeFalsy();
    }));

    it("should provide an explicit delay setting in the options provided to $animateCss for anchor animations",
    inject(function($rootElement) {
      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      var runner = driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      });

      expect(capturedAnimation[1].delay).toBeTruthy();
    }));

    it("should begin the anchor animation by seeding the from styles based on where the from anchor element is positioned",
    inject(function($rootElement) {
      ss.addRule('.starting-element', 'width:200px; height:100px; display:inline-block;');

      var fromAnchor = jqLite('<div class="starting-element"' +
                                  ' style="margin-top:500px; margin-left:150px;"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      var runner = driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      });

      var anchorAnimation = captureLog.pop();
      var anchorElement = anchorAnimation.element;
      var anchorDetails = anchorAnimation.args[1];

      var fromStyles = anchorDetails.from;
      expect(int(fromStyles.width)).toBe(200);
      expect(int(fromStyles.height)).toBe(100);
      // some browsers have their own body margin defaults
      expect(int(fromStyles.top)).toBeGreaterThan(499);
      expect(int(fromStyles.left)).toBeGreaterThan(149);
    }));

    it("should append a `px` value for all seeded animation styles", inject(function($rootElement, $$rAF) {
      ss.addRule('.starting-element', 'width:10px; height:20px; display:inline-block;');

      var fromAnchor = jqLite('<div class="starting-element"' +
                                  ' style="margin-top:30px; margin-left:40px;"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      var runner = driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      });

      var anchorAnimation = captureLog.pop();
      var anchorDetails = anchorAnimation.args[1];

      forEach(anchorDetails.from, function(value) {
        expect(value.substr(value.length - 2)).toBe('px');
      });

      // the out animation goes first
      anchorAnimation.defered.resolve();
      $$rAF.flush();

      anchorAnimation = captureLog.pop();
      anchorDetails = anchorAnimation.args[1];

      forEach(anchorDetails.to, function(value) {
        expect(value.substr(value.length - 2)).toBe('px');
      });
    }));

    it("should then do an removeClass('out') + addClass('in') animation on the cloned anchor",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      // the out animation goes first
      captureLog.pop().defered.resolve();
      $$rAF.flush();

      var anchorDetails = captureLog.pop().args[1];
      expect(anchorDetails.removeClass).toMatch(/\bout\b/);
      expect(anchorDetails.addClass).toMatch(/\bin\b/);
      expect(anchorDetails.event).toBeFalsy();
    }));

    it("should add the `ng-animate-anchor` class to the cloned anchor element",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      var clonedAnchor = captureLog.pop().element;
      expect(clonedAnchor).toHaveClass('ng-animate-anchor');
    }));

    it("should add and remove the `ng-animate-shim` class on the in anchor element during the animation",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      expect(fromAnchor).toHaveClass('ng-animate-shim')

      // the out animation goes first
      captureLog.pop().defered.resolve();
      $$rAF.flush();
      captureLog.pop().defered.resolve();

      expect(fromAnchor).not.toHaveClass('ng-animate-shim')
    }));

    it("should add and remove the `ng-animate-shim` class on the out anchor element during the animation",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      expect(toAnchor).toHaveClass('ng-animate-shim')

      // the out animation goes first
      captureLog.pop().defered.resolve();
      $$rAF.flush();

      expect(toAnchor).toHaveClass('ng-animate-shim')
      captureLog.pop().defered.resolve();

      expect(toAnchor).not.toHaveClass('ng-animate-shim')
    }));

    it("should create the cloned anchor with all of the classes from the from anchor element",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div class="yes no maybe"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      var addedClasses = captureLog.pop().element.attr('class').split(' ');
      expect(hasAll(addedClasses, ['yes', 'no', 'maybe'])).toBe(true);
    }));

    it("should remove the classes of the starting anchor from the cloned anchor node during the in animation and also add the classes of the destination anchor within the same animation",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div class="yes no maybe"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div class="why ok so-what"></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      // the out animation goes first
      captureLog.pop().defered.resolve();
      $$rAF.flush();

      var anchorDetails = captureLog.pop().args[1];
      var removedClasses = anchorDetails.removeClass.split(' ');
      var addedClasses = anchorDetails.addClass.split(' ');

      expect(hasAll(removedClasses, ['yes', 'no', 'maybe'])).toBe(true);
      expect(hasAll(addedClasses, ['why', 'ok', 'so-what'])).toBe(true);
    }));

    it("should not attempt to add/remove any classes that contain a `ng-` prefix",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div class="ng-yes ng-no sure"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div class="ng-bar ng-foo maybe"></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      // the out animation goes first
      captureLog.pop().defered.resolve();
      $$rAF.flush();

      var inAnimation = captureLog.pop();
      var details = inAnimation.args[1];

      var addedClasses = details.addClass.split(' ');
      var removedClasses = details.removeClass.split(' ');

      expect(addedClasses).not.toContain('ng-foo');
      expect(addedClasses).not.toContain('ng-bar');

      expect(removedClasses).not.toContain('ng-yes');
      expect(removedClasses).not.toContain('ng-no');
    }));

    it("should not remove any shared CSS classes between the starting and destination anchor element during the in animation",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div class="blue green red"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div class="blue brown red black"></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      // the out animation goes first
      captureLog.pop().defered.resolve();
      $$rAF.flush();

      var outAnimation = captureLog.pop();
      var clonedAnchor = outAnimation.element;
      var details = outAnimation.args[1];

      var addedClasses = details.addClass.split(' ');
      var removedClasses = details.removeClass.split(' ');

      expect(hasAll(addedClasses, ['brown', 'black'])).toBe(true);
      expect(hasAll(removedClasses, ['green'])).toBe(true);

      expect(addedClasses).not.toContain('red');
      expect(addedClasses).not.toContain('blue');

      expect(removedClasses).not.toContain('brown');
      expect(removedClasses).not.toContain('black');

      expect(clonedAnchor).toHaveClass('red');
      expect(clonedAnchor).toHaveClass('blue');
    }));

    it("should continue the anchor animation by seeding the to styles based on where the final anchor element will be positioned",
    inject(function($rootElement, $$rAF) {
      ss.addRule('.ending-element', 'width:9999px; height:6666px; display:inline-block;');

      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);

      var toAnchor = jqLite('<div class="ending-element"' +
                                ' style="margin-top:300px; margin-left:20px;"></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      captureLog.pop().defered.resolve();
      $$rAF.flush();

      var anchorAnimation = captureLog.pop();
      var anchorElement = anchorAnimation.element;
      var anchorDetails = anchorAnimation.args[1];

      var toStyles = anchorDetails.to;
      expect(int(toStyles.width)).toBe(9999);
      expect(int(toStyles.height)).toBe(6666);
      // some browsers have their own body margin defaults
      expect(int(toStyles.top)).toBeGreaterThan(300);
      expect(int(toStyles.left)).toBeGreaterThan(20);
    }));

    it("should remove the cloned anchor node from the DOM once the 'in' animation is complete",
      inject(function($rootElement, $$rAF) {

      var fromAnchor = jqLite('<div class="blue green red"></div>');
      from.append(fromAnchor);
      var toAnchor = jqLite('<div class="blue brown red black"></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start();

      // the out animation goes first
      var inAnimation = captureLog.pop();
      var clonedAnchor = inAnimation.element;
      expect(clonedAnchor.parent().length).toBe(1);
      inAnimation.defered.resolve();
      $$rAF.flush();

      // now the in animation completes
      expect(clonedAnchor.parent().length).toBe(1);
      captureLog.pop().defered.resolve();

      expect(clonedAnchor.parent().length).toBe(0);
    }));

    it("should run the provided domOperation right after the element is animated if a leave animation is run",
      inject(function($rootElement, $$rAF) {

      toAnimation.event = 'enter';
      fromAnimation.event = 'leave';

      var spy = jasmine.createSpy();
      fromAnimation.domOperation = spy;

      driver({
        from: fromAnimation,
        to: toAnimation
      }).start();

      expect(spy).not.toHaveBeenCalled();
      captureLog.shift().defered.resolve();
      $$rAF.flush();
      expect(spy).toHaveBeenCalled();
    }));

    it("should fire the returned runner promise when the from, to and anchor animations are all complete",
      inject(function($rootElement, $rootScope, $$rAF) {

      ss.addRule('.ending-element', 'width:9999px; height:6666px; display:inline-block;');

      var fromAnchor = jqLite('<div></div>');
      from.append(fromAnchor);

      var toAnchor = jqLite('<div></div>');
      to.append(toAnchor);

      $rootElement.append(fromAnchor);
      $rootElement.append(toAnchor);

      var completed = false;
      driver({
        from: fromAnimation,
        to: toAnimation,
        anchors: [{
          'out': fromAnchor,
          'in': toAnchor
        }]
      }).start().then(function() {
        completed = true;
      });

      captureLog.pop().defered.resolve(); //from
      captureLog.pop().defered.resolve(); //to
      captureLog.pop().defered.resolve(); //anchor(out)
      $$rAF.flush();

      captureLog.pop().defered.resolve(); //anchor(in)
      expect(completed).toBe(true);
    }));
  });
});
