 Use at your own risk!
 =====================
This client application is used for trading in the bittrex exchange.
You'll need to have [nodejs installed](https://nodejs.org/en/download/package-manager/) on your machine to run this client

This application uses the node package [node.bittrex.api](https://github.com/dparlevliet/node.bittrex.api)

If you have any questions or feedback - I can be contacted at luis@devluismiranda.com

This Library is licensed under the [MIT license](https://github.com/dparlevliet/node.bittrex.api/blob/master/LICENSE).

Before you start
================
Keep in mind that this client's purpose is for trading in the bittrex exchange; so, be thoughtful and take the time to understand how to use this application before you start trading.

- In order to start trading, make sure that you create an api key in bittrex with the following permissions:

![image](https://user-images.githubusercontent.com/1113806/30525069-ed44bfce-9bc4-11e7-9f7d-d9cb3916771c.png)

- When the page is loaded for the first time, click on 'Update Settings' and enter the api key and secret key to start trading - this information is only maintained in the browser local storage. Make sure to keep this information safe, in case the data is loss and needs to be re-entered.

- After updating the settings for the first time, refresh the page to reconnect to the server with the api information - this only needs to be done when the api info is entered, from thereon, it'll be loaded from the local storage