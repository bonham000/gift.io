
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const controllers = require('./controllers');
const helpers = require('./helpers');
const app = express();

app.use(bodyParser.urlencoded({extended: true}) )
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/', 'index.html'));
});

app.post('/api/gift', (req, res) => {
  const { user } = req.body;
  console.log('Request received for ' + user);
  controllers.instagramAPI(user)
    .then(images => {
      controllers.promiseWrapper(helpers.getTen(images), res);
    }).catch(err => {
      res.status(404).send('Instagram username was not found!');
    });
});

const port = process.env.PORT || '7000';

app.listen(port, () => console.log('Clarifai App is running on port 7000'));
