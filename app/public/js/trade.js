function trade() {
    if (!_.isEmpty(rates) && rates.belowRate && rates.aboveRate && rates.adjustedBelowRate && rates.adjustedBelowRate >= config.satoshiLimit) {
        if (!shouldCancelTrade() && proceedWithTrade()) {
            const newTradeData = {
                marketName: config.marketName,
                buyRate: rates.belowRate,
                sellRate: rates.aboveRate,
                tradeUnits: rates.tradeUnits,
                currency: config.currency,
                buyCost: rates.adjustedBelowRate,
                gainsPrice: rates.gainsPrice
            };
            updateActiveTrade(newTradeData);
            socket.emit('trade', tradeData);
            return true;
        } else
            cancelTrade();
    } else if (config.satoshiLimit > rates.adjustedBelowRate)
        updateTradeStatus({ status: 'error', msg: 'buying price is below satoshi limit (' + config.satoshiLimit + ')' });

    return false;
}

function proceedWithTrade() {
    if (rates.gainsPrice >= profitTickerCriteria.gains)
        return true;
    else
        console.log('stopped trade - rates:', rates);
    return false;
}

function shouldCancelTrade() {
    if (!_.isEmpty(tradeData) && !_.isEmpty(ticker) && tradeData.status === 'active' && tradeData.order.OrderType === 'LIMIT_BUY' && (tradeData.order.Quantity == tradeData.order.QuantityRemaining) &&
        (ticker.bid > rates.belowRate || ticker.ask < rates.aboveRate))
        return true;
    return false;
}

function cancelTrade() {
    socket.emit('cancelTrade', { marketName: config.marketName, currency: config.currency });

}

function updateTradeStatus(data) {
    if (!_.isEmpty(data)) {
        switch (data.status) {
            case 'active':
                updateActiveTrade(data);
                order = data.order;
                opened = new Date(order.Opened + 'Z').toLocaleString('en-US', { timeZone: "America/New_York" });
                msg = order.OrderType + ' - Rate: ' + order.Limit + ', Quantity: ' + order.Quantity + ', Remaining: ' + order.QuantityRemaining + ', Opened: ' + opened;
                $("#orderStatus").text(msg).show();
                setTimeout(trade, 2000);
                break;
            case 'pendingTrans':
                msg = 'Pending Transaction' + data.coin.Currency + ' Balance: ' + data.coin.Balance + ' Available: ' + data.coin.Available + ' Pending: ' + data.coin.Pending;
                $("#orderStatus").text(msg).show();
                setTimeout(trade, 2000);
                break;
            case 'pendingBuy':
            case 'pendingSell':
                $("#orderStatus").text(data.msg).show();
                setTimeout(trade, 2000);
                break;
            case 'error':
                $("#orderStatus").text(data.msg).show();
                break;
            case 'info':
                updateActiveTrade(null);
                $("#orderStatus").text(data.msg).show();
                break;
            default:
                updateActiveTrade(null);
                $("#orderStatus").text("").hide();
                break;
        }

    } else {
        updateActiveTrade(null);
        $("#orderStatus").text("").hide();
    }
}

function updateActiveTrade(newTradeData) {

    if (newTradeData) {
        localStorage.tradeData = tradeData = _.merge(tradeData, newTradeData);
        console.log('updateActiveTrade:', tradeData);
        const msg = tradeData.marketName + ' - Buy Rate: ' + tradeData.buyRate + ' Sell Rate: ' + tradeData.sellRate + ' Trade Units: ' + tradeData.tradeUnits + ' Gains: ' + tradeData.gainsPrice;
        localStorage.tradeData = JSON.stringify(tradeData);
        $("#active-trade-msg").text(msg);
        $("#active-trade-row").show();
    } else {
        localStorage.tradeData = tradeData = newTradeData;
        $("#active-trade-msg").text('');
        $("#active-trade-row").hide();
    }
}