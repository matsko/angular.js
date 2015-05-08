ddescribe("$$animateScheduler", function() {

  beforeEach(module('ngAnimate'));

  var log;
  function logFactory(token) {
    return function() {
      log.push(token);
    }
  }

  function treeLogFactory(token, next) {
    return {
      next: next,
      fn: logFactory(token)
    };
  }

  beforeEach(function() {
    log = [];
  });

  describe('pipe', function() {
    it('should schedule each of the functions to run when the last rAF goes quiet',
      inject(function($$animateScheduler, $$rAF) {

      $$animateScheduler.pipe(logFactory('A'));
      $$animateScheduler.pipe(logFactory('B'));
      $$animateScheduler.pipe(logFactory('C'));

      $$rAF.flush();

      expect(log).toEqual(['A','B','C']);
    }));
  });

  describe('schedule', function() {
    it('should schedule the first item immediately',
      inject(function($$animateScheduler, $$rAF) {

      $$animateScheduler.schedule(treeLogFactory('A'));
      $$animateScheduler.schedule(treeLogFactory('B'));
      $$animateScheduler.schedule(treeLogFactory('C'));

      expect(log).toEqual(['A','B','C']);
    }));

    it('should schedule the next items in the next rAF flush',
      inject(function($$animateScheduler, $$rAF) {

      $$animateScheduler.schedule(treeLogFactory('A',
        [treeLogFactory('Aa'), treeLogFactory('Ab')]
      ));

      $$animateScheduler.schedule(treeLogFactory('B',
        [treeLogFactory('Ba'), treeLogFactory('Bb')]
      ));

      expect(log).toEqual(['A','B']);

      $$rAF.flush();

      expect(log).toEqual(['A','B', 'Aa', 'Ab', 'Ba', 'Bb']);
    }));

    it('should schedule the follow up items right away even when others are in a rAF flush',
      inject(function($$animateScheduler, $$rAF) {

      $$animateScheduler.schedule(treeLogFactory('A',
        [treeLogFactory('Aa'), treeLogFactory('Ab')]
      ));

      expect(log).toEqual(['A']);

      $$rAF.flush();

      $$animateScheduler.schedule(treeLogFactory('B',
        [treeLogFactory('Ba'), treeLogFactory('Bb')]
      ));

      expect(log).toEqual(['A', 'Aa', 'Ab', 'B']);
    }));

    it('should run the piped items first before running the next row of rAF items',
      inject(function($$animateScheduler, $$rAF) {

      $$animateScheduler.schedule(treeLogFactory('A',
        [treeLogFactory('Aa'), treeLogFactory('Ab')]
      ));

      expect(log).toEqual(['A']);

      $$animateScheduler.pipe(logFactory('P1'));
      $$animateScheduler.pipe(logFactory('P2'));

      $$rAF.flush();

      expect(log).toEqual(['A', 'P1', 'P2', 'Aa', 'Ab']);
    }));
  });
});
