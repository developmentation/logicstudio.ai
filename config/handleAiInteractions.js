const { Readable } = require("stream");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { Groq } = require("groq-sdk");
const { Mistral } = require("@mistralai/mistralai");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// Helper function to create provider-specific clients
const createClient = async (provider, modelConfig) => {
    // Normalize provider to lowercase
    const normalizedProvider = provider.toLowerCase();
    
    // Define which providers need credentials
    const requiresCredentials = {
        'openai': true,
        'anthropic': true,
        'azureai': true,
        'mistral': true,
        'groq': true,
        'gemini': true,
        'ollama': false,
        'xai': true
    };

    const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    const credentials = modelConfig.apiKey || envKey;
    
    // Check credentials only for providers that require them
    if (requiresCredentials[provider.toLowerCase()] && !credentials) {
        throw new Error(`No API key available for ${provider}`);
    }

  // console.log('LLM Request for ', provider)

  switch (provider.toLowerCase()) {
    case 'openai':
      return new OpenAI({ apiKey: credentials });
    case 'anthropic':
      return new Anthropic({ apiKey: credentials });
    case 'azureai':
      const endpoint = credentials?.apiEndpoint || process.env.AZUREAI_ENDPOINT;
      if (!endpoint) {
        throw new Error('AzureAI requires both an API key and endpoint. No endpoint was provided.');
      }
      if (!credentials) {
        throw new Error('AzureAI requires both an API key and endpoint. No API key was provided.');
      }
      return new OpenAIClient(endpoint, new AzureKeyCredential(credentials));
    case 'mistral':
      return new Mistral({ apiKey: credentials });
    case 'groq':
      return new Groq({ apiKey: credentials });
    case 'gemini':
      return new GoogleGenerativeAI(credentials);
    case 'ollama':
      console.log('Creating Ollama client with model:', modelConfig.model);
      return {
        provider: 'ollama',
        model: modelConfig.model,
        completions: {
          create: async (config) => {
            const response = await fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: modelConfig.model,
                prompt: config.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
                stream: true
              })
            });
            
            if (!response.ok) {
              throw new Error('Ollama generation failed');
            }
            
            return response.body;
          }
        }
      };
    case 'xai':
      return new OpenAI({
        apiKey: credentials,
        baseURL: "https://api.x.ai/v1",
      });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

// Main handler function
// Validate message format
const validateMessages = (messages) => {
  return messages.every(msg => 
    msg && 
    typeof msg === 'object' && 
    typeof msg.content === 'string' &&
    ['user', 'system', 'assistant'].includes(msg.role)
  );
};

