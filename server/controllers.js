const axios = require('axios');
const Clarifai = require('clarifai');
const helpers = require('./helpers');

if (process.env.NODE_ENV !== 'production') {
  var Keys = require('./keys/keys');
}
const Shop = require('node-shop.com').initShop({apikey: process.env.SHOP_KEY || Keys.shopAPI});

const clarifai = new Clarifai.App(
	process.env.CLARIFAI_ID || Keys.clarifai_id,
	process.env.CLARIFAI_SECRET || Keys.clarifai_secret
);

var State = function() {
	completed: 0,
	concepts: []
}

const controllers = {
	state: {
		// completed: 0,
		// concepts: [],
		productMax: 3,
		threshold: 0.9,
		interval: 2000
	},
	instagramAPI: function(user) {
	  return new Promise((resolve, reject) => {
	    return axios.get(`https://www.instagram.com/${user}/media/`)
		    .then(res => {
		      let images = [];
		      for (let post of res.data.items) {
		        images.push({url: post.images.standard_resolution.url});
		      }
		      resolve(images);
		    })
		    .catch(err => reject("Error in instagramAPI():", err));
	  });
	},
	callShopAPI: function(userKeywords, response) {
		// this.state.completed = 0;
		// this.state.concepts = [];
	  Shop.search(userKeywords, {page: 5, count: 50})
	    .then(data => {
	    	console.log(`Sending ${data.searchItems.length} shop results to client`);
	      response.send(data.searchItems);
	    })
	    .catch(err => console.error("Error in callShopAPI():", err));
	},
	getResults: function(limit, client, state) {
		state.completed++;
    if (state.completed === limit) {
    	let countedConcepts = helpers.countConcepts(state.concepts);
      let sortedFrequency = this.getNamesAndFreqs(countedConcepts);
      let keywords = this.getKeywords(sortedFrequency);
      this.callShopAPI(keywords, client);
    }
  },
	getKeywords: function(sortedNames) {
		// get keywords from sorted list
    let keywords = '';
    for (let i = 0; i < this.state.productMax; i++) { 
    	let product = sortedNames[i];
      keywords += product.name;
      i < this.state.productMax - 1 ? keywords += ' ' : null;
    };
    return keywords;
	},
  getNamesAndFreqs: function(clarifaiResults) {
    let toSort = [];
    for (let key in clarifaiResults) {
      toSort.push({
        name: key,
        frequency: clarifaiResults[key]
      });
    }
		return toSort.sort((a,b) => b.frequency - a.frequency);
  },
	clarifaiPredict: function(url) {
		let threshold = this.state.threshold;
	  return clarifai.models.predict(Clarifai.GENERAL_MODEL, url)
	  	.then(res => {
	      let results = res.outputs[0].data.concepts;
        results.forEach(result => {
          if (result.value > threshold) this.state.concepts.push(result);
        });
	    });
	},
	prediction: function(images, limit, client, state) {	  
		Promise.all(images.map(img => this.clarifaiPredict(img.url)))
			.then(values => {
				this.getResults(limit, client, state);
	  }).catch(err => {
	  	console.log('There was an error (probably with the Clarifai API)!');
	  	client.status(500).send('An error occurred');
	  });
	},
	promiseWrapper: function(blocksOfTen, client) {
		var reqState = new State();
	  blocksOfTen.forEach((block, index) => {
	    setTimeout(() => {
	      this.prediction(block, blocksOfTen.length, client, reqState);
	    }, index * this.state.interval);
	  });
	}
}

module.exports = controllers;