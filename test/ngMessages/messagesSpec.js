describe('ngMessages', function() {

  beforeEach(module('ngMessages'));

  function s(str) {
    return str.replace(/\s+/g,'');
  }

  var element;
  afterEach(function() {
    dealoc(element);
  });

  describe('ngMessage', function() {
    it('should render based off of a hashmap collection', inject(function($rootScope, $compile) {
      element = $compile('<div ng-message="col">' +
                         '  <div ng-message-on="val">Message is set</div>' +
                         '</div>')($rootScope);
      $rootScope.$digest();

      expect(element.text()).not.toContain('Message is set');

      $rootScope.$apply(function() {
        $rootScope.col = { val : true };
      });

      expect(element.text()).toContain('Message is set');
    }))

    it('should render empty without a valid collection', inject(function($rootScope, $compile) {
      element = $compile('<div ng-message="col">' +
                         '  <div ng-message-on="val">Message is set</div>' +
                         '</div>')($rootScope);
      $rootScope.$digest();

      forEach([ null, false, 0, {}, [], [{}], '', { val2 : true }], function(val) {
        $rootScope.$apply(function() {
          $rootScope.col = val;
        });
        expect(element.text()).not.toContain('Message is set');
      });
    }))

    it('should insert and remove matching inner elements that are truthy and falsy',
      inject(function($rootScope, $compile) {

      element = $compile('<div ng-message="col">' +
                         '  <div ng-message-on="blue">This message is blue</div>' +
                         '  <div ng-message-on="red">This message is red</div>' +
                         '</div>')($rootScope);

      $rootScope.$apply(function() {
        $rootScope.col = {};
      });

      expect(element.children().length).toBe(0);
      expect(trim(element.text())).toEqual('');

      $rootScope.$apply(function() {
        $rootScope.col = {
          blue : true,
          red : false
        };
      });

      expect(element.children().length).toBe(1);
      expect(trim(element.text())).toEqual('This message is blue');

      forEach([ true, 1, {}, 'a', [], [null]], function(prop) {
        $rootScope.$apply(function() {
          $rootScope.col = {
            red : prop
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual('This message is red');

        $rootScope.$apply(function() {
          $rootScope.col = null;
        });
        expect(element.children().length).toBe(0);
        expect(trim(element.text())).toEqual('');
      });


      $rootScope.$apply(function() {
        $rootScope.col = {
          blue : 0,
          red : null
        };
      });

      expect(element.children().length).toBe(0);
      expect(trim(element.text())).toEqual('');
    }))

    it('should display the elements in the order defined in the DOM',
      inject(function($rootScope, $compile) {

      element = $compile('<div ng-message="col">' +
                         '  <div ng-message-on="one">Message#one</div>' +
                         '  <div ng-message-on="two">Message#two</div>' +
                         '  <div ng-message-on="three">Message#three</div>' +
                         '</div>')($rootScope);

      $rootScope.$apply(function() {
        $rootScope.col = {
          three : true,
          one : true,
          two : true
        };
      });

      angular.forEach(['one','two','three'], function(key) {
        expect(s(element.text())).toEqual('Message#' + key);

        $rootScope.$apply(function() {
          $rootScope.col[key] = false;
        });
      });

      expect(s(element.text())).toEqual('');
    }))

    it('should add ng-active/ng-inactive CSS classes to the element when errors are/aren\'t displayed',
      inject(function($rootScope, $compile) {

      element = $compile('<div ng-message="col">' +
                         '  <div ng-message-on="ready">This message is ready</div>' +
                         '</div>')($rootScope);

      $rootScope.$apply(function() {
        $rootScope.col = {};
      });

      expect(element.hasClass('ng-active')).toBe(false);
      expect(element.hasClass('ng-inactive')).toBe(true);

      $rootScope.$apply(function() {
        $rootScope.col = { ready : true };
      });

      expect(element.hasClass('ng-active')).toBe(true);
      expect(element.hasClass('ng-inactive')).toBe(false);
    }))

    it('should render animations when the active/inactive classes are added/removed', function() {
      module('ngAnimate');
      module('ngAnimateMock');
      inject(function($rootScope, $compile, $animate) {
        element = $compile('<div ng-message="col">' +
                           '  <div ng-message-on="ready">This message is ready</div>' +
                           '</div>')($rootScope);

        $rootScope.$apply(function() {
          $rootScope.col = {};
        });

        var event = $animate.queue.pop();
        expect(event.event).toBe('setClass');
        expect(event.args[1]).toBe('ng-inactive');
        expect(event.args[2]).toBe('ng-active');

        $rootScope.$apply(function() {
          $rootScope.col = { ready : true };
        });

        event = $animate.queue.pop();
        expect(event.event).toBe('setClass');
        expect(event.args[1]).toBe('ng-active');
        expect(event.args[2]).toBe('ng-inactive');
      })
    })

    describe('[ng-message-include]', function() {
      it('should load a remote template', inject(function($compile, $rootScope, $templateCache) {
        $templateCache.put('abc.html', '<div ng-message-on="a">A</div>' +
                                       '<div ng-message-on="b">B</div>' +
                                       '<div ng-message-on="c">C</div>');

        element = $compile('<div ng-message="data" ng-message-include="abc.html"></div>')($rootScope);
        $rootScope.$apply(function() {
          $rootScope.data = {
            'a': 1,
            'b': 2,
            'c': 3
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("A");

        $rootScope.$apply(function() {
          $rootScope.data = {
            'c': 3
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("C");
      }));

      it('should cache the template after download',
        inject(function($rootScope, $compile, $templateCache, $httpBackend) {

        $httpBackend.expect('GET', 'tpl').respond(201, 'abc');

        expect($templateCache.get('tpl')).toBeUndefined();

        element = $compile('<div ng-message="data" ng-message-include="tpl"></div>')($rootScope);

        $rootScope.$digest();
        $httpBackend.flush();

        expect($templateCache.get('tpl')).not.toBeUndefined();
      }));

      it('should re-render the messages after download without an extra digest',
        inject(function($rootScope, $compile, $httpBackend) {

        $httpBackend.expect('GET', 'my-messages').respond(201,'<div ng-message-on="required">You did not enter a value</div>');

        element = $compile('<div ng-message="data" ng-message-include="my-messages">' +
                           '  <div ng-message-on="failed">Your value is that of failure</div>' +
                           '</div>')($rootScope);

        $rootScope.data = {
          required : true,
          failed : true
        };

        $rootScope.$digest();

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("Your value is that of failure");

        $httpBackend.flush();

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("You did not enter a value");
      }));

      xit('should prevent multiple ngMessage directives from downloading the remote template at the same time',
        inject(function($rootScope, $compile, $templateCache, $httpBackend) {

        $httpBackend.expect('GET', 'tpl').respond(201,
          '<div ng-message="ready">Ready</div>');

        expect($templateCache.get('tpl')).toBeUndefined();

        element = $compile(
          '<div ng-message="data0" ng-message-include="tpl"></div>-' +
          '<div ng-message="data1" ng-message-include="tpl"></div>-' +
          '<div ng-message="data2" ng-message-include="tpl"></div>'
        )($rootScope);

        $rootScope.$apply(function() {
          $rootScope.data0 = $rootScope.data1 = $rootScope.data2 = {
            ready : true
          };
        });
        $httpBackend.flush(1);

        expect($templateCache.get('tpl')).not.toBeUndefined();

        $httpBackend.verifyNoOutstandingRequest();

        expect(s(element.text())).toEqual("Ready-Ready-Ready");
      }));

      it('should allow for overriding the remote template messages within the element',
        inject(function($compile, $rootScope, $templateCache) {

        $templateCache.put('abc.html', '<div ng-message-on="a">A</div>' +
                                       '<div ng-message-on="b">B</div>' +
                                       '<div ng-message-on="c">C</div>');

        element = $compile('<div ng-message="data" ng-message-include="abc.html">' +
                           '  <div ng-message-on="a">AAA</div>' +
                           '  <div ng-message-on="c">CCC</div>' +
                           '</div>')($rootScope);

        $rootScope.$apply(function() {
          $rootScope.data = {
            'a': 1,
            'b': 2,
            'c': 3
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("AAA");

        $rootScope.$apply(function() {
          $rootScope.data = {
            'b': 2,
            'c': 3
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("B");

        $rootScope.$apply(function() {
          $rootScope.data = {
            'c': 3
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("CCC");
      }));

      it('should retain the order of the remote template\'s messages when overriding within the element',
        inject(function($compile, $rootScope, $templateCache) {

        $templateCache.put('abc.html', '<div ng-message-on="c">C</div>' +
                                       '<div ng-message-on="a">A</div>' +
                                       '<div ng-message-on="b">B</div>');

        element = $compile('<div ng-message="data" ng-message-include="abc.html">' +
                           '  <div ng-message-on="a">AAA</div>' +
                           '  <div ng-message-on="c">CCC</div>' +
                           '</div>')($rootScope);

        $rootScope.$apply(function() {
          $rootScope.data = {
            'a': 1,
            'b': 2,
            'c': 3
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("CCC");

        $rootScope.$apply(function() {
          $rootScope.data = {
            'a': 1,
            'b': 2,
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("AAA");

        $rootScope.$apply(function() {
          $rootScope.data = {
            'b': 3
          };
        });

        expect(element.children().length).toBe(1);
        expect(trim(element.text())).toEqual("B");
      }));


      it('should provide a template url to child elements',
        inject(function($templateCache, $compile, $rootScope) {

        $templateCache.put('abc.html', '<div ng-message-on="a">A</div>' +
                                       '<div ng-message-on="b">B</div>' +
                                       '<div ng-message-on="c">C</div>');


        element = angular.element('<div ng-message-include="abc.html">' +
                                      '  <div ng-message="{a:1}"></div>' +
                                      '  <div ng-message="{b:2}"></div>' +
                                      '</div>');

        var msg1 = element.children().eq(0);
        var msg2 = element.children().eq(1);

        $compile(element)($rootScope);
        $rootScope.$apply();

        expect(msg1.children().length).toBe(1);
        expect(trim(msg1.text())).toEqual("A");

        expect(msg2.children().length).toBe(1);
        expect(trim(msg2.text())).toEqual("B");
      }));
    });

    describe('[ng-message-multiple]', function() {
      it('should show all truthy messages when present', inject(function($rootScope, $compile) {
        element = $compile('<div ng-message="data" ng-message-multiple="true">' +
                           '  <div ng-message-on="one">1</div>' +
                           '  <div ng-message-on="two">2</div>' +
                           '  <div ng-message-on="three">3</div>' +
                           '</div>')($rootScope);

        $rootScope.$apply(function() {
          $rootScope.data = {
            'one': true,
            'two': false,
            'three': true
          };
        });

        expect(element.children().length).toBe(2);
        expect(s(element.text())).toContain("13");
      }));

      it('should render all truthy messages from a remote template',
        inject(function($rootScope, $compile, $templateCache) {

        $templateCache.put('xyz.html', '<div ng-message-on="x">X</div>' +
                                       '<div ng-message-on="y">Y</div>' +
                                       '<div ng-message-on="z">Z</div>');

        element = $compile('<div ng-message="data" ' +
                           'ng-message-multiple="true" ' +
                           'ng-message-include="xyz.html"></div>')($rootScope);

        $rootScope.$apply(function() {
          $rootScope.data = {
            'x': 'a',
            'y': null,
            'z': true
          };
        });

        expect(element.children().length).toBe(2);
        expect(s(element.text())).toEqual("XZ");

        $rootScope.$apply(function() {
          $rootScope.data.y = {};
        });

        expect(element.children().length).toBe(3);
        expect(s(element.text())).toEqual("XYZ");
      }));

      it('should render and override all truthy messages from a remote template',
        inject(function($rootScope, $compile, $templateCache) {

        $templateCache.put('xyz.html', '<div ng-message-on="x">X</div>' +
                                       '<div ng-message-on="y">Y</div>' +
                                       '<div ng-message-on="z">Z</div>');

        element = $compile('<div ng-message="data" ' +
                                'ng-message-multiple="true" ' +
                                'ng-message-include="xyz.html">' +
                                  '<div ng-message-on="y">YYY</div>' +
                                  '<div ng-message-on="z">ZZZ</div>' +
                           '</div>')($rootScope);

        $rootScope.$apply(function() {
          $rootScope.data = {
            'x': 'a',
            'y': null,
            'z': true
          };
        });

        expect(element.children().length).toBe(2);
        expect(s(element.text())).toEqual("XZZZ");

        $rootScope.$apply(function() {
          $rootScope.data.y = {};
        });

        expect(element.children().length).toBe(3);
        expect(s(element.text())).toEqual("XYYYZZZ");
      }));
    });
  })

  describe('ngMessageOn', function() {
    it('should set \$control as the active map value within the scope of ngMessageOn',
      inject(function($rootScope, $compile) {

      element = $compile('<div ng-message="col">' +
                         '  <div ng-message-on="number">*{{ \$control }}* is not a number</div>' +
                         '  <div ng-message-on="palendrome">*{{ \$control }}* is not a palendrome</div>' +
                         '</div>')($rootScope);

      $rootScope.$apply(function() {
        $rootScope.col = {
          'number' : "1a2e"
        };
      });

      expect(element.children().length).toBe(1);
      expect(trim(element.text())).toEqual("*1a2e* is not a number");

      $rootScope.$apply(function() {
        $rootScope.col = {
          'palendrome' : "matias"
        };
      });

      expect(element.children().length).toBe(1);
      expect(trim(element.text())).toEqual("*matias* is not a palendrome");
    }));
  });
});
