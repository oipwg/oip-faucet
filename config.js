var passwords = require("./passwords.json");

if (!passwords.recaptcha2 && !passwords.coins){
	var fs = require('fs');

	fs.createReadStream('passwords.example.json').pipe(fs.createWriteStream('passwords.json'));
	new Error("Please fill out passwords.json then restart the application!");
}

module.exports = {
	"port": 9090,
	"recaptcha2": {
		"site_key": passwords.recaptcha2.site_key,
		"secret_key": passwords.recaptcha2.secret_key
	},
	"coins": {
		"florincoin": {
			"currency_code": "FLO",
			"rpc": {
				"hostname": "localhost",
				"port": "18332",
				"username": passwords.coins.florincoin.rpc.username,
				"password": passwords.coins.florincoin.rpc.password
			},
			"send_once": {
				"enabled": true,
				"amount": 1,
				"currency": "FLO"
			},
			"send_on_interval": {
				"enabled": true,
				"interval_hrs": 24,
				"amount": 0.005,
				"currency": "USD"
			},
			"currency_endpoints": {
				"usd": {
					"currency_code": "USD",
					"api_endpoint": "https://api.coinmarketcap.com/v1/ticker/florincoin/",
					"transform_api_data": function(api_data){
						if (api_data && api_data[0] && api_data[0].price_usd){
							return parseFloat(api_data[0].price_usd);
						} else {
							return -1;
						}
					}
				}
			},
			"network": {
				"pubKeyHash": 35,
				"scriptHash": 8
			}
		}
	}
}