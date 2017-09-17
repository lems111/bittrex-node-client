function restoreData() {
    console.log(localStorage);
    if (localStorage.config)
        config = JSON.parse(localStorage.config);

    if (localStorage.rates)
        rates = JSON.parse(localStorage.rates);

    if (localStorage.tradeData)
        tradeData = JSON.parse(localStorage.tradeData);

    if (localStorage.ticker)
        ticker = JSON.parse(localStorage.ticker);

    if (localStorage.profitTickerCriteria)
        profitTickerCriteria = JSON.parse(localStorage.profitTickerCriteria);

    if (localStorage.trendPercentIncrease)
        trendPercentIncrease = JSON.parse(localStorage.trendPercentIncrease);
}

function copy(el) {
    new Clipboard(el, {
        text: function(trigger) {
            switch (trigger.id) {
                case 'sell-info':
                    return rates.sellRate;
                case 'buy-info':
                    return rates.buyRate;
                default:
                    return '';
            }
        }

    });

}

function lookForTrends(){
    $('#trend-container').children().remove();
    $('#trend-btn').text('Trends (...)').prop('disabled', true);
    socket.emit('marketList');
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
            tickerRow = tickerRowTemplate.replace(/{{data2}}/g, ticker.price)
            .replace(/{{data3}}/g, 'Last:' + ticker.price + ' ($' + ticker.priceUsd.toFixed(4) + ')')
            .replace(/{{data4}}/g, 'Bid:' + ticker.bid + ' ($' + ticker.bidUsd.toFixed(4) + ')')
            .replace(/{{data5}}/g, 'Ask:' + ticker.ask + ' ($' + ticker.askUsd.toFixed(4) + ')')
            .replace(/{{data6}}/g, '$' + ticker.priceUsd)
            .replace(/{{data7}}/g, '$' + ticker.bidUsd)
            .replace(/{{data8}}/g, '$' + ticker.askUsd);

        localStorage.ticker = JSON.stringify(ticker);
        $("#ticker-container").prepend(tickerRow);
        $("#ticker-title").text("Ticker Updates for " + ticker.marketName);
        return true; // success
    }
    return false;
}

function rateClicked(rate) {
    if (rate && ticker)
        updateRates(rate)
}

function updateAutoTrade() {
    if ($('#auto-trade').hasClass('active')) {
        config.autoTrade = 'off';
        $('#auto-trade').removeClass('active').text('Auto Trade (off)');
    } else {
        config.autoTrade = 'on';
        $('#auto-trade').addClass('active').text('Auto Trade (on)');
    }
    $('#auto-trade').button('toggle');

    localStorage.config = JSON.stringify(config);
}

function updateTradeUnits(units) {
    config.tradeUnits = units;
    localStorage.config = JSON.stringify(config);
}

function updateTrendPercentIncrease(newTrendPercentIncrease) {
    trendPercentIncrease = newTrendPercentIncrease;
    localStorage.trendPercentIncrease = JSON.stringify(trendPercentIncrease);
}

function updateTradeBlacklist(marketNames) {
    marketNames = marketNames.replace(/\s+/g, '');
    config.blacklistTickers = marketNames.split(',');
    localStorage.config = JSON.stringify(config);
}

function updateApi(apiKey, apiSecret) {
    config.apiKey = apiKey;
    config.apiSecret = apiSecret;
    localStorage.config = JSON.stringify(config);
}

function switchMarkets(marketName) {
    if (marketName !== config.marketName) {
        const fromIndex = marketName.indexOf('-') + 1;

        config.marketName = marketName;
        config.currency = marketName.substring(fromIndex);

        localStorage.config = JSON.stringify(config);

        initUpdates(false)
    }
}

function initUpdates(initMarketStatus) {
    // reset UI
    $('#ticker-container').children().remove();
    $('#opportunity-container').children().remove();

    if (config.autoTrade === 'on')
        $('#auto-trade').addClass("active").attr("aria-pressed", true).text('Auto Trade (on)');
    else
        $('#auto-trade').removeClass("active").text('Auto Trade (off)');

    if(!_.isEmpty(tradeData))
        updateActiveTradeMsg(tradeData);

    // start things
    if (initMarketStatus)
        socket.emit('marketStatus');
}

