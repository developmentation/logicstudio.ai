// TemplateCard.js
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
  name: "TemplateCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
  },

  template: `
    <div class="card">  <!-- Required class for parent DIV for drag effects-->
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
              :name="socket.name || 'Output ' + (index + 1)"
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
        <div 
          class="p-4 space-y-4" 
          v-show="localCardData.ui.display === 'default'"
        >
          <!-- Action Buttons -->
          <div class="flex justify-between gap-4">
            <button 
              @click="addInput"
              @mousedown.stop
              @touchstart.stop
              class="flex-1 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              Add Input
            </button>
            <button 
              @click="addOutput"
              @mousedown.stop
              @touchstart.stop
              class="flex-1 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              Add Output
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
                    {{ socket.name || 'Input ' + (index + 1) }}
                  </div>
                </div>
                <button 
                  class="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center"
                  @click.stop="removeSocket(index, 'input')"
                  @mousedown.stop
                  @touchstart.stop
                >×</button>
              </div>
            </div>
          </div>

          <!-- Output Sockets Table -->
          <div class="space-y-2">
            <div class="text-sm font-medium text-gray-400">Output Sockets</div>
            <div class="space-y-1">
              <div 
                v-for="(socket, index) in localCardData.data.sockets.outputs" 
                :key="socket.id"
                class="flex items-center gap-2 bg-gray-900 p-2 rounded group"
              >
                <span class="text-xs text-gray-400 w-4">{{ index + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <div v-if="editingSocket?.id === socket.id" class="flex items-center">
                    <input
                      type="text"
                      v-model="editingSocket.name"
                      @blur="saveSocketName(socket, 'output')"
                      @keyup.enter="saveSocketName(socket, 'output')"
                      @keyup.esc="cancelEdit"
                      :ref="el => { if (el) socketInputRefs['output-' + index] = el }"
                      class="w-full bg-gray-800 text-white px-2 py-1 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      @mousedown.stop
                      @click.stop
                    />
                  </div>
                  <div 
                    v-else
                    @click.stop="startEditing(socket, index, 'output')"
                    class="truncate cursor-text text-gray-100 text-xs"
                  >
                    {{ socket.name || 'Output ' + (index + 1) }}
                  </div>
                </div>
                <button 
                  class="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center"
                  @click.stop="removeSocket(index, 'output')"
                  @mousedown.stop
                  @touchstart.stop
                >×</button>
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
    const socketInputRefs = Vue.ref([]);

    // Initialize local card data with default sockets
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Template Card",           // Changed from defaultName
        description: "Template Node",    // Changed from defaultDescription
        defaultSockets: {
          inputs: [{ name: "Initial Input 1" }, { name: "Initial Input 2" }],
          outputs: [{ name: "Initial Output 1" }, { name: "Initial Output 2" }],
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
        switch (type) {
          case "modified":
            if (content.old.value !== content.new.value) {
              console.log("Input Socket Value Changed", content)
              // Handle input value change
            }
            if (content.old.name !== content.new.name) {
              console.log("Input Socket Name Changed", content)
              // Handle input name change
            }
            break;
          case "added":
            // Handle input socket addition
            console.log("Input Socket Added", content)
            break;
          case "removed":
            // Handle input socket removal
            console.log("Input Socket Removed", content)
            break;
        }
      },
      onOutputChange: ({ type, content }) => {
        switch (type) {
          case "modified":
            if (content.old.value !== content.new.value) {
              // Handle output value change
            }
            if (content.old.name !== content.new.name) {
              // Handle output name change
            }
            break;
          case "added":
            // Handle output socket addition
            break;
          case "removed":
            // Handle output socket removal
            break;
        }
      }
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
    
    // Watch height changes
    Vue.watch(() => props.cardData.ui?.height, watchers.height);

    // Socket management functions
    const addInput = () => {
      if (isProcessing.value) return;
      const newIndex = localCardData.value.data.sockets.inputs.length;
      const newSocket = createSocket({
        type: "input",
        name: "Input " + (newIndex + 1),
        index: newIndex,
      });
      localCardData.value.data.sockets.inputs.push(newSocket);
      handleCardUpdate();
    };

    const addOutput = () => {
      if (isProcessing.value) return;
      const newIndex = localCardData.value.data.sockets.outputs.length;
      const newSocket = createSocket({
        type: "output",
        name: "Output " + (newIndex + 1),
        index: newIndex,
      });
      localCardData.value.data.sockets.outputs.push(newSocket);
      handleCardUpdate();
    };

    const removeSocket = (index, type) => {
      if (isProcessing.value) return;
      const socketArray =
        type === "input"
          ? localCardData.value.data.sockets.inputs
          : localCardData.value.data.sockets.outputs;

      socketArray.splice(index, 1);

      // Reindex remaining sockets
      socketArray.forEach((socket, i) => {
        socket.index = i;
        socket.name =
          socket.name || `${type === "input" ? "Input" : "Output"} ${i + 1}`;
      });

      handleCardUpdate();
    };

    // Socket name editing functions
    const startEditing = (socket, index, type) => {
      editingSocket.value = {
        id: socket.id,
        name: socket.name || `${type} ${index + 1}`,
        index,
        type,
      };
      // Using nextTick to ensure the input is mounted
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

    // Mounted hook
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    // Cleanup
    Vue.onUnmounted(cleanup);

    return {
      localCardData,
      socketInputRefs,
      editingSocket,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      addInput,
      addOutput,
      removeSocket,
      startEditing,
      saveSocketName,
      cancelEdit,
    };
  },
};
