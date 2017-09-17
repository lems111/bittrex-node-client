function trade() {
    if (!_.isEmpty(rates)) {
        if (rates.buyRate && rates.sellRate && rates.totalBuyRate && rates.totalBuyRate >= config.satoshiLimit) {
            if (!shouldCancelTrade() && proceedWithTrade()) {
                const newTradeData = {
                    marketName: config.marketName,
                    buyRate: rates.buyRate,
                    sellRate: rates.sellRate,
                    tradeUnits: rates.tradeUnits,
                    currency: config.currency,
                    buyCost: rates.totalBuyRate,
                    gainsPrice: rates.gainsPrice
                };
                updateActiveTrade(newTradeData);
                socket.emit('trade', tradeData);
                return true;
            } else
                cancelTrade();
        } else if (config.satoshiLimit > rates.totalBuyRate)
            updateTradeStatus({ status: 'error', msg: 'buying price is below satoshi limit (' + config.satoshiLimit + ')' });
    }
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
        (ticker.bid > rates.buyRate || ticker.ask < rates.sellRate))
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
                updateActiveTrade({ status: data.status });
                msg = 'Pending Transaction: ' + data.coin.Currency + ' Balance: ' + data.coin.Balance + ' Available: ' + data.coin.Available + ' Pending: ' + data.coin.Pending;
                $("#orderStatus").text(msg).show();
                setTimeout(trade, 2000);
                break;
            case 'pendingBuy':
            case 'pendingSell':
                updateActiveTrade({ status: data.status });
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

    if (!_.isEmpty(newTradeData)) {
        localStorage.tradeData = tradeData = _.merge(tradeData, newTradeData);
        console.log('updateActiveTrade:', tradeData);
        localStorage.tradeData = JSON.stringify(tradeData);
        updateActiveTradeMsg(tradeData);
    } else {
        localStorage.tradeData = tradeData = newTradeData;
        updateActiveTradeMsg(null);
    }
}

function calculateTradeGains(trades) {
    var tradeGains = [],
        buyTrade = null,
        sellTrade = null,
        totalGains = 0,
        amount = 0,
        quantity = 0;
    trades = _.sortBy(trades, function(trade) { return new Date(trade.Closed); });
    _.forEach(trades, function(trade) {
        buyTrade = _.find(tradeGains, { 'Exchange': trade.Exchange, OrderType: 'LIMIT_BUY' });
        sellTrade = _.find(tradeGains, { 'Exchange': trade.Exchange, OrderType: 'LIMIT_SELL' });
        quantity = (trade.Quantity == trade.QuantityRemaining) ? (trade.Quantity) : (trade.Quantity - trade.QuantityRemaining);
        quantity = parseFloat(quantity.toFixed(8));
        if (trade.OrderType === 'LIMIT_BUY') {
            if (buyTrade) {
                buyTrade.Quantity = buyTrade.Quantity + quantity;
                buyTrade.Amount += (trade.Price + trade.Commission);
            } else {
                amount = trade.Price + trade.Commission;
                buyTrade = { Exchange: trade.Exchange, OrderType: trade.OrderType, Quantity: quantity, Amount: amount };
                tradeGains.push(buyTrade);
            }
        }

        if (trade.OrderType === 'LIMIT_SELL') {
            if (sellTrade) {
                sellTrade.Quantity = sellTrade.Quantity + quantity;
                sellTrade.Amount += (trade.Price - trade.Commission);
            } else {
                amount = trade.Price - trade.Commission;
                sellTrade = { Exchange: trade.Exchange, OrderType: trade.OrderType, Quantity: quantity, Amount: amount };
                tradeGains.push(sellTrade);
            }
        }

        if (buyTrade && sellTrade) {
            if (buyTrade.Quantity === sellTrade.Quantity) {
                totalGains += (sellTrade.Amount - buyTrade.Amount);
                _.remove(tradeGains, { Exchange: trade.Exchange });
            }
            /*else
                               console.log('confusion:', buyTrade, sellTrade);*/
        }
    })
    console.log('tradeGains: ', tradeGains);
    return totalGains.toFixed(8);
}