// ModelCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";
import { createSocket } from "../utils/socketManagement/socketRemapping.js";
import { useModels } from "../composables/useModels.js";

export default {
  name: "ModelCard",
  components: { BaseCard },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
    activeCards: { type: Array, default: [] },
  },

  template: `
    <div class="card">
      <BaseCard
        :card-data="localCardData"
        :zoom-level="zoomLevel"
        :z-index="zIndex"
        :is-selected="isSelected"
        @drag-start="$emit('drag-start', $event)"   
        @drag="$emit('drag', $event)"
        @drag-end="$emit('drag-end', $event)"
        @update-card="handleCardUpdate"
        @close-card="$emit('close-card', $event)"
        @clone-card="uuid => $emit('clone-card', uuid)"
        @select-card="$emit('select-card', $event)"
      >
        <!-- Content -->
        <div class="space-y-2 text-gray-300" v-show="localCardData.ui.display === 'default'">
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-medium text-gray-400">Models:</label>
              <button 
                class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                @click="addModel"
                @mousedown.stop
              >+ Add Model</button>
            </div>
            
            <div class="space-y-2">
              <div 
                v-for="(model, index) in localCardData.data.models" 
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
    // Initialize card setup utilities
    const {
      socketRegistry,
      connections,
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    const { updateModelsFromCards } = useModels();


    // Initialize local card data
    const localCardData = Vue.ref(initializeCardData(props.cardData, {
      defaultName: "Model Config",
      defaultDescription: "Model Configuration Node",
      
    }));

    // Setup data model editing state
    const isEditing = Vue.ref({});
    
    // Available model providers
    const providers = [
      'OpenAI',
      'Gemini',
      'Anthropic',
      'Groq',
      'Mistral',
      'AzureAI',
      "xAI"
    ];

    // Card update handler
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }

      updateModelsFromCards(props.activeCards)
    };

    // Setup watchers for card data
    const watchers = setupCardDataWatchers({
      props,
      localCardData,
      isProcessing,
      emit,
    });

    // Watch position changes
    Vue.watch(
      () => ({ x: props.cardData.ui?.x, y: props.cardData.ui?.y }),
      watchers.position
    );

    // Watch display changes
    Vue.watch(() => props.cardData.ui?.display, watchers.display);

    // Watch width changes
    Vue.watch(() => props.cardData.ui?.width, watchers.width);
    
    // Watch height changes
    Vue.watch(() => props.cardData.ui?.height, watchers.height);

    Vue.onMounted(() => {
      console.log("ModelCard mounted, emitting initial state");
      Vue.nextTick(() => {
        // Ensure all reactivity is set up before emitting
        handleCardUpdate();
      });
    });

    // Cleanup on unmount
    Vue.onUnmounted(cleanup);

    //----------------------------------------
    // Card Specific Functions
    //----------------------------------------
    
    const randomId = () => Math.random().toString(36).substring(2, 15);

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

    const addModel = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const newId = generateId();
        if (!localCardData.value.data.models) {
          localCardData.value.data.models = [];
        }
        
        localCardData.value.data.models.push({
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
        const model = localCardData.value.data.models[index];
        if (model && model.id) {
          delete isEditing.value[model.id];
        }
        localCardData.value.data.models.splice(index, 1);
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const generateId = () => {
      return 'model_' + Math.random().toString(36).substr(2, 9);
    };

    return {
      localCardData,
      providers,
      isEditing,
      randomId,
      startEditing,
      stopEditing,
      updateApiKey,
      addModel,
      removeModel,
      handleCardUpdate,
      handleSocketMount,
      getSocketConnections,
    };
  },
};