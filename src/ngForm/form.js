angular.module('ngForm', [])

  .directive('ngModel', function() {
    var EMAIL_REGEXP = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9-]+(\.[a-z0-9-]+)*$/i;
    var URL_REGEXP = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
    var NUMBER_REGEXP = /^\s*(\-|\+)?(\d+|(\d*(\.\d*)))\s*$/;
    var trueNoop = function() {
      return true;
    };

    return {
      require : 'ngModel',
      link : function(scope, element, attrs, ngModel) {
        var registerValidator = function(attr, name, validatorFactory) {
          if(attrs[attr] != null || attrs.type == attr) {
            ngModel.$validators[name] = validatorFactory();
          }
        };

        var requiredValidator = function(value) {
          return value && value.length > 0;
        };

        registerValidator('required', 'ngRequired', function() {
          return requiredValidator;
        });

        registerValidator('ngRequired', 'ngRequired', function() {
          var enabled = false;
          scope.$watch(attrs.ngRequired, function(value) {
            enabled = angular.toBoolean(value);
          });
          return function(value) {
            return !enabled || requiredValidator(value); 
          };
        });


        var patternValidator = function(pattern, value) {
          return pattern.test(value);
        };

        registerValidator('pattern', 'ngPattern', function() {
          var pattern = RegExp(attrs.pattern);
          return function(value) {
            return patternValidator(pattern, value);
          };
        });

        registerValidator('ngPattern', 'ngPattern', function() {
          var pattern;
          scope.$watch(attrs.ngPattern, function(value) {
            pattern = value && value.length
                ? new RegExp(pattern)
                : null;
          });
          return function(value) {
            return !pattern || patternValidator(pattern, value);
          };
        });

        registerValidator('email', 'ngEmail', function() {
          return function(value) {
            return patternValidator(EMAIL_REGEXP, value);
          };
        });

        registerValidator('url', 'ngUrl', function() {
          return function(value) {
            return patternValidator(URL_EXP, value);
          };
        });

        registerValidator('number', 'ngNumber', function() {
          return function(value) {
            return patternValidator(NUMBER_REGEXP, value);
          };
        });

        var minlengthValidator = function(length, value) {
          return !value || value.length == 0 || value.length >= length;
        };

        registerValidator('minlength', 'ngMinlength', function() {
          var minlength = attrs.minlength;
          if(minlength <= 0) {
            return trueNoop;
          }
          return function(value) {
            return minlengthValidator(minlength, value);
          };
        });

        registerValidator('ngMinlength', 'ngMinlength', function() {
          var minlength = 0;
          scope.$watch(attrs.ngPattern, function(value) {
            minlength = value && value > 0 ? value : 0;
          });
          return function(value) {
            return minlength == 0 || minlengthValidator(minlength, value);
          };
        });


        var maxlengthValidator = function(length, value) {
          return !value || value.length <= length;
        };

        registerValidator('maxlength', 'ngMaxlength', function() {
          var maxlength = attrs.maxlength;
          if(maxlength <= 0) {
            return trueNoop;
          }
          return function(value) {
            return maxlengthValidator(maxlength, value);
          }
        });

        registerValidator('ngMaxlength', 'ngMaxlength', function() {
          var maxlength = 0;
          scope.$watch(attrs.ngPattern, function(value) {
            maxlength = value && value > 0 ? value : 0;
          });
          return function(value) {
            return maxlength == 0 || maxlengthValidator(maxlength, value);
          }
        });


        var inputSupportsMinMax = function(type) {
          return type == 'range' || type == 'number';
        };

        var maxValidator = function(max, value) {
          return value <= max;
        };

        registerValidator('max', 'ngMax', function() {
          var max = attrs.max;
          if(max == null || !inputSupportsMinMax(element.attr('type'))) {
            return trueNoop;
          }

          return function(value) {
            return maxValidator(max, value);
          }
        });

        registerValidator('ngMax', 'ngMax', function() {
          if(!inputSupportsMinMax(attrs.type)) {
            return trueNoop;
          }

          var max = 0;
          scope.$watch(attrs.ngMax, function(maxVal) {
            max = maxVal > 0 ? maxVal : 0;
          });

          return function(value) {
            return maxValidator(max, value);
          }
        });

        var minValidator = function(min, value) {
          return value >= min;
        };

        registerValidator('min', 'ngMin', function() {
          var min = attrs.min;
          if(min == null || !inputSupportsMinMax(element.attr('type'))) {
            return trueNoop;
          }

          return function(value) {
            return minValidator(min, value);
          }
        });

        registerValidator('ngMin', 'ngMin', function() {
          if(!inputSupportsMinMax(attrs.type)) {
            return trueNoop;
          }

          var min = 0;
          scope.$watch(attrs.ngmin, function(minVal) {
            min = minVal > 0 ? minVal : 0;
          });

          return function(value) {
            return minValidator(min, value);
          };
        });
      }
    }
  })
