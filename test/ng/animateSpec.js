ddescribe("animations", function() {

  var element;
  afterEach(function() {
    dealoc(element);
  });

  var getNode = function(element) {
    return isArray(element) ? element[0] : element;
  };

  describe('$animate', function() {
    var parent, options, capturedAnimation;

    beforeEach(module(function($provide) {
      options = {};
      capturedAnimation = null;

      var fakePromise;

      $provide.value('$animateSequence', function() {
        capturedAnimation = arguments;
        return fakePromise;
      });

      return function($document, $rootElement, $q) {
        fakePromise = $q.defer().promise;
        element = jqLite('<div>element</div>');
        parent = jqLite('<div>parent</div>');
        parent2 = jqLite('<div>parent</div>');

        $rootElement.append(parent);
        $rootElement.append(parent2);
        jqLite($document[0].body).append($rootElement);
      }
    }));

    it('enter() should issue an enter animation with the correct DOM operation', inject(function($animate, $rootScope) {
      $animate.enter(element, parent, null, options);
      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('enter');
      expect(capturedAnimation[2]).toEqual(options);

      expect(parent.children().length).toBe(0);
      capturedAnimation[3]();
      expect(parent.children().length).toBe(1);
    }));

    it('move() should issue a move animation with the correct DOM operation', inject(function($animate, $rootScope) {
      parent.append(element);
      $animate.move(element, parent2, null, options);
      $rootScope.$digest();

      expect(capturedAnimation[0]).toBe(element);
      expect(capturedAnimation[1]).toBe('move');
      expect(capturedAnimation[2]).toEqual(options);

      expect(parent.children().length).toBe(1);
      expect(parent2.children().length).toBe(0);
      capturedAnimation[3]();
      expect(parent.children().length).toBe(0);
      expect(parent2.children().length).toBe(1);
    }));

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

        $animate.enter(element, parent);
        $animate.addClass(element, 'red');
        $animate.removeClass(element, 'green');

        $rootScope.$digest();

        expect(capturedAnimation[0]).toBe(element);
        expect(capturedAnimation[1]).toBe('enter');

        options = capturedAnimation[2];
        expect(options.addClass).toEqual('red');
        expect(options.removeClass).toEqual('green');

        expect(element.parent().length).toBe(0);
        expect(element).not.toHaveClass('red');
        expect(element).toHaveClass('green');

        capturedAnimation[3]();

        expect(element.parent().length).toBe(1);
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

        expect(element.parent()).toEqual(parent);

        options = capturedAnimation[2];
        expect(options.addClass).toEqual('red');
        expect(options.removeClass).toEqual('green');
      }));
    });
  })
});
