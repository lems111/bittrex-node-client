function trade() {
    if (!_.isEmpty(rates) && rates.belowRate && rates.aboveRate && rates.adjustedBelowRate) {
        if (!shouldCancelTrade()) {
            tradeData = {
                ticker: config.ticker,
                buyRate: rates.belowRate,
                sellRate: rates.aboveRate,
                tradeUnits: config.tradeUnits,
                currency: config.currency,
                buyCost: rates.adjustedBelowRate
            };
            console.log('tradeData: ', tradeData);
            localStorage.tradeData = JSON.stringify(tradeData);
            socket.emit('trade', tradeData);
        } else
            cancelTrade();
    }

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
    if (tradeStatusInterval)
        clearInterval(tradeStatusInterval);

    if (!_.isEmpty(data)) {
        switch (data.status) {
            case 'active':
                order = data.order;
                opened = new Date(order.Opened + 'Z').toLocaleString('en-US', { timeZone: "America/New_York" });
                msg = order.OrderType + ' - Rate: ' + order.Limit + ', Quantity: ' + order.Quantity + ', Remaining: ' + order.QuantityRemaining + ', Opened: ' + opened;
                $("#orderStatus").text(msg).show();
                tradeStatusInterval = setInterval(function() { socket.emit('trade', tradeData) }, 2000);
                break;
            case 'pendingTrans':
                msg = 'Pending Transaction' + data.coin.Currency + ' Balance: ' + data.coin.Balance + ' Available: ' + data.coin.Available + ' Pending: ' + data.coin.Pending;
                $("#orderStatus").text(msg).show();
                tradeStatusInterval = setInterval(function() { socket.emit('trade', tradeData) }, 2000);
                break;
            case 'pendingBuy':
            case 'pendingSell':
                $("#orderStatus").text(data.msg).show();
                tradeStatusInterval = setInterval(function() { socket.emit('trade', tradeData) }, 2000);
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