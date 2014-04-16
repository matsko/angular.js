describe("ngForm", function() {

  beforeEach(module('ngForm'));

  describe("validations", function() {

    it('should perform a required validation', inject(function($compile, $rootScope) {
      var element = $compile('<form name="myForm">' + 
                             '  <input type="text" name="myInput" ng-model="val" required />' +
                             '</form>')($rootScope);

      var input = element.find('input');

      $rootScope.$digest();

      var model = $rootScope.myForm.myInput;

      expect(model.$invalid).toBe(true);
      expect(model.$error.ngRequired).toBe(true);

      input.val('123');
      browserTrigger(input, 'input');

      expect(model.$valid).toBe(true);
      expect(model.$error.ngRequired).toBe(false);

      dealoc(element);
    }));

  });

});
