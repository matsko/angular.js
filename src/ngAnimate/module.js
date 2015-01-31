'use strict';

angular.module('ngAnimate', [])
  .provider('$animateCss', $AnimateCssProvider)
  .provider('ngAnimateJsDriver', $NgAnimateJsDriverProvider)
  .provider('ngAnimateCssDriver', $NgAnimateCssDriverProvider);
