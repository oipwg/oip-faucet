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

	console.log(coin.wallet, amount, address);

	var callback = async function(err, result) {
		if (err){
			console.log("Error sending from faucet!", err);
			onError("Error Sending From faucet", err);
		} else {
			try {
				// Wait a bit...
				await async function (){ let res = Promise.resolve; setTimeout(function(){res()}, 100) }

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
	}

	if (coin.wallet === ""){
		console.log("Send To Address")
		client.sendToAddress(address, amount, callback)
	} else {
		console.log("Send From " + coin.wallet + " To Address")
		client.sendFrom(coin.wallet, address, amount, callback)
	}
}

function sendCoins (coin, currency, amount, address, onSuccess, onError){
	if (currency !== coin.currency_code){
		for (var currency_id in coin.currency_endpoints){
			if (currency = coin.currency_endpoints[currency_id].currency_code){
				util.getCurrencyValue(coin.currency_endpoints[currency_id], function(currency_value_per_coin){
					var paymentAmount = amount / currency_value_per_coin;

					paymentAmount = parseFloat(paymentAmount.toFixed(8));

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

function trySend (coin, type, address, onSuccess, onError){
	try {
		sendCoins(coin, coin[type].currency, coin[type].amount, address, onSuccess, onError)
	} catch (error) {
		onError("Error sending coins, try again later...")
	}
}

module.exports = {
	trySend: trySend
}