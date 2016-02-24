Wiki Battle! - [battle.schlosser.io](http://battle.schlosser.io)
================================================================

Wiki Battle! answers a question we've all been wondering, even if we didn't know it yet: _In what language are Wikipedia contributors getting fired up right now?_

## About

Inspired by [Listen to Wikipedia, by Hatnote][hatnote], Wiki Battle! uses a live stream of Wikipedia edits to compare how fired up Wikipedia contributors are getting in each language.

Head over to [battle.schlosser.io](http://battle.schlosser.io), choose two languages, and let the battle it out.  Wiki Battle! will let you know in which language contributors are getting more fired up.

### Getting the data.

Hatnote's Listen to Wikipedia is [open source][hatnote-github], and this source [includes a list of 36 websocket URLs][hatnote-github-js] that publish new Wikipedia edits in different languages, all in JSON format.

For this project, I'm not acutally using any of the data itself, rather the message and the time it was received is of interest to me.

### Determining a winner

When comparing two languages, I was interested in which language community was more abnormally active.  To do this, I couldn't just compare the frequency of edits: some languages (e.g. English) have many more edits happening per day than others (e.g. Polish), and so this wouldn't be a compelling comparison.  Instead, I bucket edits into second-long buckets, and count the number of edits per second. Then, I compute a moving average and standard deviation over all data recorded so far of how many edits are happening per second in that language. For each new bucket size data point, I compute a "score" of that data point, which is the deviation from the average:

```js
// From: src/js/battle.js:Contender.prototype.computeStatistics
var score = (datasetStdDev === 0) ? 0 : (newCount - datasetAverage) / datasetStdDev;
```

If the standard deviation is zero, then the score is zero, otherwise, it's the differnce between the new count (bucket size) and the dataset average divided by the standard deviation.  If a point is 2 standard deviations above the mean, then the score is 2.

Then, I compute a moving average of the latest 20 (or fewer to start) scores, and call that the total score.  The total score is meant to represent how active the contributor community is in the given language compared to normal. 

The total score of each language is compared, the language with the larger total score is said to be the winner.  The winner is recomputed every second, with every new bucket size data point.

### Possible flaws

There are two flaws with this approach:  First, many languages have 0 edits per second, for many seconds in a row.  This can make comparisons less interesting.  Negative total scores are possible, so comparing an active community with an extremely inactive community is less compelling.

Second, no historical data is being used.  Every time the user selects to languages, a new battle is started and new data is recorded.  The entire application is written in JavaScript, so there is no server to store data across page reloads.

# Code

With one command, build a static page using Websockets, [Gulp][gulp], [Handlebars.js][handlebars], and [SCSS][scss].

## Files of interest

Much of the code in this repository is for styling and animating the webapp.  The interesting computation and state management happens in `src/js/battle.js`, and all UI interactions being managed by `src/js/app.js`.  All other files are either HTML template (written in the `.hbs` [Handlebars.js][handlebars] format) or stylesheets.

## Setup

Install [npm][npm-install]. Then, install gulp:

```
npm install -g gulp  # May require `sudo`
```

## Developing

```
npm install
gem install scss_lint
gulp serve
```

## Gulp Commands

An overview of Gulp commands available:

### `gulp build`

Builds the site into the `dist` directory.  This includes:

- SCSS w/ linting, sourcemaps and autoprefixing
- JS linting, uglification, and ES6 to ES5 conversion
- Handlebars to HTML

### `gulp build:optimized`

This is used for distributing an optimized version of the site (for deployment).  It includes everything from `gulp build` as well as:
- SCSS minification
- CSS / JS inline-sourcing 

### `gulp watch`

Watchs for changes in local files and rebuilds parts of the site as necessary, into the `dist` directory.

### `gulp serve`

Runs `gulp watch` in the background, and serves the `dist` directory at `localhost:3000` with automatic reloading using [Browsersync][browsersync].

### `gulp deploy`

For use by the Minimill team only.  Deploys to `work.minimill.co/TITLE/`, but won't do so without proper authentication.

## Structure

```
├── Gulpfile.js       # Controls Gulp, used for building the website
├── README.md         # This file
├── data.yml          # Metadata associated with the site.
├── dist/             # Gulp builds the static site into this directory
├── package.json      # Dependencies
└── src/              # All source code
    ├── font/         # Font files
    ├── img/          # Images and SVGs
    ├── js/           # Javascript libraries and scripts
    ├── partials/     # Handlebars HTML partials that are included / extended
    ├── sass/         # Stylesheets
    └── templates/    # Handlebars HTML files, one per page on the site.
```

[autoprefixer]: https://css-tricks.com/autoprefixer/
[bable]: https://babeljs.io/
[browsersync]: http://www.browsersync.io/
[cssmin]: https://github.com/ben-eb/cssnano
[es6]: https://github.com/lukehoban/es6features
[gulp]: http://gulpjs.com/
[hatnote]: http://listen.hatnote.com/
[hatnote-github]: https://github.com/hatnote/listen-to-wikipedia/
[hatnote-github-js]: https://github.com/hatnote/listen-to-wikipedia/blob/master/static/index.html#L86
[handlebars]: http://handlebarsjs.com/
[htmlmin]: https://github.com/kangax/html-minifier
[imagemin]: https://github.com/imagemin/imagemin
[jscs]: http://jscs.info/
[jshint]: http://jshint.com/
[linting]: https://en.wikipedia.org/wiki/Lint_%28software%29
[npm-install]: https://nodejs.org/en/download/
[uglifyjs]: https://github.com/mishoo/UglifyJS
[scss]: http://sass-lang.com/
[scss-lint]: https://github.com/brigade/scss-lint
