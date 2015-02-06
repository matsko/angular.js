'use strict';

describe("$animateCss", function() {

  beforeEach(module('ngAnimate'));

  var fakeStyle = {
    color: 'blue'
  };

  var ss, prefix, triggerAnimationStartFrame;
  beforeEach(module(function() {
    return function($document, $window, $sniffer, $$rAF) {
      prefix = '-' + $sniffer.vendorPrefix.toLowerCase() + '-';
      ss = createMockStyleSheet($document, $window);
      triggerAnimationStartFrame = function() {
        $$rAF.flush();
      };
    };
  }));

  afterEach(function() {
    if (ss) {
      ss.destroy();
    }
  });

  describe("rAF usage", function() {
    it("should buffer all requests into a single requestAnimationFrame call",
      inject(function($animateCss, $$rAF, $document, $rootElement) {

      angular.element($document[0].body).append($rootElement);

      var count = 0;
      var runners = [];
      function makeRequest() {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        var runner = $animateCss(element, { duration : 5, to : fakeStyle }).start();
        runner.then(function() {
          count++;
        });
        runners.push(runner);
      }

      makeRequest();
      makeRequest();
      makeRequest();

      expect(count).toBe(0);

      triggerAnimationStartFrame();
      forEach(runners, function(runner) {
        runner.end();
      });
      expect(count).toBe(3);
    }));

    it("should cancel previous requests to rAF to avoid premature flushing", function() {
      var count = 0;
      module(function($provide) {
        $provide.value('$$rAF', function() {
          return function cancellationFn() {
            count++;
          }
        });
      });
      inject(function($animateCss, $$rAF, $document, $rootElement) {
        angular.element($document[0].body).append($rootElement);

        function makeRequest() {
          var element = jqLite('<div></div>');
          $rootElement.append(element);
          $animateCss(element, { duration : 5, to : fakeStyle }).start();
        }

        makeRequest();
        makeRequest();
        makeRequest();
        expect(count).toBe(2);
      })
    });
  });

  describe("animator and runner", function() {
    var element, animator;
    beforeEach(inject(function($animateCss, $rootElement, $document) {
      element = jqLite('<div></div>');
      $rootElement.append(element);
      angular.element($document[0].body).append($rootElement);

      animator = $animateCss(element, {
        event: 'enter',
        duration: 5,
        to: fakeStyle
      });
    }));

    it('should expose start and end functions for the animator object', inject(function() {
      expect(typeof animator.start).toBe('function');
      expect(typeof animator.end).toBe('function');
    }));

    it('should expose the duration and delay values for the animator object', inject(function($animateCss) {
      animator = $animateCss(element, {
        event: 'enter',
        duration: 20,
        delay: 50,
        to: fakeStyle
      });

      expect(animator.duration).toBe(20);
      expect(animator.delay).toBe(50);
    }));

    it('should expose flags transition and animation values on the animator object', inject(function($animateCss) {
      animator = $animateCss(element, {
        event: 'enter',
        transitionStyle: '1s linear all',
        keyframeStyle: 'my_animation 20s'
      });

      expect(animator.transitions).toBe(true);
      expect(animator.keyframes).toBe(true);
    }));

    it('should expose end, cancel, resume and pause methods on the runner object', inject(function() {
      var runner = animator.start();
      triggerAnimationStartFrame();

      expect(typeof runner.end).toBe('function');
      expect(typeof runner.cancel).toBe('function');
      expect(typeof runner.resume).toBe('function');
      expect(typeof runner.pause).toBe('function');
    }));

    it('should start the animation', inject(function() {
      expect(element).not.toHaveClass('ng-enter-active');
      animator.start();
      triggerAnimationStartFrame();

      expect(element).toHaveClass('ng-enter-active');
    }));

    it('should end the animation when called from the animator object', inject(function() {
      animator.start();
      triggerAnimationStartFrame();

      animator.end();
      expect(element).not.toHaveClass('ng-enter-active');
    }));

    it('should end the animation when called from the runner object', inject(function() {
      var runner = animator.start();
      triggerAnimationStartFrame();
      runner.end();
      expect(element).not.toHaveClass('ng-enter-active');
    }));

    it('should permanently close the animation if closed before the next rAF runs', inject(function() {
      var runner = animator.start();
      runner.end();

      triggerAnimationStartFrame();
      expect(element).not.toHaveClass('ng-enter-active');
    }));

    it('should return a runner object at the start of the animation that is an extension of a promise', inject(function() {
      var runner = animator.start();
      triggerAnimationStartFrame();

      expect(isPromiseLike(runner)).toBeTruthy();

      var resolved;
      runner.then(function() {
        resolved = true;
      });

      runner.end();
      expect(resolved).toBeTruthy();
    }));

    it('should cancel the animation and reject', inject(function() {
      var rejected;
      var runner = animator.start();
      triggerAnimationStartFrame();

      runner.catch(function() {
        rejected = true;
      });

      runner.cancel();
      expect(rejected).toBeTruthy();
    }));

    it('should run pause, but not effect the animation', inject(function() {
      expect(element.css('transition-property')).toEqual('none');
      var runner = animator.start();
      triggerAnimationStartFrame();

      expect(element.css('transition-property')).not.toEqual('none');
      runner.pause();
      expect(element.css('transition-property')).not.toEqual('none');
    }));

    it('should pause the transition, have no effect, but not end it', inject(function() {
      var runner = animator.start();
      triggerAnimationStartFrame();

      runner.pause();

      browserTrigger(element, 'transitionend',
        { timeStamp: Date.now(), elapsedTime: 5 });

      expect(element).toHaveClass('ng-enter-active');
    }));

    it('should resume the animation', inject(function() {
      var runner = animator.start();
      triggerAnimationStartFrame();

      runner.pause();

      browserTrigger(element, 'transitionend',
        { timeStamp: Date.now(), elapsedTime: 5 });

      expect(element).toHaveClass('ng-enter-active');
      runner.resume();

      expect(element).not.toHaveClass('ng-enter-active');
    }));

    it('should pause and resume a keyframe animation using animation-play-state',
      inject(function($animateCss) {

      element.attr('style', '');
      ss.addRule('.ng-enter', '-webkit-animation:1.5s keyframe_animation;' +
                                      'animation:1.5s keyframe_animation;');

      animator = $animateCss(element, {
        event: 'enter'
      });

      var runner = animator.start();
      triggerAnimationStartFrame();

      runner.pause();
      expect(element.css(prefix + 'animation-play-state')).toEqual('paused');
      runner.resume();
      expect(element.css(prefix + 'animation-play-state')).not.toEqual('paused');
    }));

    it('should remove the animation-play-state style if the animation is closed',
      inject(function($animateCss) {

      element.attr('style', '');
      ss.addRule('.ng-enter', '-webkit-animation:1.5s keyframe_animation;' +
                                      'animation:1.5s keyframe_animation;');

      animator = $animateCss(element, {
        event: 'enter'
      });

      var runner = animator.start();
      triggerAnimationStartFrame();

      runner.pause();
      expect(element.css(prefix + 'animation-play-state')).toEqual('paused');
      runner.end();
      expect(element.css(prefix + 'animation-play-state')).toEqual('');
    }));
  });

  describe("CSS", function() {
    describe("detected styles", function() {
      var element, options;

      function assertAnimationComplete(bool) {
        var assert = expect(element);
        if (bool) {
          assert = assert.not;
        }
        assert.toHaveClass('ng-enter');
        assert.toHaveClass('ng-enter-active');
      }

      function keyframeProgress(element, duration, delay) {
        browserTrigger(element, 'animationend',
          { timeStamp: Date.now() + ((delay || 1) * 1000), elapsedTime: duration });
      }

      function transitionProgress(element, duration, delay) {
        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + ((delay || 1) * 1000), elapsedTime: duration });
      }

      beforeEach(inject(function($rootElement, $document) {
        element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);
        options = { event: 'enter' };
      }));

      it("should use the highest transition duration value detected in the CSS class", inject(function($animateCss) {
        ss.addRule('.ng-enter', 'transition:1s linear all;' +
                                'transition-duration:10s, 15s, 20s;');

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        transitionProgress(element, 10);
        assertAnimationComplete(false);

        transitionProgress(element, 15);
        assertAnimationComplete(false);

        transitionProgress(element, 20);
        assertAnimationComplete(true);
      }));

      it("should use the highest transition delay value detected in the CSS class", inject(function($animateCss) {
        ss.addRule('.ng-enter', 'transition:1s linear all;' +
                                'transition-delay:10s, 15s, 20s;');

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        transitionProgress(element, 1, 10);
        assertAnimationComplete(false);

        transitionProgress(element, 1, 15);
        assertAnimationComplete(false);

        transitionProgress(element, 1, 20);
        assertAnimationComplete(true);
      }));

      it("should use the highest keyframe duration value detected in the CSS class", inject(function($animateCss) {
        ss.addRule('.ng-enter', 'animation:animation 1s, animation 2s, animation 3s;' +
                        '-webkit-animation:animation 1s, animation 2s, animation 3s;');

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        keyframeProgress(element, 1);
        assertAnimationComplete(false);

        keyframeProgress(element, 2);
        assertAnimationComplete(false);

        keyframeProgress(element, 3);
        assertAnimationComplete(true);
      }));

      it("should use the highest keyframe delay value detected in the CSS class", inject(function($animateCss) {
        ss.addRule('.ng-enter', 'animation:animation 1s 2s, animation 1s 10s, animation 1s 1000ms;' +
                        '-webkit-animation:animation 1s 2s, animation 1s 10s, animation 1s 1000ms;');

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        keyframeProgress(element, 1, 1);
        assertAnimationComplete(false);

        keyframeProgress(element, 1, 2);
        assertAnimationComplete(false);

        keyframeProgress(element, 1, 10);
        assertAnimationComplete(true);
      }));

      it("should use the highest keyframe duration value detected in the CSS class with respect to the animation-iteration-count property", inject(function($animateCss) {
        ss.addRule('.ng-enter',
                  'animation:animation 1s 2s 3, animation 1s 10s 2, animation 1s 1000ms infinite;' +
          '-webkit-animation:animation 1s 2s 3, animation 1s 10s 2, animation 1s 1000ms infinite;');

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        keyframeProgress(element, 1, 1);
        assertAnimationComplete(false);

        keyframeProgress(element, 1, 2);
        assertAnimationComplete(false);

        keyframeProgress(element, 3, 10);
        assertAnimationComplete(true);
      }));

      it("should use the highest duration value when both transitions and keyframes are used", inject(function($animateCss) {
        ss.addRule('.ng-enter', 'transition:1s linear all;' +
                                'transition-duration:10s, 15s, 20s;' +
                                'animation:animation 1s, animation 2s, animation 3s 0s 7;' +
                        '-webkit-animation:animation 1s, animation 2s, animation 3s 0s 7;');

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        transitionProgress(element, 10);
        keyframeProgress(element, 10);
        assertAnimationComplete(false);

        transitionProgress(element, 15);
        keyframeProgress(element, 15);
        assertAnimationComplete(false);

        transitionProgress(element, 20);
        keyframeProgress(element, 20);
        assertAnimationComplete(false);

        // 7 * 3 = 21
        transitionProgress(element, 21);
        keyframeProgress(element, 21);
        assertAnimationComplete(true);
      }));

      it("should use the highest delay value when both transitions and keyframes are used", inject(function($animateCss) {
        ss.addRule('.ng-enter', 'transition:1s linear all;' +
                                'transition-delay:10s, 15s, 20s;' +
                                'animation:animation 1s 2s, animation 1s 16s, animation 1s 19s;' +
                        '-webkit-animation:animation 1s 2s, animation 1s 16s, animation 1s 19s;');

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        transitionProgress(element, 1, 10);
        keyframeProgress(element, 1, 10);
        assertAnimationComplete(false);

        transitionProgress(element, 1, 16);
        keyframeProgress(element, 1, 16);
        assertAnimationComplete(false);

        transitionProgress(element, 1, 19);
        keyframeProgress(element, 1, 19);
        assertAnimationComplete(false);

        transitionProgress(element, 1, 20);
        keyframeProgress(element, 1, 20);
        assertAnimationComplete(true);
      }));
    });

    describe("staggering", function() {
      it("should apply a stagger based when an active ng-EVENT-stagger class with a transition-delay is detected",
        inject(function($animateCss, $document, $rootElement, $timeout) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.ng-enter-stagger', 'transition-delay:0.2s');
        ss.addRule('.ng-enter', 'transition:2s linear all');

        var elements = [];
        for (var i=0;i<5;i++) {
          var elm = jqLite('<div></div>');
          elements.push(elm);
          $rootElement.append(elm);

          $animateCss(elm, { event: 'enter' }).start();
          expect(elm).not.toHaveClass('ng-enter-stagger');
          expect(elm).toHaveClass('ng-enter');
        }

        triggerAnimationStartFrame();

        expect(elements[0]).toHaveClass('ng-enter-active');
        for (var i=1;i<5;i++) {
          var elm = elements[i];

          expect(elm).not.toHaveClass('ng-enter-active');
          $timeout.flush(200);
          expect(elm).toHaveClass('ng-enter-active');

          browserTrigger(elm, 'transitionend',
            { timeStamp: Date.now() + 1000, elapsedTime: 2 });

          expect(elm).not.toHaveClass('ng-enter');
          expect(elm).not.toHaveClass('ng-enter-active');
          expect(elm).not.toHaveClass('ng-enter-stagger');
        }
      }));

      it("should apply a stagger based when for all provided addClass/removeClass CSS classes",
        inject(function($animateCss, $document, $rootElement, $timeout) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.red-add-stagger,' +
                   '.blue-remove-stagger,' +
                   '.green-add-stagger', 'transition-delay:0.2s');

        ss.addRule('.red-add,' +
                   '.blue-remove,' +
                   '.green-add', 'transition:2s linear all');

        var elements = [];
        for (var i=0;i<5;i++) {
          var elm = jqLite('<div class="blue"></div>');
          elements.push(elm);
          $rootElement.append(elm);

          $animateCss(elm, {
            addClass: 'red green',
            removeClass: 'blue'
          }).start();
        }

        triggerAnimationStartFrame();
        for (var i=0;i<5;i++) {
          var elm = elements[i];

          expect(elm).not.toHaveClass('red-add-stagger');
          expect(elm).not.toHaveClass('green-add-stagger');
          expect(elm).not.toHaveClass('blue-remove-stagger');

          expect(elm).toHaveClass('red-add');
          expect(elm).toHaveClass('green-add');
          expect(elm).toHaveClass('blue-remove');
        }

        expect(elements[0]).toHaveClass('red-add-active');
        expect(elements[0]).toHaveClass('green-add-active');
        expect(elements[0]).toHaveClass('blue-remove-active');
        for (var i=1;i<5;i++) {
          var elm = elements[i];

          expect(elm).not.toHaveClass('red-add-active');
          expect(elm).not.toHaveClass('green-add-active');
          expect(elm).not.toHaveClass('blue-remove-active');

          $timeout.flush(200);

          expect(elm).toHaveClass('red-add-active');
          expect(elm).toHaveClass('green-add-active');
          expect(elm).toHaveClass('blue-remove-active');

          browserTrigger(elm, 'transitionend',
            { timeStamp: Date.now() + 1000, elapsedTime: 2 });

          expect(elm).not.toHaveClass('red-add-active');
          expect(elm).not.toHaveClass('green-add-active');
          expect(elm).not.toHaveClass('blue-remove-active');

          expect(elm).not.toHaveClass('red-add-stagger');
          expect(elm).not.toHaveClass('green-add-stagger');
          expect(elm).not.toHaveClass('blue-remove-stagger');
        }
      }));

      it("should block the transition animation between start and animate when staggered",
        inject(function($animateCss, $document, $rootElement) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.ng-enter-stagger', 'transition-delay:0.2s');
        ss.addRule('.ng-enter', 'transition:2s linear all;');

        for (var i=0;i<5;i++) {
          var element = jqLite('<div class="transition-animation"></div>');
          $rootElement.append(element);

          $animateCss(element, { event: 'enter' }).start();
        }

        triggerAnimationStartFrame();
        for (var i=0;i<5;i++) {
          if (i == 0) {
            expect(element.css('transition-property')).toMatch('');
          } else {
            expect(element.css('transition-property')).toMatch('none');
          }
        }
      }));

      it("should block (pause) the keyframe animation between start and animate when staggered",
        inject(function($animateCss, $document, $rootElement) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.ng-enter-stagger', prefix + 'animation-delay:0.2s');
        ss.addRule('.ng-enter', prefix + 'animation:my_animation 2s;');

        var element, elements = [];
        for (var i=0;i<5;i++) {
          element = jqLite('<div class="transition-animation"></div>');
          $rootElement.append(element);

          $animateCss(element, { event: 'enter' }).start();
          elements.push(element);
        }

        triggerAnimationStartFrame();

        for (var i=0;i<5;i++) {
          element = elements[i];
          if (i == 0) {
            expect(element.css(prefix + 'animation-play-state')).toBe('');
          } else {
            expect(element.css(prefix + 'animation-play-state')).toBe('paused');
          }
        }
      }));

      it("should applying a stagger if the transition is zero incase a delay value is inherited from a earlier CSS class",
        inject(function($animateCss, $document, $rootElement) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.transition-animation', 'transition:2s 5s linear all;');

        for (var i=0;i<5;i++) {
          var element = jqLite('<div class="transition-animation"></div>');
          $rootElement.append(element);

          $animateCss(element, { event: 'enter' }).start();
          triggerAnimationStartFrame();


          expect(element).toHaveClass('ng-enter-active');
        }
      }));

      it("should ignore animation staggers if only transition animations were detected",
        inject(function($animateCss, $document, $rootElement) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.ng-enter-stagger', prefix + 'animation-delay:0.2s');
        ss.addRule('.transition-animation', 'transition:2s 5s linear all;');

        for (var i=0;i<5;i++) {
          var element = jqLite('<div class="transition-animation"></div>');
          $rootElement.append(element);

          $animateCss(element, { event: 'enter' }).start();
          triggerAnimationStartFrame();


          expect(element).toHaveClass('ng-enter-active');
        }
      }));

      it("should ignore transition staggers if only keyframe animations were detected",
        inject(function($animateCss, $document, $rootElement) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.ng-enter-stagger', 'transition-delay:0.2s');
        ss.addRule('.transition-animation', prefix + 'animation:2s 5s my_animation;');

        for (var i=0;i<5;i++) {
          var elm = jqLite('<div class="transition-animation"></div>');
          $rootElement.append(elm);

          var animator = $animateCss(elm, { event: 'enter' }).start();
          triggerAnimationStartFrame();


          expect(elm).toHaveClass('ng-enter-active');
        }
      }));

      it("should start on the highest stagger value if both transition and keyframe staggers are used together",
        inject(function($animateCss, $document, $rootElement, $timeout, $browser) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.ng-enter-stagger', 'transition-delay:0.5s;' +
                               prefix + 'animation-delay:1s');

        ss.addRule('.ng-enter', 'transition:10s linear all;' +
                       prefix + 'animation:my_animation 20s');

        var elements = [];
        for (var i=0;i<5;i++) {
          var element = jqLite('<div></div>');
          elements.push(element);
          $rootElement.append(element);

          $animateCss(element, { event: 'enter' }).start();

          expect(element).toHaveClass('ng-enter');
        }

        triggerAnimationStartFrame();

        expect(elements[0]).toHaveClass('ng-enter-active');
        for (var i=1;i<5;i++) {
          var elm = elements[i];

          expect(elm).not.toHaveClass('ng-enter-active');

          $timeout.flush(500);
          expect(elm).not.toHaveClass('ng-enter-active');

          $timeout.flush(500);
          expect(elm).toHaveClass('ng-enter-active');
        }
      }));

      it("should apply the closing timeout ontop of the stagger timeout",
        inject(function($animateCss, $document, $rootElement, $timeout, $browser) {

        angular.element($document[0].body).append($rootElement);

        ss.addRule('.ng-enter-stagger', 'transition-delay:1s;');
        ss.addRule('.ng-enter', 'transition:10s linear all;');

        var elements = [];
        for (var i=0;i<5;i++) {
          var element = jqLite('<div></div>');
          elements.push(element);
          $rootElement.append(element);

          $animateCss(element, { event: 'enter' }).start();
          triggerAnimationStartFrame();

        }

        for (var i=1;i<2;i++) {
          var elm = elements[i];
          expect(elm).toHaveClass('ng-enter');
          $timeout.flush(1000);
          $timeout.flush(15000);
          expect(elm).not.toHaveClass('ng-enter');
        }
      }));

      it("should issue a stagger if a stagger value is provided in the options",
        inject(function($animateCss, $document, $rootElement, $timeout) {

        angular.element($document[0].body).append($rootElement);
        ss.addRule('.ng-enter', 'transition:2s linear all');

        var elements = [];
        for (var i=0;i<5;i++) {
          var elm = jqLite('<div></div>');
          elements.push(elm);
          $rootElement.append(elm);

          $animateCss(elm, {
            event: 'enter',
            stagger: 0.5
          }).start();
          expect(elm).toHaveClass('ng-enter');
        }

        triggerAnimationStartFrame();

        expect(elements[0]).toHaveClass('ng-enter-active');
        for (var i=1;i<5;i++) {
          var elm = elements[i];

          expect(elm).not.toHaveClass('ng-enter-active');
          $timeout.flush(500);
          expect(elm).toHaveClass('ng-enter-active');

          browserTrigger(elm, 'transitionend',
            { timeStamp: Date.now() + 1000, elapsedTime: 2 });

          expect(elm).not.toHaveClass('ng-enter');
          expect(elm).not.toHaveClass('ng-enter-active');
          expect(elm).not.toHaveClass('ng-enter-stagger');
        }
      }));

      it("should only add/remove classes once the stagger timeout has passed",
        inject(function($animateCss, $document, $rootElement, $timeout) {

        angular.element($document[0].body).append($rootElement);

        var element = jqLite('<div class="green"></div>');
        $rootElement.append(element);

        $animateCss(element, {
          addClass: 'red',
          removeClass: 'green',
          duration: 5,
          stagger: 0.5,
          staggerIndex : 3
        }).start();

        triggerAnimationStartFrame();
        expect(element).toHaveClass('green');
        expect(element).not.toHaveClass('red');

        $timeout.flush(1500);
        expect(element).not.toHaveClass('green');
        expect(element).toHaveClass('red');
      }));
    });

    describe("closing timeout", function() {
      it("should close off the animation after 150% of the animation time has passed",
        inject(function($animateCss, $document, $rootElement, $timeout) {

        ss.addRule('.ng-enter', 'transition:10s linear all;');

        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var animator = $animateCss(element, { event: 'enter' });
        animator.start();
        triggerAnimationStartFrame();


        expect(element).toHaveClass('ng-enter');
        expect(element).toHaveClass('ng-enter-active');

        $timeout.flush(15000);

        expect(element).not.toHaveClass('ng-enter');
        expect(element).not.toHaveClass('ng-enter-active');
      }));

      it("should still resolve the animation once expired",
        inject(function($animateCss, $document, $rootElement, $timeout) {

        ss.addRule('.ng-enter', 'transition:10s linear all;');

        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var animator = $animateCss(element, { event: 'enter' });

        var failed, passed;
        animator.start().then(function() {
            passed = true;
          }, function() {
            failed = true;
          });

        triggerAnimationStartFrame();
        $timeout.flush(15000);
        expect(passed).toBe(true);
      }));

      it("should not resolve/reject after passing if the animation completed successfully",
        inject(function($animateCss, $document, $rootElement, $timeout) {

        ss.addRule('.ng-enter', 'transition:10s linear all;');

        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var animator = $animateCss(element, { event: 'enter' });

        var failed, passed;
        animator.start().then(
          function() {
            passed = true;
          },
          function() {
            failed = true;
          }
        );
        triggerAnimationStartFrame();

        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + 1000, elapsedTime: 10 });

        expect(passed).toBe(true);
        expect(failed).not.toBe(true);

        $timeout.flush(15000);

        expect(passed).toBe(true);
        expect(failed).not.toBe(true);
      }));
    });

    describe("getComputedStyle", function() {
      var count;
      var acceptableTimingsData = {
        transitionDuration: "10s"
      };

      beforeEach(module(function($provide) {
        count = {};
        $provide.value('$window', extend({}, window, {
          getComputedStyle : function(node) {
            var key = node.className.indexOf('stagger') >= 0
                ? 'stagger' : 'normal';
            count[key] = count[key] || 0;
            count[key]++;
            return acceptableTimingsData;
          }
        }));

        return function($document, $rootElement) {
          angular.element($document[0].body).append($rootElement);
        };
      }));

      it("should cache frequent calls to getComputedStyle before the next animation frame kicks in",
        inject(function($animateCss, $document, $rootElement, $$rAF) {

        for(var i = 0; i < 5; i++) {
          var element = jqLite('<div></div>');
          $rootElement.append(element);
          var animator = $animateCss(element, { event: 'enter' });
          var runner = animator.start();
        }

        expect(count.normal).toBe(1);

        for(var i = 0; i < 5; i++) {
          var element = jqLite('<div></div>');
          $rootElement.append(element);
          var animator = $animateCss(element, { event: 'enter' });
          animator.start();
        }

        expect(count.normal).toBe(1);
        triggerAnimationStartFrame();

        for(var i = 0; i < 5; i++) {
          var element = jqLite('<div></div>');
          $rootElement.append(element);
          var animator = $animateCss(element, { event: 'enter' });
          animator.start();
        }

        expect(count.normal).toBe(2);
      }));

      it("should cache frequent calls to getComputedStyle for stagger animations before the next animation frame kicks in",
        inject(function($animateCss, $document, $rootElement, $$rAF) {

        var element = jqLite('<div></div>');
        $rootElement.append(element);
        var animator = $animateCss(element, { event: 'enter' });
        animator.start();
        triggerAnimationStartFrame();

        expect(count.stagger).toBeUndefined();

        for(var i = 0; i < 5; i++) {
          var element = jqLite('<div></div>');
          $rootElement.append(element);
          var animator = $animateCss(element, { event: 'enter' });
          animator.start();
        }

        expect(count.stagger).toBe(1);

        for(var i = 0; i < 5; i++) {
          var element = jqLite('<div></div>');
          $rootElement.append(element);
          var animator = $animateCss(element, { event: 'enter' });
          animator.start();
        }

        expect(count.stagger).toBe(1);
        $$rAF.flush();

        for(var i = 0; i < 5; i++) {
          var element = jqLite('<div></div>');
          $rootElement.append(element);
          var animator = $animateCss(element, { event: 'enter' });
          animator.start();
        }

        triggerAnimationStartFrame();
        expect(count.stagger).toBe(2);
      }));
    });
  });

  describe("structural animations", function() {
    they('should decorate the element with the ng-$prop CSS class',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        $animateCss(element, {
          event: event,
          duration: 1000,
          to: fakeStyle
        });
        expect(element).toHaveClass('ng-' + event);
      });
    });

    they('should decorate the element with the ng-$prop-active CSS class',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var animator = $animateCss(element, {
          event: event,
          duration: 1000,
          to: fakeStyle
        });

        animator.start();
        triggerAnimationStartFrame();

        expect(element).toHaveClass('ng-' + event + '-active');
      });
    });

    they('should remove the ng-$prop and ng-$prop-active CSS classes from the element once the animation is done',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var animator = $animateCss(element, {
          event: event,
          duration: 1,
          to: fakeStyle
        });

        animator.start();
        triggerAnimationStartFrame();


        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + 1000, elapsedTime: 1 });

        expect(element).not.toHaveClass('ng-' + event);
        expect(element).not.toHaveClass('ng-' + event + '-active');
      });
    });

    they('should allow additional CSS classes to be added and removed alongside the $prop animation',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement) {
        var element = jqLite('<div class="green"></div>');
        $rootElement.append(element);
        var animator = $animateCss(element, {
          event: event,
          duration: 1,
          to: fakeStyle,
          addClass: 'red',
          removeClass: 'green'
        });

        animator.start();
        triggerAnimationStartFrame();

        expect(element).toHaveClass('ng-' + event);
        expect(element).toHaveClass('ng-' + event + '-active');

        expect(element).toHaveClass('red');
        expect(element).toHaveClass('red-add');
        expect(element).toHaveClass('red-add-active');

        expect(element).not.toHaveClass('green');
        expect(element).toHaveClass('green-remove');
        expect(element).toHaveClass('green-remove-active');
      });
    });

    they('should place a CSS transition block after the preparation function to block accidental style changes',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        ss.addRule('.cool-animation', 'transition:1.5s linear all;');
        element.addClass('cool-animation');

        var animator = $animateCss(element, {
          event: event
        });

        expect(element.css('transition-property')).toMatch('none');
        animator.start();
        triggerAnimationStartFrame();

        expect(element.css('transition-property')).toEqual('');
      });
    });

    they('should not place a CSS transition block if options.skipBlocking is provided',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        ss.addRule('.cool-animation', 'transition:1.5s linear all;');
        element.addClass('cool-animation');

        var animator = $animateCss(element, {
          skipBlocking: true,
          event: event
        });

        expect(element.css('transition-property')).toEqual('');
        animator.start();
        triggerAnimationStartFrame();

        expect(element.css('transition-property')).toEqual('');
      });
    });

    they('should place a CSS transition block after the preparation function even if a duration is provided',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        ss.addRule('.cool-animation', 'transition:1.5s linear all;');
        element.addClass('cool-animation');

        var animator = $animateCss(element, {
          event: event,
          duration : 10
        });

        expect(element.css('transition-property')).toMatch('none');
        expect(element.css('transition-duration')).toMatch('');
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-property')).toEqual('all');
        expect(element.css('transition-duration')).toMatch('10s');
      });
    });

    it('should allow multiple events to be animated at the same time',
      inject(function($animateCss, $rootElement, $document) {

      var element = jqLite('<div></div>');
      $rootElement.append(element);
      angular.element($document[0].body).append($rootElement);

      $animateCss(element, {
        event: ['enter', 'leave', 'move'],
        duration: 1,
        to: fakeStyle
      }).start();
      triggerAnimationStartFrame();


      expect(element).toHaveClass('ng-enter');
      expect(element).toHaveClass('ng-leave');
      expect(element).toHaveClass('ng-move');

      expect(element).toHaveClass('ng-enter-active');
      expect(element).toHaveClass('ng-leave-active');
      expect(element).toHaveClass('ng-move-active');

      browserTrigger(element, 'transitionend',
        { timeStamp: Date.now() + 1000, elapsedTime: 1 });

      expect(element).not.toHaveClass('ng-enter');
      expect(element).not.toHaveClass('ng-leave');
      expect(element).not.toHaveClass('ng-move');
      expect(element).not.toHaveClass('ng-enter-active');
      expect(element).not.toHaveClass('ng-leave-active');
      expect(element).not.toHaveClass('ng-move-active');
    }));
  });

  describe("class-based animations", function() {
    they('should decorate the element with the class-$prop CSS class',
      ['add', 'remove'], function(event) {
      inject(function($animateCss, $rootElement) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);

        var options = {};
        options[event + 'Class'] = 'class';
        options.duration = 1000;
        options.to = fakeStyle;
        $animateCss(element, options);
        expect(element).toHaveClass('class-' + event);
      });
    });

    they('should decorate the element with the class-$prop-active CSS class',
      ['add', 'remove'], function(event) {
      inject(function($animateCss, $rootElement) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);

        var options = {};
        options[event + 'Class'] = 'class';
        options.duration = 1000;
        options.to = fakeStyle;
        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element).toHaveClass('class-' + event + '-active');
      });
    });

    they('should remove the class-$prop-add and class-$prop-active CSS classes from the element once the animation is done',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var options = {};
        options.event = event;
        options.duration = 10;
        options.to = fakeStyle;

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + 1000, elapsedTime: 10 });

        expect(element).not.toHaveClass('ng-' + event);
        expect(element).not.toHaveClass('ng-' + event + '-active');
      });
    });

    they('should allow the class duration styles to be recalculated once started if the CSS classes being applied result new transition styles',
      ['add', 'remove'], function(event) {
      inject(function($animateCss, $rootElement, $document) {

        var element = jqLite('<div></div>');

        if (event == 'add') {
          ss.addRule('.natural-class', 'transition:1s linear all;');
        } else {
          ss.addRule('.natural-class', 'transition:0s linear none;');
          ss.addRule('.base-class', 'transition:1s linear none;');

          element.addClass('base-class');
          element.addClass('natural-class');
        }

        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var options = {};
        options[event + 'Class'] = 'natural-class';
        var runner = $animateCss(element, options);
        runner.start();
        triggerAnimationStartFrame();

        expect(element).toHaveClass('natural-class-' + event);
        expect(element).toHaveClass('natural-class-' + event + '-active');

        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now(), elapsedTime: 1 });

        expect(element).not.toHaveClass('natural-class-' + event);
        expect(element).not.toHaveClass('natural-class-' + event + '-active');
      });
    });

    they('should force the class-based values to be applied early if no transition/keyframe is detected at all',
      ['enter', 'leave', 'move'], function(event) {
      inject(function($animateCss, $rootElement, $document) {

        ss.addRule('.blue.ng-' + event, 'transition:2s linear all;');

        var element = jqLite('<div class="red"></div>');
        $rootElement.append(element);
        angular.element($document[0].body).append($rootElement);

        var runner = $animateCss(element, {
          addClass : 'blue',
          removeClass : 'red',
          event: event
        });

        runner.start();
        expect(element).toHaveClass('ng-' + event);
        expect(element).toHaveClass('blue');
        expect(element).not.toHaveClass('red');

        triggerAnimationStartFrame();
        expect(element).toHaveClass('ng-' + event);
        expect(element).toHaveClass('ng-' + event + '-active');
        expect(element).toHaveClass('blue');
        expect(element).not.toHaveClass('red');

        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now(), elapsedTime: 2 });

        expect(element).not.toHaveClass('ng-' + event);
        expect(element).not.toHaveClass('ng-' + event + '-active');
        expect(element).toHaveClass('blue');
        expect(element).not.toHaveClass('red');
      });
    });
  });

  describe("options", function() {
    var element;
    beforeEach(inject(function($rootElement, $document) {
      angular.element($document[0].body).append($rootElement);

      element = jqLite('<div></div>');
      $rootElement.append(element);
    }));

    describe("[duration]", function() {
      it("should be applied for a transition directly", inject(function($animateCss, $rootElement) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);

        var options = {
          duration: 3000,
          to: fakeStyle,
          event: 'enter'
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-duration')).toMatch('3000s');
        expect(element.css('transition-property')).toMatch('all');
        expect(element.css('transition-timing-function')).toMatch('linear');
      }));

      it("should be applied to a CSS keyframe animation directly if keyframes are detected within the CSS class",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-animation:1.5s keyframe_animation;' +
                                        'animation:1.5s keyframe_animation;');

        var options = {
          duration: 5,
          event: 'enter'
        };
        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css(prefix + 'animation-duration')).toEqual('5s');
      }));

      it("should remove all inline keyframe styling when an animation completes if a custom duration was applied",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-animation:1.5s keyframe_animation;' +
                                        'animation:1.5s keyframe_animation;');

        var options = {
          duration: 5,
          event: 'enter'
        };
        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        browserTrigger(element, 'animationend',
          { timeStamp: Date.now() + 5000, elapsedTime: 5 });

        expect(element.css(prefix + 'animation-duration')).toEqual('');
      }));

      it("should remove all inline keyframe delay styling when an animation completes if a custom duration was applied",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-animation:1.5s keyframe_animation;' +
                                        'animation:1.5s keyframe_animation;');

        var options = {
          delay: 5,
          event: 'enter'
        };
        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css(prefix + 'animation-delay')).toEqual('5s');

        browserTrigger(element, 'animationend',
          { timeStamp: Date.now() + 5000, elapsedTime: 1.5 });

        expect(element.css(prefix + 'animation-delay')).toEqual('');
      }));

      it("should not prepare the animation at all if a duration of zero is provided",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-transition:1s linear all;' +
                                        'transition:1s linear all;');

        var options = {
          duration: 0,
          event: 'enter'
        };
        var animator = $animateCss(element, options);
        expect(animator).toBeFalsy();
      }));

      it("should apply a transition and keyframe duration directly if both transitions and keyframe classes are detected",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-animation:3s keyframe_animation;' +
                                        'animation:3s keyframe_animation;' +
                                        'transition:5s linear all;');

        var options = {
          duration: 4,
          event: 'enter'
        };
        var animator = $animateCss(element, options);

        animator.start();
        triggerAnimationStartFrame();


        expect(element.css(prefix + 'animation-duration')).toEqual('4s');
        expect(element.css('transition-duration')).toMatch('4s');
        expect(element.css('transition-property')).toMatch('all');
        expect(element.css('transition-timing-function')).toMatch('linear');
      }));
    });

    describe("[delay]", function() {
      it("should be applied for a transition directly", inject(function($animateCss, $rootElement) {
        var element = jqLite('<div></div>');
        $rootElement.append(element);

        var options = {
          duration: 3000,
          delay: 500,
          to: fakeStyle,
          event: 'enter'
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        var prop = element.css('transition-delay');
        expect(prop).toEqual('500s');
      }));

      it("should return false for the animator if a delay is provided but not a duration",
        inject(function($animateCss, $rootElement) {

        var element = jqLite('<div></div>');
        $rootElement.append(element);

        var options = {
          delay: 500,
          to: fakeStyle,
          event: 'enter'
        };

        var animator = $animateCss(element, options);
        expect(animator).toBeFalsy();
      }));

      it("should override the delay value present in the CSS class",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-transition:1s linear all;' +
                                        'transition:1s linear all;' +
                                '-webkit-transition-delay:10s;' +
                                        'transition-delay:10s;');

        var element = jqLite('<div></div>');
        $rootElement.append(element);

        var options = {
          delay: 500,
          event: 'enter'
        };
        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        var prop = element.css('transition-delay');
        expect(prop).toEqual('500s');
      }));

      it("should allow the delay value to zero if provided",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-transition:1s linear all;' +
                                        'transition:1s linear all;' +
                                '-webkit-transition-delay:10s;' +
                                        'transition-delay:10s;');

        var element = jqLite('<div></div>');
        $rootElement.append(element);

        var options = {
          delay: 0,
          event: 'enter'
        };
        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        var prop = element.css('transition-delay');
        expect(prop).toEqual('0s');
      }));

      it("should be applied to a CSS keyframe animation if detected within the CSS class",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-animation:1.5s keyframe_animation;' +
                                        'animation:1.5s keyframe_animation;');

        var options = {
          delay: 400,
          event: 'enter'
        };
        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css(prefix + 'animation-delay')).toEqual('400s');
      }));

      it("should apply a transition and keyframe delay if both transitions and keyframe classes are detected",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-animation:3s keyframe_animation;' +
                                        'animation:3s keyframe_animation;' +
                                        'transition:5s linear all;');

        var options = {
          delay: 10,
          event: 'enter'
        };
        var animator = $animateCss(element, options);

        expect(element.css('transition-delay')).toEqual('');
        expect(element.css(prefix + 'animation-delay')).toEqual('');
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css(prefix + 'animation-delay')).toEqual('10s');
        expect(element.css('transition-delay')).toEqual('10s');
      }));
    });

    describe("[transtionStyle]", function() {
      it("should apply the transition directly onto the element and animate accordingly",
        inject(function($animateCss, $rootElement) {

        var options = {
          transitionStyle: '5.5s linear all',
          event: 'enter'
        };

        var animator = $animateCss(element, options);

        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-duration')).toMatch('5.5s');
        expect(element.css('transition-property')).toMatch('all');
        expect(element.css('transition-timing-function')).toMatch('linear');

        expect(element).toHaveClass('ng-enter');
        expect(element).toHaveClass('ng-enter-active');

        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + 10000, elapsedTime: 5.5 });

        expect(element).not.toHaveClass('ng-enter');
        expect(element).not.toHaveClass('ng-enter-active');

        expect(element.css('transition')).toEqual('');
      }));

      it("should give priority to the provided duration value, but only update the duration style itself",
        inject(function($animateCss, $rootElement) {

        var options = {
          transitionStyle: '5.5s ease-in color',
          duration: 4,
          event: 'enter'
        };

        var animator = $animateCss(element, options);

        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-duration')).toMatch('4s');
        expect(element.css('transition-property')).toMatch('color');
        expect(element.css('transition-timing-function')).toMatch('ease-in');
      }));

      it("should give priority to the provided delay value, but only update the delay style itself",
        inject(function($animateCss, $rootElement) {

        var options = {
          transitionStyle: '5.5s 4s ease-in color',
          delay: 20,
          event: 'enter'
        };

        var animator = $animateCss(element, options);

        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-delay')).toMatch('20s');
        expect(element.css('transition-duration')).toMatch('5.5s');
        expect(element.css('transition-property')).toMatch('color');
        expect(element.css('transition-timing-function')).toMatch('ease-in');
      }));
    });

    describe("[keyframeStyle]", function() {
      it("should apply the keyframe animation directly onto the element and animate accordingly",
        inject(function($animateCss, $rootElement) {

        var options = {
          keyframeStyle: 'my_animation 5.5s',
          event: 'enter'
        };

        var animator = $animateCss(element, options);

        animator.start();
        triggerAnimationStartFrame();


        var detectedStyle = element.css(prefix + 'animation');
        expect(detectedStyle).toContain('5.5s');
        expect(detectedStyle).toContain('my_animation');

        expect(element).toHaveClass('ng-enter');
        expect(element).toHaveClass('ng-enter-active');

        browserTrigger(element, 'animationend',
          { timeStamp: Date.now() + 10000, elapsedTime: 5.5 });

        expect(element).not.toHaveClass('ng-enter');
        expect(element).not.toHaveClass('ng-enter-active');

        var detectedStyle = element.css(prefix + 'animation');
        expect(detectedStyle).toEqual('');
      }));

      it("should give priority to the provided duration value, but only update the duration style itself",
        inject(function($animateCss, $rootElement) {

        var options = {
          keyframeStyle: 'my_animation 5.5s',
          duration: 50,
          event: 'enter'
        };

        var animator = $animateCss(element, options);

        animator.start();
        triggerAnimationStartFrame();


        var detectedStyle = element.css(prefix + 'animation');
        expect(detectedStyle).toContain('50s');
        expect(detectedStyle).toContain('my_animation');
      }));

      it("should give priority to the provided delay value, but only update the duration style itself",
        inject(function($animateCss, $rootElement) {

        var options = {
          keyframeStyle: 'my_animation 5.5s 10s',
          delay: 50,
          event: 'enter'
        };

        var animator = $animateCss(element, options);

        animator.start();
        triggerAnimationStartFrame();


        expect(element.css(prefix + 'animation-delay')).toEqual('50s');
        expect(element.css(prefix + 'animation-duration')).toEqual('5.5s');
        expect(element.css(prefix + 'animation-name')).toEqual('my_animation');
      }));
    })

    describe("[from] and [to]", function() {
      it("should apply from styles to an element during the preparation phase",
        inject(function($animateCss, $rootElement) {

        var options = {
          duration: 2.5,
          event: 'enter',
          from: { background: 'red' },
          to: { background: 'blue' }
        };

        var animator = $animateCss(element, options);
        expect(element.css('background')).toMatch('red');
      }));

      it("should apply to styles to an element during the animation phase",
        inject(function($animateCss, $rootElement) {

        var options = {
          duration: 2.5,
          event: 'enter',
          from: { background: 'red' },
          to: { background: 'blue' }
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();

        expect(element.css('background')).toMatch('blue');
      }));

      it("should apply the union of from and to styles to the element if no animation is run",
        inject(function($animateCss, $rootElement) {

        var options = {
          event: 'enter',
          from: { background: 'red', color: 'yellow' },
          to: { background: 'blue' }
        };

        var animator = $animateCss(element, options);

        expect(animator).toBeFalsy();
        expect(element.css('background')).toMatch('blue');
        expect(element.css('color')).toMatch('yellow');
      }));

      it("should retain to and from styles on an element after an animation completes",
        inject(function($animateCss, $rootElement) {

        var options = {
          event: 'enter',
          duration: 10,
          from: { background: 'red', color: 'yellow' },
          to: { background: 'blue' }
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + 10000, elapsedTime: 10 });

        expect(element).not.toHaveClass('ng-enter');
        expect(element.css('background')).toMatch('blue');
        expect(element.css('color')).toMatch('yellow');
      }));

      it("should apply an inline transition if [to] styles and a duration are provided",
        inject(function($animateCss, $rootElement) {

        var options = {
          event: 'enter',
          duration: 2.5,
          to: { background: 'red' }
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-duration')).toMatch('2.5s');
        expect(element.css('transition-property')).toMatch('all');
        expect(element.css('transition-timing-function')).toMatch('linear');
      }));

      it("should remove all inline transition styling when an animation completes",
        inject(function($animateCss, $rootElement) {

        var options = {
          event: 'enter',
          duration: 2.5,
          to: { background: 'red' }
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition')).not.toEqual('');

        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + 2500, elapsedTime: 2.5 });

        expect(element.css('transition')).toEqual('');
      }));

      it("should remove all inline transition delay styling when an animation completes",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', 'transition: 1s linear color');

        var options = {
          event: 'enter',
          delay: 5
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-delay')).toEqual('5s');

        browserTrigger(element, 'transitionend',
          { timeStamp: Date.now() + 5000, elapsedTime: 1 });

        expect(element.css('transition-delay')).toEqual('');
      }));

      it("should not apply an inline transition if only [from] styles and a duration are provided",
        inject(function($animateCss, $rootElement) {

        var options = {
          duration: 3,
          from : { background: 'blue' }
        };

        var animator = $animateCss(element, options);
        expect(animator).toBeFalsy();
      }));

      it("should not apply an inline transition if no styles are provided",
        inject(function($animateCss, $rootElement) {

        var emptyObject = {};
        var options = {
          duration: 3,
          to: emptyObject,
          from: emptyObject
        };

        var animator = $animateCss(element, options);
        expect(animator).toBeFalsy();
      }));

      it("should apply a transition duration if the existing transition duration's property value is not 'all'",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', 'transition: 1s linear color');

        var emptyObject = {};
        var options = {
          event: 'enter',
          to: { background: 'blue' }
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-duration')).toMatch('1s');
        expect(element.css('transition-property')).toMatch('all');
        expect(element.css('transition-timing-function')).toMatch('linear');
      }));

      it("should apply a transition duration and an animation duration if duration + styles options are provided for a matching keyframe animation",
        inject(function($animateCss, $rootElement) {

        ss.addRule('.ng-enter', '-webkit-animation:3.5s keyframe_animation;' +
                                        'animation:3.5s keyframe_animation;');

        var emptyObject = {};
        var options = {
          event: 'enter',
          duration: 10,
          to: {
            background: 'blue'
          }
        };

        var animator = $animateCss(element, options);
        animator.start();
        triggerAnimationStartFrame();


        expect(element.css('transition-duration')).toMatch('10s');
        expect(element.css(prefix + 'animation-duration')).toEqual('10s');
      }));
    });

    describe("[easing]", function() {

      var element;
      beforeEach(inject(function($document, $rootElement) {
        element = jqLite('<div></div>');
        $rootElement.append(element);
        jqLite($document[0].body).append($rootElement);
      }));

      it("should apply easing to a transition animation if it exists", inject(function($animateCss) {
        ss.addRule('.red', 'transition:1s linear all;');
        var easing = 'ease-out';
        var animator = $animateCss(element, { addClass : 'red', easing : easing });
        animator.start();
        triggerAnimationStartFrame();

        expect(element.css('transition-timing-function')).toEqual(easing);
      }));

      it("should apply easing to a transition animation if it exists", inject(function($animateCss) {
        ss.addRule('.red', prefix + 'animation:my_keyframe 1s;');
        var easing = 'ease-out';
        var animator = $animateCss(element, { addClass : 'red', easing : easing });
        animator.start();
        triggerAnimationStartFrame();

        expect(element.css(prefix + 'animation-timing-function')).toEqual(easing);
      }));

      it("should not apply easing to transitions nor keyframes on an element animation if nothing is detected",
        inject(function($animateCss) {

        ss.addRule('.red', ';');
        var easing = 'ease-out';
        var animator = $animateCss(element, { addClass : 'red', easing : easing });
        animator.start();
        triggerAnimationStartFrame();

        expect(element.css('transition-timing-function')).toEqual('');
        expect(element.css(prefix + 'animation-timing-function')).toEqual('');
      }));

      it("should apply easing to both keyframes and transition animations if detected",
        inject(function($animateCss) {

        ss.addRule('.red', 'transition: 1s linear all;');
        ss.addRule('.blue', prefix + 'animation:my_keyframe 1s;');
        var easing = 'ease-out';
        var animator = $animateCss(element, { addClass : 'red blue', easing : easing });
        animator.start();
        triggerAnimationStartFrame();

        expect(element.css('transition-timing-function')).toEqual(easing);
        expect(element.css(prefix + 'animation-timing-function')).toEqual(easing);
      }));
    });
  });
});
