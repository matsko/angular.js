'use strict';

describe("$animate", function() {

  describe("without animation", function() {
    var element, $rootElement;

    beforeEach(module(function() {
      return function($compile, _$rootElement_, $rootScope) {
        element = $compile('<div></div>')($rootScope);
        $rootElement = _$rootElement_;
      };
    }));

    it("should add element at the start of enter animation", inject(function($animate, $compile, $rootScope) {
      var child = $compile('<div></div>')($rootScope);
      expect(element.contents().length).toBe(0);
      $animate.enter(child, element);
      expect(element.contents().length).toBe(1);
    }));

    it("should enter the element to the start of the parent container",
      inject(function($animate, $compile, $rootScope) {

      for(var i = 0; i < 5; i++) {
        element.append(jqLite('<div> ' + i + '</div>'));
      }

      var child = jqLite('<div>first</div>');
      $animate.enter(child, element);

      expect(element.text()).toEqual('first 0 1 2 3 4');
    }));

    it("should remove the element at the end of leave animation", inject(function($animate, $compile, $rootScope) {
      var child = $compile('<div></div>')($rootScope);
      element.append(child);
      expect(element.contents().length).toBe(1);
      $animate.leave(child);
      expect(element.contents().length).toBe(0);
    }));

    it("should reorder the move animation", inject(function($animate, $compile, $rootScope) {
      var child1 = $compile('<div>1</div>')($rootScope);
      var child2 = $compile('<div>2</div>')($rootScope);
      element.append(child1);
      element.append(child2);
      expect(element.text()).toBe('12');
      $animate.move(child1, element, child2);
      expect(element.text()).toBe('21');
    }));

    it("should still perform DOM operations even if animations are disabled", inject(function($animate) {
      $animate.enabled(false);
      expect(element).toBeShown();
      $animate.addClass(element, 'ng-hide');
      expect(element).toBeHidden();
    }));

    it("should run each method and return a promise", inject(function($animate, $document) {
      var element = jqLite('<div></div>');
      var move   = jqLite('<div></div>');
      var parent = jqLite($document[0].body);
      parent.append(move);

      expect($animate.enter(element, parent)).toBeAPromise();
      expect($animate.move(element, move)).toBeAPromise();
      expect($animate.addClass(element, 'on')).toBeAPromise();
      expect($animate.removeClass(element, 'off')).toBeAPromise();
      expect($animate.setClass(element, 'on', 'off')).toBeAPromise();
      expect($animate.leave(element)).toBeAPromise();
    }));

    it("should provide noop `enabled` and `cancel` methods", inject(function($animate) {
      expect($animate.enabled).toBe(angular.noop);
      expect($animate.enabled()).toBeUndefined();

      expect($animate.cancel).toBe(angular.noop);
      expect($animate.cancel()).toBeUndefined();
    }));

    it("should add and remove classes on SVG elements", inject(function($animate) {
      if (!window.SVGElement) return;
      var svg = jqLite('<svg><rect></rect></svg>');
      var rect = svg.children();
      $animate.enabled(false);
      expect(rect).toBeShown();
      $animate.addClass(rect, 'ng-hide');
      expect(rect).toBeHidden();
      $animate.removeClass(rect, 'ng-hide');
      expect(rect).not.toBeHidden();
    }));

    it("should throw error on wrong selector", function() {
      module(function($animateProvider) {
        expect(function() {
          $animateProvider.register('abc', null);
        }).toThrowMinErr("$animate", "notcsel", "Expecting class selector starting with '.' got 'abc'.");
      });
      inject();
    });

    it("should apply and retain inline styles on the element that is animated", inject(function($animate) {
      var element = jqLite('<div></div>');
      var parent = jqLite('<div></div>');
      var other = jqLite('<div></div>');
      parent.append(other);
      $animate.enabled(true);

      $animate.enter(element, parent, null, { color : 'red' });
      assertColor('red');

      $animate.move(element, null, other, { color : 'yellow' });
      assertColor('yellow');

      $animate.addClass(element, 'on', { color : 'green' });
      assertColor('green');

      $animate.setClass(element, 'off', 'on', { color : 'black' });
      assertColor('black');

      $animate.removeClass(element, 'off', { color : 'blue' });
      assertColor('blue');

      $animate.leave(element, 'off', { color : 'blue' });
      assertColor('blue'); //nothing should happen the element is gone anyway

      function assertColor(color) {
        expect(element[0].style.color).toBe(color);
      }
    }));

    it("should merge the before and after styles that are provided", inject(function($animate) {
      var element = jqLite('<div></div>');

      element.css('color', 'red');
      $animate.addClass(element, 'on', {
        before : { color : 'green' },
        after : { borderColor : 'purple' }
      });

      var style = element[0].style;
      expect(style.color).toBe('green');
      expect(style.borderColor).toBe('purple');
    }));
  });
});
