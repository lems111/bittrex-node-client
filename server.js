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

bittrex.options(config.bittrex);

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
        console.log(data);
    });

    client.on('unsubscribe', function() {
        console.log('unsubscribing...');
        bittrex.websockets.client().end();
        console.log('disconnecting...')
        client.disconnect(true);
    });

    client.on('messages', function(tickers) {
        var websocketsclient = bittrex.websockets.subscribe(tickers, function(data) {
            if (data.M === 'updateExchangeState') {
                data.A.forEach(function(data_for) {
                    client.emit('broad', data_for);
                    console.log('Market Update for ' + data_for.MarketName, data_for);
                });
            }
        });

        //      client.broadcast.emit('broad',data);
        //client.broadcast.emit('broad',data);
    });

    client.on('ticker', function(tickers) {
        if (!_.isEmpty(tickers)) {
            _.forEach(tickers, function(value) {
                var res = { ticker: value };
                bittrex.getticker({ market: value }, function(ticker) {
                    res.price = ticker.result.Last;
                    if (value.startsWith('BTC')) {
                        bittrex.getticker({ market: 'USDT-BTC' }, function(ticker) {
                            res.usdPrice = ticker.result.Last;
                            client.emit('ticker', res);
                        })
                    } else if (value.startsWith('ETH')) {
                        bittrex.getticker({ market: 'USDT-ETH' }, function(ticker) {
                            res.usdPrice = ticker.result.Last;
                            client.emit('ticker', res);
                        })
                    }
                });
            });
        }


    });

    client.on('trade', function(data) {
        var tradeStatus = {};

        trade.getOpenedOrders(data.ticker).then(function(orders) {
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
                            return trade.sellLimit({ market: data.ticker, quantity: data.tradeUnits, rate: data.sellRate });
                        } else {
                            tradeStatus.status = 'pendingTrans';
                            tradeStatus.coin = coin;
                            return null;
                        }
                    } else {
                        if (data.ticker.startsWith('BTC') || data.ticker.startsWith('ETH')) {
                            const currency = (data.ticker.startsWith('BTC')) ? 'BTC' : 'ETH',
                                money = _.find(balances.result, ['Currency', currency]);
                            console.log('money: ', money);
                            // Only buy if there is enough money
                            if (money && money.Available >= data.buyCost) {
                                tradeStatus.status = 'pendingBuy';
                                return trade.buyLimit({ market: data.ticker, quantity: data.tradeUnits, rate: data.buyRate });
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
            } else
                client.emit('tradeStatus', tradeStatus);
        }).catch(function(err) {
            console.log('trade err:', err);
            client.emit('tradeStatus', null);
        });
    });

    client.on('cancelTrade', function(data) {
        var tradeStatus = {};

        trade.getOpenedOrders(data.ticker).then(function(orders) {
            console.log('orders', orders);
            // 1. if there are orders, there must be a trade active already
            if (orders && orders.success && !_.isEmpty(orders.result)) {
                if (orders.result.length > 1)
                    console.log('ALERT - ', orders.result);
                return trade.cancel({ uuid: orders.result[0].OrderUuid });
            } else {
                tradeStatus = { status: 'info', msg: 'no open orders...ready to trade' };
                return null;
            }
        }).then(function(cancelled) {
            if (_.isEmpty(tradeStatus)) { // only proceed in here, if there wasn't any action yet
                console.log('cancelled:', cancelled);
                // 2. Check if there are coins already - there must have been a buy order, sell!
                if (cancelled.success) {
                    tradeStatus = { status: 'info', msg: 'cancelled order...ready to trade' };
                    client.emit('tradeStatus', tradeStatus);
                } else {
                    tradeStatus = { status: 'error', msg: 'failed to cancel order' };
                    client.emit('tradeStatus', tradeStatus);
                }
            } else client.emit('tradeStatus', tradeStatus);
        }).catch(function(err) {
            console.log('trade err:', err);
            client.emit('tradeStatus', null);
        });
    });

    client.on('tradeStatus', function(data) {
        var res = {};
        // 1. Are there any trades already?
        trade.getOpenedOrders(data.ticker).then(function(orders) {
            console.log('orders', orders);
            // 1. if there are orders, there must be a trade active already
            if (orders && orders.success && !_.isEmpty(orders.result)) {
                if (orders.result.length > 1)
                    console.log('ALERT - ', orders.result);
                const order = orders.result[0],
                    opened = new Date(order.Opened + 'Z').toLocaleString('en-US', { timeZone: "America/New_York" }),
                    msg = 'UPDATE TRADE (' + order.OrderType + ') - Rate: ' + order.Limit + ', Quantity: ' + order.Quantity + ', Remaining: ' + order.QuantityRemaining + ', Opened: ' + opened;
                client.emit('tradeStatus', { status: 'info', msg: msg });
            } else
                client.emit('tradeStatus', { status: 'info', msg: 'no active orders...ready to trade' });
        }).catch(function(err) {
            console.log('trade err:', err);
            client.emit('tradeStatus', null);
        });
    });

    client.on('seekProfit', function() {
        var websocketsclient = bittrex.websockets.listen(function(data) {
            if (data.M === 'updateSummaryState') {
                data.A.forEach(function(data_for) {
                    data_for.Deltas.forEach(function(marketsDelta) {
                        console.log('Ticker Update for ' + marketsDelta.MarketName, marketsDelta);
                    });
                });
            }
        });

    })
})

server.listen(port);