//Inherits KnowledgeSet permission and requires a knowledgeSetUuid for each transaction
const ApiError = require('../../error/ApiError');

const logger = require('../../middleware/logger');
const uuidv4 = require('uuid').v4;
const packageInfo = require('../../package.json');

exports.getStats = async function (req, res, next) {
    try {
        //Get the node version for troubleshooting
        const version = packageInfo.version;

        // Send the counts as JSON response
        res.status(200).json({
            message: "Here are relevants stats",
            payload: {
                version: version // Include the version in the response
            }
        });
    } catch (error) {
        next(ApiError.internal("An error occurred while retrieving stats"));
    }
};
