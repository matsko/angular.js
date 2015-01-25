'use strict';

angular.module('ngAnimate', [])
  .provider('$animateCSS', $animateCssProvider)
  .provider('ngTimelineCssDriver', $ngTimelineCssDriverProvider)
  .provider('ngAnimateJsDriver', $ngAnimateJsDriverProvider)
  .provider('ngAnimateCssDriver', $ngAnimateCssDriverProvider);
