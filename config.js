module.exports = function(env) {
    switch (env) {
        case 'dev':
            return {
                bittrex: {
                    apikey: 'API KEY COMES FROM CLIENT',
                    apisecret: 'API SECRET COMES FROM CLIENT',
                    verbose: true
                }
            }
        case 'prod':
            return {
                bittrex: {
                    apikey: 'API KEY COMES FROM CLIENT',
                    apisecret: 'API SECRET COMES FROM CLIENT',
                    verbose: true
                }
            }
        default:
            return {
                bittrex: {
                    apikey: 'API KEY COMES FROM CLIENT',
                    apisecret: 'API SECRET COMES FROM CLIENT',
                    verbose: true
                }
            }
    }
}