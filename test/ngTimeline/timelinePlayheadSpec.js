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
});
