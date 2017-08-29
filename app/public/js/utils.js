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

function rateClicked(rate) {
    if (rate) {
        selectedRate = rate
        highlightRates();

        if (ticker) {
            updateRates(rate)
        }
    }
}

function updateTradeUnits(units) {
    config.tradeUnits = units;
    localStorage.config = JSON.stringify(config);
}

function updateTicker(ticker) {
    const fromIndex = ticker.indexOf('-') + 1;

    config.tickers = [ticker];
    config.ticker = ticker;
    config.currency = ticker.substring(fromIndex);

    localStorage.config = JSON.stringify(config);
    resetConnection();
}

function resetConnection() {
    console.log('tradesInterval:' + tradesInterval);
    if (tradesInterval)
        clearInterval(tradesInterval);

    socket.emit('unsubscribe'); // in the disconnect callback, restart everything

}

function initUpdates() {
    // start things
    socket.emit('ticker', config.tickers);
    socket.emit('messages', config.tickers);
    socket.emit('tradeStatus', { ticker: config.ticker });
    tradesInterval = setInterval(function() { socket.emit('ticker', config.tickers) }, 30000);
}

function highlightRates() {
    if (selectedRate) {
        $(".highlighted-rate").each(function(index) {
            $(this).removeClass("alert-warning alert-danger alert-success").addClass("rate");
        });

        $(".rate").each(function(index) {
            if ($(this).text() == selectedRate)
                $(this).removeClass("rate").addClass("alert-warning highlighted-rate");
            else if ($(this).text() > selectedRate)
                $(this).removeClass("rate").addClass("alert-danger highlighted-rate");
            else if ($(this).text() < selectedRate)
                $(this).removeClass("rate").addClass("alert-success highlighted-rate");
        });
    }
}

function updateRates(rate) {
    const rates = calculateFromRate(rate);
    $("#currentUSD").text(rate + ': $' + rates.usdPrice);
    $("#overCurrent").text('Sell: ' + rates.aboveRate + ': $' + rates.abovePrice);
    $("#belowCurrent").text('Buy: ' + rates.belowRate + ': $' + rates.belowPrice);
    $("#adjustedOverCurrent").text('Sell: ' + rates.adjustedAboveRate + ': $' + rates.adjustedAbovePrice);
    $("#adjustedBelowCurrent").text('Buy: ' + rates.adjustedBelowRate + ': $' + rates.adjustedBelowPrice);
    $("#gains").text('Gains: ' + rates.gainsRate + ' ($' + rates.gainsPrice + ')');
}

function calculateFromRate(rate) {
    const usdPrice = (ticker.price * ticker.usdPrice * rate) / ticker.price,
        belowPrice = usdPrice - config.margin,
        belowRate = ((belowPrice * rate) / usdPrice),
        adjustedBelowRate = ((belowRate * config.commission) + belowRate) * config.tradeUnits,
        adjustedBelowPrice = (ticker.price * ticker.usdPrice * adjustedBelowRate) / ticker.price;

    const abovePrice = usdPrice,
        aboveRate = ((abovePrice * rate) / usdPrice),
        // Includes commission adjusted price and rates
        adjustedAboveRate = (aboveRate - (aboveRate * config.commission)) * config.tradeUnits,
        adjustedAbovePrice = (ticker.price * ticker.usdPrice * adjustedAboveRate) / ticker.price,
        gainsPrice = adjustedAbovePrice - adjustedBelowPrice,
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
        gainsRate: parseFloat(gainsRate).toFixed(8)
    };

    localStorage.rates = JSON.stringify(rates);

    return rates;
    //console.log(usdPrice);

}

function showStats() {
    var canceledBuyCount = $("#buysContainer").children(".row .alert-danger").length,
        updatedBuyCount = $("#buysContainer").children(".row .alert-info").length,
        newBuyCount = $("#buysContainer").children(".row .alert-success").length,
        canceledSellCount = $("#sellsContainer").children(".row .alert-danger").length,
        updatedSellCount = $("#sellsContainer").children(".row .alert-info").length,
        newSellCount = $("#sellsContainer").children(".row .alert-success").length,
        totalBuyCount = canceledBuyCount + updatedBuyCount + newBuyCount,
        totalSellCount = canceledSellCount + updatedSellCount + newSellCount,
        outstandingBuyCount = updatedBuyCount + newBuyCount - canceledBuyCount,
        outstandingSellCount = updatedSellCount + newSellCount - canceledSellCount,
        msg = '';

    msg += ('Trade Units: ' + config.tradeUnits + '<br/>');
    msg += ('Margin: ' + config.margin + '¢<br/>');
    msg += ('Total Buy Count: ' + totalBuyCount + '<br/>');
    msg += ('Outstanding Buy Count: ' + outstandingBuyCount + '<br/>');
    msg += ('Total Sell Count: ' + totalSellCount + '<br/>');
    msg += ('Outstanding Sell Count: ' + outstandingSellCount);

    $('#stats').popover('dispose')
        .popover({ trigger: 'focus', content: msg, placement: 'left', html: true })
        .popover('show');
}

function checkRate() {
    const newRate = parseFloat($("#new-rate").val());
    selectedRate = newRate
    if (newRate)
        updateRates(newRate)
}

function updateMargin(newMargin) {
    if (newMargin) {
        config.margin = newMargin;
        localStorage.config = JSON.stringify(config);
    }

}

function quantityClicked(quantity) {
    if (quantity) {
        selectedQuantity = quantity
        $(".highlighted-quantity").each(function(index) {
            $(this).removeClass("alert-warning alert-danger alert-success").addClass("quantity");
        });

        $(".quantity").each(function(index) {
            if ($(this).text() == quantity)
                $(this).removeClass("quantity").addClass("alert-warning highlighted-quantity");
            else if ($(this).text() > quantity)
                $(this).removeClass("quantity").addClass("alert-danger highlighted-quantity");
            else if ($(this).text() < quantity)
                $(this).removeClass("quantity").addClass("alert-success highlighted-quantity");
        });
    }
}

function newTransaction(transArray, container) {
    var transRowTemplate = document.getElementById("template-trans-row").innerHTML,
        orderType = '',
        alertType = '',
        transRow;

    _.forEach(transArray, function(trans, key) {
        if (trans.Type == 0) { //https://github.com/n0mad01/node.bittrex.api/issues/23#issuecomment-311090618
            alertType = 'success';
        } else if (trans.Type == 1) {
            alertType = 'danger';
        } else if (trans.Type == 2) {
            alertType = 'info';
        }

        transRow = transRowTemplate.replace(/{{alertType}}/g, alertType)
            .replace(/{{data2}}/g, trans.Rate)
            .replace(/{{data3}}/g, trans.Quantity);
    });

    if ($(container + " .row").length == 10000)
        $(container).children('.row').last().remove();

    if (transRow)
        $(container).prepend(transRow);
}

function seekProfit(){
    socket.emit('seekProfit', profitTickerCriteria);
}