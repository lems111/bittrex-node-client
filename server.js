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
                    //console.log('Market Update for ' + data_for.MarketName, data_for);
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
                            console.log('here')
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
                client.emit('tradeStatus', tradeStatus);
            } else
                return trade.getBalances();
        }).then(function(balances) {
            console.log('balances:', balances);
            // 2. Check if there are coins already - there must have been a buy order, sell!
            if (balances.success && !_.isEmpty(balances.result)) {
                const coin = _.find(balances.result, ['Currency', data.currency]);
                if (!_.isEmpty(coin) && coin.Balance) {
                    if (coin.Balance == coin.Available) {
                        console.log('sell ' + data.currency + ', balance:' + coin.Balance + ', available: ' + coin.Available);
                        client.emit('tradeStatus', { status: 'info', msg: 'sell ' + data.currency + ' - balance:' + coin.Balance + ', available: ' + coin.Available });
                    } else {
                        tradeStatus.status = 'pendingBuy';
                        tradeStatus.coin = coin;
                        client.emit('tradeStatus', tradeStatus);
                    }
                } else {
                    if (data.ticker.startsWith('BTC') || data.ticker.startsWith('ETH')) {
                        const currency = (data.ticker.startsWith('BTC')) ? 'BTC' : 'ETH',
                            money = _.find(balances.result, ['Currency', currency]);
                        console.log('money: ', money);
                        // Only buy if there is enough money
                        if (money && money.Available >= data.buyCost) {
                            console.log('buying...');
                            client.emit('tradeStatus', { status: 'info', msg: 'buying...' });
                        } else
                            client.emit('tradeStatus', { status: 'error', msg: 'not enought funds in ' + currency });
                    } else
                        client.emit('tradeStatus', { status: 'error', msg: 'unknown currency' });
                }
            } else
                client.emit('tradeStatus', { status: 'error', msg: 'there are no funds in your account' });
        }).catch(function(err) {
            console.log('trade err:', err);
            client.emit('tradeStatus', null);
        });
    });

    client.on('tradeStatus', function(data) {
        var res = {};
        // 1. Are there any trades already?
        bittrex.getopenorders({market: data.ticker}, function(orders) {
            res.orders = orders;
            bittrex.getbalances(function(balances) {
                res.balances = balances;
                client.emit('tradeStatus', res);
            });
        });
    });
})

server.listen(port);