function initTrade(marketName) {
    const tickerData = $("#" + marketName + ".opportunity-row").data('ticker');
    console.log(tickerData);
    switchMarkets(marketName);

    if (updateTicker(tickerData)) {
        updateRates(tickerData.Last);
        trade();
    }
}

function updateRates(rate) {
    const rates = calculateFromRate(rate);
    $("#currentUSD").text(rate + ': $' + rates.usdPrice);
    $("#sell-info").text('Sell: ' + rates.sellRate + ': $' + rates.sellPrice).prop('title', ticker.ask);
    $("#buy-info").text('Buy: ' + rates.buyRate + ': $' + rates.buyPrice).prop('title', ticker.bid);
    $("#total-sell-info").text('Total Sell cost: ' + rates.totalSellRate + ': $' + rates.totalSellPrice);
    $("#total-buy-info").text('Total Buy cost: ' + rates.totalBuyRate + ': $' + rates.totalBuyPrice);
    $("#gains").text('Gains: ' + rates.gainsRate + ' ($' + rates.gainsPrice + ')');
}

function calculateFromRate(rate) {
    const usdPrice = ticker.usdPrice * rate,
        buyRate = ticker.bid + (ticker.bid * config.margin),
        buyPrice = ticker.usdPrice * buyRate,
        sellRate = ticker.ask - (ticker.ask * config.margin),
        sellPrice = ticker.usdPrice * sellRate;

    var tradeUnits = config.tradeUnits,
        totalBuyRate = ((buyRate * config.commission) + buyRate) * tradeUnits,
        totalBuyPrice = ticker.usdPrice * totalBuyRate,
        totalSellRate = (sellRate - (sellRate * config.commission)) * tradeUnits,
        totalSellPrice = ticker.usdPrice * totalSellRate,
        gainsPrice = totalSellPrice - totalBuyPrice,
        gainsRate = totalSellRate - totalBuyRate;

    gainsPrice = totalSellPrice - totalBuyPrice;
    gainsRate = totalSellRate - totalBuyRate;

    rates = {
        usdPrice: usdPrice,
        sellPrice: sellPrice,
        buyPrice: buyPrice,
        buyRate: parseFloat(buyRate.toFixed(8)),
        sellRate: parseFloat(sellRate.toFixed(8)),
        totalBuyRate: parseFloat(totalBuyRate.toFixed(8)),
        totalSellRate: parseFloat(totalSellRate.toFixed(8)),
        totalBuyPrice: totalBuyPrice,
        totalSellPrice: totalSellPrice,
        gainsPrice: gainsPrice,
        gainsRate: parseFloat(gainsRate.toFixed(8)),
        tradeUnits: tradeUnits
    };

    localStorage.rates = JSON.stringify(rates);

    return rates;
    //console.log(usdPrice);

}

function getAccountInfo() {
    socket.emit('accountInfo');
}

function checkRate() {
    const newRate = parseFloat($("#new-rate").val());
    if (newRate)
        updateRates(newRate)
}

function updateMargin(newMargin) {
    if (newMargin) {
        config.margin = newMargin;
        localStorage.config = JSON.stringify(config);
    }
}

function updateTickerPriceCeiling(tickerPriceCeiling) {
    if (tickerPriceCeiling) {
        profitTickerCriteria.tickerPriceCeiling = tickerPriceCeiling;
        localStorage.profitTickerCriteria = JSON.stringify(profitTickerCriteria);
    }
}

function updateProfitMinGain(minGain) {
    if (minGain) {
        profitTickerCriteria.gains = minGain;
        localStorage.profitTickerCriteria = JSON.stringify(profitTickerCriteria);
    }
}

function getUsdPrice(marketName) {
    if (marketName.startsWith('BTC'))
        return btc_usdPrice;
    else if (marketName.startsWith('ETH'))
        return eth_usdPrice;
    else
        return null;
}

function updateActiveTradeMsg(updatedTradeData) {
    if (!_.isEmpty(updatedTradeData) && updatedTradeData.marketName) {
        const msg = updatedTradeData.marketName + ' - Buy Rate: ' + updatedTradeData.buyRate + ' Sell Rate: ' + updatedTradeData.sellRate + ' Trade Units: ' + updatedTradeData.tradeUnits + ' Gains: ' + updatedTradeData.gainsPrice;
        $("#active-trade-msg").text(msg);
        $("#active-trade-row").show();
    } else {
        $("#active-trade-msg").text('');
        $("#active-trade-row").hide();
    }
}