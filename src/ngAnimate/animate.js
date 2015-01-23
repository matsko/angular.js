angular.module('ngAnimate', [])
  .provider('ngAnimateJSDriver', $JsDriverProvider)
  .provider('ngAnimateCSSDriver', $CssDriverProvider);
