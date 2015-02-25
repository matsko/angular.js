'use strict';

angular.module('ngAnimate', [])
  .provider('$animateCss', $AnimateCssProvider)
  .provider('$$animateJsDriver', $AnimateJsDriverProvider)
  .provider('$$animateCssDriver', $AnimateCssDriverProvider);
