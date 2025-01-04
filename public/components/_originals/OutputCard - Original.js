// OutputCard.js
import BaseCard from "../BaseCard.js";
import BaseSocket from "../BaseSocket.js";

export default {
  name: "OutputCard",
  components: {
    BaseCard,
    BaseSocket,
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
    :is-connected="isSocketConnected(socket.id)"
    :has-error="hasSocketError(socket.id)"
    :zoom-level="zoomLevel"
    @connection-drag-start="handleConnectionDragStart"
    @connection-drag="handleConnectionDrag"
    @connection-drag-end="handleConnectionDragEnd"
    @socket-mounted="handleSocketMounted"
  />
</div>
      </div>

      <!-- Output Socket -->
      <div class="absolute -right-[12px]" style="bottom: 16px;">
        <div class="flex items-center">
          <BaseSocket
            type="output"
            :socket-id="outputSocket.id"
            :card-id="localCardData.uuid"
            :name="outputSocket.name"
            :value="getSocketValue(outputSocket.id)"
            :is-connected="isSocketConnected(outputSocket.id)"
            :has-error="hasSocketError(outputSocket.id)"
            :zoom-level="zoomLevel"
            @connection-drag-start="handleConnectionDragStart"
            @connection-drag="handleConnectionDrag"
            @connection-drag-end="handleConnectionDragEnd"
            @socket-mounted="handleSocketMounted"
          />
        </div>
      </div>

      <!-- Content -->
      <div class="space-y-2 text-gray-300">
        <!-- Output Configuration -->
        <div class="mt-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-xs font-medium text-gray-400">Save Input as:</label>
            <button 
              class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
              @click="addInput"
            >
              + Add
            </button>
          </div>
          
          <!-- Output List -->
          <div class="space-y-2">
            <div 
              v-for="(output, index) in localCardData.outputs" 
              :key="index"
              class="flex items-center gap-2 bg-gray-900 p-2 rounded"
            >
              <span class="text-xs text-gray-400 w-6">{{ index + 1 }}.</span>
     <select
  v-model="output.type"
  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
  @mousedown.stop  
  @change="handleTypeChange(index, $event)"
>
                <option value="markdown">Markdown</option>
                <option value="docx">DOCX</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
                <option value="pptx">PPTX</option>
                <option value="text">Text</option>
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

        <!-- Download Settings -->
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
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </BaseCard>
  `,

  setup(props, { emit }) {
    // Helper to generate unique socket IDs
    const generateSocketId = () =>
      `socket-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const localCardData = Vue.ref({
      uuid: props.cardData.uuid,
      name: props.cardData.name || "Output",
      description: props.cardData.description || "Output Node",
      x: props.cardData.x || 0,
      y: props.cardData.y || 0,
      outputs: [],
      autoDownload: false,
      sockets: {
        inputs: [],
        outputs: [
          {
            id: generateSocketId(),
            type: "output",
            name: "output",
            value: null,
            momentUpdated: Date.now(),
          },
        ],
      },
      ...props.cardData,
    });

    // Add default output if none exist
    if (!localCardData.value.outputs?.length) {
      localCardData.value.outputs = [{ type: "markdown" }];
    }

    // Socket initialization and management
    const ensureSocket = (index, type = "input") => {
      const sockets =
        type === "input"
          ? localCardData.value.sockets.inputs
          : localCardData.value.sockets.outputs;

      const existingSocket = sockets.find((s) => s.name === String(index + 1));
      if (existingSocket) return existingSocket;

      const newSocket = {
        id: generateSocketId(),
        type,
        name: "Index " + String(index + 1),
        value: null,
        momentUpdated: Date.now(),
      };

      sockets.push(newSocket);
      return newSocket;
    };

    // Initialize output socket
    const outputSocket = Vue.computed(() => {
      if (!localCardData.value.sockets.outputs.length) {
        localCardData.value.sockets.outputs.push({
          id: generateSocketId(),
          type: "output",
          name: "output",
          value: null,
          momentUpdated: Date.now(),
        });
      }
      return localCardData.value.sockets.outputs[0];
    });

    const inputSockets = Vue.computed(() => localCardData.value.sockets.inputs);

    // Socket value management
    const getSocketValue = (socketId) => {
      const socket = [
        ...localCardData.value.sockets.inputs,
        ...localCardData.value.sockets.outputs,
      ].find((s) => s.id === socketId);
      return socket?.value;
    };

    const isSocketConnected = (socketId) => {
      // Implement based on your connection management system
      return false;
    };

    const hasSocketError = (socketId) => {
      // Implement error checking logic
      return false;
    };
    const addInput = () => {
      const oldSockets = [...localCardData.value.sockets.inputs];

      // Add new output
      localCardData.value.outputs.push({ type: "markdown" });

      // Create new socket with proper index and naming
      const newIndex = localCardData.value.sockets.inputs.length;
      const socketId = generateSocketId();
      const newSocket = {
        id: socketId,
        type: "input",
        name: `Input ${newIndex + 1}`, // Changed from output to input
        source: "input", // Changed from output to input
        sourceIndex: newIndex,
        value: null,
        momentUpdated: Date.now(),
      };

      // Add the new socket
      localCardData.value.sockets.inputs.push(newSocket);

      const reindexMap = {};
      oldSockets.forEach((socket, index) => {
        reindexMap[index] = index;
      });
      reindexMap[oldSockets.length] = oldSockets.length;

      // Map sockets with consistent input naming
      const newSockets = localCardData.value.sockets.inputs.map(
        (socket, idx) => ({
          ...socket,
          sourceIndex: idx,
          name: `Input ${idx + 1}`, // Changed from output to input
          source: "input", // Changed from output to input
        })
      );

      emit("sockets-updated", {
        oldSockets,
        newSockets,
        cardId: localCardData.value.uuid,
        reindexMap,
        deletedSocketIds: [],
      });

      handleCardUpdate();
    };

    const removeInput = (index) => {
      const oldSockets = [...localCardData.value.sockets.inputs];
      const socketToRemove = oldSockets[index];

      // Remove the output and its corresponding socket
      localCardData.value.outputs.splice(index, 1);
      localCardData.value.sockets.inputs.splice(index, 1);

      const reindexMap = {};
      oldSockets.forEach((socket, oldIndex) => {
        if (oldIndex < index) {
          reindexMap[oldIndex] = oldIndex;
        } else if (oldIndex > index) {
          reindexMap[oldIndex] = oldIndex - 1;
        } else {
          reindexMap[oldIndex] = -1;
        }
      });

      // Map remaining sockets with consistent input naming
      const newSockets = localCardData.value.sockets.inputs.map(
        (socket, idx) => ({
          ...socket,
          sourceIndex: idx,
          name: `Input ${idx + 1}`, // Changed from output to input
          source: "input", // Changed from output to input
        })
      );

      emit("sockets-updated", {
        oldSockets: oldSockets.map((s) => ({ ...s, source: "input" })), // Changed from output to input
        newSockets,
        cardId: localCardData.value.uuid,
        reindexMap,
        deletedSocketIds: socketToRemove ? [socketToRemove.id] : [],
      });

      handleCardUpdate();
    };

    // Connection handling
    const handleConnectionDragStart = (event) => {
      emit("connection-drag-start", {
        ...event,
        cardId: localCardData.value.uuid,
      });
    };

    const handleConnectionDrag = (event) => {
      emit("connection-drag", event);
    };

    const handleConnectionDragEnd = (event) => {
      emit("connection-drag-end", event);
    };

    const handleSocketMounted = ({ socketId, element }) => {
      // Handle socket mounting if needed
    };

    // Card updates
    const handleCardUpdate = () => {
      emit("update-card", Vue.toRaw(localCardData.value));
    };

    // Download handling
    const handleDownload = () => {
      const outputValue = getSocketValue(outputSocket.value.id);
      if (outputValue) {
        console.log("Download triggered for:", outputValue);
        // Implement download logic
      }
    };

    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData) => {
        if (newData.x !== undefined) localCardData.value.x = newData.x;
        if (newData.y !== undefined) localCardData.value.y = newData.y;
        if (newData.outputs !== undefined) {
          // Ensure we don't break socket connections when updating outputs
          const oldOutputsLength = localCardData.value.outputs.length;
          localCardData.value.outputs = [...newData.outputs];

          // If outputs length changed, trigger socket updates
          if (oldOutputsLength !== newData.outputs.length) {
            Vue.nextTick(() => {
              const oldSockets = [...localCardData.value.sockets.inputs];
              // Ensure sockets match outputs
              while (
                localCardData.value.sockets.inputs.length <
                newData.outputs.length
              ) {
                ensureSocket(
                  localCardData.value.sockets.inputs.length,
                  "input"
                );
              }
              while (
                localCardData.value.sockets.inputs.length >
                newData.outputs.length
              ) {
                localCardData.value.sockets.inputs.pop();
              }
              handleCardUpdate();
            });
          }
        }
      },
      { deep: true }
    );

    const handleTypeChange = (index, event) => {
      // Update the type in the outputs array
      localCardData.value.outputs[index].type = event.target.value;
      
      // Update the socket's momentUpdated to trigger reactivity
      if (localCardData.value.sockets.inputs[index]) {
        localCardData.value.sockets.inputs[index].momentUpdated = Date.now();
      }
    
      // Update the card
      handleCardUpdate();
    };
    


    return {
      localCardData,
      outputSocket,
      inputSockets,
      getSocketValue,
      isSocketConnected,
      hasSocketError,
      addInput,
      removeInput,
      handleDownload,
      handleCardUpdate,
      handleConnectionDragStart,
      handleConnectionDrag,
      handleConnectionDragEnd,
      handleSocketMounted,
      handleTypeChange

    };
  },
};
