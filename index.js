const path = require('path');
const helmet = require('helmet');
const express = require('express');
const countapi = require('countapi-js');
const compression = require('compression');
const fetch = require('node-fetch');
var moment = require('moment');

const app = express();
app.use(helmet());
app.use(compression());
app.use(express.static('public'));
app.set('json spaces', 2);

const COUNTAPI = {
  NAMESPACE: process.env.COUNTAPI_NAMESPACE || 'not-wordle-just-github',
  KEY: process.env.COUNTAPI_KEY || 'grids-generated',
};

function zip(arrays) {
  return arrays[0]
    .map((_, i) => arrays.map((array) => array[i]).join(''))
    .join('\n');
}

function createGrid(contributions) {
  return zip([
    contributions.splice(0, 6),
    contributions.splice(0, 6),
    contributions.splice(0, 6),
    contributions.splice(0, 6),
    contributions.splice(0, 6),
  ]);
}

app.get('/api', (req, res) => {
  if (!req.query.username.trim()) res.send('Enter a GitHub username.');
  fetch(`https://github-contributions.vercel.app/api/v1/${req.query.username}`)
    .then((response) => response.json())
    .then((json) => {
      if (!json.contributions.length) throw new Error('Invalid Username');
      const past = moment().subtract(30, 'days').format('YYYY-MM-DD');
      const contributions = json.contributions
        .filter((c) => c.date > past)
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .slice(0, 30)
        .map((c) => (c.count ? '🟩' : '⬜️'));
      countapi
        .hit(COUNTAPI.NAMESPACE, COUNTAPI.KEY)
        .catch((e) => console.error(e));
      res.send(
        'Not Wordle, just my GitHub contributions activity\n\n' +
          createGrid(contributions)
      );
    })
    .catch((e) => {
      console.error(e);
      res.send(e.message);
    });
});

app.get('/api/stats', (req, res) => {
  countapi
    .info(COUNTAPI.NAMESPACE, COUNTAPI.KEY)
    .then((result) => {
      res.send({ grids_generated: result.value });
    })
    .catch((e) => {
      console.error(e);
      res.status(503).json({ error: 'Service Unavailable' });
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'));
});

app.get('*', (req, res) => {
  res.redirect('/');
});

app.listen(process.env.PORT || 3000);