const handlePrompt = async (promptConfig, sendToClient) => {
  const {
    model: modelConfig,
    uuid,
    session,
    messageHistory,
    userPrompt,
    systemPrompt,
    temperature = 0.5,
  } = promptConfig;

  try {
    const messages = messageHistory.length ? messageHistory : [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const client = await createClient(modelConfig.provider, modelConfig);

    let promptPayload = {
      model: modelConfig.model,
      messages,
      temperature: Math.max(0, Math.min(1, parseFloat(temperature) || 0.5)),
      stream: true,
    };

    const responseStream = await handleProviderPrompt(
      client,
      modelConfig.provider,
      promptPayload
    );

    await handleProviderResponse(
      responseStream,
      modelConfig.provider,
      uuid,
      session,
      sendToClient
    );

  } catch (error) {
    sendToClient(uuid, session, "ERROR", JSON.stringify({
      message: error.message || "An error occurred while processing the prompt",
      details: error.stack
    }));
  }
};

// Provider-specific prompt handling
const handleProviderPrompt = async (client, provider, config) => {
  switch (provider.toLowerCase()) {
    case 'openai':
      // console.log("handleProviderPrompt, openAI",{client,provider,config})
      return client.chat.completions.create(config);

    case 'anthropic':
      const anthropicConfig = prepareAnthropicConfig(config);
      return client.messages.create(anthropicConfig);

    case 'azureai':
      return client.streamChatCompletions(
        config.model,
        config.messages,
        { temperature: config.temperature }
      );

    case 'mistral':
      return client.chat.stream(config);

    case 'groq':
      return client.chat.completions.create(config);

    case 'gemini':
      return handleGeminiPrompt(client, config);

    case 'ollama':
      if (!client?.completions?.create) {
        console.error('Invalid client:', client);
        throw new Error('Invalid Ollama client configuration');
      }
      return client.completions.create(config);

    case 'xai':
      return client.chat.completions.create(config);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

// Prepare Anthropic-specific configuration
const prepareAnthropicConfig = (config) => {
  const systemMessage = config.messages.find(msg => msg.role === "system");
  const messages = config.messages
    .filter(msg => msg?.content?.length)
    .map(msg => ({
      role: msg.role === "system" ? "assistant" : msg.role,
      content: msg.content
    }));

  return {
    messages,
    model: config.model,
    max_tokens: 4096,
    stream: true,
    temperature: config.temperature,
    ...(systemMessage && { system: systemMessage.content })
  };
};

// Handle Gemini-specific configuration
const handleGeminiPrompt = async (client, config) => {
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];

  const modelConfigs = {
    model: config.model,
    ...(config.messages[0]?.role === "system" && config.messages[0]?.content && {
      systemInstruction: config.messages[0].content
    })
  };

  // Filter out empty messages and system messages after using for system instruction
  const filteredMessages = config.messages
    .filter((msg, index) => 
      msg?.content?.length && 
      !(index === 0 && msg.role === "system"));

  const messages = config.messages
    .filter(msg => msg.role !== "system" && msg?.content?.length)
    .map(msg => ({
      role: msg.role === "assistant" ? "model" : msg.role,
      parts: [{ text: msg.content }]
    }));

  const model = client.getGenerativeModel(modelConfigs, safetySettings);
  const chat = model.startChat({
    history: messages.slice(0, -1)
  });

  return chat.sendMessageStream(messages[messages.length - 1].parts[0].text);
};

// Handle provider responses
const handleProviderResponse = async (responseStream, provider, uuid, session, sendToClient) => {
    provider = provider.toLowerCase();

    if (provider === 'ollama') {
        try {
            const reader = responseStream.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const response = JSON.parse(line);
                        if (response.response) {
                            sendToClient(uuid, session, "message", response.response);
                        }
                    } catch (e) {
                        // Silent catch for parsing errors
                    }
                }
            }
            
            sendToClient(uuid, session, "EOM", null);
            
        } catch (error) {
            sendToClient(uuid, session, "ERROR", JSON.stringify({
                message: "Error processing Ollama stream",
                error: error.message
            }));
        }
        return;
    }

    // Handle Gemini separately
    if (provider === "gemini") {
        for await (const chunk of responseStream.stream) {
            sendToClient(uuid, session, "message", chunk.text());
        }
        sendToClient(uuid, session, "EOM", null);
        return;
    }

    // Handle Azure separately
    if (provider === "azureai") {
        const stream = Readable.from(responseStream);
        handleAzureStream(stream, uuid, session, sendToClient);
        return;
    }

    // Handle other providers
    let messageEnded = false;
    for await (const part of responseStream) {
        try {
            let content = null;

            switch (provider) {
                case "openai":
                    content = part?.choices?.[0]?.delta?.content;
                    messageEnded = part?.choices?.[0]?.finish_reason === "stop";
                    break;
                case "anthropic":
                    if (part.type === "message_stop") {
                        messageEnded = true;
                    } else {
                        content = part?.content_block?.text || part?.delta?.text || "";
                    }
                    break;
                case "mistral":
                    content = part?.data?.choices?.[0]?.delta?.content;
                    messageEnded = part?.data?.choices?.[0]?.finishReason === "stop";
                    break;
                case "groq":
                    content = part?.choices?.[0]?.delta?.content;
                    messageEnded = part?.choices?.[0]?.finish_reason === "stop";
                    break;
            }

            if (content) {
                sendToClient(uuid, session, "message", content);
            }
            
            // Send EOM if we've reached the end of the message
            if (messageEnded) {
                sendToClient(uuid, session, "EOM", null);
            }
        } catch (error) {
            console.error(`Error processing ${provider} stream message:`, error);
            sendToClient(uuid, session, "ERROR", JSON.stringify({
                message: "Error processing stream message",
                error: error.message,
                provider: provider
            }));
        }
    }

    // Send final EOM if not already sent
    if (!messageEnded) {
        sendToClient(uuid, session, "EOM", null);
    }
};

// Handle AzureAI specific stream
const handleAzureStream = (stream, uuid, session, sendToClient) => {
    stream.on("data", (event) => {
        event.choices.forEach((choice) => {
            if (choice.delta?.content !== undefined) {
                sendToClient(uuid, session, "message", choice.delta.content);
            }
        });
    });

    stream.on("end", () => sendToClient(uuid, session, "EOM", null));
    stream.on("error", (error) => {
        sendToClient(uuid, session, "ERROR", JSON.stringify({
            message: "Stream error.",
            error: error.message
        }));
    });
};

module.exports = {
    handlePrompt
};