function trade() {
    if (!_.isEmpty(rates) && rates.belowRate && rates.aboveRate && rates.adjustedBelowRate && rates.adjustedBelowRate >= config.satoshiLimit) {
        if (!shouldCancelTrade()) {
            tradeData = {
                ticker: config.ticker,
                buyRate: rates.belowRate,
                sellRate: rates.aboveRate,
                tradeUnits: rates.tradeUnits,
                currency: config.currency,
                buyCost: rates.adjustedBelowRate
            };
            console.log('tradeData: ', tradeData);
            localStorage.tradeData = JSON.stringify(tradeData);
            socket.emit('trade', tradeData);
        } else
            cancelTrade();
    } else if (config.satoshiLimit > rates.adjustedBelowRate)
        updateTradeStatus({ status: 'error', msg: 'buying price is below satoshi limit (' + config.satoshiLimit + ')' });
}

function shouldCancelTrade() {
    if (currentTrade && ticker && currentTrade.status === 'active' && currentTrade.order.OrderType === 'LIMIT_BUY' && (ticker.bid > rates.belowRate || ticker.ask < rates.aboveRate))
        return true;
    return false;
}

function cancelTrade() {
    tradeData = null;
    localStorage.tradeData = null;
    socket.emit('cancelTrade', { ticker: config.ticker });

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
                $("#orderStatus").text(data.msg).show();
                break;
            default:
                currentTrade = null;
                $("#orderStatus").text("").hide();
                break;
        }

    } else {
        currentTrade = null;
        $("#orderStatus").text("").hide();
    }
}