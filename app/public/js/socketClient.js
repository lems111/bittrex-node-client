var socket = io.connect('http://localhost:3000');

socket.on('connect', function(data) {
    if (config)
        socket.emit('join', { apiKey: config.apiKey, apiSecret: config.apiSecret });
});

socket.on('marketList', function(marketList) {
    if (marketList) {
        trendingMarkets = marketList
        socket.emit('orderHistory', trendingMarkets[0].MarketName);
    }
});

socket.on('orderHistory', function(history) {
    if (!_.isEmpty(history)) {
        if (isTrending(history.orders)) {
            var market = _.find(trendingMarkets, { MarketName: history.marketName });
            market.trending = true;
            console.log('marketName: ' + history.marketName + ' is trending');
        } else {
            _.remove(trendingMarkets, { MarketName: history.marketName });
        }
        if (!_.isEmpty(trendingMarkets)) {
            var market = _.find(trendingMarkets, function(o) { return !o.trending; });
            if (market)
                socket.emit('orderHistory', market.MarketName);
        }
    }
});

socket.on('marketsStatus', function(markets) {
    if (!_.isEmpty(markets)) {
        updateUsdPrices(markets);
        _.forEach(markets, function(market) {
            if (market.MarketName === config.marketName)
                updateTicker(market);
            else if (!config.blacklistTickers.includes(market.MarketName))
                checkIfProfitable(market);
        });
    }
});

socket.on('accountData', function(accountData) {
    if (!_.isEmpty(accountData)) {
        const btcTrades = _.filter(accountData, function(trade) { return trade.Exchange.startsWith('BTC'); }),
            ethTrades = _.filter(accountData, function(trade) { return trade.Exchange.startsWith('ETH'); }),
            btcTradeGains = calculateTradeGains(btcTrades),
            ethTradeGains = calculateTradeGains(ethTrades),
            btcTradeGainsUsd = (btc_usdPrice) ? (btcTradeGains * btc_usdPrice) : (0),
            ethTradeGainsUsd = (eth_usdPrice) ? (ethTradeGains * eth_usdPrice) : (0);

        $("#btc-trade-gains").text('Total BTC trade gains: ' + btcTradeGains + '($' + btcTradeGainsUsd.toFixed(4) + ')');
        $("#eth-trade-gains").text('Total ETH trade gains: ' + ethTradeGains + '($' + ethTradeGainsUsd.toFixed(4) + ')');
    }

    $("#account-modal").modal('show');
});

function isTrending(orders) {
    var firstHit, secondHit, percentIncrease, bottomPrice;
    orders = _.sortBy(orders, function(order) { return new Date(order.TimeStamp); });
    _.forEach(orders, function(o) {
        if (bottomPrice && o.Price > bottomPrice) {
            if (!firstHit)
                percentIncrease = ((o.Price * 100) / bottomPrice) - 100;
            else
                percentIncrease = ((o.Price * 100) / firstHit) - 100;
            if (percentIncrease >= 5) {
                //console.log('percentIncrease: ' + percentIncrease + ',firstHit: ' + firstHit + ',secondHit: ' + secondHit + ',Price: ' + o.Price);
                if (!firstHit)
                    firstHit = o.Price;
                else if (!secondHit)
                    secondHit = o.Price;
                else if (o.Price > secondHit) {
                    firstHit = o.Price;
                    secondHit = 0;
                }
            }
        } else {
            bottomPrice = o.Price;
            if (firstHit && secondHit)
                secondHit = 0;
        }
    });
    //console.log('firstHit: ' + firstHit + ',secondHit: ' + secondHit);
    return (firstHit && secondHit);
}

function updateUsdPrices(markets) {
    const usdt_btc = _.find(markets, { MarketName: 'USDT-BTC' }),
        usdt_eth = _.find(markets, { MarketName: 'USDT-ETH' });

    if (usdt_btc)
        btc_usdPrice = usdt_btc.Last;

    if (usdt_eth)
        eth_usdPrice = usdt_eth.Last;
}

socket.on('tradeStatus', function(data) {
    updateTradeStatus(data);
});

function checkIfProfitable(ticker) {
    const usdPrice = getUsdPrice(ticker.MarketName),
        profit = determineProfit(ticker, usdPrice);

    if (ticker && profit.profitable) {
        console.log('profitTicker: ', ticker);
        const opportunityRowTemplate = document.getElementById("template-opportunity-row").innerHTML,
            opportunityRow = opportunityRowTemplate.replace(/{{data1}}/g, ticker.MarketName)
            .replace(/{{data2}}/g, 'Bid: ' + ticker.Bid)
            .replace(/{{data3}}/g, 'Sell: ' + ticker.Ask)
            .replace(/{{data4}}/g, 'Last: ' + ticker.Last)
            .replace(/{{data5}}/g, 'Gains: ' + profit.gains.toFixed(4))
            .replace(/{{data6}}/g, '$' + profit.gains);

        if ($("#" + ticker.MarketName + ".opportunity-row").length)
            $("#" + ticker.MarketName + ".opportunity-row").replaceWith(opportunityRow);
        else
            $("#opportunity-container").prepend(opportunityRow);

        $("#" + ticker.MarketName + ".opportunity-row").data('ticker', ticker);
        if (config.autoTrade === 'on' && _.isEmpty(tradeData))
            initTrade(ticker.MarketName);
    }
}

function determineProfit(ticker, usd_price) {
    var ret = { profitable: false, gains: 0 };

    usd_volume = usd_price * ticker.BaseVolume;
    if (usd_volume >= profitTickerCriteria.volume) {
        const tickerUsdPrice = ticker.Last * usd_price;
        if (tickerUsdPrice <= profitTickerCriteria.tickerPriceCeiling) {
            const bidUsdPrice = ticker.Bid * usd_price,
                askUsdPrice = ticker.Ask * usd_price,
                belowRate = ticker.Bid + (ticker.Bid * config.margin),
                belowPrice = usd_price * belowRate,
                aboveRate = ticker.Ask - (ticker.Ask * config.margin),
                abovePrice = usd_price * aboveRate,
                adjustedBelowRate = ((belowRate * config.commission) + belowRate) * config.tradeUnits,
                adjustedBelowPrice = usd_price * adjustedBelowRate,
                adjustedAboveRate = (aboveRate - (aboveRate * config.commission)) * config.tradeUnits,
                adjustedAbovePrice = usd_price * adjustedAboveRate,
                gainsPrice = adjustedAbovePrice - adjustedBelowPrice;

            //console.log(ticker.MarketName + ',askUsdPrice: ' + askUsdPrice + ',bidUsdPrice: ' + bidUsdPrice + ',adjustedAbovePrice:' + adjustedAbovePrice + ',adjustedBelowPrice:' + adjustedBelowPrice +', gainsPrice: ' + gainsPrice);
            if (gainsPrice >= profitTickerCriteria.gains) {
                ret.profitable = true;
                ret.gains = gainsPrice;
            }
        }
    }

    return ret;
}