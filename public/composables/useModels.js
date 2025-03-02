// composables/useModels.js
const modelRegistry = Vue.ref(new Map());  // Canvas model cards registry
const serverModels = Vue.ref([]); // Initialize as empty array
const lastModelConfig = Vue.ref(null);

export function useModels() {
  const availableModels = Vue.ref([]);
  const isLoading = Vue.ref(false);

  // Helper Functions
  const isValidField = (field) => field && typeof field === 'string' && field.trim().length > 0;

  const isValidModel = (model) => {
    // Basic required fields for both server and card models
    if (!model || typeof model !== 'object') return false;
    
    // For card models, we need these additional fields
    if (model.displayName !== undefined) {  // This indicates it's a card model
      if (!isValidField(model.displayName) || 
          !isValidField(model.model) || 
          !isValidField(model.provider) || 
          !isValidField(model.apiKey)) {
        return false;
      }

      // Special case for AzureAI
      if (model.provider === 'AzureAI' && !isValidField(model.apiEndpoint)) {
        return false;
      }
      return true;
    }
    
    // For server models, we only need these fields
    return model.name?.en && 
           isValidField(model.model) && 
           isValidField(model.provider);
  };

  const areModelConfigsEqual = (prev, curr) => {
    if (!prev || !curr) return false;
    return JSON.stringify(prev) === JSON.stringify(curr);
  };

  // Server Model Functions
  const fetchServerModels = async () => {
    try {
      isLoading.value = true;
      
      // Fetch all models first
      const allModelsResponse = await fetch('/api/models');
      if (allModelsResponse.ok) {
        const allModelsData = await allModelsResponse.json();
        serverModels.value = allModelsData.map(model => ({
          displayName: `${model.provider}: ${model.name.en}`,
          name: { en: model.name.en, fr: model.name.fr },
          model: model.model,
          provider: model.provider,
          apiKey: model.apiKey,
          apiEndpoint: model.apiEndpoint
        }));
      }

      // Then fetch Ollama specifically
      const ollamaResponse = await fetch('/api/ollama/models');
      if (ollamaResponse.ok) {
        const ollamaData = await ollamaResponse.json();
        const ollamaModels = ollamaData.models?.map(model => ({
          displayName: `Ollama: ${model.name}`,
          name: { en: `Ollama: ${model.name}`, fr: `Ollama: ${model.name}` },
          model: model.name,
          provider: 'ollama',
          local: true,
          apiKey: 'local'
        })) || [];
        
        serverModels.value = [...serverModels.value, ...ollamaModels];
      }
      
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      isLoading.value = false;
    }
  };

  // Canvas Model Functions
  const updateModelsFromCards = (cards) => {
    const modelCards = cards.filter(card => card.type === 'model');
    
    const currentConfig = modelCards.map(card => ({
      cardId: card.uuid,
      models: Vue.toRaw(card.data.models || [])
        .filter(isValidModel)
        .map(model => {
          return {
            name: { 
              en: model.displayName,
              fr: model.displayName
            },
            model: model.model,
            provider: model.provider,
            apiKey: model.apiKey,
            ...(model.provider === 'AzureAI' && { apiEndpoint: model.apiEndpoint }),
            _fromCard: true
          };
        })
    }));
    if (!areModelConfigsEqual(lastModelConfig.value, currentConfig)) {
      lastModelConfig.value = currentConfig;
      modelRegistry.value = new Map(
        currentConfig.map(config => [config.cardId, config.models])
      );
    }
  };

  const getModelsForCard = (cardId) => {
    return modelRegistry.value.get(cardId) || [];
  };

  // Combined Models
  const allModels = Vue.computed(() => {
    const canvasModels = Array.from(modelRegistry.value.values()).flat();
    const uniqueModels = new Map();

    // 1. Canvas models (highest priority)
    canvasModels.forEach(model => {
      if (model?.model) uniqueModels.set(model.model, model);
    });

    // 2. Non-Ollama server models
    serverModels.value.forEach(model => {
      if (model?.model && model.provider !== 'ollama') {
        uniqueModels.set(model.model, model);
      }
    });

    // 3. Ollama models (lowest priority)
    serverModels.value.forEach(model => {
      if (model?.model && model.provider === 'ollama') {
        uniqueModels.set(model.model, model);
      }
    });

    return Array.from(uniqueModels.values());
  });

  const localOllamaModels = Vue.ref([]);
  const isOllamaAvailable = Vue.ref(false);
  const ollamaStatus = Vue.ref('checking'); // 'checking', 'available', 'unavailable'

  const detectOllamaModels = async () => {
    try {
      ollamaStatus.value = 'checking';
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) throw new Error('Ollama API returned an error');
      
      const data = await response.json();
      localOllamaModels.value = data.models?.map(model => ({
        name: { en: `Ollama: ${model.name}`, fr: `Ollama: ${model.name}` },
        model: model.name,
        provider: 'ollama',
        local: true
      })) || [];
      
      isOllamaAvailable.value = true;
      ollamaStatus.value = 'available';
      
      // Merge with other available models
      availableModels.value = [...availableModels.value, ...localOllamaModels.value];
      
    } catch (error) {
      console.warn('Ollama detection failed:', error);
      isOllamaAvailable.value = false;
      ollamaStatus.value = 'unavailable';
    }
  };

  const generateWithOllama = async (model, prompt, systemPrompt = '') => {
    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      
      const response = await fetch('/api/ollama/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text;
      
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw new Error(`Failed to generate with Ollama: ${error.message}`);
    }
  };

  return {
    updateModelsFromCards,
    getModelsForCard,
    fetchServerModels,
    allModels,
    serverModels,
    modelRegistry,
    availableModels,
    localOllamaModels,
    isOllamaAvailable,
    ollamaStatus,
    detectOllamaModels,
    generateWithOllama,
    isLoading
  };
}