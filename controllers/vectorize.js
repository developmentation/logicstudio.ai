const ApiError = require("../error/ApiError");
const logger = require("../middleware/logger");
const OpenAI = require("openai");

//###############################
//Controller Endpoints Below
//###############################

// Perform a vectorization function
exports.vectorize = async function (req, res, next) {
  if (process.env.OPENAI_API_KEY) {
    try {
      //Vectorize the text provided by the POST request
      const text = req.body.text || null;
      vectorize(text)
        .then((vectorizedText) => {
          res.status(201).send({
            message: "Text embeddings created",
            payload: vectorizedText.data[0].embedding,
          });
        })
        .catch((err) => {
          logger.error("Error attempting to vectorize:", err);
          throw ApiError.badRequest("Error processing vector calcuation.");
        });
    } catch (error) {
      logger.error("Vectorized text error:", error);
      throw ApiError.internal({
        message: "Error processing vectors",
        error: error,
      });
    }
  } else {
    logger.error("Missing OpenAI Key:");

    throw ApiError.badRequest(
      "No OpenAI Key present in the .env configuration."
    );
  }
};

async function vectorize(text) {
  return new Promise(async (resolve, reject) => {
    try {
      const openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      if (openAiClient) {
        let model = process.env.OPENAI_EMBEDDINGS_MODEL;
        let params = {
          model: model, // Specify the model you want to use
          input: text,
        };
        const embeddedText = await openAiClient.embeddings.create(params);
        resolve(embeddedText);
      }
    } catch (error) {
      logger.error(error);
      reject(error);
    }
  });
}
