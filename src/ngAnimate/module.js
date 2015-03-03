'use strict';

angular.module('ngAnimate', [])
  .directive('ngAnimateChildren', $$AnimateChildrenDirective)

  .provider('$$animation', $$AnimationProvider)
  .factory('$$animateRunner', $$AnimateRunnerFactory)

  .provider('$$animateQueue', $$AnimateQueueProvider)

  .provider('$animateCss', $AnimateCssProvider)
  .provider('$$animateCssDriver', $$AnimateCssDriverProvider)

  .provider('$animateJs', $AnimateJsProvider)
  .provider('$$animateJsDriver', $$AnimateJsDriverProvider);
