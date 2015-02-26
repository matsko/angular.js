'use strict';

describe("ngAnimate $$animateJsDriver", function() {

  beforeEach(module('ngAnimate'));

  it('should register the $$animateJsDriver into the list of drivers found in $animateProvider',
    module(function($animateProvider) {

    expect($animateProvider.drivers).toContain('$$animateJsDriver');
  }));

});
