'use strict';

angular.module('ngAnimate', [])
  .provider('$animateCss', $AnimateCssProvider)
  .provider('$$animateJsDriver', $NgAnimateJsDriverProvider)
  .provider('$$animateCssDriver', $NgAnimateCssDriverProvider);
