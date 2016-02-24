(function(global) {
  'use strict';

  var MAX_SCORES_TO_CONSIDER = 20;
  var MESSAGE_WINDOW_SIZE = 1000;

  /**
   * _standardDeviation and _average methods taken from:
   * http://derickbailey.com/2014/09/21/calculating-standard-deviation-with-array-map-and-array-reduce-in-javascript/
   */
  function _average(data){
    var sum = data.reduce(function(sum, value) {
      return sum + value;
    }, 0);

    var avg = sum / data.length;
    return avg;
  }

  /**
   * _standardDeviation and _average methods taken from:
   * http://derickbailey.com/2014/09/21/calculating-standard-deviation-with-array-map-and-array-reduce-in-javascript/
   */
  function _standardDeviation(values){
    var avg = _average(values);

    var squareDiffs = values.map(function(value) {
      var diff = value - avg;
      var sqrDiff = diff * diff;
      return sqrDiff;
    });

    var avgSquareDiff = _average(squareDiffs);

    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
  }

  function Contender(countryCode, lang, name, side, wsUrl) {
    this.countryCode = countryCode;
    this.lang = lang;
    this.name = name;
    this.side = side;
    this.wsUrl = wsUrl;
    this.ws = new WebSocket(wsUrl);
    this.messageTimeDeltas = [];
    this.windowSums = [];
    this.scores = [];
    this.totalScore = 0;
    this.previousMessageTime = null;
    this.timeoutId = null;
  }

  Contender.prototype.startListening = function(onNewCount) {

    this.callbacks = {
      onNewCount: onNewCount
    };

    /* Note that we are not using the `message` parameter that would usually
     * be passed into this funciton, because we aren't doing anything with the
     * content of the message itself, just the time it was received.
     */
    this.ws.onmessage = function(message) {
      var time = Date.now();

      if (this.previousMessageTime) {
        var delta = time - this.previousMessageTime;
        this.previousMessageTime = time;
        this.messageTimeDeltas.push(delta);
      } else {
        this.previousMessageTime = time;
      }
    }.bind(this);

    this.computeStatistics();
  };

  Contender.prototype.addNewScore = function(score) {
    this.scores.push(score);
    while (this.scores.length > MAX_SCORES_TO_CONSIDER) {
      this.scores.shift();
    }
    console.log(this.scores);
    this.totalScore = _average(this.scores);
  };

  Contender.prototype.computeStatistics = function() {
    this.timeoutId = window.setTimeout(function() {
      var deltas = this.messageTimeDeltas;
      this.messageTimeDeltas = [];
      var newCount = deltas.length;
      if (this.windowSums.length > 1) {
        var datasetAverage = _average(this.windowSums);
        var datasetStdDev = _standardDeviation(this.windowSums);
        var score = (datasetStdDev === 0) ? 0 : (newCount - datasetAverage) / datasetStdDev;
        this.addNewScore(score);
      }
      this.windowSums.push(newCount);
      this.callbacks.onNewCount(newCount, this.side);

      // Call recursively, until the timeout is cleared.
      this.computeStatistics();
    }.bind(this), MESSAGE_WINDOW_SIZE);
  };

  Contender.prototype.stopListening = function() {
    this.ws.onmessage = null;
    window.clearTimeout(this.timeoutId);
  };

  function Battle(leftContender, rightContender, onNewCount, onChangeWinner) {
    this.left = leftContender;
    this.right = rightContender;
    this.winner = null;
    this.callbacks = {
      onNewCount: onNewCount,
      onChangeWinner: onChangeWinner,
    };

    return this;
  }

  Battle.prototype.getOnNewCount = function()  {
    return function(count, side) {
      this.callbacks.onNewCount(count, side);

      var oldWinnerSide = (this.winner) ? this.winner.side : 'none';
      this.winner = (this.left.totalScore > this.right.totalScore) ? this.left : this.right;
      if (this.winner.side !== oldWinnerSide) {
        this.callbacks.onChangeWinner(this.winner);
      }
    }.bind(this);
  };

  Battle.prototype.stop = function() {
    this.left.stopListening();
    this.right.stopListening();
  };

  Battle.prototype.start = function() {
    this.left.startListening(this.getOnNewCount());
    this.right.startListening(this.getOnNewCount());
  };

  if (typeof define === 'function' && define.amd) {
    define(Battle);
    define(Contender);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      Battle: Battle,
      Contender: Contender,
    };
  } else {
    global.Battle = Battle;
    global.Contender = Contender;
  }

}(this));
