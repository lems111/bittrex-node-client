module.exports = function(env) {
    switch (env) {
        case 'dev':
            return {
                bittrex: {
                    apikey: 'API KEY COMES FROM CLIENT',
                    apisecret: 'API SECRET COMES FROM CLIENT',
                    verbose: false
                }
            }
        case 'prod':
            return {
                bittrex: {
                    apikey: 'API KEY COMES FROM CLIENT',
                    apisecret: 'API SECRET COMES FROM CLIENT',
                    verbose: false
                }
            }
        default:
            return {
                bittrex: {
                    apikey: 'API KEY COMES FROM CLIENT',
                    apisecret: 'API SECRET COMES FROM CLIENT',
                    verbose: false
                }
            }
    }
}