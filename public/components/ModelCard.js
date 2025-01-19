// ModelCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";

export default {
  name: "ModelCard",
  components: { BaseCard },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
  },
  template: `
  <div>
    <BaseCard
      :card-data="localCardData"
      :zoom-level="zoomLevel"
      :z-index="zIndex"
      :is-selected="isSelected"
      @update-position="$emit('update-position', $event)"
      @update-card="handleCardUpdate"
      @close-card="$emit('close-card', $event)"
      @clone-card="uuid => $emit('clone-card', uuid)"
      @select-card="$emit('select-card', $event)"
    >
      <div class="space-y-2 text-gray-300" v-show="localCardData.display == 'default'">
        <div class="mt-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-xs font-medium text-gray-400">Models:</label>
            <button 
              class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
              @click="addModel"
            >+ Add Model</button>
          </div>
          
          <div class="space-y-2">
            <div 
              v-for="(model, index) in localCardData.models" 
              :key="model.id"
              class="space-y-2 bg-gray-900 p-2 rounded"
            >

              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 w-6">{{ index + 1 }}.</span>
                <select
                  v-model="model.provider"
                  :name="'provider_' + randomId()"
                  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
                  autocomplete="off"
                  data-lpignore="true"
                  @mousedown.stop
                  @change="handleCardUpdate"
                >
                  <option v-for="provider in providers" :key="provider" :value="provider">
                    {{ provider }}
                  </option>
                </select>
                <button 
                  class="text-gray-400 hover:text-gray-200"
                  @click.stop="removeModel(index)"
                  @mousedown.stop
                  @touchstart.stop
                >×</button>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 w-20">Name:</span>
                <input
                  v-model="model.displayName"
                  :name="'display_name_' + randomId()"
                  type="text"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-form-type="other"
                  data-lpignore="true"
                  data-private="true"
                  aria-autocomplete="none"
                  aria-hidden="true"
                  readonly
                  onfocus="this.removeAttribute('readonly')"
                  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
                  placeholder="Enter display name..."
                  @mousedown.stop
                  @change="handleCardUpdate"
                />
              </div>


              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 w-20">Model:</span>
                <input
                  v-model="model.model"
                  :name="'model_' + randomId()"
                  type="text"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-form-type="other"
                  data-lpignore="true"
                  data-private="true"
                  aria-autocomplete="none"
                  aria-hidden="true"
                  readonly
                  onfocus="this.removeAttribute('readonly')"
                  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
                  placeholder="Enter model name..."
                  @mousedown.stop
                  @change="handleCardUpdate"
                />
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 w-20">API Key:</span>
                <input
                  :type="isEditing[model.id] ? 'text' : 'password'"
                  :name="'api_key_' + randomId()"
                  autocomplete="new-password"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-form-type="other"
                  data-lpignore="true"
                  data-private="true"
                  aria-autocomplete="none"
                  aria-hidden="true"
                  readonly
                  onfocus="this.removeAttribute('readonly')"
                  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded font-mono"
                  :value="isEditing[model.id] ? model.apiKey : '•'.repeat(model.apiKey?.length || 0)"
                  @focus="startEditing(model.id)"
                  @blur="stopEditing(model.id)"
                  @input="e => updateApiKey(model, e.target.value)"
                  placeholder="Enter API key..."
                  @mousedown.stop
                />
              </div>

              <div v-if="model.provider === 'AzureAI'" class="flex items-center gap-2">
                <span class="text-xs text-gray-400 w-20">Endpoint:</span>
                <input
                  v-model="model.apiEndpoint"
                  :name="'endpoint_' + randomId()"
                  type="text"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  data-form-type="other"
                  data-lpignore="true"
                  data-private="true"
                  aria-autocomplete="none"
                  aria-hidden="true"
                  readonly
                  onfocus="this.removeAttribute('readonly')"
                  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
                  placeholder="Enter API endpoint..."
                  @mousedown.stop
                  @change="handleCardUpdate"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseCard>
  </div>
`,

  setup(props, { emit }) {

    
    const randomId = () => Math.random().toString(36).substring(2, 15);


    const providers = [
      'OpenAI',
      'Gemini',
      'Anthropic',
      'Groq',
      'Mistral',
      'AzureAI'
    ];

    const isProcessing = Vue.ref(false);
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isEditing = Vue.ref({});

    const startEditing = (modelId) => {
      isEditing.value[modelId] = true;
    };

    const stopEditing = (modelId) => {
      isEditing.value[modelId] = false;
    };

    const updateApiKey = (model, value) => {
      model.apiKey = value;
      handleCardUpdate();
    };

    const initializeCardData = (data) => {
      return {
        uuid: data.uuid,
        type: 'model', // Card type
        name: data.name || "Model Config",
        description: data.description || "Model Configuration Node",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        models: data.models || [],
        // Add empty socket arrays
        sockets: {
          inputs: [],
          outputs: []
        }
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    const addModel = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const newId = generateId();
        localCardData.value.models.push({
          id: newId,
          displayName: '',
          provider: providers[0],
          model: '',
          apiKey: '',
          apiEndpoint: ''
        });
        isEditing.value[newId] = false;
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const removeModel = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const model = localCardData.value.models[index];
        if (model && model.id) {
          delete isEditing.value[model.id];
        }
        localCardData.value.models.splice(index, 1);
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const generateId = () => {
      return 'model_' + Math.random().toString(36).substr(2, 9);
    };

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, { element: event.element, cleanup: [] });
    };

    const getSocketConnections = (socketId) => connections.value.has(socketId);
    
    const hasSocketError = () => false;

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const handleCardUpdate = (data) => {
      if (data?.uuid) localCardData.value = data;
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData, oldData) => {
        if (!newData || isProcessing.value) return;
        isProcessing.value = true;

        try {
          if (newData.x !== oldData?.x) localCardData.value.x = newData.x;
          if (newData.y !== oldData?.y) localCardData.value.y = newData.y;
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Cleanup on unmount
    Vue.onUnmounted(() => {
      socketRegistry.forEach(socket => socket.cleanup.forEach(cleanup => cleanup()));
      socketRegistry.clear();
      connections.value.clear();
      isEditing.value = {};
    });

    return {
        randomId,
      localCardData,
      providers,
      isEditing,
      startEditing,
      stopEditing,
      updateApiKey,
      addModel,
      removeModel,
      handleCardUpdate,
      handleSocketMount,
      getSocketConnections,
      hasSocketError,
      emitWithCardId
    };
  }
};