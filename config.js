module.exports = function(env) {
    switch (env) {
        case 'dev':
            return {
                bittrex: {
                    apikey: '737097941bb841cd90ed55f38fc57e68',
                    apisecret: '8b8db7e322034b1bac1150ce081bc9da',
                    verbose: false
                }
            }
        case 'prod':
            return {
                bittrex: {
                    apikey: '737097941bb841cd90ed55f38fc57e68',
                    apisecret: '8b8db7e322034b1bac1150ce081bc9da',
                    verbose: false
                }
            }
        default:
            return {
                bittrex: {
                    apikey: '737097941bb841cd90ed55f38fc57e68',
                    apisecret: '8b8db7e322034b1bac1150ce081bc9da',
                    verbose: false
                }
            }
    }
}