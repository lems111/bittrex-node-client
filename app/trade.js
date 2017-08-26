const bittrex = require('node.bittrex.api'),
    config = require('../config')(process.env.CONFIG);

bittrex.options(config.bittrex);

module.exports = {
    getOpenedOrders: function(ticker) {
        return new Promise(function(resolve, reject) {
            bittrex.getopenorders({market: ticker}, function(orders) {
                resolve(orders);
            });
        })
    },
    getBalances: function() {
        return new Promise(function(resolve, reject) {
            bittrex.getbalances(function(balances) {
                resolve(balances);
            });
        })
    },
    buyLimit: function(options) {
        return new Promise(function(resolve, reject) {
            bittrex.buylimit(function(options, balances) {
                resolve(balances);
            });
        })
    }
}