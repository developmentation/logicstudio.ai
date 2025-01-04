// AgentCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import SocketEditor from './SocketEditor.js';
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId
} from '../utils/socketManagement/socketRemapping.js';

export default {
  name: "AgentCard",
  components: {
    BaseCard,
    BaseSocket,
    SocketEditor,
  },
  props: {
    cardData: {
      type: Object,
      required: true,
    },
    zoomLevel: {
      type: Number,
      default: 1,
    },
    zIndex: {
      type: Number,
      default: 1,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
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
          v-for="(socket, index) in inputSockets"
          :key="socket.id"
          class="flex items-center"
          :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
        >
          <BaseSocket
            type="input"
            :socket-id="socket.id"
            :card-id="localCardData.uuid"
            :name="socket.name"
            :value="getSocketValue(socket.id)"
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

      <!-- Output Socket -->
      <div class="absolute -right-[12px]" style="top: 16px;">
        <BaseSocket
          type="output"
          :socket-id="outputSocket.id"
          :card-id="localCardData.uuid"
          :name="outputSocket.name"
          :value="getSocketValue(outputSocket.id)"
          :is-connected="getSocketConnections(outputSocket.id)"
          :has-error="hasSocketError(outputSocket.id)"
          :zoom-level="zoomLevel"
          @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
          @connection-drag="$emit('connection-drag', $event)"
          @connection-drag-end="$emit('connection-drag-end', $event)"
          @socket-mounted="handleSocketMount($event)"
        />
      </div>

      <!-- Content -->
      <div class="space-y-4 text-gray-300">
        <!-- System Prompt -->
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">System Prompt</label>
          <SocketEditor
            v-model="localCardData.systemPrompt"
            type="system"
            placeholder="Enter system prompt..."
            :existing-sockets="localCardData.sockets.inputs"
            @update:modelValue="text => handlePromptChange('system', text)"
            @socket-update="handleSocketUpdate"
          />
        </div>

        <!-- User Prompt -->
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">User Prompt</label>
          <SocketEditor
            v-model="localCardData.userPrompt"
            type="user"
            placeholder="Enter user prompt..."
            :existing-sockets="localCardData.sockets.inputs"
            @update:modelValue="text => handlePromptChange('user', text)"
            @socket-update="handleSocketUpdate"
          />
        </div>

        <!-- Output Display -->
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">Output</label>
          <div class="w-full min-h-[60px] bg-gray-900 text-xs text-gray-200 p-2 rounded">
            {{ localCardData.output || 'No output yet...' }}
          </div>
        </div>
      </div>
    </BaseCard>
  `,

  setup(props, { emit }) {
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const socketMap = Vue.ref(new Map());

    // Initialize card data with proper socket structure
const initializeCardData = (data) => {
  return {
    uuid: data.uuid,
    name: data.name || "Agent",
    description: data.description || "Agent Node",
    systemPrompt: data.systemPrompt || "",
    userPrompt: data.userPrompt || "",
    output: data.output || "",
    x: data.x || 0,
    y: data.y || 0,
    sockets: {
      inputs: data.sockets?.inputs?.map((socket, index) => ({
        ...createSocket({
          type: 'input',
          index,
          existingId: socket.id,
          value: socket.value
        }),
        name: socket.name,
        source: socket.source
      })) || [],
      outputs: [createSocket({
        type: 'output',
        index: 0,
        existingId: data.sockets?.outputs?.[0]?.id,
        value: data.sockets?.outputs?.[0]?.value
      })]
    }
  };
};

    // Initialize local state
    const localCardData = Vue.reactive(initializeCardData(props.cardData));

    // Computed properties
    const outputSocket = Vue.computed(() => localCardData.sockets.outputs[0]);
    const inputSockets = Vue.computed(() => localCardData.sockets.inputs);

    // Socket connection tracking
    const getSocketConnections = (socketId) => connections.value.has(socketId);
    const hasSocketError = () => false;

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, { 
        element: event.element, 
        cleanup: [] 
      });
    };

    // Helper to emit events with card ID
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.uuid });
    };

    // Parse socket declarations from prompts
    const parseSocketDeclarations = (text, source) => {
      const pattern = /<socket\s+name\s*=\s*"([^"]+)"\s*\/>/g;
      const matches = [...text.matchAll(pattern)];
      
      return matches.map(match => ({
        name: match[1],
        source
      }));
    };

    // Get both prompt's socket declarations
    const getMergedSocketDeclarations = () => {
      const systemDeclarations = parseSocketDeclarations(localCardData.systemPrompt, "system");
      const userDeclarations = parseSocketDeclarations(localCardData.userPrompt, "user");
      return systemDeclarations.concat(userDeclarations);
    };

    // Handle socket updates from SocketEditor
    const handleSocketUpdate = ({ type }) => {
      if (isProcessing.value) return;
      isProcessing.value = true;
    
      try {
        const oldSockets = [...localCardData.sockets.inputs];
        const declarations = getMergedSocketDeclarations();
        
        // Create new sockets with proper names from declarations
        const newSockets = declarations.map((decl, index) => {
          const existingSocket = oldSockets.find(s => 
            s.name === decl.name && s.source === decl.source
          );
    
          // Create the socket with preserved name and source
          const socket = createSocket({
            type: 'input',
            index,
            existingId: existingSocket?.id,
            value: existingSocket?.value
          });
          
          // Explicitly override the name to prevent default naming
          socket.name = decl.name;
          socket.source = decl.source;
          return socket;
        });
    
        // Find deleted sockets
        const deletedSocketIds = oldSockets
          .filter(old => !newSockets.some(n => 
            n.name === old.name && n.source === old.source
          ))
          .map(s => s.id);
    
        // Use utility for socket array update
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: 'input',
          deletedSocketIds,
          socketRegistry,
          connections: connections.value
        });
    
        // Ensure the reindexed sockets retain their names
        const finalSockets = reindexedSockets.map((socket, index) => {
          const declaration = declarations[index];
          return {
            ...socket,
            name: declaration.name,
            source: declaration.source
          };
        });
    
        // Update local state with properly named sockets
        localCardData.sockets.inputs = finalSockets;
    
        // Emit socket update event
        emit('sockets-updated', createSocketUpdateEvent({
          cardId: localCardData.uuid,
          oldSockets,
          newSockets: finalSockets,
          reindexMap,
          deletedSocketIds,
          type: 'input'
        }));
    
      } finally {
        isProcessing.value = false;
        Vue.nextTick(() => {
          handleCardUpdate();
        });
      }
    };
    // Handle prompt changes
    const handlePromptChange = (type, text) => {
      if (isProcessing.value) return;
      
      if (type === "system") {
        localCardData.systemPrompt = text;
      } else {
        localCardData.userPrompt = text;
      }
      
      Vue.nextTick(() => {
        handleCardUpdate();
      });
    };

    // Socket value management
    const getSocketValue = (socketId) => {
      return socketMap.value.get(socketId)?.value;
    };

    // Card update handler
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData));
      }
    };

    // Watch for card data changes
    Vue.watch(() => props.cardData, (newData, oldData) => {
      if (!newData || isProcessing.value || !oldData) return;
      isProcessing.value = true;

      try {
        // Update position and output only if changed
        if (newData.x !== oldData.x) localCardData.x = newData.x;
        if (newData.y !== oldData.y) localCardData.y = newData.y;
        if (newData.output !== oldData.output) {
          localCardData.output = newData.output;
        }

        // Update socket values
        if (newData.sockets?.inputs) {
          newData.sockets.inputs.forEach(socket => {
            const existingSocket = socketMap.value.get(socket.id);
            if (existingSocket) {
              existingSocket.value = socket.value;
            }
          });
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
      socketMap.value.clear();
    });

    return {
      localCardData,
      outputSocket,
      inputSockets,
      getSocketValue,
      getSocketConnections,
      hasSocketError,
      handlePromptChange,
      emitWithCardId,
      handleSocketMount,
      handleCardUpdate,
      handleSocketUpdate,
    };
  },
};