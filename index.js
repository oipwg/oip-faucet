// Import express as webserver connection
var express = require('express');
// Import other express assets needed to parse JSON from POST's
var bodyParser = require('body-parser');
var multer = require('multer');
// Import reCaptcha2 for Faucet Verification of a human.
var reCAPTCHA = require('recaptcha2');

// Import our JSON-RPC bridge helper stuff
var coinRPC = require('./coinRPC.js');
// Import the local config file with our Faucet settings.
var config = require('./config.js');
// Import the util file
var util = require('./util.js');

const MINUTES = 60;
const SECONDS = 60;
const MILISECONDS = 1000;

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

// In order to validate recaptcha submissions, we need to start up a new instance containing our siteKey and secretKey.
var recaptcha = new reCAPTCHA({
	siteKey: config.recaptcha2.site_key,
	secretKey: config.recaptcha2.secret_key,
})

// Start up the "app" (webserver)
var app = express()

// Setup middleware
// for parsing multipart/form-data
var upload = multer();
// for parsing application/json
app.use(bodyParser.json()); 
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true })); 


// Listen to connections on "http://faucet:port/"
// Respond with a status of being online.
app.get('/', function(req, res){
	res.send(JSON.stringify({
		status: "online"
	}));
})

// Listen to conenctions on "http://faucet:port/faucet"
app.post('/faucet', upload.array(), function (req, res) {
	// Make sure that we have body values
	if (req.body){
		if (req.body.currency_code){
			// Create variable to track if the user submitted currency_code is supported
			var currency_code_match = false;
			var selected_coin = "";

			for (var coin in config.coins){
				// Check in each coin to see if the currency_code matches.
				if (config.coins[coin].currency_code === req.body.currency_code){
					// If it does match, set the variable to true
					selected_coin = coin;
					currency_code_match = true;
				}
			}

			// Check to make sure that the currency_code is supported
			if (currency_code_match){
				// Check to make sure the user submitted a depositAddress
				if (req.body.depositAddress){
					// Check to see if the address is valid based on the network info of the selected_coin.
					var validAddress = util.isValidAddress(req.body.depositAddress, config.coins[selected_coin].network);

					// Make sure the address is valid
					if (validAddress){
						// Check to make sure the user submitted a recaptcha2 response
						if (req.body.recaptcha2){
							recaptcha.validate(req.body.recaptcha2)
								.then(function(){
									// validated and secure
									// Make sure that the type is defined as either "one_time" || "interval"
									if (req.body.type){
										if (req.body.type === "one_time"){
											if (config.coins[selected_coin].send_once.enabled){
												var find_ip = db.get('one_time').filter({ ip: req.ip, currency_code: req.body.currency_code }).value();

												if (!find_ip){
													coinRPC.trySend(config.coins[selected_coin], "send_once", "one_time", req.body.depositAddress, db, req, res);
												} else {
													res.send(JSON.stringify({
														success: false,
														error: "ONE_TIME_ALREADY_RECEIVED"
													}))
												}
											} else {
												res.send(JSON.stringify({
													success: false,
													error: "SEND_ONCE_NOT_ENABLED"
												}))
											}
										} else if (req.body.type === "interval") {
											if (config.coins[selected_coin].send_on_interval.enabled){
												var timestampInterval = config.coins[selected_coin].send_on_interval.interval_hrs * MINUTES * SECONDS * MILISECONDS;

												var find_ip = db.get('interval').find(function(o) {
													if (o.ip === req.ip && o.currency_code === req.body.currency_code){
														if (Date.now() < o.timestamp + timestampInterval)
															return true;
														else 
															return false;
													} else
														return false;
												}).value();

												if (!find_ip){ 
													coinRPC.trySend(config.coins[selected_coin], "send_on_interval", "interval", req.body.depositAddress, db, req, res);
												} else {
													// User submitted an invalid faucet type
													res.send(JSON.stringify({
														success: false,
														error: "ALREADY_RECEIVED_INTERVAL_FOR_NOW",
														try_again_at: find_ip.timestamp + timestampInterval
													}))
												}
											} else {
												res.send(JSON.stringify({
													success: false,
													error: "SEND_ON_INTERVAL_NOT_ENABLED"
												}))
											}
										} else {
											// User submitted an invalid faucet type
											res.send(JSON.stringify({
												success: false,
												error: "FAUCET_TYPE_IS_INVALID"
											}))
										}
									} else {
										// User did not include a faucet type ("one_time" || "interval")
										res.send(JSON.stringify({
											success: false,
											error: "FAUCET_TYPE_IS_REQUIRED"
										}))
									}
								}).catch(function(errorCodes){
									// Recaptcha2 is invalid
									var error = recaptcha.translateErrors(errorCodes); // translate error codes to human readable text
									console.log(error);
									res.send(JSON.stringify({
										success: false,
										error: "RECAPTCHA2_IS_INVALID",
										details: error
									}))
								});	
						} else {
							// User did not include a recaptcha code.
							res.send(JSON.stringify({
								success: false,
								error: "RECAPTCHA2_SUBMISSION_IS_REQUIRED"
							}))
						}
					} else {
						// User did not submit a valid address.
						res.send(JSON.stringify({
							success: false,
							error: "DEPOSIT_ADDRESS_IS_INVALID"
						}))
					}
				} else {
					// User did not specify where they want their faucet funds to be sent.
					res.send(JSON.stringify({
						success: false,
						error: "DEPOSIT_ADDRESS_IS_REQUIRED"
					}))
				}
			} else {
				// User did not specify where they want their faucet funds to be sent.
				res.send(JSON.stringify({
					success: false,
					error: "CURRENCY_CODE_NOT_SUPPORTED"
				}))
			}
		} else {
			// User did not include what kind of currency they want from the faucet, reject them.
			res.send(JSON.stringify({
				success: false,
				error: "CURRENCY_CODE_IS_REQUIRED"
			}))
		}
	} else {
		// We have no body values, error out and tell the user to submit them.
		res.send(JSON.stringify({
			success: false,
			error: "CURRENCY_CODE__DEPOSIT_ADDRESS_AND_RECAPTCHA2_ARE_REQUIRED"
		}))
	}
})

app.listen(config.port, function(){
	console.log("Listening on http://127.0.0.1:" + config.port)
});