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
            fillRow = fillRowTemplate.replace(/{{data1}}/g, fill.OrderType)
                .replace(/{{data2}}/g, fill.Rate)
                .replace(/{{data3}}/g, fill.Quantity)
                .replace(/{{data4}}/g, fill.TimeStamp);
        });

        if (fillRow)
            $("#fillsContainer").prepend(fillRow);
    }

    highlightRates();
    quantityClicked(selectedQuantity);
});

socket.on('ticker', function(data) {
    const tickerRowTemplate = document.getElementById("template-ticker-row").innerHTML,
        tickerRow = tickerRowTemplate.replace(/{{data1}}/g, data.ticker + ': ' + data.price + ' ($' + (data.price * data.usdPrice) + ')')
        .replace(/{{data2}}/g, data.price);

    ticker = data;

    $("#tickerContainer").prepend(tickerRow);
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