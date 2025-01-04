//Configs to the frontend
const ApiError = require('../../error/ApiError');
const logger = require('../../middleware/logger');

exports.getConfigs = async function (req, res, next) {
    try {
        //Get the node version for troubleshooting
        const payload = {
            WEBSOCKET_URL:process.env.WEBSOCKET_URL,
            API_URL:process.env.API_URL,
        };

        // Send the counts as JSON response
        res.status(200).json({
            message: "Here are the configuration variables from the server side",
            payload:payload
        });
    } catch (error) {
        next(ApiError.internal("An error occurred while retrieving stats"));
    }
};
