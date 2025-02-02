// OutputCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";
import { createSocket, updateSocketArray, createSocketUpdateEvent } from "../utils/socketManagement/socketRemapping.js";
import { createFormattedFile, createAndDownloadFile, downloadBlob } from "../utils/fileManagement/fileFormatting.js";

export default {
  name: "OutputCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
  },

  template: `
    <div class = "card">
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
        <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 16px;">
          <div 
            v-for="(socket, index) in localCardData.data.sockets.inputs"
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
          v-if="localCardData.data.sockets.outputs?.[0]"
          class="absolute -right-[12px]" 
          style="top: 16px;"
        >
          <BaseSocket
            type="output"
            :socket-id="localCardData.data.sockets.outputs[0].id"
            :card-id="localCardData.uuid"
            :name="localCardData.data.sockets.outputs[0].name"
            :value="localCardData.data.sockets.outputs[0].value"
            :is-connected="getSocketConnections(localCardData.data.sockets.outputs[0].id)"
            :has-error="hasSocketError(localCardData.data.sockets.outputs[0])"
            :zoom-level="zoomLevel"
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Content -->
        <div class="space-y-2 text-gray-300" v-show="localCardData.ui.display === 'default'">
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
                v-for="(output, index) in localCardData.data.outputs" 
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
                  @click.stop="processFileDownload(index)"
                  @mousedown.stop
                  @touchstart.stop
                > <i class="pi pi-download text-xs"></i></button>

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
            <div class="flex items-center justify-right">
              <button v-if="localCardData.data.outputs?.length > 1"
                class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
                @click.stop="processFileDownload(null)"
              >Download All</button>
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
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    // Constants
    const outputTypes = ["markdown", "docx", "pdf", "json", "txt", "js", "html"];

    // Initialize local card data
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Output",
        description: "Output Node",
        defaultData: {
          outputs: [],
          autoDownload: false,
        },
        defaultSockets: {
          inputs: [],
          outputs: [],
        },
      })
    );

    // Basic error handling for sockets
    const hasSocketError = (socket) => false;

    // Helper to emit events with card ID
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Handle card updates
    const handleCardUpdate = (data) => {
      if (data) localCardData.value = data;
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    // File handling
    const processFileDownload = async (index = null) => {
      if (isProcessing.value) {
        console.warn('Download already in progress');
        return;
      }
      
      isProcessing.value = true;
      const timestamp = Date.now();

      const outputs = localCardData.value.data.outputs;
      if (!outputs?.length) {
        console.warn('No outputs configured');
        isProcessing.value = false;
        return;
      }

      try {
        const indices = index !== null ? [index] : [...Array(outputs.length).keys()];
        
        // Single file download
        if (indices.length === 1) {
          const idx = indices[0];
          const inputSocket = localCardData.value.data.sockets.inputs[idx];
          const outputType = outputs[idx].type;
          const socketValue = inputSocket?.value;

          if (!socketValue) {
            console.warn("No content to download");
            return;
          }

          await createAndDownloadFile(socketValue, outputType, `File${idx + 1}_${timestamp}`);
          return;
        }

        // Multiple files - create zip
        const zip = new JSZip();
        const promises = indices.map(async (idx) => {
          const inputSocket = localCardData.value.data.sockets.inputs[idx];
          const outputType = outputs[idx].type;
          const socketValue = inputSocket?.value;

          if (!socketValue) return;

          const baseFilename = `File${idx + 1}_${timestamp}`;
          const { content, extension } = await createFormattedFile(socketValue, outputType, baseFilename);
          zip.file(`${baseFilename}.${extension}`, content);
        });

        await Promise.all(promises);

        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 9 }
        });

        await downloadBlob(zipBlob, `AllFiles_${timestamp}.zip`);

      } catch (error) {
        console.error("Error processing download:", error);
      } finally {
        isProcessing.value = false;
      }
    };

    // Card-specific operations
    const addInput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.data.sockets.inputs];
        const newSocket = createSocket({
          type: "input",
          index: localCardData.value.data.outputs.length
        });

        localCardData.value.data.outputs.push({
          type: "markdown"
        });

        const newSockets = [...oldSockets, newSocket];

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          socketRegistry,
        });

        localCardData.value.data.sockets.inputs = reindexedSockets;

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

    const removeInput = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.data.sockets.inputs];
        const deletedSocket = oldSockets[index];
        const deletedSocketIds = deletedSocket ? [deletedSocket.id] : [];

        localCardData.value.data.outputs.splice(index, 1);
        const newSockets = oldSockets.filter((_, i) => i !== index);

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          deletedSocketIds,
          socketRegistry,
        });

        localCardData.value.data.sockets.inputs = reindexedSockets;

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

    const updateOutputType = (index, event) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        localCardData.value.data.outputs[index].type = event.target.value;
        if (localCardData.value.data.sockets.inputs[index]) {
          localCardData.value.data.sockets.inputs[index].momentUpdated = Date.now();
        }
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
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
          handleCardUpdate();
        }
      },
      onOutputChange: ({ type, content }) => {
        if (type === 'modified' && content.old.value !== content.new.value) {
          handleCardUpdate();
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

    // Watch core property changes
    Vue.watch(
      () => ({ x: props.cardData.ui?.x, y: props.cardData.ui?.y }),
      watchers.position
    );

    // Watch display changes
    Vue.watch(() => props.cardData.ui?.display, watchers.display);

    // Watch width changes
    Vue.watch(() => props.cardData.ui?.width, watchers.width);

    // Lifecycle hooks
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    Vue.onUnmounted(cleanup);

    return {
      localCardData,
      outputTypes,
      getSocketConnections,
      hasSocketError,
      handleSocketMount,
      handleCardUpdate,
      emitWithCardId,
      addInput,
      removeInput,
      updateOutputType,
      processFileDownload,
    };
  },
};