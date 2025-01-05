//Configs to the frontend
const ApiError = require("../../error/ApiError");
const logger = require("../../middleware/logger");

exports.getConfigs = async function (req, res, next) {
  try {
    //Get the node version for troubleshooting
    const payload = {
      WEBSOCKET_URL: process.env.WEBSOCKET_URL,
      API_URL: process.env.API_URL,

      //Come here and set your own models as you prefer.
      //Make sure that you add the associated API keys for:
      /*
            OpenAI
            Anthrpoic
            Mistral
            Groq
            Azure AI
            X
            */
      models: [
        {
          name: { en: "Claude Sonnet 3.5", fr: "Claude Sonnet 3.5" },
          model: "claude-3-5-sonnet-20241022",
          provider: "anthropic",
        },
        {
          name: { en: "GPT 4o", fr: "GPT 4o" },
          model: "gpt-4o",
          provider: "openAi",
        },
        {
          name: { en: "GPT o1", fr: "GPT o1" },
          model: "o1",
          provider: "openAi",
        },
      ],
    };

    // Send the counts as JSON response
    res.status(200).json({
      message: "Here are the configuration variables from the server side",
      payload: payload,
    });
  } catch (error) {
    next(ApiError.internal("An error occurred while retrieving stats"));
  }
};
