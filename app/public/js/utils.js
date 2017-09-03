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
}

function copy(el) {
    new Clipboard(el, {
        text: function(trigger) {
            switch (trigger.id) {
                case 'overCurrent':
                    return rates.aboveRate;
                case 'belowCurrent':
                    return rates.belowRate;
                default:
                    return '';
            }
        }

    });

}

function initTrade(marketName) {
    const tickerData = $("#" + marketName + ".opportunity-row").data('ticker');
    console.log(tickerData);
    switchMarkets(marketName);
    updateTicker(tickerData);
    updateRates(tickerData.Last);
    trade();
}

function rateClicked(rate) {
    if (rate && ticker)
        updateRates(rate)
}

function updateTradeUnits(units) {
    config.tradeUnits = units;
    localStorage.config = JSON.stringify(config);
}

function switchMarkets(marketName) {
    if (marketName !== config.marketName) {
        const fromIndex = marketName.indexOf('-') + 1;

        config.marketName = marketName;
        config.currency = marketName.substring(fromIndex);

        localStorage.config = JSON.stringify(config);

        initUpdates()
    }
}

function updateApi(apiKey, apiSecret) {
    config.apiKey = apiKey;
    config.apiSecret = apiSecret;
    localStorage.config = JSON.stringify(config);
}

function initUpdates() {
    // reset UI
    $('#ticker-container').children().remove();
    $('#opportunity-container').children().remove();

    // start things
    socket.emit('tradeStatus', { marketName: config.marketName });
    socket.emit('marketStatus');
}

function updateRates(rate) {
    const rates = calculateFromRate(rate);
    $("#currentUSD").text(rate + ': $' + rates.usdPrice);
    $("#overCurrent").text('Sell: ' + rates.aboveRate + ': $' + rates.abovePrice).prop('title', ticker.ask);
    $("#belowCurrent").text('Buy: ' + rates.belowRate + ': $' + rates.belowPrice).prop('title', ticker.bid);
    $("#adjustedOverCurrent").text('Sell: ' + rates.adjustedAboveRate + ': $' + rates.adjustedAbovePrice);
    $("#adjustedBelowCurrent").text('Buy: ' + rates.adjustedBelowRate + ': $' + rates.adjustedBelowPrice);
    $("#gains").text('Gains: ' + rates.gainsRate + ' ($' + rates.gainsPrice + ')');
}

function calculateFromRate(rate) {
    const usdPrice = ticker.usdPrice * rate,
        belowRate = ticker.bid + (ticker.bid * config.margin),
        belowPrice = ticker.usdPrice * belowRate,
        aboveRate = ticker.ask - (ticker.ask * config.margin),
        abovePrice = ticker.usdPrice * aboveRate;

    var tradeUnits = config.tradeUnits,
        adjustedBelowRate = ((belowRate * config.commission) + belowRate) * tradeUnits,
        adjustedBelowPrice = ticker.usdPrice * adjustedBelowRate,
        adjustedAboveRate = (aboveRate - (aboveRate * config.commission)) * tradeUnits,
        adjustedAbovePrice = ticker.usdPrice * adjustedAboveRate,
        gainsPrice = adjustedAbovePrice - adjustedBelowPrice,
        gainsRate = adjustedAboveRate - adjustedBelowRate;

    gainsPrice = adjustedAbovePrice - adjustedBelowPrice;
    gainsRate = adjustedAboveRate - adjustedBelowRate;

    rates = {
        usdPrice: usdPrice,
        abovePrice: abovePrice,
        belowPrice: belowPrice,
        belowRate: parseFloat(belowRate).toFixed(8),
        aboveRate: parseFloat(aboveRate).toFixed(8),
        adjustedBelowRate: parseFloat(adjustedBelowRate).toFixed(8),
        adjustedAboveRate: parseFloat(adjustedAboveRate).toFixed(8),
        adjustedBelowPrice: adjustedBelowPrice,
        adjustedAbovePrice: adjustedAbovePrice,
        gainsPrice: gainsPrice,
        gainsRate: parseFloat(gainsRate).toFixed(8),
        tradeUnits: tradeUnits
    };

    localStorage.rates = JSON.stringify(rates);

    return rates;
    //console.log(usdPrice);

}

function showStats() {
    var msg = '',
        tradeUnits = rates.tradeUnits || config.tradeUnits;

    msg += ('Trade Units: ' + tradeUnits + '<br/>');
    msg += ('Margin: ' + config.margin + '%<br/>');

    $('#stats').popover('dispose')
        .popover({ trigger: 'focus', content: msg, placement: 'left', html: true })
        .popover('show');
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

function getUsdPrice(marketName) {
    if (marketName.startsWith('BTC'))
        return btc_usdPrice;
    else if (marketName.startsWith('ETH'))
        return eth_usdPrice;
    else
        return null;
}