ddescribe("$$animateOptions", function() {

  beforeEach(module('ngAnimate'));

  var element;
  beforeEach(function() {
    element = jqLite('<div></div>');
  });

  it('should construct an options wrapper from the provided options',
    inject(function($$animateOptions) {

    var options = $$animateOptions(element, {
      value: 'hello'
    });

    expect(options.$use('value')).toBe('hello');
  }));

  it('should return the same instance it already instantiated as an options object with the given element',
    inject(function($$animateOptions) {

    var options = $$animateOptions(element, {});
    expect($$animateOptions(element, options)).toBe(options);

    var element2 = jqLite('<div>1</div>');
    expect($$animateOptions(element2, options)).not.toBe(options);
  }));

  it('should only allow an option to be used once', inject(function($$animateOptions) {
    var options = $$animateOptions(element, {
      once: 'only once'
    });

    expect(options.$use('once')).toBe('only once');
    expect(options.$use('once')).toBeUndefined();
  }));

  it('should apply the provided `from` styles', inject(function($$animateOptions) {
    var options = $$animateOptions(element, {
      from: { color: 'red' },
      to: { color: 'blue' }
    });

    options.$applyStyles(true, false);
    expect(element.css('color')).toBe('red');
  }));

  it('should apply the provided `to` styles', inject(function($$animateOptions) {
    var options = $$animateOptions(element, {
      from: { color: 'red' },
      to: { color: 'blue' }
    });

    options.$applyStyles(false, true);
    expect(element.css('color')).toBe('blue');
  }));

  it('should apply the both provided `from` and `to` styles', inject(function($$animateOptions) {
    var options = $$animateOptions(element, {
      from: { color: 'red', 'font-size':'50px' },
      to: { color: 'blue' }
    });

    options.$applyStyles();
    expect(element.css('color')).toBe('blue');
    expect(element.css('font-size')).toBe('50px');
  }));

  it('should only apply the options once', inject(function($$animateOptions) {
    var options = $$animateOptions(element, {
      from: { color: 'red', 'font-size':'50px' },
      to: { color: 'blue' }
    });

    options.$applyStyles();
    expect(element.attr('style')).not.toBe('');

    element.attr('style', '');

    options.$applyStyles();
    expect(element.attr('style')).toBe('');
  }));

  it('should add/remove the provided CSS classes', inject(function($$animateOptions) {
    element.addClass('four six');
    var options = $$animateOptions(element, {
      addClass: 'one two three',
      removeClass: 'four'
    });

    options.$applyClasses();
    expect(element).toHaveClass('one two three');
    expect(element).toHaveClass('six');
    expect(element).not.toHaveClass('four');
  }));

  it('should add/remove the provided CSS classes only once', inject(function($$animateOptions) {
    element.attr('class', 'blue');
    var options = $$animateOptions(element, {
      addClass: 'black',
      removeClass: 'blue'
    });

    options.$applyClasses();
    element.attr('class', 'blue');

    options.$applyClasses();
    expect(element).toHaveClass('blue');
    expect(element).not.toHaveClass('black');
  }));

  it('should merge in new options', inject(function($$animateOptions) {
    element.attr('class', 'blue');
    var options = $$animateOptions(element, {
      name: 'matias',
      age: 28,
      addClass: 'black',
      removeClass: 'blue'
    });

    options.$merge({
      age: 29,
      addClass: 'blue brown',
      removeClass: 'orange'
    });

    expect(options.name).toBe('matias');
    expect(options.age).toBe(29);
    expect(options.addClass).toBe('black brown');
    expect(options.removeClass).toBe('blue');
  }));
});
