const bittrex = require('node-bittrex-api'),
    config = require('../config')(process.env.CONFIG);

bittrex.options(config.bittrex);

module.exports = {
    getOrderhistory: function() {
        return new Promise(function(resolve, reject) {
            bittrex.getorderhistory(null, function(orders) {
                resolve(orders);
            });
        })
    },
    getMarkets: function() {
        return new Promise(function(resolve, reject) {
            bittrex.getmarkets(function(markets) {
                resolve(markets);
            });
        })
    },
    getMarketHistory: function() {
        return new Promise(function(resolve, reject) {
            bittrex.getmarkethistory({ market: marketName }, function(history) {
                resolve(history);
            });
        })
    },
    getMarketSummaries: function() {
        return new Promise(function(resolve, reject) {
            bittrex.getmarketsummaries(function(orders) {
                resolve(orders);
            });
        })
    },
    getOpenedOrders: function(marketName) {
        return new Promise(function(resolve, reject) {
            bittrex.getopenorders({ market: marketName }, function(orders) {
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
            bittrex.buylimit(options, function(res) {
                resolve(res);
            });
        })
    },
    sellLimit: function(options) {
        return new Promise(function(resolve, reject) {
            bittrex.selllimit(options, function(res) {
                resolve(res);
            });
        })
    },
    cancel: function(options) {
        return new Promise(function(resolve, reject) {
            bittrex.cancel(options, function(res) {
                resolve(res);
            });
        })
    }
}