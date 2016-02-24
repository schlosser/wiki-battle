/*****************************************************************************
 * app.js                                                                    *
 *                                                                           *
 * This controls all user interaction and clicks, and manages all visual     *
 * application state. When two languages have been selected, a new battle is *
 * started (using the new Battle() class from battle.js), and when the       *
 * battle has updates, this file defines callbacks to reflect those changes  *
 * in the UI.                                                                *
 *****************************************************************************/

document.addEventListener('DOMContentLoaded', function() {

  /**
   * Global state
   **/

  // Holds the instance of the Battle class, which mangages application state.
  var battle = null;

  // Holds a string like 'left', or 'right', indicating which side is winning.
  var winningSide = null;

  // Holds two instances of the Contender class.  If both contenders.left and
  // contenders.right are not null, then we have two contenders and we should
  // start the battle.
  var contenders = {
    left: null,
    right: null,
  };

  /**
   * Elements
   **/

  // All of the flags that can be clicked to select a country
  var selectButtons = document.getElementsByClassName('select-country');

  // The "X" buttons that can be clicked to deselect a country
  var deselectButtons = document.getElementsByClassName('deselect-country');

  // The left and right sides of the battle
  var contenderElements = {
    left: document.querySelectorAll('.contender.left')[0],
    right: document.querySelectorAll('.contender.right')[0],
  };

  // The left and right modal which covers the list of flags when one language
  // is selected.
  var coverElements = {
    left: document.querySelectorAll('.contender.left .cover')[0],
    right: document.querySelectorAll('.contender.right .cover')[0],
  };

  // The left and right elements in which the counts of edits per second should
  // be rendered.
  var countContainerElements = {
    left: document.querySelectorAll('.contender.left .counts')[0],
    right: document.querySelectorAll('.contender.right .counts')[0],
  };

  /**
   * Callbacks: reflecting state changes in the UI
   */

  /**
   * When a new winner is selected, we should show the correct side as winning.
   *
   * @param {Object:Contender} winner - the Contender instance that is winning.
   **/
  function onChangeWinner(winner) {
    // Hide the "winning" panel on the losing side.
    if (winningSide) {
      contenderElements[winningSide].classList.remove('winning');
    }

    // Show the "winning" panel on the winning side.
    contenderElements[winner.side].classList.add('winning');

    // Store the winning side in global state.
    winningSide = winner.side;
  }

  /**
   * When we have a new count of the number of edits per second for a
   * particular side, reflect that in the UI.
   *
   * @param {Number} count - the number of edits per second.
   * @param {String} side - either 'left' or 'right'.
   */
  function onNewCount(count, side) {
    countContainerElements[side].innerHTML = 'Edits per second: ' + count;
  }

  /**
   * Handlers: reacting to user interaction
   */

  /**
   * When a flag is clicked, we should display the modal over the list of flags
   * and store the selected Contender in state.  If both the left and right
   * side have been selected, we should start the battle.
   *
   * @param {Object} e - the HTML5 click event.
   */
  function onSelectLanguage(e) {
    // Don't follow the link or change the URL
    e.preventDefault();

    // We'll be using the side ('left' or 'right') alot, so we pull it out into
    // a convenient variable.
    var side = this.dataset.side;

    // Mark this flag as selected, which animates the language name.
    this.className += ' selected';

    // Instantiate the new contender object, pulling data from our HTML about
    // the selected language.  We have the country code (of the flag), the
    // language code, the language name, the side we are in ("left" or
    // "right"), and the web socket URL which publishes Wikipedia edits for
    // this language.
    var contender = new Contender(
      this.dataset.countryCode,
      this.dataset.lang,
      this.dataset.name,
      this.dataset.side,
      this.dataset.wsUrl
    );

    // Store the Contender we created in global state
    contenders[side] = contender;

    // Here we set state in the UI, showing the modal, and starting CSS
    // animations by adding / removing classes in HTML.
    contenderElements[side].classList.add('active');
    coverElements[side].className = coverElements[side].className.replace(/ flag-icon[^ ]*/g, '');
    coverElements[side].classList.add('flag-icon', 'flag-icon-' + contender.countryCode);

    // If both contenders.left and contenders.right are not null, then we have
    // selected two contenders and we should start the battle
    if (contenders.left && contenders.right) {
      // Instantiate the new Battle (passing in the callbacks that will reflect
      // changes in game state in the UI, and the two contenders that will be
      // battling) and start it.
      battle = new Battle(contenders.left, contenders.right, onNewCount, onChangeWinner);
      battle.start();
    }
  }

  /**
   * When the "X" button is clicked, stop any game that is happening and show
   * the language flags again.
   *
   * @param {Object} e - the HTML5 click event.
   **/
  function onDeselectLanguage(e) {
    // Don't follow the link or change the URL
    e.preventDefault();

    // We'll be using the side ('left' or 'right') alot, so we pull it out into
    // a convenient variable.
    var side = this.dataset.side;

    // Stop the battle (stope listening to the websockets) if one exists.
    if (battle) {
      battle.stop();
    }

    // Unset our global state, indicating that we don't have a contender on
    // this side anymore.
    contenders[side] = null;

    // Set the UI state.  We hide the modal and language name, showing the
    // language flags again. We also reset the modal back to its original
    // state, so that we have a clean slate if we start a second battle.
    selected = contenderElements[side].getElementsByClassName('selected');
    for (var i = 0; i < selected.length; i++) {
      selected[i].classList.remove('selected');
    }
    contenderElements[side].classList.remove('active', 'winning');
    countContainerElements.left.innerHTML = '';
    countContainerElements.right.innerHTML = '';

  }

  /**
   * addEventListener calls: Link up all buttons to their handlers
   **/
  for (var i = 0; i < deselectButtons.length; i++) {
    deselectButtons[i].addEventListener('click', onDeselectLanguage);
  }

  for (i = 0; i < selectButtons.length; i++) {
    selectButtons[i].addEventListener('click', onSelectLanguage);
  }
});
