var socket = io.connect('http://localhost:3000');

socket.on('connect', function(data) {
    socket.emit('join', {apiKey: config.apiKey, apiSecret: config.apiSecret});
});


socket.on('markets', function(data) {
    updateUsdPrices(data.Deltas);
    _.forEach(data.Deltas, function(ticker) {
        if (ticker.MarketName === config.marketName)
            updateTicker(ticker);
        else if(!blacklistTickers.includes(ticker.MarketName))
            checkIfProfitable(ticker);
    });
});

function updateUsdPrices(markets) {
    const usdt_btc = _.find(markets, { MarketName: 'USDT-BTC' }),
        usdt_eth = _.find(markets, { MarketName: 'USDT-ETH' });

    if (usdt_btc)
        btc_usdPrice = usdt_btc.Last;

    if (usdt_eth)
        eth_usdPrice = usdt_eth.Last;
}

function updateTicker(data) {
    const usdPrice = getUsdPrice(data.MarketName);

    if (data && usdPrice) {
        ticker = {
            marketName: data.MarketName,
            price: data.Last,
            priceUsd: (data.Last * usdPrice),
            bid: data.Bid,
            bidUsd: (data.Bid * usdPrice),
            ask: data.Ask,
            askUsd: (data.Ask * usdPrice),
            usdPrice: usdPrice
        };

        const tickerRowTemplate = document.getElementById("template-ticker-row").innerHTML,
            tickerRow = tickerRowTemplate.replace(/{{data1}}/g, ticker.marketName)
            .replace(/{{data2}}/g, ticker.price)
            .replace(/{{data3}}/g, 'Last:' + ticker.price + ' ($' + ticker.priceUsd + ')')
            .replace(/{{data4}}/g, 'Bid:' + ticker.bid + ' ($' + ticker.bidUsd + ')')
            .replace(/{{data5}}/g, 'Ask:' + ticker.ask + ' ($' + ticker.askUsd + ')');

        localStorage.ticker = JSON.stringify(ticker);
        $("#ticker-container").prepend(tickerRow);
    }
}

socket.on('tradeStatus', function(data) {
    updateTradeStatus(data);
});

function checkIfProfitable(ticker) {
    const usdPrice = getUsdPrice(ticker.MarketName),
        profit = determineProfit(ticker, usdPrice);

    if (ticker && profit.profitable) {
        console.log('profitTicker: ', ticker);
        const tickerRowTemplate = document.getElementById("template-opportunity-row").innerHTML,
            tickerRow = tickerRowTemplate.replace(/{{data1}}/g, ticker.MarketName)
            .replace(/{{data2}}/g, 'Bid: ' + ticker.Bid)
            .replace(/{{data3}}/g, 'Sell: ' + ticker.Ask )
            .replace(/{{data4}}/g, 'Last: ' + ticker.Last )
            .replace(/{{data5}}/g, 'Gains: ' + profit.gains);

        if ($("#" + ticker.MarketName + ".opportunity-row").length)
            $("#" + ticker.MarketName + ".opportunity-row").replaceWith(tickerRow);
        else
            $("#opportunity-container").prepend(tickerRow);

        $("#" + ticker.MarketName + ".opportunity-row").data('ticker', ticker);
        if(config.autoTrade === 'on' && _.isEmpty(tradeData))
            initTrade(ticker.MarketName);
    }
}

function determineProfit(ticker, usd_price) {
    var ret = { profitable: false, gains: 0 };

    usd_volume = (ticker.MarketName.startsWith('BTC')) ? (usd_price * ticker.BaseVolume) : (usd_price * ticker.BaseVolume);
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
                console.log(ticker.MarketName + ',usd_volume:' + usd_volume + ', ask: ' + ticker.Ask + ', bid: ' + ticker.Bid + ', gainsPrice: ' + gainsPrice);
                ret.profitable = true;
                ret.gains = gainsPrice;
            }
        }
    }

    return ret;
}