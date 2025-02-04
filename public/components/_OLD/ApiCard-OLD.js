// ApiCard.js
import BaseCard from "../BaseCard.js";
import BaseSocket from "../BaseSocket.js";
import { useApis } from "../../composables/useApis.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
} from '../../utils/socketManagement/socketRemapping.js';

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
        <!-- Input Socket -->
        <div class="absolute -left-[12px]" style="top: 16px;">
          <BaseSocket
            type="input"
            :socket-id="localCardData.sockets.inputs[0].id"
            :card-id="localCardData.uuid"
            name="Payload Input"
            :value="localCardData.sockets.inputs[0].value"
            :is-connected="getSocketConnections(localCardData.sockets.inputs[0].id)"
            :has-error="hasSocketError(localCardData.sockets.inputs[0].id)"
            :zoom-level="zoomLevel"
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Output Sockets -->
        <div 
          class="absolute -right-[12px] flex flex-col gap-1" 
          style="top: 16px;"
        >
          <div 
            v-for="(socket, index) in localCardData.sockets.outputs"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 24) + 'px)' }"
          >
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
              :value="socket.value"
              :is-connected="getSocketConnections(socket.id)"
              :has-error="hasSocketError(socket.id)"
              :zoom-level="zoomLevel"
              @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
              @connection-drag="$emit('connection-drag', $event)"
              @connection-drag-end="$emit('connection-drag-end', $event)"
              @socket-mounted="handleSocketMount($event)"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="space-y-4 text-gray-300 p-4" v-show="localCardData.display == 'default'">
          <!-- Status Indicator -->
          <div class="flex justify-between items-center">
            <label class="text-xs text-gray-400">Status:</label>
            <div class="flex items-center gap-2">
              <span 
                class="w-3 h-3 rounded-full"
                :class="{
                  'bg-gray-500': localCardData.status === 'idle',
                  'bg-yellow-500': localCardData.status === 'processing',
                  'bg-green-500': localCardData.status === 'success',
                  'bg-red-500': localCardData.status === 'error'
                }"
              ></span>
              <span class="text-xs capitalize">{{ localCardData.status }}</span>
            </div>
          </div>

          <!-- URL Input -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">URL</label>
            <input
              v-model="localCardData.url"
              type="text"
              class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
              placeholder="Enter API URL..."
              autocomplete="off"
              @change="handleCardUpdate"
              @mousedown.stop
            />
          </div>

          <!-- Method Selection -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">Method</label>
            <select
              v-model="localCardData.method"
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
              v-model="localCardData.token"
              type="password"
              class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
              placeholder="Enter bearer token..."
              autocomplete="off"
              @change="handleCardUpdate"
              @mousedown.stop
            />
          </div>

          <!-- Payload Input -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">Payload (must be JSON)</label>
            <textarea
              v-model="localCardData.payload"
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
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const { executeApiCall } = useApis();
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);

    // Initialize card data
    const initializeCardData = (data) => {
      const baseData = {
        uuid: data.uuid,
        name: data.name || "API Request",
        description: data.description || "Generic API Request Node",
        type: "api",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        url: data.url || "",
        method: data.method || "get",
        token: data.token || "",
        payload: data.payload || "",
        status: data.status || "idle",
        trigger: data.trigger || null,
        sockets: {
          inputs: [
            createSocket({
              type: "input",
              index: 0,
              existingId: data.sockets?.inputs?.[0]?.id,
              value: data.sockets?.inputs?.[0]?.value,
              name: "Payload Input"
            })
          ],
          outputs: [
            createSocket({
              type: "output",
              index: 0,
              existingId: data.sockets?.outputs?.[0]?.id,
              value: null,
              name: "Success"
            }),
            createSocket({
              type: "output",
              index: 1,
              existingId: data.sockets?.outputs?.[1]?.id,
              value: null,
              name: "Error"
            })
          ]
        }
      };

      // Emit initial socket registration
      emit('sockets-updated', createSocketUpdateEvent({
        cardId: data.uuid,
        oldSockets: [],
        newSockets: [...baseData.sockets.inputs, ...baseData.sockets.outputs],
        reindexMap: new Map(),
        deletedSocketIds: [],
        type: 'output'
      }));

      return baseData;
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Socket management
    const getSocketConnections = (socketId) => connections.value.has(socketId);
    const hasSocketError = () => false;

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, { element: event.element, cleanup: [] });
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Computed properties
    const canExecute = Vue.computed(() => {
      return localCardData.value.url && localCardData.value.method;
    });

    // Methods
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
      localCardData.value.sockets.outputs.forEach(socket => {
        socket.value = null;
      });
    };

    const executeRequest = async () => {
      if (!canExecute.value || isProcessing.value) return;

      isProcessing.value = true;
      localCardData.value.status = 'processing';
      resetOutputs();
      handleCardUpdate();

      try {
        // Use input socket payload if available, otherwise use textarea payload
        const payloadToUse = localCardData.value.sockets.inputs[0].value || localCardData.value.payload;
        const parsedPayload = validatePayload(payloadToUse);

        const result = await executeApiCall({
          url: localCardData.value.url,
          method: localCardData.value.method,
          payload: parsedPayload,
          token: localCardData.value.token
        });

        if (result.success) {
          localCardData.value.status = 'success';
          localCardData.value.sockets.outputs[0].value = result.data;
          localCardData.value.sockets.outputs[1].value = null;
        } else {
          localCardData.value.status = 'error';
          localCardData.value.sockets.outputs[0].value = null;
          localCardData.value.sockets.outputs[1].value = result.error;
        }

      } catch (error) {
        console.error('Error executing request:', error);
        localCardData.value.status = 'error';
        localCardData.value.sockets.outputs[0].value = null;
        localCardData.value.sockets.outputs[1].value = {
          message: error.message,
          status: error.response?.status || 500
        };
      } finally {
        isProcessing.value = false;
        handleCardUpdate();
      }
    };

    const handleCardUpdate = () => {
      emit('update-card', Vue.toRaw(localCardData.value));
    };

    // Watch for input value changes
    Vue.watch(
      () => localCardData.value.sockets.inputs[0].value,
      (newValue, oldValue) => {
        console.log('Input socket value changed:', { newValue, oldValue });
        
        if (newValue !== null && newValue !== undefined) {
          // Handle different input types
          let formattedPayload;
          try {
            if (typeof newValue === 'string') {
              // If it's already a string, try parsing it as JSON to format it
              try {
                const parsed = JSON.parse(newValue);
                formattedPayload = JSON.stringify(parsed, null, 2);
              } catch {
                // If it's not valid JSON, use the string as-is
                formattedPayload = newValue;
              }
            } else {
              // For non-string values (objects, arrays), stringify them
              formattedPayload = JSON.stringify(newValue, null, 2);
            }
            
            console.log('Formatted payload:', formattedPayload);
            localCardData.value.payload = formattedPayload;
            
            // Ensure the UI updates
            Vue.nextTick(() => {
              handleCardUpdate();
              executeRequest();
            });
          } catch (error) {
            console.error('Error processing payload:', error);
            // Fallback to string conversion if all else fails
            localCardData.value.payload = String(newValue);
            handleCardUpdate();
            executeRequest();
          }
        }
      },
      { immediate: true } // This ensures it runs on component mount
    );

    // Watch for trigger changes
    Vue.watch(
      () => localCardData.value.trigger,
      (newValue, oldValue) => {
        if (newValue && newValue !== oldValue) {
          executeRequest();
        }
      }
    );

    // Watch for card data changes
    Vue.watch(() => props.cardData, (newData, oldData) => {
      if (!newData || isProcessing.value) return;
      
      const updatedData = { ...localCardData.value };
      if (newData.x !== undefined) updatedData.x = newData.x;
      if (newData.y !== undefined) updatedData.y = newData.y;
      if (newData.trigger !== undefined) updatedData.trigger = newData.trigger;
      
      localCardData.value = updatedData;
    }, { deep: true });

    // Cleanup
    Vue.onUnmounted(() => {
      socketRegistry.forEach(socket => socket.cleanup.forEach(cleanup => cleanup()));
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      localCardData,
      isProcessing,
      canExecute,
      getSocketConnections,
      hasSocketError,
      handleSocketMount,
      emitWithCardId,
      executeRequest,
      handleCardUpdate
    };
  }
};