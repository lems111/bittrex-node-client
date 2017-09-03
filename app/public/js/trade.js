function trade() {
    if (!_.isEmpty(rates) && rates.belowRate && rates.aboveRate && rates.adjustedBelowRate && rates.adjustedBelowRate >= config.satoshiLimit) {
        if (!shouldCancelTrade() && proceedWithTrade()) {
            tradeData = {
                marketName: config.marketName,
                buyRate: rates.belowRate,
                sellRate: rates.aboveRate,
                tradeUnits: rates.tradeUnits,
                currency: config.currency,
                buyCost: rates.adjustedBelowRate,
                gainsPrice: rates.gainsPrice
            };
            updateActiveTrade(tradeData);
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
    if (!_.isEmpty(currentTrade) && !_.isEmpty(ticker) && currentTrade.status === 'active' && currentTrade.order.OrderType === 'LIMIT_BUY' && currentTrade.Quantity >= currentTrade.QuantityRemaining &&
         (ticker.bid > rates.belowRate || ticker.ask < rates.aboveRate))
        return true;
    return false;
}

function cancelTrade() {
    currentTrade = null;
    updateActiveTrade(null);
    socket.emit('cancelTrade', { marketName: config.marketName });

}

function updateTradeStatus(data) {
    currentTrade = data;
    console.log(data);

    if (!_.isEmpty(data)) {
        switch (data.status) {
            case 'active':
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
            case 'info':
                currentTrade = null;
                updateActiveTrade(null);
                $("#orderStatus").text(data.msg).show();
                break;
            default:
                currentTrade = null;
                updateActiveTrade(null);
                $("#orderStatus").text("").hide();
                break;
        }

    } else {
        currentTrade = null;
        updateActiveTrade(null);
        $("#orderStatus").text("").hide();
    }
}