function trade() {
    if (!_.isEmpty(tradeStatus)) {
        const trade = {
            ticker: config.ticker,
            buyRate: rates.belowRate,
            sellRate: rates.aboveRate,
            tradeUnits: config.tradeUnits,
            currency: config.currency,
            buyCost: rates.adjustedBelowRate
        };
        console.log('trade: ', trade);
        socket.emit('trade', trade);
    }
}

function updateTradeStatus(data) {
    var startTrade = false;
    tradeStatus = data;
    console.log(data);
    if (!_.isEmpty(data)) {
        if (data.status === 'active') {
            order = data.order;
            opened = new Date(order.Opened + 'Z').toLocaleString('en-US', { timeZone: "America/New_York" });
            msg = order.OrderType + ' - Rate: ' + order.Limit + ', Quantity: ' + order.Quantity + ', Remaining: ' + order.QuantityRemaining + ', Opened: ' + opened;
            $("#orderStatus").text(msg).show();
        } else if (data.status === 'pendingBuy') {
            msg = 'Pending Buy' + data.coin.Currency + ' Balance: ' + data.coin.Balance + ' Available: ' + data.coin.Available + ' Pending: ' + data.coin.Pending;
            $("#orderStatus").text(msg).show();
        } else if (data.status === 'error' || data.status === 'info') {
            $("#orderStatus").text(data.msg).show();
        }else {
            tradeStatus.orders = null;
            $("#orderStatus").text("").hide();
        }

    } else {
        tradeStatus.orders = null;
        $("#orderStatus").text("").hide();
    }
}