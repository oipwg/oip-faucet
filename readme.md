# OIP-Faucet
This faucet is written in Node.js using Express, and connects to the coins via JSON-RPC.

## Installation
todo...

## Config
Take a look inside `config.js` there you will find a way to add new coins, or modify this for your current coin. To add a new coin, just add another JSON object to `config.coins`.

## Interaction
This faucet is built as an API layer tool. It does not have a user interface bundled with it currently. You can interact with this API layer as such below.

### HTTP Endpoint
POST to `http://faucet:9090/faucet` with the following data:
```javascript
{
	"type": "one_time" || "interval",
	"currency_code": "FLO",
	"depositAddress": "FLOAddress",
	"recaptcha2": "recaptcha2 data"
}
```