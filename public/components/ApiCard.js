// ApiCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useApis } from "../composables/useApis.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";

export default {
  name: "ApiCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false }
  },

  template: `
    <div class="card">
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
        style = "min-height:150px"
      >
        <!-- Input Socket -->
        <div class="absolute -left-[12px] flex flex-col gap-4 py-4" style="top: 16px;">
          <div class="flex items-center justify-start">
            <BaseSocket
              type="input"
              :socket-id="localCardData.data.sockets.inputs[0].id"
              :card-id="localCardData.uuid"
              name="Payload Input"
              :value="localCardData.data.sockets.inputs[0].value"
              :is-connected="getSocketConnections(localCardData.data.sockets.inputs[0].id)"
              :has-error="false"
              :zoom-level="zoomLevel"
              @connection-drag-start="$emit('connection-drag-start', $event)"
              @connection-drag="$emit('connection-drag', $event)"
              @connection-drag-end="$emit('connection-drag-end', $event)"
              @socket-mounted="handleSocketMount($event)"
            />
          </div>
        </div>

        <!-- Output Sockets -->
        <div class="absolute -right-[12px] flex flex-col gap-4 py-4" style="top: 16px;">
          <div 
            v-for="(socket, index) in localCardData.data.sockets.outputs"
            :key="socket.id"
            class="flex items-center justify-end"
          >
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
              :value="socket.value"
              :is-connected="getSocketConnections(socket.id)"
              :has-error="false"
              :zoom-level="zoomLevel"
              @connection-drag-start="$emit('connection-drag-start', $event)"
              @connection-drag="$emit('connection-drag', $event)"
              @connection-drag-end="$emit('connection-drag-end', $event)"
              @socket-mounted="handleSocketMount($event)"
            />
          </div>
        </div>

        <!-- Content -->
        <form>
        <div class="space-y-4 text-gray-300 p-4" v-show="localCardData.ui.display === 'default'">
          <!-- Status Indicator -->
          <div class="flex justify-between items-center">
            <label class="text-xs text-gray-400">Status:</label>
            <div class="flex items-center gap-2">
              <span 
                class="w-3 h-3 rounded-full"
                :class="{
                  'bg-gray-500': localCardData.data.status === 'idle',
                  'bg-yellow-500': localCardData.data.status === 'processing',
                  'bg-green-500': localCardData.data.status === 'success',
                  'bg-red-500': localCardData.data.status === 'error'
                }"
              ></span>
              <span class="text-xs capitalize">{{ localCardData.data.status }}</span>
            </div>
          </div>

          <!-- URL Input -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">URL</label>
            <input
              v-model="localCardData.data.url"
              type="text"
              class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"

              :name="'url' + randomId()"
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

              placeholder="Enter API URL..."
               
              @change="handleCardUpdate"
              @mousedown.stop
            />
          </div>

          <!-- Method Selection -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">Method</label>
            <select
              v-model="localCardData.data.method"
              class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
              autocomplete="off"
              @change="handleCardUpdate"
              @mousedown.stop
            >
              <option value="get">GET</option>
              <option value="post">POST</option>
              <option value="put">PUT</option>
              <option value="patch">PATCH</option>
              <option value="delete">DELETE</option>
            </select>
          </div>

          <!-- Token Input -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">Bearer Token (Optional)</label>
            <input
              v-model="localCardData.data.token"

              :name="'bearer_token_' + randomId()"
              type="password"
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

              class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
              placeholder="Enter bearer token..."
              @change="handleCardUpdate"
              @mousedown.stop
            />
          </div>

          <!-- Payload Input -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">Payload (must be JSON)</label>
            <textarea
              v-model="localCardData.data.payload"
              class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
              rows="4"
              placeholder="Enter JSON payload..."
              @change="handleCardUpdate"
              @mousedown.stop
            ></textarea>
          </div>

          <!-- Execute Button -->
          <div class="flex justify-center mt-2">
            <button 
              class="px-6 py-2 text-sm font-medium rounded"
              :class="isProcessing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'"
              @click="executeRequest"
              :disabled="isProcessing || !canExecute"
            >
              {{ isProcessing ? 'Processing...' : 'Execute Request' }}
            </button>
          </div>
        </div>
        </form>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    // Initialize APIs utility
    const { executeApiCall } = useApis();

    const randomId = () => Math.random().toString(36).substring(2, 15);

    // Initialize card setup utilities
    const {
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup
    } = useCardSetup(props, emit);

    // Initialize local card data
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "API Request",
        description: "API Request Node",
        defaultData: {
          url: "",
          method: "get",
          token: "",
          payload: "",
          status: "idle"
        },
        defaultSockets: {
          inputs: [{ name: "Payload Input" }],
          outputs: [
            { name: "Success" },
            { name: "Error" }
          ]
        }
      })
    );

    // Basic card update handler
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    
    const executeRequest = async () => {
      if (!canExecute.value || isProcessing.value) return;

      isProcessing.value = true;
      localCardData.value.data.status = 'processing';
      resetOutputs();
      handleCardUpdate();

      try {
        const payloadToUse = localCardData.value.data.sockets.inputs[0].value || 
                            localCardData.value.data.payload;
        const parsedPayload = validatePayload(payloadToUse);

        const result = await executeApiCall({
          url: localCardData.value.data.url,
          method: localCardData.value.data.method,
          payload: parsedPayload,
          token: localCardData.value.data.token
        });

        if (result.success) {
          localCardData.value.data.status = 'success';
          localCardData.value.data.sockets.outputs[0].value = result.data;
          localCardData.value.data.sockets.outputs[1].value = null;
        } else {
          localCardData.value.data.status = 'error';
          localCardData.value.data.sockets.outputs[0].value = null;
          localCardData.value.data.sockets.outputs[1].value = result.error;
        }
      } catch (error) {
        console.error('Error executing request:', error);
        localCardData.value.data.status = 'error';
        localCardData.value.data.sockets.outputs[0].value = null;
        localCardData.value.data.sockets.outputs[1].value = {
          message: error.message,
          status: error.response?.status || 500
        };
      } finally {
        isProcessing.value = false;
        handleCardUpdate();
      }
    };


    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: ({ type, content }) => {
        if (type === "modified" && content.old.value !== content.new.value) {
          handleInputValueChange(content.new.value);
        }
      }
      ,
      onOutputChange: ({ type, content }) => {
      }
    });

    // Set up watchers
    const watchers = setupCardDataWatchers({
      props,
      localCardData,
      isProcessing,
      emit,
      onTrigger: executeRequest
    });

    // Watch for card data changes
    Vue.watch(
      () => ({ x: props.cardData.ui?.x, y: props.cardData.ui?.y }),
      watchers.position
    );

    Vue.watch(() => props.cardData.ui?.display, watchers.display);
    Vue.watch(() => props.cardData.ui?.width, watchers.width);
    Vue.watch(() => props.cardData.data?.trigger, watchers.trigger);

    // API Card specific functions
    const canExecute = Vue.computed(() => {
      return localCardData.value.data.url && localCardData.value.data.method;
    });

    const validatePayload = (payload) => {
      if (!payload) return null;
      try {
        return JSON.parse(payload);
      } catch (error) {
        console.error('Invalid JSON payload:', error);
        return null;
      }
    };

    const resetOutputs = () => {
      localCardData.value.data.sockets.outputs.forEach(socket => {
        socket.value = null;
      });
    };

    const handleInputValueChange = (newValue) => {
      if (newValue !== null && newValue !== undefined) {
        try {
          let formattedPayload = typeof newValue === 'string' 
            ? newValue 
            : JSON.stringify(newValue, null, 2);
          
          localCardData.value.data.payload = formattedPayload;
          handleCardUpdate();
          executeRequest();
        } catch (error) {
          console.error('Error processing payload:', error);
          localCardData.value.data.payload = String(newValue);
          handleCardUpdate();
        }
      }
    };

    // Lifecycle hooks
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    Vue.onUnmounted(cleanup);

    return {
      localCardData,
      isProcessing,
      canExecute,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      executeRequest,
      randomId,
    };
  }
};