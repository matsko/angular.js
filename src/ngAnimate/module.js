'use strict';

angular.module('ngAnimate', [])
  .provider('$animateCss', $AnimateCssProvider)
  .provider('$animateJs', $AnimateJsProvider)
  .provider('$$animateCssDriver', $AnimateCssDriverProvider)
  .provider('$$animateJsDriver', $AnimateJsDriverProvider);
