// Import rpc to provide JSON-RPC bridge to Coins
var rpc = require('bitcoin');
const util = require('./util.js');

function sendToAddress (coin, address, amount, onSuccess, onError){
	var client = new rpc.Client({
		port: coin.rpc.port,
		host: coin.rpc.hostname,
		user: coin.rpc.username,
		pass: coin.rpc.password
	});

	client.sendToAddress(address, amount, function(err, result) {
		if (err){
			onError(err);
		} else {
			try {
				client.getRawTransaction(result, 1, function(err, res){
					if (err){
						console.log(err);
						onSuccess(result)
					} else {
						console.log('\x1b[36m%s\x1b[0m', 'Sent ' + amount + ' ' + coin.currency_code + ' to ' + address);
						onSuccess(res);
					}
				})
			} catch (e) {
				onSuccess(result);
			}
		}
	})
}

function sendCoins (coin, currency, amount, address, onSuccess, onError){
	if (currency !== coin.currency_code){
		for (var currency_id in coin.currency_endpoints){
			if (currency = coin.currency_endpoints[currency_id].currency_code){
				util.getCurrencyValue(coin.currency_endpoints[currency_id], function(currency_value_per_coin){
					var paymentAmount = amount / currency_value_per_coin;

					sendToAddress(coin, address, paymentAmount, onSuccess, onError);
				}, function (error){
					onError(error)
				})
			}
		}
	} else {
		// The currency submitted is the same as the coin currency code
		sendToAddress(coin, address, amount, onSuccess, onError);
	}
}

function trySend (coin, type, db_title, address, db, req, res){
	try {
		sendCoins(coin, coin[type].currency, coin[type].amount, address, function(success){
			db.get(db_title).push({
				"timestamp": Date.now(),
				"currency_code": req.body.currency_code,
				"address": req.body.depositAddress,
				"amount": coin[type].amount,
				"ip": req.ip,
				"txid": success.txid, 
				"status": "sent_successfully"
			}).write();

			res.send(JSON.stringify({
				"success": true,
				"info": success
			}))
		}, function(error){
			console.log(error);
			res.send(JSON.stringify({
				"success": false,
				"error": error
			}))
		})
	} catch (error) {
		console.log(error);
		res.send(JSON.stringify({
			"success": false,
			"error": "ERROR_SENDING_COINS_TRY_AGAIN_LATER"
		}))
	}
}

module.exports = {
	trySend: trySend
}