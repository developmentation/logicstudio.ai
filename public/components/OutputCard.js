// OutputCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId
} from '../utils/socketManagement/socketRemapping.js';

export default {
  name: "OutputCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false }
  },
  template: `
    <BaseCard
      :card-data="localCardData"
      :zoom-level="zoomLevel"
      :z-index="zIndex"
      :is-selected="isSelected"
      @update-position="$emit('update-position', $event)"
      @update-card="handleCardUpdate"
      @close-card="$emit('close-card', $event)"
      @select-card="$emit('select-card', $event)"
    >
      <!-- Input Sockets -->
      <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 16px;">
        <div 
          v-for="(socket, index) in localCardData.sockets.inputs"
          :key="socket.id"
          class="flex items-center"
          :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
        >
          <BaseSocket
            v-if="socket"
            type="input"
            :socket-id="socket.id"
            :card-id="localCardData.uuid"
            :name="socket.name"
            :value="socket.value"
            :is-connected="getSocketConnections(socket.id)"
            :has-error="hasSocketError(socket)"
            :zoom-level="zoomLevel"
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>
      </div>

      <!-- Output Socket -->
      <div 
        v-if="localCardData.sockets.outputs?.[0]"
        class="absolute -right-[12px]" 
        style="top: 16px;"
      >
        <BaseSocket
          type="output"
          :socket-id="localCardData.sockets.outputs[0].id"
          :card-id="localCardData.uuid"
          :name="localCardData.sockets.outputs[0].name"
          :value="localCardData.sockets.outputs[0].value"
          :is-connected="getSocketConnections(localCardData.sockets.outputs[0].id)"
          :has-error="hasSocketError(localCardData.sockets.outputs[0])"
          :zoom-level="zoomLevel"
          @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
          @connection-drag="$emit('connection-drag', $event)"
          @connection-drag-end="$emit('connection-drag-end', $event)"
          @socket-mounted="handleSocketMount($event)"
        />
      </div>

      <!-- Content -->
      <div class="space-y-2 text-gray-300">
        <div class="mt-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-xs font-medium text-gray-400">Save Input as:</label>
            <button 
              class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
              @click="addInput"
            >+ Add</button>
          </div>
          
          <div class="space-y-2">
            <div 
              v-for="(output, index) in localCardData.outputs" 
              :key="output.id || index"
              class="flex items-center gap-2 bg-gray-900 p-2 rounded"
            >
              <span class="text-xs text-gray-400 w-6">{{ index + 1 }}.</span>
              <select
                v-model="output.type"
                class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
                @mousedown.stop
                @change="updateOutputType(index, $event)"
              >
                <option v-for="type in outputTypes" :key="type" :value="type">
                  {{ type.toUpperCase() }}
                </option>
              </select>
              <button 
                class="text-gray-400 hover:text-gray-200"
                @click.stop="removeInput(index)"
                @mousedown.stop
                @touchstart.stop
              >×</button>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2">
              <input 
                type="checkbox"
                v-model="localCardData.autoDownload"
                @change="handleCardUpdate"
                class="form-checkbox"
              />
              <span class="text-xs text-gray-400">Auto Download</span>
            </label>
            <button
              class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
              @click="handleDownload"
            >Download</button>
          </div>
        </div>
      </div>
    </BaseCard>
  `,

  setup(props, { emit }) {
    // Constants
    const outputTypes = ['markdown', 'docx', 'pdf', 'json', 'pptx', 'text'];
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);

    // Initialize card data with proper socket structure
    const initializeCardData = (data) => {
      const baseData = {
        uuid: data.uuid,
        name: data.name || "Output",
        description: data.description || "Output Node",
        x: data.x || 0,
        y: data.y || 0,
        outputs: data.outputs || [{ type: 'markdown', id: generateSocketId() }],
        autoDownload: data.autoDownload || false,
        sockets: {
          inputs: [],
          outputs: [createSocket({
            type: 'output',
            index: 0,
            existingId: data.sockets?.outputs?.[0]?.id
          })]
        }
      };

      // Initialize input sockets
      if (data.sockets?.inputs?.length) {
        baseData.sockets.inputs = data.sockets.inputs.map((socket, index) => 
          createSocket({
            type: 'input',
            index,
            existingId: socket.id,
            value: socket.value
          })
        );
      } else {
        baseData.sockets.inputs = baseData.outputs.map((_, index) => 
          createSocket({
            type: 'input',
            index
          })
        );
      }

      return baseData;
    };

    // Initialize local state
    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Socket connection tracking
    const getSocketConnections = (socketId) => connections.value.has(socketId);

    const hasSocketError = (socket) => false;

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, {
        element: event.element,
        cleanup: []
      });
    };

    // Helper to emit events with card ID
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Add new input
    const addInput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.inputs];
        const newSocket = createSocket({
          type: 'input',
          index: localCardData.value.outputs.length
        });

        localCardData.value.outputs.push({ 
          type: 'markdown', 
          id: generateSocketId() 
        });

        const newSockets = [...oldSockets, newSocket];

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: 'input',
          socketRegistry,
          connections: connections.value
        });

        localCardData.value.sockets.inputs = reindexedSockets;

        emit('sockets-updated', createSocketUpdateEvent({
          cardId: localCardData.value.uuid,
          oldSockets,
          newSockets: reindexedSockets,
          reindexMap,
          deletedSocketIds: [],
          type: 'input'
        }));

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    // Remove input
    const removeInput = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.inputs];
        const deletedSocket = oldSockets[index];
        const deletedSocketIds = deletedSocket ? [deletedSocket.id] : [];

        localCardData.value.outputs.splice(index, 1);
        const newSockets = oldSockets.filter((_, i) => i !== index);

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: 'input',
          deletedSocketIds,
          socketRegistry,
          connections: connections.value
        });

        localCardData.value.sockets.inputs = reindexedSockets;

        emit('sockets-updated', createSocketUpdateEvent({
          cardId: localCardData.value.uuid,
          oldSockets,
          newSockets: reindexedSockets,
          reindexMap,
          deletedSocketIds,
          type: 'input'
        }));

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    // Update output type
    const updateOutputType = (index, event) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        localCardData.value.outputs[index].type = event.target.value;
        if (localCardData.value.sockets.inputs[index]) {
          localCardData.value.sockets.inputs[index].momentUpdated = Date.now();
        }
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    // Handle card updates
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit('update-card', Vue.toRaw(localCardData.value));
      }
    };

    // Handle downloads
    const handleDownload = () => {
      const outputSocket = localCardData.value.sockets.outputs[0];
      if (outputSocket?.value) {
        console.log("Download triggered for:", outputSocket.value);
      }
    };

    // Watch for card data changes
    Vue.watch(() => props.cardData, (newData, oldData) => {
      if (!newData || isProcessing.value) return;
      isProcessing.value = true;

      try {
        // Update position
        if (newData.x !== oldData?.x) localCardData.value.x = newData.x;
        if (newData.y !== oldData?.y) localCardData.value.y = newData.y;

        // Update outputs and sockets
        if (newData.outputs !== undefined && 
            newData.outputs.length !== oldData?.outputs?.length) {
          const oldSockets = [...localCardData.value.sockets.inputs];
          localCardData.value.outputs = [...newData.outputs];

          const newSockets = newData.outputs.map((_, index) => 
            createSocket({
              type: 'input',
              index,
              existingId: oldSockets[index]?.id,
              value: oldSockets[index]?.value
            })
          );

          const { reindexMap, reindexedSockets } = updateSocketArray({
            oldSockets,
            newSockets,
            type: 'input',
            socketRegistry,
            connections: connections.value
          });

          localCardData.value.sockets.inputs = reindexedSockets;

          emit('sockets-updated', createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type: 'input'
          }));

          handleCardUpdate();
        }
      } finally {
        isProcessing.value = false;
      }
    }, { deep: true });

    // Cleanup on unmount
    Vue.onUnmounted(() => {
      socketRegistry.forEach(socket => socket.cleanup.forEach(cleanup => cleanup()));
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      localCardData,
      outputTypes,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      addInput,
      removeInput,
      handleDownload,
      handleCardUpdate,
      updateOutputType,
      handleSocketMount
    };
  }
};