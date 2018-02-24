// Import reCaptcha2 for Faucet Verification of a human.
var reCAPTCHA = require('recaptcha2');

// Import our JSON-RPC bridge helper stuff
var coinRPC = require('./coinRPC.js');
// Import the util file
var util = require('./util.js');

// Import the local config file with our Faucet settings.
var config = require('./config.js');

var recaptcha = new reCAPTCHA({
	siteKey: config.recaptcha2.site_key,
	secretKey: config.recaptcha2.secret_key,
})

const MINUTES = 60;
const SECONDS = 60;
const MILISECONDS = 1000;

module.exports =
class FaucetProcesser {
	constructor(req, db) {
		this.options_ = req.body;
		this.ip_ = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		this.req_ = req;
		this.db_ = db;
	}

	validate(onSuccess, onError){
		var _this = this;
		
		this.getCoinFromConfig(function(coin){
			_this.coin_ = coin;

			_this.validAddressForCoin(function(valid){
				_this.checkDatabase(onSuccess, onError)
			}, onError)
		}, onError)
	}

	process(onSuccess, onError){
		var _this = this;

		this.validate(function(valid){
			_this.validateRecaptcha(function(valid){
				_this.sendCoins(onSuccess, onError)
			}, onError)
		}, onError)
	}

	getCoinFromConfig(onSuccess, onError){
		var match = false;

		for (var coin in config.coins){
			// Check in each coin to see if the currency_code matches.
			if (config.coins[coin].currency_code === this.options_.currency_code){
				match = true;
				onSuccess(config.coins[coin]);
			}
		}

		if (!match) {
			onError("Selected Currency (" + this.options_.currency_code + ") Not Supported")
		}
	}

	validAddressForCoin(onSuccess, onError){
		var valid = util.isValidAddress(this.options_.depositAddress, this.coin_.network);

		if (valid) {
			onSuccess(true);
		} else {
			onError("Invalid " + this.coin_.currency_code + " Address.");
		}
	}

	validateRecaptcha(onSuccess, onError){
		if (config.recaptcha2.enabled) {
			console.log("Recaptcha Test");
			recaptcha.validate(this.options_.recaptcha2)
			.then(onSuccess)
			.catch(function(errorCodes){
				// Recaptcha2 is invalid
				var error = recaptcha.translateErrors(errorCodes); // translate error codes to human readable text

				onError("RECAPTCHA2_IS_INVALID", error);
			});	
		} else {
			console.log("bypass");
			onSuccess(true)
		}
	}

	checkDatabase(onSuccess, onError){
		if (this.options_.type === "one_time"){
			if (this.coin_.send_once.enabled){
				var find_ip = this.db_.get('one_time').filter({ ip: this.ip_, currency_code: this.options_.currency_code }).value();
				var same_address = this.db_.get('one_time').filter({ address: this.options_.depositAddress }).value();

				if (find_ip.length === 0 && same_address.length === 0){
					onSuccess(true)
				} else if (this.coin_.send_once.restrict_ip === false) {
					onSuccess(true)
				} else {
					onError("one_time already used on this IP!")
				}
			} else {
				onError("one_time not enabled")
			}
		} else if (this.options_.type === "interval") {
			if (this.coin_.send_on_interval.enabled){
				var timestampInterval = this.coin_.send_on_interval.interval_hrs * MINUTES * SECONDS * MILISECONDS;

				var ip = this.ip_;
				var options = this.options_;

				var find_ip = this.db_.get('interval').find(function(o) {
					if ((o.ip === ip && o.currency_code === options.currency_code) || o.address === options.depositAddress){
						if (Date.now() < o.timestamp + timestampInterval)
							return true;
						else 
							return false;
					} else
						return false;
				}).value();

				var find_address = this.db_.get('interval').find(function(o) {
					if (o.address === options.depositAddress){
						if (Date.now() < o.timestamp + timestampInterval)
							return true;
						else 
							return false;
					} else
						return false;
				}).value();

				if (!find_ip && !find_address){
					onSuccess(true)
				} else if ((!find_ip && this.coin_.send_on_interval.restrict_address === false) || (!find_address && this.coin_.send_on_interval.restrict_ip === false) || (this.coin_.send_on_interval.restrict_ip === false && this.coin_.send_on_interval.restrict_address === false)) {
					onSuccess(true)
				} else {
					onError("interval already used on this IP/address for this period!")
				}
			} else {
				onError("interval not enabled")
			}
		} else {
			onError("You must set `type` to either 'one_time' or 'interval'");
		}
	}

	sendCoins(onSuccess, onError){
		var db_title = "";
		var obj_name = "";

		if (this.options_.type === "one_time"){
			db_title = "one_time";
			obj_name = "send_once";
		} else if (this.options_.type === "interval"){
			db_title = "interval";
			obj_name = "send_on_interval";
		}

		var _this = this;

		coinRPC.trySend(this.coin_, obj_name, this.options_.depositAddress, function(success){
			_this.db_.get(db_title).push({
				"timestamp": Date.now(),
				"currency_code": _this.options_.currency_code,
				"address": _this.options_.depositAddress,
				"amount": _this.coin_[obj_name].amount,
				"currency": _this.coin_[obj_name].currency,
				"ip": _this.ip_,
				"txid": success.txid, 
				"status": "sent_successfully"
			}).write();

			onSuccess(success)
		}, onError);
	}
}