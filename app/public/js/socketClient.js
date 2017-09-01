var socket = io.connect('http://localhost:3000');

socket.on('connect', function(data) {
    socket.emit('join', 'Hello World from client');
});


socket.on('broad', function(data) {
    const fillRowTemplate = document.getElementById("template-fill-row").innerHTML;
    var fillRow = '';

    if (!_.isEmpty(data.Buys))
        newTransaction(data.Buys, '#buysContainer');

    if (!_.isEmpty(data.Sells))
        newTransaction(data.Sells, '#sellsContainer');

    if (!_.isEmpty(data.Fills)) {
        _.forEach(data.Fills, function(fill, key) {
            timestamp = new Date(fill.TimeStamp + 'Z').toLocaleString('en-US', { timeZone: "America/New_York" });
            fillRow = fillRowTemplate.replace(/{{data1}}/g, fill.OrderType)
                .replace(/{{data2}}/g, fill.Rate)
                .replace(/{{data3}}/g, fill.Quantity)
                .replace(/{{data4}}/g, timestamp);
        });

        if (fillRow)
            $("#fillsContainer").prepend(fillRow);
    }

    highlightRates();
    quantityClicked(selectedQuantity);
});

socket.on('ticker', function(data) {
    if (data) {
        const tickerRowTemplate = document.getElementById("template-ticker-row").innerHTML,
            tickerRow = tickerRowTemplate.replace(/{{data1}}/g, data.ticker + ': ' + data.price + ' ($' + (data.price * data.usdPrice) + ')')
            .replace(/{{data2}}/g, data.price);

        ticker = data;
        localStorage.ticker = JSON.stringify(ticker);
        $("#tickerContainer").prepend(tickerRow);
    }
    //updateRates(data.price);
});

socket.on('tradeStatus', function(data) {
    updateTradeStatus(data);
});

socket.on('disconnect', () => {
    console.log('client successfully disconnected')

    // clear things
    $('#buysContainer').children().remove();
    $('#sellsContainer').children().remove();
    $('#fillsContainer').children().remove();
    $('#tickerContainer').children().remove();
    socket.open();
    initUpdates();
});

socket.on('profitTicker', function(data) {
    if (data) {
        console.log('profitTicker: ', data);
        const buttonTemplate = document.getElementById("template-profit-ticker-button").innerHTML,
            tickerRow = buttonTemplate.replace(/{{data1}}/g, data.ticker.MarketName)
            .replace(/{{data2}}/g, 'Bid: ' + data.ticker.Ask + ',Sell: ' + data.ticker.Bid + ',Last: ' + data.ticker.Last + ',Gains: ' + data.gains);

        if ($('button#' + data.ticker.MarketName).length)
            $('button#' + data.ticker.MarketName).replaceWith(tickerRow);
        else
            $("#profit-ticker-container").prepend(tickerRow);

        $("#profit-count").text($("#profit-ticker-container").children(".btn").length);
    }
});