document.addEventListener('DOMContentLoaded', function() {
  var battle;
  var winningSide = null;
  var deselectButtons = document.getElementsByClassName('deselect-country');
  var selectButtons = document.getElementsByClassName('select-country');
  var contenderElements = {
    left: document.querySelectorAll('.contender.left')[0],
    right: document.querySelectorAll('.contender.right')[0],
  };

  var coverElements = {
    left: document.querySelectorAll('.contender.left .cover')[0],
    right: document.querySelectorAll('.contender.right .cover')[0],
  };

  var countContainerElements = {
    left: document.querySelectorAll('.contender.left .counts')[0],
    right: document.querySelectorAll('.contender.right .counts')[0],
  };

  var contenders = {
    left: null,
    right: null,
  };

  function onChangeWinner(winner) {
    if (winningSide) {
      contenderElements[winningSide].classList.remove('winning');
    }

    contenderElements[winner.side].classList.add('winning');

    winningSide = winner.side;
  }

  function onNewCount(count, side) {
    countContainerElements[side].innerHTML = 'Edits per second: ' + count;
  }

  function onSelectLanguage(e) {
    e.preventDefault();

    console.log(this.classList);
    this.className += ' selected';
    console.log(this.classList);

    var contender = new Contender(
      this.dataset.countryCode,
      this.dataset.lang,
      this.dataset.name,
      this.dataset.side,
      this.dataset.wsUrl
    );

    var side = contender.side;


    contenderElements[side].classList.add('active');
    coverElements[side].className = coverElements[side].className.replace(/ flag-icon[^ ]*/g, '');
    coverElements[side].classList.add('flag-icon', 'flag-icon-' + contender.countryCode);
    contenders[side] = contender;

    if (contenders.left && contenders.right) {
      battle = new Battle(contenders.left, contenders.right, onNewCount, onChangeWinner);
      battle.start();
    }
  }

  function onDeselectLanguage(e) {
    e.preventDefault();


    var side = this.dataset.side;

    if (battle) {
      battle.stop();
    }

    selected = contenderElements[side].getElementsByClassName('selected');
    for (var i = 0; i < selected.length; i++) {
      selected[i].classList.remove('selected');
    }
    contenderElements[side].classList.remove('active', 'winning');
    countContainerElements.left.innerHTML = '';
    countContainerElements.right.innerHTML = '';
    contenders[side] = null;
  }

  for (var i = 0; i < deselectButtons.length; i++) {
    deselectButtons[i].addEventListener('click', onDeselectLanguage);
  }

  for (i = 0; i < selectButtons.length; i++) {
    selectButtons[i].addEventListener('click', onSelectLanguage);
  }
});
