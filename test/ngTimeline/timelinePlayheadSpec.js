ddescribe("$timelinePlayhead", function() {

  beforeEach(module('ngTimeline'));

  it("should play the next item right away that has no position",
    inject(function($timelinePlayhead, $interval) {

    var signature = '';

    function push(node, letter) {
      node.start = function() {
        signature += letter;
      }
    }

    var timeline = {};
    push(timeline, 'A');

    var row1 = timeline.children = [{}, {}, {}];
    push(row1[0], 'B');

    var row2 = row1[0].children = [{}, {}];
    push(row2[0], 'x');
    push(row2[1], 'y');

    push(row1[1], 'C');
    push(row1[2], 'D');

    var play = $timelinePlayhead(timeline);
    play.start();

    expect(signature).toBe('ABxyCD');
  }));

  it("should walk timelines with a position at a different time",
    inject(function($timelinePlayhead, $interval, $$rAF) {

    var signature = '';

    function push(node, letter) {
      node.letter = letter;
      node.start = function() {
        signature += letter;
      }
    }

    var timeline = {};
    push(timeline, 'A');

    var row1 = timeline.children = [{}, {}, {}, {}];
    push(row1[0], 'B');

    var row2 = row1[0].children = [{}, {}];
    push(row2[0], 'x');
    push(row2[1], 'y');

    push(row1[1], 'C');

    var asyncRow = row1[2];
    asyncRow.position = 0.5;
    push(asyncRow, 'D');

    var asyncKids = asyncRow.children = [{}, {}];
    push(asyncKids[0], 'b');
    push(asyncKids[1], 'c');

    push(row1[3], 'E');

    var play = $timelinePlayhead(timeline);
    play.start();

    expect(signature).toBe('ABxyCE');

    $interval.flush(500);
    $interval.flush(1000);
    expect(signature).toBe('ABxyCEDbc');
  }));

  it("should resolve the provided promise when all node functions are complete",
    inject(function($timelinePlayhead, $interval, $$rAF) {

    var signature = '';

    function push(node, letter) {
      node.letter = letter;
      node.start = function() {
        signature += letter;
      }
    }

    var timeline = {};
    push(timeline, 'A');

    var row1 = timeline.children = [{}, {}, {}, {}];
    push(row1[0], 'B');

    var row2 = row1[0].children = [{}, {}];
    push(row2[0], 'x');
    push(row2[1], 'y');

    push(row1[1], 'C');

    var asyncRow = row1[2];
    asyncRow.position = 0.5;
    push(asyncRow, 'D');

    var asyncKids = asyncRow.children = [{}, {}];
    push(asyncKids[0], 'b');
    push(asyncKids[1], 'c');

    push(row1[3], 'E');

    var play = $timelinePlayhead(timeline);

    var resolved = false;
    play.start().then(function() {
      resolved = true;
    });

    // run the first wave of async animations
    $interval.flush(500);

    // run the next wave of async animations
    $interval.flush(1000);

    $$rAF.flush();
    expect(resolved).toBe(true);
  }));

  it("should reject the player if any timeline returns `false`",
    inject(function($timelinePlayhead, $$rAF) {

    var timeline = {
      start : function() { return false; }
    };

    var rejected = false;

    var play = $timelinePlayhead(timeline);
    play.start().catch(function() {
      rejected = true;
    });

    $$rAF.flush();
    expect(rejected).toBe(true);
  }));

  it("should reject the player if any timeline rejects its given promise",
    inject(function($timelinePlayhead, $$rAF, $q, $rootScope) {

    var defered = $q.defer();
    var timeline = {
      start : function() { return defered.promise; }
    };

    var rejected = false;
    var play = $timelinePlayhead(timeline);
    play.start().catch(function() {
      rejected = true;
    });

    defered.reject();
    $rootScope.$digest();

    $$rAF.flush();
    expect(rejected).toBe(true);
  }));

  it("should cancel the interval loop when the player ends", function() {
    var capturedFlags = {};
    module(function($provide) {
      $provide.decorator('$interval', function($delegate) {
        intervalFn.flush = $delegate.flush;
        intervalFn.cancel = function() {
          capturedFlags.cancelled = true;
        }

        return intervalFn;
        function intervalFn() {
          capturedFlags.created = true;
          return $delegate.apply($delegate, arguments);
        }
      });
    })

    inject(function($timelinePlayhead, $$rAF, $interval) {
      var timeline = {
        start : function() { return false },
        position : 10
      };

      var ended = false;
      var play = $timelinePlayhead(timeline);
      play.start().finally(function() {
        ended = true;
      });

      expect(capturedFlags.created).toBe(true);
      $interval.flush(20000);

      expect(capturedFlags.cancelled).toBe(true);

      $$rAF.flush();
      expect(ended).toBe(true);
    });
  });

  it("should automatically trigger past steps if a future timeline is evaluated",
    inject(function($timelinePlayhead, $interval, $$rAF) {

    var signature = '';

    function push(node, letter) {
      node.letter = letter;
      node.start = function() {
        signature += letter;
      }
    }

    var timeline = {};
    push(timeline, 'A');

    var row1 = timeline.children = [{}, {}];
    push(row1[0], 'B');
    push(row1[1], 'C');

    var row2 = row1[1].children = [{}, {}, {}];
    row2.position = 10;
    push(row2[0], 'a');
    push(row2[1], 'b');
    push(row2[2], 'c');

    // 5 is less than 10
    row2[0].position = 5;
    row2[1].position = 9;
    row2[2].position = 15;

    var play = $timelinePlayhead(timeline);

    var resolved = false;
    play.start().then(function() {
      resolved = true;
    });

    expect(signature).toEqual('ABC');
    $interval.flush(10000);

    expect(signature).toEqual('ABCab');
    $interval.flush(6000);
    expect(signature).toEqual('ABCabc');

    $$rAF.flush();
    expect(resolved).toBe(true);
  }));

  it("should defer to the timeline start function before running the children",
    inject(function($timelinePlayhead, $q, $rootScope) {

    var signature = '';

    var defered = $q.defer();
    var timeline = {
      start : function() {
        return defered.promise;
      }
    };

    var childRun = false;
    timeline.children = [{
      start : function() {
        childRun = true;
      }
    }]

    var play = $timelinePlayhead(timeline);
    play.start();

    expect(childRun).toBe(false);
    defered.resolve();
    $rootScope.$digest();
    expect(childRun).toBe(true);
  }));

  it("should allow a timeline to optionally have no start function",
    inject(function($timelinePlayhead, $q, $rootScope) {

    var capturedLog = '';
    var log = function(token) {
      return function() {
        capturedLog += token;
      };
    };

    var timeline = { /* nothing here */ };
    timeline.children = [
      { start : log('a') },
      { start : log('b') }
    ];

    var play = $timelinePlayhead(timeline);
    play.start();

    expect(capturedLog).toBe('ab');
  }));

  describe('start function', function() {
    var startFn, player, capturedLog, log;
    beforeEach(inject(function($timelinePlayhead) {
      capturedLog = '';
      log = function(token) {
        capturedLog += token;
      };

      var runFn = function() {
        return startFn();
      };

      var timeline = {};
      timeline.children = [
        { start : runFn },
        { start : runFn }
      ];

      player = $timelinePlayhead(timeline);
    }));

    it("should accept simple values and act synchronously", inject(function() {
      startFn = function() { log('1'); };
      player.start();
      expect(capturedLog).toBe('11');
    }));

    it("should immediately stop the player if `false` is returned as a value", inject(function() {
      startFn = function() { log('1'); return false };
      player.start();
      expect(capturedLog).toBe('1');
    }));

    it("should accept a function, call that, and then continue synchronously", inject(function() {
      startFn = function() {
        return function() {
          log('2');
        }
      };

      player.start();
      expect(capturedLog).toBe('22');
    }));

    it("should accept an object with a start function, call that, and then continue synchronously", inject(function() {
      startFn = function() {
        log('0');
        return {
          start : function() {
            log('9');
          }
        }
      };

      player.start();
      expect(capturedLog).toBe('0909');
    }));

    it("should accept a promise and then block until resolved", inject(function($q, $rootScope) {
      var d1 = $q.defer();
      var d2 = $q.defer();
      startFn = function() {
        log('a');
        return (d1 || d2).promise.then(function() {
          log('Z');
        });
      };

      player.start();
      expect(capturedLog).toBe('a');

      d1.resolve();
      d1 = null;
      $rootScope.$digest();
      expect(capturedLog).toBe('aZa');

      d2.resolve();
      d2 = null;
      $rootScope.$digest();
      expect(capturedLog).toBe('aZaZ');
    }));

    it("should accept a function which then returns a promise and then block until resolved", inject(function($q, $rootScope) {
      var d1 = $q.defer();
      var d2 = $q.defer();
      startFn = function() {
        log('a');
        return function() {
          log('b');
          return (d1 || d2).promise.then(function() {
            log('Z');
          });
        }
      };

      player.start();
      expect(capturedLog).toBe('ab');

      d1.resolve();
      d1 = null;
      $rootScope.$digest();
      expect(capturedLog).toBe('abZab');

      d2.resolve();
      d2 = null;
      $rootScope.$digest();
      expect(capturedLog).toBe('abZabZ');
    }));

    it("should accept an object with a start function, call that, and then block until resolved when a promise is returned", inject(function($q, $rootScope) {
      var d1 = $q.defer();
      var d2 = $q.defer();
      startFn = function() {
        log('a');
        return {
          start : function() {
            log('b');
            return (d1 || d2).promise.then(function() {
              log('Z');
            });
          }
        }
      };

      player.start();
      expect(capturedLog).toBe('ab');

      d1.resolve();
      d1 = null;
      $rootScope.$digest();
      expect(capturedLog).toBe('abZab');

      d2.resolve();
      d2 = null;
      $rootScope.$digest();
      expect(capturedLog).toBe('abZabZ');
    }));
  });

  it("should ensure that all step objects contain a start function",
    inject(function($timelinePlayhead, $q, $rootScope) {

    var capturedLog = '';
    var log = function(token) {
      return function() {
        capturedLog += token;
      };
    };

    var timeline = {};
    timeline.children = [
      { /* nothing here */ },
      { /* nothing here */ }
    ];

    var play = $timelinePlayhead(timeline);

    var startFn = function() {
      play.start();
    };

    expect(startFn).toThrow();
  }));

  it("should ensure that all step objects contain a start function",
    inject(function($timelinePlayhead, $q, $rootScope) {

    var capturedLog = '';
    var log = function(token) {
      return function() {
        capturedLog += token;
      };
    };

    var timeline = {};
    timeline.children = [
      { /* nothing here */ },
      { /* nothing here */ }
    ];

    var play = $timelinePlayhead(timeline);

    var startFn = function() {
      play.start();
    };

    expect(startFn).toThrow();
  }));

  describe('label', function() {
    var player, capturedLog, log;
    beforeEach(inject(function($timelinePlayhead) {
      capturedLog = [];
      log = function(token) {
        capturedLog.push(token);
      };
    }));

    it("should register on a step and then trigger a matching positioned-step when complete",
      inject(function($q, $rootScope, $timelinePlayhead) {

      var d1 = $q.defer();
      var d2 = $q.defer();
      var animateFn = function(name) {
        return function() {
          log('started-' + name);
          return (d1 || d2).promise.then(function() {
            log('ended-' + name);
          });
        }
      };

      var timeline = {
        children: [
          { name : '1', start : animateFn('FIRST'), label: 'long-animation' },
          { name : '2', start : animateFn('SECOND'), position: 'long-animation' }
        ]
      };

      player = $timelinePlayhead(timeline);
      player.start();

      expect(capturedLog).toEqual(['started-FIRST']);
      d1.resolve();
      d1 = null;
      $rootScope.$digest();

      expect(capturedLog).toEqual(['started-FIRST', 'ended-FIRST', 'started-SECOND']);
    }));

    it("should register on a step and then trigger a matching positioned-timeline when complete",
      inject(function($q, $rootScope, $timelinePlayhead) {

      var defers = [];
      var asyncFn = function(name) {
        return function() {
          log('started-' + name);
          var defer = $q.defer();
          defers.push(defer);
          return defer.promise.then(function() {
            log('ended-' + name);
          });
        }
      };

      function triggerNext() {
        defers.shift().resolve();
        $rootScope.$digest();
      }

      function lastTwoMessages() {
        return capturedLog.slice(capturedLog.length - 2, capturedLog.length);
      }

      var t0 = { children : [] };

      var t1 = t0.children[0] = { children: [] };
      t1.label = 'first';
      t1.children.push({ start : asyncFn('a') });
      t1.children.push({ start : asyncFn('b') });

      var t2 = t0.children[1] = { children: [] };
      t2.children.push({ start : asyncFn('c') });
      t2.children.push({ start : asyncFn('d') });

      var t3 = t0.children[2] = { children: [] };
      t3.position = 'first';
      t3.children.push({ start : asyncFn('e') });
      t3.children.push({ start : asyncFn('f') });

      player = $timelinePlayhead(t0);
      player.start();

      expect(capturedLog).toEqual(['started-a']);

      triggerNext();
      expect(lastTwoMessages()).toEqual(['ended-a', 'started-b']);

      triggerNext();
      expect(lastTwoMessages()).toEqual(['started-e', 'started-c']);
    }));
  });

});
