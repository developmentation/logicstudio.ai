// JoinCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "JoinCard",
  components: { BaseCard, BaseSocket },
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
            <label class="text-xs font-medium text-gray-400">Join Inputs:</label>
            <button 
              class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
              @click="addInput"
              @mousedown.stop
            >+ Add Input</button>
          </div>
          
          <div class="space-y-2">
            <div 
              v-for="(socket, index) in localCardData.sockets.inputs" 
              :key="socket.id"
              class="flex items-center gap-2 bg-gray-900 p-2 rounded"
            >
              <span class="text-xs text-gray-400 w-6">{{ index + 1 }}.</span>
              <input
                type="text"
                v-model="socket.name"
                placeholder="Input name"
                class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
                @input="handleSocketNameUpdate(socket)"
                @mousedown.stop
              />
              <button 
                class="text-gray-400 hover:text-gray-200"
                @click.stop="removeInput(index)"
                @mousedown.stop
                @touchstart.stop
              >×</button>
            </div>
          </div>
        </div>

        <div class="mt-4 p-2 bg-gray-900 rounded">
          <label class="text-xs font-medium text-gray-400 block mb-1">Join with:</label>
          <input
            type="text"
            v-model="localCardData.separator"
            placeholder="Separator (e.g. space, comma, newline)"
            class="w-full bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
            @input="handleSeparatorUpdate"
            @mousedown.stop
          />
        </div>
      </div>
    </BaseCard>
  </div>
  `,

  setup(props, { emit }) {
    // Constants and state
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);

    // Initialize card data with proper socket structure
    const initializeCardData = (data) => {
      const baseData = {
        uuid: data.uuid,
        name: data.name || "Join",
        description: data.description || "Join multiple inputs together",
        x: data.x || 0,
        y: data.y || 0,
        separator: data.separator || " ",
        sockets: {
          inputs: [],
          outputs: [
            createSocket({
              type: "output",
              index: 0,
              existingId: data.sockets?.outputs?.[0]?.id,
              name: "Joined Output"
            }),
          ],
        },
      };

      // Initialize input sockets if they exist
      if (data.sockets?.inputs?.length) {
        baseData.sockets.inputs = data.sockets.inputs.map((socket, index) =>
          createSocket({
            type: "input",
            index,
            existingId: socket.id,
            value: socket.value,
            name: socket.name || `Input ${index + 1}`
          })
        );
      } else {
        // Create initial input socket
        baseData.sockets.inputs = [
          createSocket({
            type: "input",
            index: 0,
            name: "Input 1"
          })
        ];
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
        cleanup: [],
      });
    };

    // Helper to emit events with card ID
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Update the output value whenever inputs change
// Update the output value whenever inputs change
const updateOutput = () => {
    if (isProcessing.value) return;
    isProcessing.value = true;
  
    try {
      const processValue = (value) => {
        if (value === undefined || value === null) return null;
        
        // Handle objects like file inputs
        if (typeof value === 'object') {
          // First check for content/contents from file inputs
          if (value.content !== undefined) return value.content;
          if (value.contents !== undefined) return value.contents;
          
          // If it's an object but not a file, stringify it
          return JSON.stringify(value, null, 2);
        }
        
        // Handle simple values
        return String(value);
      };
  
      const inputValues = localCardData.value.sockets.inputs
        .map(socket => processValue(socket.value))
        .filter(value => value !== null);
  
        console.log("inputValues", inputValues)
      const oldSocket = localCardData.value.sockets.outputs?.[0];
      if (oldSocket) {
        const separator = localCardData.value.separator || " ";
        const joinedValue = inputValues.length > 0 ? inputValues.join(separator) : null;

          oldSocket.value = joinedValue;
          oldSocket.momentUpdated = Date.now();
          
          // Create updated socket instance
          const updatedSocket = createSocket({
            type: 'output',
            index: 0,
            existingId: oldSocket.id,
            value: joinedValue,
            name: oldSocket.name
          });
  
          // Update socket array with proper remapping
          const { reindexMap, reindexedSockets } = updateSocketArray({
            oldSockets: [oldSocket],
            newSockets: [updatedSocket],
            type: 'output',
            socketRegistry,
            connections: connections.value
          });
  
          // Update the sockets array
          localCardData.value.sockets.outputs = reindexedSockets;
          console.log("reindexedSockets", reindexedSockets)
          // Emit socket update event
          emit('sockets-updated', createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets: [oldSocket],
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type: 'output'
          }));
  
          // Emit card update
          emit("update-card", Vue.toRaw(localCardData.value));
        
      }
    } finally {
      isProcessing.value = false;
    }
  };

    // Add new input
    const addInput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.inputs];
        const newSocket = createSocket({
          type: "input",
          index: oldSockets.length,
          name: `Input ${oldSockets.length + 1}`
        });

        const newSockets = [...oldSockets, newSocket];

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          socketRegistry,
          connections: connections.value,
        });

        localCardData.value.sockets.inputs = reindexedSockets;

        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type: "input",
          })
        );

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

        const newSockets = oldSockets.filter((_, i) => i !== index);

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          deletedSocketIds,
          socketRegistry,
          connections: connections.value,
        });

        localCardData.value.sockets.inputs = reindexedSockets;

        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds,
            type: "input",
          })
        );

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const handleSocketNameUpdate = (socket) => {
      if (isProcessing.value) return;
      socket.momentUpdated = Date.now();
      handleCardUpdate();
    };

    const handleSeparatorUpdate = () => {
      if (isProcessing.value) return;
      updateOutput();
      handleCardUpdate();
    };

    // Handle card updates
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        updateOutput();
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
          // Update position
          if (newData.x !== oldData?.x) localCardData.value.x = newData.x;
          if (newData.y !== oldData?.y) localCardData.value.y = newData.y;

          // Update separator
          if (newData.separator !== oldData?.separator) {
            localCardData.value.separator = newData.separator;
          }

          // Update socket values
          if (newData.sockets?.inputs) {
            newData.sockets.inputs.forEach((socket, index) => {
              if (localCardData.value.sockets.inputs[index]) {
                localCardData.value.sockets.inputs[index].value = socket.value;
              }
            });
          }

          updateOutput();
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Watch for input value changes
// Inside setup() function, replace the existing watcher with:

// Watch input values specifically
Vue.watch(
    () => localCardData.value.sockets.inputs.map(socket => socket.value),
    (newValues, oldValues) => {
      console.log("Join input values changed:", newValues);
      updateOutput();
    },
    { deep: true }
  );

  
    Vue.onMounted(() => {
        updateOutput();
      });
      
    // Cleanup on unmount
    Vue.onUnmounted(() => {
      socketRegistry.forEach((socket) =>
        socket.cleanup.forEach((cleanup) => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      localCardData,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      addInput,
      removeInput,
      handleCardUpdate,
      handleSocketMount,
      handleSocketNameUpdate,
      handleSeparatorUpdate,
    };
  },
};