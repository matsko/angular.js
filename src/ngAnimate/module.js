'use strict';

angular.module('ngAnimate', [])
  .provider('$animateCss', $animateCssProvider)
  .provider('ngTimelineCssDriver', $ngTimelineCssDriverProvider)
  .provider('ngAnimateJsDriver', $ngAnimateJsDriverProvider)
  .provider('ngAnimateCssDriver', $ngAnimateCssDriverProvider);
