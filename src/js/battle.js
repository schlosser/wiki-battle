/*****************************************************************************
 * battle.js                                                                 *
 *                                                                           *
 * This controls game logic and statistics for comparing two languages.      *
 *                                                                           *
 * Determining a winner:                                                     *
 *                                                                           *
 * When comparing two languages, I was interested in which language          *
 * community was more abnormally active.  To do this, I couldn't just        *
 * compare the frequency of edits: some languages (e.g. English) have many   *
 * more edits happening per day than others (e.g. Polish), and so this       *
 * wouldn't be a compelling comparison.  Instead, I bucket edits into        *
 * second-long buckets, and count the number of edits per second. Then, I    *
 * compute a moving average and standard deviation over all data recorded so *
 * far of how many edits are happening per second in that language. For each *
 * new bucket size data point, I compute a "score" of that data point, which *
 * is the deviation from the average:                                        *
 *                                                                           *
 *     // Contender.prototype.computeStatistics                              *
 *     var score = (datasetStdDev === 0) ? 0 :                               *
 *        (newCount - datasetAverage) / datasetStdDev;                       *
 *                                                                           *
 * If the standard deviation is zero, then the score is zero, otherwise,     *
 * it's the differnce between the new count (bucket size) and the dataset    *
 * average divided by the standard deviation.  If a point is 2 standard      *
 * deviations above the mean, then the score is 2.                           *
 *                                                                           *
 * Then, I compute a moving average of the latest 20 (or fewer to start)     *
 * scores, and call that the total score.  The total score is meant to       *
 * represent how active the contributor community is in the given language   *
 * compared to normal.                                                       *
 *                                                                           *
 * The total score of each language is compared, the language with the       *
 * larger total score is said to be the winner.  The winner is recomputed    *
 * every second, with every new bucket size data point.                      *
 *****************************************************************************/

