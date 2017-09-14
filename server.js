// modules
var express = require('express'),
    app = express(),
    router = express.Router(),
    bodyParser = require('body-parser'),
    config = require('./config')(process.env.CONFIG),
    server = require('http').createServer(app),
    io = require('socket.io')(server),
    port = process.env.PORT || 3000,
    _ = require('lodash'),
    bittrex = require('node-bittrex-api'),
    trade = require('./app/trade.js');
const { Console } = require('console'),
    fs = require("fs"),
    output = fs.createWriteStream('./console.log'),
    logger = new Console(output);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }))
app.use(express.static(__dirname + '/node_modules'));
app.use(express.static(__dirname + '/app/public'));
app.get('*', function(req, res) {
    res.sendFile(__dirname + '/app/public/index.html'); // load our public/index.html file
});

io.on('connection', function(client) {
    logMessage('Client connected...');

    client.on('accountInfo', function() {
        var accountData = null;
        trade.getOrderhistory().then(function(orders) {
            if (orders && orders.success && !_.isEmpty(orders.result))
                accountData = orders.result;
            client.emit('accountData', accountData);
        }).catch(function(err) {
            logMessage('accountInfo err: ' + JSON.stringify(err, null, 4));
            client.emit('accountData', null);
        });
    });

    client.on('join', function(data) {
        logMessage('joined client, data: ' + JSON.stringify(data, null, 4));
        if (data && data.apiKey && data.apiSecret) {
            config.bittrex.apikey = data.apiKey;
            config.bittrex.apisecret = data.apiSecret;
            bittrex.options(config.bittrex);
        }
    });

    client.on('marketStatus', function() {
        bittrex.websockets.client(function() {
            console.log('Websocket connected');
            bittrex.websockets.listen(function(data) {
                if (data.M === 'updateSummaryState') {
                    data.A.forEach(function(data_for) {
                        if (data_for && !_.isEmpty(data_for.Deltas))
                            client.emit('markets', data_for.Deltas);
                        else
                            client.emit('markets', null);
                    });
                }
            });
        });
    })

    client.on('ticker', function(tickers) {
        if (!_.isEmpty(tickers)) {
            _.forEach(tickers, function(value) {
                var res = { ticker: value };
                bittrex.getticker({ market: value }, function(ticker) {
                    if (ticker && ticker.result) {
                        var marketName;
                        res.price = ticker.result.Last;
                        res.bid = ticker.result.Bid;
                        res.ask = ticker.result.Ask;
                        if (value.startsWith('BTC'))
                            marketName = 'USDT-BTC';
                        else if (value.startsWith('ETH'))
                            marketName = 'USDT-ETH';

                        bittrex.getticker({ market: marketName }, function(ticker) {
                            if (ticker.result) {
                                res.usdPrice = ticker.result.Last;
                                client.emit('ticker', res);
                            } else client.emit('ticker', null);
                        })
                    }
                });
            });
        }
    });

    client.on('trade', function(data) {
        var tradeStatus = {};
        logMessage('trade: ' + JSON.stringify(data, null, 4));
        if (data) {
            trade.getOpenedOrders(data.marketName).then(function(orders) {
                logMessage('orders: ' + JSON.stringify(orders, null, 4));
                // 1. if there are orders, there must be a trade active already
                if (orders && orders.success && !_.isEmpty(orders.result)) {
                    if (orders.result.length > 1)
                        logMessage('ALERT - ' + orders.result);
                    tradeStatus.status = 'active';
                    tradeStatus.order = orders.result[0];
                    return null;
                } else
                    return trade.getBalances();
            }).then(function(balances) {
                if (_.isEmpty(tradeStatus)) { // only proceed in here, if there wasn't any action yet
                    logMessage('balances: ' + JSON.stringify(balances, null, 4));
                    // 2. Check if there are coins already - there must have been a buy order, sell!
                    if (balances.success && !_.isEmpty(balances.result)) {
                        const coin = _.find(balances.result, ['Currency', data.currency]);
                        if (!_.isEmpty(coin) && coin.Balance) {
                            if (coin.Balance == coin.Available) {
                                logMessage('sell - coin: ' + JSON.stringify(coin, null, 4));
                                tradeStatus.status = 'pendingSell';
                                return trade.sellLimit({ market: data.marketName, quantity: data.tradeUnits, rate: data.sellRate });
                            } else {
                                tradeStatus.status = 'pendingTrans';
                                tradeStatus.coin = coin;
                                return null;
                            }
                        } else {
                            if (data.marketName.startsWith('BTC') || data.marketName.startsWith('ETH')) {
                                const currency = (data.marketName.startsWith('BTC')) ? 'BTC' : 'ETH',
                                    money = _.find(balances.result, ['Currency', currency]);
                                logMessage('money: ' + JSON.stringify(money, null, 4));
                                // Only buy if there is enough money
                                if (money && money.Available >= data.buyCost) {
                                    if (data.status !== 'pendingBuy') { // only proceed, if there isn't a pending buy
                                        tradeStatus.status = 'pendingBuy';
                                        return trade.buyLimit({ market: data.marketName, quantity: data.tradeUnits, rate: data.buyRate });
                                    } else {
                                        tradeStatus.status = 'pendingTrans';
                                        tradeStatus.coin = coin;
                                        return null;
                                    }
                                } else {
                                    tradeStatus = { status: 'error', msg: 'not enough funds in ' + currency };
                                    return null;
                                }
                            } else {
                                tradeStatus = { status: 'error', msg: 'unknown currency' };
                                return null;
                            }
                        }
                    } else {
                        tradeStatus = { status: 'error', msg: 'there are no funds in your account' };
                        return null;
                    }
                } else return null;
            }).then(function(tradeRes) {
                if (!_.isEmpty(tradeStatus) && (tradeStatus.status === 'pendingSell' || tradeStatus.status === 'pendingBuy')) {
                    logMessage('tradeRes: ' + JSON.stringify(tradeRes, null, 4));
                    if (tradeRes && tradeRes.success && !_.isEmpty(tradeRes.result)) {
                        tradeStatus.msg = 'success - order pending, uuid: ' + tradeRes.result.uuid;
                        client.emit('tradeStatus', tradeStatus);
                    } else
                        client.emit('tradeStatus', { status: 'error', msg: 'failed placing buying order' });
                } else {
                    logMessage('tradeStatus: ' + JSON.stringify(tradeStatus, null, 4));
                    client.emit('tradeStatus', tradeStatus);
                }
            }).catch(function(err) {
                logMessage('trade err: ' + JSON.stringify(err, null, 4));
                client.emit('tradeStatus', null);
            });
        } else
            client.emit('tradeStatus', { status: 'info', msg: 'ready to trade' });
    });

    client.on('cancelTrade', function(data) {
        var tradeStatus = {};
        logMessage('cancelTrade: ' + JSON.stringify(data, null, 4));

        trade.getOpenedOrders(data.marketName).then(function(orders) {
            logMessage('orders: ' + JSON.stringify(orders, null, 4));
            // 1. if there are orders, there must be a trade active already
            if (orders && orders.success && !_.isEmpty(orders.result)) {
                if (orders.result.length > 1)
                    logMessage('ALERT - ', orders.result);
                tradeStatus.status = 'cancelling';
                return trade.cancel({ uuid: orders.result[0].OrderUuid });
            } else { // we should check our wallet, in case that our buy order was already completed and there are coins that should be sold
                tradeStatus.status = 'balance';
                return trade.getBalances();
            }
        }).then(function(resp) {
            if (tradeStatus.status === 'cancelling') {
                logMessage('cancelled: ' + JSON.stringify(resp, null, 4));
                // 2. Check if there are coins already - there must have been a buy order, sell!
                if (resp && resp.success) {
                    tradeStatus = { status: 'info', msg: 'cancelled order...ready to trade' };
                    client.emit('tradeStatus', tradeStatus);
                } else {
                    tradeStatus = { status: 'error', msg: 'failed to cancel order' };
                    client.emit('tradeStatus', tradeStatus);
                }
            } else if (tradeStatus.status === 'balance') { // only proceed in here, if there wasn't any action yet
                logMessage('balances: ' + JSON.stringify(resp, null, 4));
                // 2. Check if there are coins already - there must have been a buy order, sell!
                if (resp.success && !_.isEmpty(resp.result)) {
                    const coin = _.find(resp.result, ['Currency', data.currency]);
                    if (!_.isEmpty(coin) && coin.Balance) {
                        tradeStatus.status = 'pendingTrans';
                        tradeStatus.coin = coin;
                    } else {
                        logMessage('coin: ' + JSON.stringify(coin, null, 4));
                        tradeStatus = { status: 'info', msg: 'no open orders...ready to trade' };
                    }
                } else
                    tradeStatus = { status: 'info', msg: 'no open orders...ready to trade' };
            } else
                tradeStatus = { status: 'info', msg: 'no open orders...ready to trade' };
            client.emit('tradeStatus', tradeStatus);
        }).catch(function(err) {
            logMessage('trade err: ' + JSON.stringify(err, null, 4));
            client.emit('tradeStatus', null);
        });
    });
})

server.listen(port);

function logMessage(msg) {
    const timestamp = new Date().toISOString();
    logger.log(timestamp + ' - ' + msg);
}