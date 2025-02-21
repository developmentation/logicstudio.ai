// composables/useModels.js
const modelRegistry = Vue.ref(new Map());  // Canvas model cards registry
const serverModels = Vue.ref([]); // Initialize as empty array
const lastModelConfig = Vue.ref(null);

export const useModels = () => {
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
      const response = await axios.get("/api/models");
      if (response.data?.payload && Array.isArray(response.data.payload)) {
        serverModels.value = response.data.payload;
      } else {
        console.warn("Invalid server models response format", response.data);
        serverModels.value = [];
      }
      console.log("Loaded the following models", serverModels.value);
    } catch (error) {
      console.error("Error fetching models:", error);
      serverModels.value = []; // Ensure it's always an array
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
    // Get canvas models
    const canvasModels = Array.from(modelRegistry.value.values()).flat();
    
    // If we have any canvas models, return ONLY those
    if (canvasModels.length > 0) {
      return canvasModels;
    }
    
    // Otherwise return server models
    const currentServerModels = Array.isArray(serverModels.value) ? serverModels.value : [];
    return currentServerModels;
  });

  return {
    updateModelsFromCards,
    getModelsForCard,
    fetchServerModels,
    allModels,
    serverModels,
    modelRegistry
  };
};