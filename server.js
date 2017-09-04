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
    bittrex = require('node.bittrex.api'),
    trade = require('./app/trade.js');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }))
app.use(express.static(__dirname + '/node_modules'));
app.use(express.static(__dirname + '/app/public'));
app.get('*', function(req, res) {
    res.sendFile(__dirname + '/app/public/index.html'); // load our public/index.html file
});

io.on('connection', function(client) {
    console.log('Client connected...');

    client.on('join', function(data) {
        console.log('joined client', data);
        if (data && data.apiKey && data.apiSecret) {
            config.bittrex.apikey = data.apiKey;
            config.bittrex.apisecret = data.apiSecret;
            bittrex.options(config.bittrex);
        }
    });

    client.on('marketStatus', function() {
        var res, usdt_btc, usdt_eth, usd_volume;
        var websocketsclient = bittrex.websockets.listen(function(data) {
            if (data.M === 'updateSummaryState') {
                data.A.forEach(function(data_for) {
                    client.emit('markets', data_for);
                });
            }
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
        console.log('trade: ', data);
        if (data) {
            trade.getOpenedOrders(data.marketName).then(function(orders) {
                console.log('orders', orders);
                // 1. if there are orders, there must be a trade active already
                if (orders && orders.success && !_.isEmpty(orders.result)) {
                    if (orders.result.length > 1)
                        console.log('ALERT - ', orders.result);
                    tradeStatus.status = 'active';
                    tradeStatus.order = orders.result[0];
                    return null;
                } else
                    return trade.getBalances();
            }).then(function(balances) {
                if (_.isEmpty(tradeStatus)) { // only proceed in here, if there wasn't any action yet
                    console.log('balances:', balances);
                    // 2. Check if there are coins already - there must have been a buy order, sell!
                    if (balances.success && !_.isEmpty(balances.result)) {
                        const coin = _.find(balances.result, ['Currency', data.currency]);
                        if (!_.isEmpty(coin) && coin.Balance) {
                            if (coin.Balance == coin.Available) {
                                console.log('sell - coin: ', coin);
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
                                console.log('money: ', money);
                                // Only buy if there is enough money
                                if (money && money.Available >= data.buyCost) {
                                    tradeStatus.status = 'pendingBuy';
                                    return trade.buyLimit({ market: data.marketName, quantity: data.tradeUnits, rate: data.buyRate });
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
                if (_.isEmpty(tradeStatus)) { // only proceed in here, if there wasn't any action yet
                    console.log('tradeRes:', tradeRes);
                    if (tradeRes && tradeRes.success && !_.isEmpty(tradeRes.result)) {
                        tradeStatus.msg = 'success - order pending, uuid: ' + tradeRes.result.uuid;
                        client.emit('tradeStatus', tradeStatus);
                    } else
                        client.emit('tradeStatus', { status: 'error', msg: 'failed placing buying order' });
                } else {
                    console.log('tradeStatus: ', tradeStatus);
                    client.emit('tradeStatus', tradeStatus);
                }
            }).catch(function(err) {
                console.log('trade err:', err);
                client.emit('tradeStatus', null);
            });
        } else
            client.emit('tradeStatus', { status: 'info', msg: 'ready to trade' });
    });

    client.on('cancelTrade', function(data) {
        var tradeStatus = {};
        console.log('cancelTrade: ', data);

        trade.getOpenedOrders(data.marketName).then(function(orders) {
            console.log('orders', orders);
            // 1. if there are orders, there must be a trade active already
            if (orders && orders.success && !_.isEmpty(orders.result)) {
                if (orders.result.length > 1)
                    console.log('ALERT - ', orders.result);
                tradeStatus.status = 'cancelling';
                return trade.cancel({ uuid: orders.result[0].OrderUuid });
            } else { // we should check our wallet, in case that our buy order was already completed and there are coins that should be sold
                tradeStatus.status = 'balance';
                return trade.getBalances();
            }
        }).then(function(resp) {
            if (tradeStatus.status === 'cancelling') {
                console.log('cancelled:', resp);
                // 2. Check if there are coins already - there must have been a buy order, sell!
                if (resp && resp.success) {
                    tradeStatus = { status: 'info', msg: 'cancelled order...ready to trade' };
                    client.emit('tradeStatus', tradeStatus);
                } else {
                    tradeStatus = { status: 'error', msg: 'failed to cancel order' };
                    client.emit('tradeStatus', tradeStatus);
                }
            } else if (_tradeStatus.status === 'balance') { // only proceed in here, if there wasn't any action yet
                console.log('balances:', resp);
                // 2. Check if there are coins already - there must have been a buy order, sell!
                if (resp.success && !_.isEmpty(resp.result)) {
                    const coin = _.find(resp.result, ['Currency', data.currency]);
                    if (!_.isEmpty(coin) && coin.Balance) {
                        tradeStatus.status = 'pendingTrans';
                        tradeStatus.coin = coin;
                    } else {
                        console.log('coin: ', coin);
                        tradeStatus = { status: 'info', msg: 'no open orders...ready to trade' };
                    }
                } else
                    tradeStatus = { status: 'info', msg: 'no open orders...ready to trade' };
            } else
                tradeStatus = { status: 'info', msg: 'no open orders...ready to trade' };
            client.emit('tradeStatus', tradeStatus);
        }).catch(function(err) {
            console.log('trade err:', err);
            client.emit('tradeStatus', null);
        });
    });
})

server.listen(port);