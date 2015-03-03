'use strict';

angular.module('ngAnimate', [])
  .directive('ngAnimateChildren', $$AnimateChildrenDirective)

  .factory('$$animateRunner', $$AnimateRunnerFactory)
  .factory('$$animateOptions', $$AnimateOptionsFactory)

  .provider('$$animateQueue', $$AnimateQueueProvider)
  .provider('$$animation', $$AnimationProvider)

  .provider('$animateCss', $AnimateCssProvider)
  .provider('$$animateCssDriver', $$AnimateCssDriverProvider)

  .provider('$animateJs', $AnimateJsProvider)
  .provider('$$animateJsDriver', $$AnimateJsDriverProvider);
