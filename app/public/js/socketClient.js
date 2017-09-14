var socket = io.connect('http://localhost:3000');

socket.on('connect', function(data) {
    if (config)
        socket.emit('join', { apiKey: config.apiKey, apiSecret: config.apiSecret });
});


socket.on('markets', function(markets) {
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