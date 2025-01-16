const { Readable } = require("stream");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { Groq } = require("groq-sdk");

// Establish the AI Services
const services = {
  openAi:
    process.env.OPENAI_API_KEY !== undefined &&
    process.env.OPENAI_API_KEY !== "",
  azureOpenAi:
    process.env.AZURE_OPENAI_KEY !== undefined &&
    process.env.AZURE_OPENAI_KEY !== "",
  anthropic:
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.ANTHROPIC_API_KEY !== "",
  mistral:
    process.env.MISTRAL_API_KEY !== undefined &&
    process.env.MISTRAL_API_KEY !== "",
  groq:
    process.env.GROQ_API_KEY !== undefined && process.env.GROQ_API_KEY !== "",
  gemini:
    process.env.GEMINI_API_KEY !== undefined &&
    process.env.GEMINI_API_KEY !== "",
};

// Clients for AI services
const openAiClient = services.openAi
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const anthropicClient = services.anthropic
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const azureOpenAiClient = services.azureOpenAi
  ? new OpenAIClient(
      process.env.AZURE_OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_OPENAI_KEY)
    )
  : null;
const groqClient = services.groq
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Initialize Mistral client asynchronously
let mistralClient;
if (process.env.MISTRAL_API_KEY) {
  const { Mistral } = require("@mistralai/mistralai");
  mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
}

// Initialize Google Gemini client asynchronously
let geminiClient;
if (process.env.GEMINI_API_KEY) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const handlePrompt = async (promptConfig, sendToClient) => {
  console.log("promptConfig", promptConfig);
  const {
    account,
    provider,
    uuid,
    session,
    model,
    messageHistory,
    userPrompt,
    systemPrompt,
    temperature,
  } = promptConfig;

  try {
    let responseStream;
    let messages = null;
    if (messageHistory.length) messages = messageHistory;
    else
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

    switch (provider) {
      case "openAi":
        if (!services.openAi) break;
        responseStream = await handleOpenAiPrompt(account, {
          model,
          messages: messages,
          temperature: parseFloat(temperature) || 0.5,
          stream: true,
        });
        await handlePromptResponse(
          responseStream,
          provider,
          uuid,
          session,
          sendToClient
        );
        break;
      case "anthropic":
        if (!services.anthropic) break;
        responseStream = await handleAnthropicPrompt(account, {
          model,
          messages: messages,
          temperature: parseFloat(temperature) || 0.5,
          stream: true,
        });
        await handlePromptResponse(
          responseStream,
          provider,
          uuid,
          session,
          sendToClient
        );
        break;
      case "azureOpenAi":
        if (!services.azureOpenAi) break;
        responseStream = await handleAzureOpenAiPrompt(
          account,
          model,
          messages,
          {
            temperature: parseFloat(temperature) || 0.5,
          }
        );
        const stream = Readable.from(responseStream);
        handleAzureStream(stream, uuid, session, sendToClient);
        break;

      case "mistral":
        if (!services.mistral) break;
        // console.log("mistral messages", messages)
        responseStream = await handleMistralPrompt(account, {
          model,
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        });
        await handlePromptResponse(
          responseStream,
          provider,
          uuid,
          session,
          sendToClient
        );
        break;

      case "groq":
        if (!services.groq) break;
        // console.log("mistral messages", messages)
        responseStream = await handleGroqPrompt(account, {
          model,
          stream: true,
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        });
        await handlePromptResponse(
          responseStream,
          provider,
          uuid,
          session,
          sendToClient
        );
        break;

      case "gemini":
        if (!services.gemini) break;
        // console.log("mistral messages", messages)
        responseStream = await handleGeminiPrompt(account, {
          model,
          stream: true,
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        });
        await handlePromptResponse(
          responseStream,
          provider,
          uuid,
          session,
          sendToClient
        );
        break;

      default:
        sendToClient(
          uuid,
          session,
          "ERROR",
          JSON.stringify({
            message: "Provider not supported or not activated.",
          })
        );
        break;
    }
  } catch (error) {
    sendToClient(uuid, session, "ERROR", JSON.stringify(error));
    console.error("Prompt error", error);
  }
};

const handleOpenAiPrompt = async (account, promptConfig) => {
  let client = openAiClient;
  if (account?.openAiApiKey)
    client = new OpenAI({ apiKey: account.openAiApiKey });
  const responseStream = await client.chat.completions.create(promptConfig);
  return responseStream;
};

const handleAnthropicPrompt = async (account, promptConfig) => {
  let client = anthropicClient;
  if (account?.anthropicApiKey)
    client = new Anthropic({ apiKey: account.anthropicApiKey });

  // Find the first system message if it exists
  let systemPrompt = null;
  const messages = promptConfig.messages
    .filter((msg) => msg?.content?.length)
    .map((msg) => {
      if (msg.role === "system") {
        if (!systemPrompt) systemPrompt = msg.content;
        // Convert system messages to assistant in the array
        return { role: "assistant", content: msg.content };
      }
      return msg;
    });

  const anthropicPrompt = {
    messages,
    model: promptConfig.model,
    max_tokens: 4096,
    stream: true,
    temperature: promptConfig.temperature || 0.5,
  };

  // Add system parameter if we found a system message
  if (systemPrompt) {
    anthropicPrompt.system = systemPrompt;
  }

  console.log("new anthropic prompt", anthropicPrompt);

  const responseStream = await client.messages.create(anthropicPrompt);
  return responseStream;
};

