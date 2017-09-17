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
        var trendCount = checkTrending(history);

        if (trendCount)
            $('#trend-btn').text('Trends (' + trendCount + ')');

        _.remove(trendingMarkets, { MarketName: history.marketName });

        if (!_.isEmpty(trendingMarkets))
            socket.emit('orderHistory', trendingMarkets[0].MarketName);
        else {
            if (trendCount > 0)
                $("#trend-modal").modal('show');
            // updating trend count again, in case it's a zero
            $('#trend-btn').text('Trends (' + trendCount + ')').prop('disabled', false);
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

function checkTrending(history) {
    const increaseCriteria = trendPercentIncrease/2;
    var firstHit, secondHit, percentIncrease, bottomPrice;
    const orders = _.sortBy(history.orders, function(order) { return new Date(order.TimeStamp); });
    _.forEach(orders, function(o) {
        if (bottomPrice && o.Price > bottomPrice) {
            if (!firstHit)
                percentIncrease = ((o.Price * 100) / bottomPrice) - 100;
            else
                percentIncrease = ((o.Price * 100) / firstHit) - 100;
            if (percentIncrease >= increaseCriteria) {
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

    if (firstHit && secondHit) {
        const trendRowTemplate = document.getElementById("template-trend-row").innerHTML,
            trendRow = trendRowTemplate.replace(/{{data1}}/g, history.marketName)
        $("#trend-container").prepend(trendRow);
    }
    return $("#trend-container").children().length;
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

        $("#opportunity-title").text('Profit Opportunities - select a ticker to start trading');

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
                buyRate = ticker.Bid + (ticker.Bid * config.margin),
                buyPrice = usd_price * buyRate,
                sellRate = ticker.Ask - (ticker.Ask * config.margin),
                sellPrice = usd_price * sellRate,
                totalBuyRate = ((buyRate * config.commission) + buyRate) * config.tradeUnits,
                totalBuyPrice = usd_price * totalBuyRate,
                totalSellRate = (sellRate - (sellRate * config.commission)) * config.tradeUnits,
                totalSellPrice = usd_price * totalSellRate,
                gainsPrice = totalSellPrice - totalBuyPrice;

            //console.log(ticker.MarketName + ',askUsdPrice: ' + askUsdPrice + ',bidUsdPrice: ' + bidUsdPrice + ',totalSellPrice:' + totalSellPrice + ',totalBuyPrice:' + totalBuyPrice +', gainsPrice: ' + gainsPrice);
            if (gainsPrice >= profitTickerCriteria.gains) {
                ret.profitable = true;
                ret.gains = gainsPrice;
            }
        }
    }

    return ret;
}