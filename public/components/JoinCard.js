// JoinCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";
import { createSocket } from "../utils/socketManagement/socketRemapping.js";

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
   <div class="card">
      <BaseCard
        :card-data="localCardData"
        :zoom-level="zoomLevel"
        :z-index="zIndex"
        :is-selected="isSelected"
        @drag-start="$emit('drag-start', $event)"
        @drag="$emit('drag', $event)"
        @drag-end="$emit('drag-end', $event)"
        @update-position="$emit('update-position', $event)"
        @update-card="handleCardUpdate"
        @close-card="$emit('close-card', $event)"
        @clone-card="uuid => $emit('clone-card', uuid)"
        @select-card="$emit('select-card', $event)"
      >
        <!-- Input Sockets -->
        <div class="absolute -left-[12px] flex flex-col gap-4 py-4" style="top: 16px;">
          <div 
            v-for="(socket, index) in localCardData.data.sockets.inputs"
            :key="socket.id"
            class="flex items-center justify-start"
          >
            <BaseSocket
              type="input"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name || 'Input ' + (index + 1)"
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

        <!-- Output Socket -->
        <div 
          v-if="localCardData.data.sockets.outputs?.[0]"
          class="absolute -right-[12px] flex flex-col gap-4 py-4" 
          style="top: 16px;"
        >
          <BaseSocket
            type="output"
            :socket-id="localCardData.data.sockets.outputs[0].id"
            :card-id="localCardData.uuid"
            :name="localCardData.data.sockets.outputs[0].name"
            :value="localCardData.data.sockets.outputs[0].value"
            :is-connected="getSocketConnections(localCardData.data.sockets.outputs[0].id)"
            :has-error="false"
            :zoom-level="zoomLevel"
            @connection-drag-start="$emit('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Content -->
        <div 
          class="p-4 space-y-4"
          v-show="localCardData.ui.display === 'default'"
        >
          <div class="space-y-4">
            <!-- Join Type Selection -->
            <div class="space-y-2">
              <div class="text-sm font-medium text-gray-400">Join Type</div>
              <div class="bg-gray-900 p-2 rounded">
                <select
                  v-model="localCardData.data.joinType"
                  class="w-full bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
                  @change="handleJoinTypeChange"
                  @mousedown.stop
                >
                  <option value="text">Text</option>
                  <option value="array">JSON Array</option>
                  <option value="object">JSON Object</option>
                </select>
              </div>
            </div>

            <!-- Separator (for text mode) -->
            <div v-if="localCardData.data.joinType === 'text'" class="space-y-2">
              <div class="text-sm font-medium text-gray-400">Separator</div>
              <div class="bg-gray-900 p-2 rounded">
                <input
                  type="text"
                  v-model="localCardData.data.separator"
                  placeholder="Separator (e.g. space, comma, newline)"
                  class="w-full bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
                  @input="handleSeparatorUpdate"
                  @mousedown.stop
                />
              </div>
            </div>

            <!-- Action Button -->
            <div class="flex justify-end">
              <button 
                @click="addInput"
                @mousedown.stop
                @touchstart.stop
                class="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                Add Input
              </button>
            </div>

            <!-- Input Sockets Table -->
            <div class="space-y-2">
              <div class="text-sm font-medium text-gray-400">Input Sockets</div>
              <div class="space-y-1">
                <div 
                  v-for="(socket, index) in localCardData.data.sockets.inputs" 
                  :key="socket.id"
                  class="flex items-center gap-2 bg-gray-900 p-2 rounded group"
                >
                  <span class="text-xs text-gray-400 w-4">{{ index + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <div v-if="editingSocket?.id === socket.id" class="flex items-center">
                      <input
                        type="text"
                        v-model="editingSocket.name"
                        @blur="saveSocketName(socket, 'input')"
                        @keyup.enter="saveSocketName(socket, 'input')"
                        @keyup.esc="cancelEdit"
                        :ref="el => { if (el) socketInputRefs['input-' + index] = el }"
                        class="w-full bg-gray-800 text-white px-2 py-1 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        @mousedown.stop
                        @click.stop
                      />
                    </div>
                    <div 
                      v-else
                      @click.stop="startEditing(socket, index, 'input')"
                      class="truncate cursor-text text-gray-100 text-xs"
                    >
                      {{ socket.name || getInputPlaceholder(socket) }}
                    </div>
                  </div>
                  <button 
                    class="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center"
                    @click.stop="removeInput(index)"
                    @mousedown.stop
                    @touchstart.stop
                  >×</button>
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
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    // Initialize refs for editing
    const editingSocket = Vue.ref(null);
    const socketInputRefs = Vue.ref({});
    const socketCounter = Vue.ref(0);

    // Initialize local card data
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Join",
        description: "Join multiple inputs together",
        defaultData: {
          joinType: "text",
          separator: " ",
          socketCounter: 0
        },
        defaultSockets: {
          inputs: [{ name: "Input 1" }],
          outputs: [{ name: "Joined Output" }],
        },
      })
    );

    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: ({ type, content }) => {
        if (type === 'modified' && content.old.value !== content.new.value) {
          updateOutput();
        }
        if (type === 'removed') {
          updateOutput();
        }

      },
      onOutputChange: ({ type, content }) => {},
    });

    // Set up watchers
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

    // Socket editing functions
    const startEditing = (socket, index, type) => {
      editingSocket.value = {
        id: socket.id,
        name: socket.name || `${type} ${index + 1}`,
        index,
        type,
      };
      Vue.nextTick(() => {
        const inputRef = socketInputRefs.value[`${type}-${index}`];
        if (inputRef) {
          inputRef.focus();
          inputRef.select();
        }
      });
    };

    const saveSocketName = (socket, type) => {
      if (!editingSocket.value || !editingSocket.value.name?.trim()) return;

      const socketArray =
        type === "input"
          ? localCardData.value.data.sockets.inputs
          : localCardData.value.data.sockets.outputs;

      const targetSocket = socketArray.find((s) => s.id === socket.id);
      if (targetSocket) {
        targetSocket.name = editingSocket.value.name;
        handleCardUpdate();
      }

      cancelEdit();
    };

    const cancelEdit = () => {
      editingSocket.value = null;
    };

    // Card-specific functions
    const processInputValue = (value) => {
      if (value === undefined || value === null) return null;
      
      if (typeof value === 'object') {
        if (value.content !== undefined) return value.content;
        if (value.contents !== undefined) return value.contents;
        return value;
      }
      
      return value;
    };

    const updateOutput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const inputValues = localCardData.value.data.sockets.inputs
          .map(socket => processInputValue(socket.value))
          .filter(value => value !== null);

        let outputValue = null;

        switch (localCardData.value.data.joinType) {
          case 'text':
            outputValue = inputValues.length > 0 ? 
              inputValues.map(String).join(localCardData.value.data.separator || ' ') : 
              null;
            break;

          case 'array':
            outputValue = inputValues.length > 0 ? inputValues : null;
            break;

          case 'object':
            if (inputValues.length > 0) {
              outputValue = {};
              localCardData.value.data.sockets.inputs.forEach((socket, index) => {
                if (socket.value !== null) {
                  const key = `input${socket.socketNumber}`;
                  outputValue[key] = processInputValue(socket.value);
                }
              });
            }
            break;
        }

        if (localCardData.value.data.sockets.outputs?.[0]) {
          const outputSocket = localCardData.value.data.sockets.outputs[0];
          outputSocket.value = outputValue;
          outputSocket.momentUpdated = Date.now();
        }

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const handleJoinTypeChange = () => {
      if (isProcessing.value) return;
      updateOutput();
      handleCardUpdate();
    };

    const handleSeparatorUpdate = () => {
      if (isProcessing.value) return;
      updateOutput();
      handleCardUpdate();
    };

    const getInputPlaceholder = (socket) => {
      const baseText = `Input ${socket.socketNumber || socket.index + 1}`;
      switch (localCardData.value.data.joinType) {
        case 'object':
          return `${baseText} (Key: input${socket.socketNumber || socket.index + 1})`;
        default:
          return baseText;
      }
    };

    const addInput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        socketCounter.value++;
        const newSocket = createSocket({
          type: "input",
          index: localCardData.value.data.sockets.inputs.length,
          name: `Input ${localCardData.value.data.sockets.inputs.length + 1}`
        });
        newSocket.socketNumber = socketCounter.value;

        localCardData.value.data.sockets.inputs.push(newSocket);
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const removeInput = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const removedSocket = localCardData.value.data.sockets.inputs[index];
        localCardData.value.data.sockets.inputs.splice(index, 1);
        
        // Reindex remaining sockets
        localCardData.value.data.sockets.inputs.forEach((socket, i) => {
          socket.index = i;
          if (!socket.name) {
            socket.name = `Input ${i + 1}`;
          }
        });

        // Force output recalculation
        const outputSocket = localCardData.value.data.sockets.outputs[0];
        if (outputSocket) {
          outputSocket.momentUpdated = Date.now(); // Force update
        }
        
        // Update output before card update
        updateOutput();
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    // Lifecycle hooks
    Vue.onMounted(() => {
      socketCounter.value = localCardData.value.data.socketCounter || 0;
      
      // Initialize socket numbers if they don't exist
      localCardData.value.data.sockets.inputs.forEach((socket, index) => {
        if (!socket.socketNumber) {
          socketCounter.value++;
          socket.socketNumber = socketCounter.value;
        }
      });
      
      // Ensure we have at least one output socket
      if (!localCardData.value.data.sockets.outputs.length) {
        const outputSocket = createSocket({
          type: "output",
          index: 0,
          name: "Joined Output"
        });
        localCardData.value.data.sockets.outputs = [outputSocket];
      }

      updateOutput();
      handleCardUpdate();
    });

    Vue.onBeforeUnmount(cleanup);

    return {
      localCardData,
      socketInputRefs,
      editingSocket,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      handleJoinTypeChange,
      handleSeparatorUpdate,
      getInputPlaceholder,
      addInput,
      removeInput,
      startEditing,
      saveSocketName,
      cancelEdit,
    };
  },
};