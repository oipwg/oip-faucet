// Import express as webserver connection
var express = require('express');
// Import other express assets needed to parse JSON from POST's
var bodyParser = require('body-parser');
var multer = require('multer');

// Import the local config file with our Faucet settings.
var config = require('./config.js');

// Import the Faucet Processor
var FaucetProcesser = require('./FaucetProcesser.js');

// Import lowdb for database handling
const low = require('lowdb')
// FileSync will provide us with a way to save our db to a file
const FileSync = require('lowdb/adapters/FileSync')
// Here we setup the db file
const adapter = new FileSync('db.json')
// And again, finishing the db setup
const db = low(adapter);

// Setup database defaults
db.defaults({ one_time: [], interval: [] }).write();

// Start up the "app" (webserver)
var app = express()

// Setup middleware
// for parsing multipart/form-data
var upload = multer();
// for parsing application/json
app.use(bodyParser.json()); 
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true })); 

// CORS stuff
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Listen to connections on "http://faucet:port/"
// Respond with a status of being online.
app.get('/', function(req, res){
	res.send({
		status: "online"
	});
})

app.post('/check', upload.array(), function(req, res){
	var check = new FaucetProcesser(req, db);

	check.validate(function(info){
		res.send({
			success: true,
			info: info
		})
	}, function(error, detail){
		res.send({
			success: false,
			error: error,
			detail: detail
		})
	})
})

// Listen to conenctions on "http://faucet:port/faucet"
app.post('/request', upload.array(), function (req, res) {
	var trySend = new FaucetProcesser(req, db);

	trySend.process(function(info){
		res.send({
			success: true,
			info: info
		})
	}, function(error, detail){
		res.send({
			success: false,
			error: error,
			detail: detail
		})
	})
})

app.listen(config.port, function(){
	console.log("Listening on http://127.0.0.1:" + config.port)
});