const handleMistralPrompt = async (account, promptConfig) => {
  let client = mistralClient;
  if (client) {
    if (account?.mistralApiKey)
      client = new MistralClient({ apiKey: account.mistralApiKey });
    const chatStreamResponse = await client.chat.stream(promptConfig);
    return chatStreamResponse;
  }
};

const handleGroqPrompt = async (account, promptConfig) => {
  let client = groqClient;
  if (account?.groqApiKey) client = new Groq({ apiKey: account.groqApiKey });
  const responseStream = await client.chat.completions.create(promptConfig);
  return responseStream;
};

const handleGeminiPrompt = async (account, promptConfig) => {
  try {
    let client = geminiClient;
    if (account?.geminiApiKey) {
      client = new GoogleGenerativeAI(account.geminiApiKey);
    }
    
    const model = client.getGenerativeModel({ model: promptConfig.model });

    let historyForGemini = promptConfig.messages.slice(0, -1).filter((msg) => msg?.content?.length).map((msg) => {
      if (msg.role === "system") msg.role = "model";
      if (msg.role === "assistant") msg.role = "model";
      return { 
        role: msg.role, 
        parts: [{ text: msg.content }] 
      };
    });

    const lastMessage = promptConfig.messages.at(-1);
    const messageToSend = lastMessage.content;

    const chat = model.startChat({
      history: historyForGemini,
    });

    // Return the result directly without awaiting
    let result = await chat.sendMessageStream(messageToSend);
    return result;
  } catch (error) {
    console.error('Error in handleGeminiPrompt:', error);
    throw error;
  }
};

// function convertArray(array) {
//   let result = {
//     system: null,
//     messages: [],
//   };

//   array.forEach((item, index) => {
//     if (index === 0 && item.role === "system") {
//       // If the first item has role 'system', store its content separately
//       result.system = item.content;
//     } else {
//       // For all other items, convert 'system' to 'assistant'
//       let role = item.role === "system" ? "assistant" : item.role;
//       // Add the message object to the messages array
//       result.messages.push({ role: role, content: item.content });
//     }
//   });

//   return result;
// }

const handleAzureOpenAiPrompt = async (
  account,
  model,
  messages,
  promptConfig
) => {
  let client = azureOpenAiClient;
  if (account?.azureOpenAiApiKey && account?.azureOpenAiApiEndpoint) {
    client = new OpenAIClient(
      azure.azureOpenAiApiEndpoint,
      new AzureKeyCredential(azure.azureOpenAiApiKey)
    );
  }
  const responseStream = await client.streamChatCompletions(
    model,
    messages,
    promptConfig
  );
  return responseStream;
};

const handlePromptResponse = async (
  responseStream,
  provider,
  uuid,
  session,
  sendToClient
) => {


  if (provider === "gemini") {
    // Gemini needs to iterate over responseStream.stream
    for await (const chunk of responseStream.stream) {
      sendToClient(uuid, session, "message", chunk.text());
    }
    sendToClient(uuid, session, "EOM", null);
    return;
  }

  for await (const part of responseStream) {
    try {
      if (provider === "openAi" && part?.choices?.[0]?.delta?.content) {
        sendToClient(uuid, session, "message", part.choices[0].delta.content);
      } else if (provider === "anthropic" && part.type != "message_stop") {
        // console.log('part', part)
        let text = part?.content_block?.text || part?.delta?.text || "";
        sendToClient(uuid, session, "message", text);
      }
      // Add a condition for Mistral
      else if (
        provider === "mistral" &&
        part.data.choices[0].delta.content !== undefined &&
        !part.data.choices[0].finishReason
      ) {
        console.log(part.data.choices[0]);
        sendToClient(
          uuid,
          session,
          "message",
          part.data.choices[0].delta.content
        );
      }
      // Add a condition for Mistral
      else if (provider === "groq" && part?.choices?.[0]?.delta?.content) {
        // console.log(part.choices[0])
        sendToClient(uuid, session, "message", part.choices[0].delta.content);
      } 
   
      
      
      else {
        sendToClient(uuid, session, "EOM", null);
      }
    } catch (error) {
      sendToClient(uuid, session, "ERROR", JSON.stringify(error));
      console.error("Could not process stream message", error);
    }
  }
};

const handleAzureStream = (stream, uuid, session, sendToClient) => {
  stream.on("data", (event) => {
    event.choices.forEach((choice) => {
      if (choice.delta?.content !== undefined) {
        sendToClient(uuid, session, "message", choice.delta.content);
      }
    });
  });

  stream.on("end", () => sendToClient(uuid, session, "EOM", null));
  stream.on("error", (error) =>
    sendToClient(
      uuid,
      session,
      "ERROR",
      JSON.stringify({ message: "Stream error.", error: error.message })
    )
  );
};

// function formatAnthropic(messageHistory) {
//   let anthropicString = "";
//   messageHistory.forEach((message, index) => {
//     const prompt =
//       message.role === "system"
//         ? index === 0
//           ? ""
//           : Anthropic.AI_PROMPT
//         : Anthropic.HUMAN_PROMPT;
//     anthropicString += prompt + message.content;
//   });
//   anthropicString += Anthropic.AI_PROMPT;
//   return anthropicString; // Return the resulting string
// }

module.exports = {
  handlePrompt,
  // Export any other functions that are needed externally
};