// We package all this up as a nice JavaScript library, so that only the Battle
// and Contender classes are exposed.
(function(global) {
  'use strict';

  /**
   * Global Constants
   **/

  // The amount of time we use to bucket edits, in miliseconds.  By choosing
  // 1000ms, we get a balance between recording a significant number of edits
  // and wanting a responsive UI.
  var MESSAGE_WINDOW_SIZE = 1000;

  // This is the window of how many scores should be considered when determining
  // the total score. This reflects how active a communitiy is "right now".  If
  // this window is too large, then if language A has been winning for a long
  // time, it would be very difficult for language B to be declared a winner,
  // even if language A takes a dip and language B has a burst of edits.  Too
  // small, and the winner will flip back and forth every second.
  //
  // With MESSAGE_WINDOW_SIZE set to 1000, we get a new score every second, so
  // this value can be seen in units of seconds or buckets.
  var MAX_SCORES_TO_CONSIDER = 20;

  /**
   * Math Helpers
   **/

  /**
   * _standardDeviation and _average methods taken from:
   * http://derickbailey.com/2014/09/21/calculating-standard-deviation-with-array-map-and-array-reduce-in-javascript/
   **/
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
   **/
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

  /**
   * Contender
   *
   * @param {string} countryCode - the country code for the flag
   * @param {string} lang - the language code for this language
   * @param {string} name - the name of the language
   * @param {string} wsUrl - the web socket URL which publishes the edits.
   **/
  function Contender(countryCode, lang, name, side, wsUrl) {
    this.countryCode = countryCode;
    this.lang = lang;
    this.name = name;
    this.side = side;
    this.wsUrl = wsUrl;

    // Intialize the web socket but dont' start listening
    this.ws = new WebSocket(wsUrl);

    // This is the "bucket" of message times, the datetimes.  This will be
    // cleared each second.
    this.bucket = [];

    // This is persistent state, containing one entry with the number of
    // edits per second
    this.windowCounts = [];

    // This the rolling window of scores of the MAX_SCORES_TO_CONSIDER most
    // recent scores.
    this.scores = [];

    // The total score, computed from `this.scores`.
    this.totalScore = 0;

    // Used to compute time deltas
    this.previousMessageTime = null;

    // Used to control the infinite listening loop.
    this.timeoutId = null;
  }

  /**
   * Start listening to the websocket.
   *
   * @param {function} onNewCount - callback to call when we get a new bucket.
   **/
  Contender.prototype.startListening = function(onNewCount) {

    this.callbacks = {
      onNewCount: onNewCount
    };

    /* Note that we are not using the `message` parameter that would usually
     * be passed into this funciton, because we aren't doing anything with the
     * content of the message itself, just the time it was received.
     *
     * This is called every time a new message is published on the web socket
     */
    this.ws.onmessage = function() {

      // Compute the delta time from last message.
      var time = Date.now();
      if (this.previousMessageTime) {
        var delta = time - this.previousMessageTime;
        this.previousMessageTime = time;

        // Add the delta to the current bucket
        this.bucket.push(delta);
      } else {
        this.previousMessageTime = time;
      }
    }.bind(this);

    // Run computeStatistics for the first time, which will call itself
    // infinitely, as long as this.timeoutId is not cleared.
    this.computeStatistics();
  };

  /**
   * When we add a new score, we should shift out old scores if we have
   * collected more than MAX_SCORES_TO_CONSIDER.
   *
   * Also computes the new totalScore.
   **/
  Contender.prototype.addNewScore = function(score) {

    // if we've hit MAX_SCORES_TO_CONSIDER scores, remove the least recent one.
    this.scores.push(score);
    while (this.scores.length > MAX_SCORES_TO_CONSIDER) {
      this.scores.shift();
    }

    // the totalScore is the average of the last MAX_SCORES_TO_CONSIDER scores.
    this.totalScore = _average(this.scores);
  };

  /**
   * Gathers a new data point for the size of the `this.windowCounts` bucket,
   * and computes the average and standard deviation of the dataset of bucket
   * counts, creating a new score for the most recent data point.
   *
   * Once called, this funciton will call itself infinitely, every
   * MESSAGE_WINDOW_SIZE milliseconds.
   *
   * Also calls the UI callback.
   */
  Contender.prototype.computeStatistics = function() {
    // Call every MESSAGE_WINDOW_SIZE seconds.
    this.timeoutId = window.setTimeout(function() {

      // Grab the current bucket, then empty the bucket.
      var deltas = this.bucket;
      this.bucket = [];

      // get the bucket size.
      var newCount = deltas.length;

      // If we have nontrivial data, do statistics
      if (this.windowCounts.length > 1) {

        // Compute the average and std deviation of the windowCounts
        var datasetAverage = _average(this.windowCounts);
        var datasetStdDev = _standardDeviation(this.windowCounts);

        // If the standard deviation is zero, then the score is zero,
        // otherwise, it's the differnce between the new count (bucket size)
        // and the dataset average divided by the standard deviation.  If a
        // point is 2 standard deviations above the mean, then the score is 2.
        var score = (datasetStdDev === 0) ? 0 : (newCount - datasetAverage) / datasetStdDev;
        this.addNewScore(score);
      }

      // Store the new bucket size in state
      this.windowCounts.push(newCount);

      // call the callback to the UI.
      this.callbacks.onNewCount(newCount, this.side);

      // Call recursively, until the timeout is cleared.
      this.computeStatistics();

    }.bind(this), MESSAGE_WINDOW_SIZE);
  };

  /**
   * Stop listening to the websocket, and stop computing stats.
   **/
  Contender.prototype.stopListening = function() {
    this.ws.onmessage = null; // stop web socket
    window.clearTimeout(this.timeoutId); // stop computing stats
  };

  /**
   * The Battle class keeps track of which contender is winning, and starts and
   * stops the battle when told.
   *
   * @param {object:Contender} leftContender - the left contender
   * @param {object:Contender} rigthContender - the rigth contender
   * @param {function} onNewCount - to be called when a new bucket is counted.
   * @param {function} onChangeWinner - to be called there is a new winner.
   */
  function Battle(leftContender, rightContender, onNewCount, onChangeWinner) {
    // Our only special state is winner, which is the Contender that is winning.
    this.winner = null;

    // Store the arguments passed.
    this.left = leftContender;
    this.right = rightContender;
    this.callbacks = {
      onNewCount: onNewCount,
      onChangeWinner: onChangeWinner,
    };

    return this;
  }

  /**
   * When a contender gets a new count, it calls the function that this method
   * returns, which will determine if a new winner exists, then reflects any
   * such change in the UI.
   **/
  Battle.prototype.getOnNewCount = function()  {
    return function(count, side) {
      // UI Callback for a new count.
      this.callbacks.onNewCount(count, side);

      // See if we have a new winner
      var oldWinnerSide = (this.winner) ? this.winner.side : 'none';
      this.winner = (this.left.totalScore > this.right.totalScore) ? this.left : this.right;
      if (this.winner.side !== oldWinnerSide) {
        // If we do, call the UI callback
        this.callbacks.onChangeWinner(this.winner);
      }
    }.bind(this);
  };

  /**
   * Stop both the left and right contenders from listening to their web
   * sockets.
   **/
  Battle.prototype.stop = function() {
    this.left.stopListening();
    this.right.stopListening();
  };

  /**
   * Start both the left and right contenders, passing the result of
   * getOnNewCount(), which is our callback, to the contender so that it can
   * call it when it gets a new bucket count.
   **/
  Battle.prototype.start = function() {
    this.left.startListening(this.getOnNewCount());
    this.right.startListening(this.getOnNewCount());
  };

  /**
   * This exports the Battle and Contender classes, so that they are available
   * in other functions.
   **/
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
