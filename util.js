const bitcoin = require('bitcoinjs-lib')

function isValidAddress (address, network) {
	try {
		let dec = bitcoin.address.fromBase58Check(address)
		return dec.version === network.pubKeyHash || dec.version === network.scriptHash
	} catch (e) {
		return false
	}
}

module.exports = {
	isValidAddress: isValidAddress
}