// Import rpc to provide JSON-RPC bridge to Coins
var rpc = require('bitcoin');

var sendCoins = function(rpcInfo, amount, address, onSuccess, onError){
	var client = new rpc.Client({
		port: rpcInfo.port,
		host: rpcInfo.hostname,
		user: rpcInfo.username,
		pass: rpcInfo.password
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
						onSuccess(res);
					}
				})
			} catch (e) {
				onSuccess(result);
			}
		}
	})
}

module.exports = {
	sendCoins: sendCoins
}