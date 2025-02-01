// composables/useModels.js

const modelRegistry = Vue.ref(new Map());  // Canvas model cards registry
const serverModels = Vue.ref([]);  // Models from API
const lastModelConfig = Vue.ref(null);

export const useModels = () => {
  // Helper Functions
  const isValidField = (field) => field && typeof field === 'string' && field.trim().length > 0;

  const isValidModel = (model) => {
    if (!isValidField(model.displayName) || 
        !isValidField(model.model) || 
        !isValidField(model.provider) || 
        !isValidField(model.apiKey)) {
      return false;
    }

    if (model.provider === 'AzureAI' && !isValidField(model.apiEndpoint)) {
      return false;
    }

    return true;
  };

  const areModelConfigsEqual = (prev, curr) => {
    if (!prev || !curr) return false;
    return JSON.stringify(prev) === JSON.stringify(curr);
  };

  // Server Model Functions
  const fetchServerModels = async () => {
    try {
      const response = await axios.get("/api/models");  // New dedicated models endpoint
      serverModels.value = response.data.payload;
      console.log("Loaded the following models", serverModels.value)
    } catch (error) {
      console.error("Error fetching models:", error);
      // Keep existing models on error
    }
  };

  // Canvas Model Functions
  const updateModelsFromCards = (cards) => {
    const modelCards = cards.filter(card => card.type === 'model');
    
    const currentConfig = modelCards.map(card => ({
      cardId: card.uuid,
      models: Vue.toRaw(card.models || [])
        .filter(isValidModel)
        .map(model => ({
          name: { 
            en: model.displayName,
            fr: model.displayName
          },
          model: model.model,
          provider: model.provider,
          apiKey: model.apiKey,
          ...(model.provider === 'AzureAI' && { apiEndpoint: model.apiEndpoint })
        }))
    }));

    // Only update if configuration has changed
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
    // Get unique models by combining server models and canvas models
    const canvasModels = Array.from(modelRegistry.value.values()).flat();
    
    // Create a Map to track unique models by model ID
    const uniqueModels = new Map();
    
    // Add server models first (these will be overridden by canvas models if they exist)
    serverModels.value.forEach(model => {
      uniqueModels.set(model.model, model);
    });
    
    // Add canvas models (these will override server models with the same ID)
    canvasModels.forEach(model => {
      uniqueModels.set(model.model, model);
    });
    
    return Array.from(uniqueModels.values());
  });



  return {
    // Core functions
    updateModelsFromCards,
    getModelsForCard,
    fetchServerModels,
    
    // Computed properties
    allModels,
    
    // Raw refs (in case needed)
    serverModels,
    modelRegistry
  };
};