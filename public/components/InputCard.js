

// InputCard.js
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
  name: "InputCard",
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
        @update-card="handleCardUpdate"
        @close-card="$emit('close-card', $event)"
        @clone-card="uuid => $emit('clone-card', uuid)"
        @select-card="$emit('select-card', $event)"
        :style="{ minHeight: contentMinHeight + 'px' }"
      >
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
              :name="\`\${index + 1}. \${socket.name || \`File \${index + 1}\`}\`"
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
          class="space-y-2 text-gray-300 p-4 select-none" 
          v-show="localCardData.ui.display === 'default'"
        >
          <!-- File Upload Area -->
          <div 
            class="flex justify-center items-center border-2 border-dashed border-gray-600 rounded-lg p-4 cursor-pointer"
            @click.stop="triggerFileInput"
            @mousedown.stop
            @dragover.prevent
            @dragenter.prevent
            @drop.stop.prevent="handleFileDrop"
            @dragleave.prevent
          >
            <div class="text-center">
              <p class="text-xs text-gray-400">Click or drag files to upload</p>
            </div>
            <input
              type="file"
              ref="fileInput"
              class="hidden"
              multiple
              @change="handleFileSelect"
            />
          </div>

          <!-- File List -->
          <div class="space-y-2">
            <div 
              v-for="(fileData, index) in localCardData.data.filesData" 
              :key="localCardData.data.sockets.outputs[index]?.id || index"
              class="flex items-center gap-2 bg-gray-900 p-2 rounded group"
            >
              <span class="text-xs text-gray-400 w-4">{{ index + 1 }}</span>
              <div class="flex-1 min-w-0">
                <div v-if="editingIndex === index" class="flex items-center">
                  <input
                    type="text"
                    v-model="editingName"
                    @blur="saveFileName(index)"
                    @keyup.enter="saveFileName(index)"
                    @keyup.esc="cancelEdit"
                    ref="fileNameInput"
                    class="w-full bg-gray-800 text-white px-2 py-1 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    @mousedown.stop
                    @click.stop
                  />
                </div>
                <div 
                  v-else
                  @click.stop="startEditing(index, fileData.name)"
                  class="truncate cursor-text hover:text-gray-100 text-xs"
                  :title="fileData.name"
                >
                  {{ fileData.name }}
                </div>
              </div>
              <input
                type="file"
                :ref="el => { if (el) refreshInputs[index] = el }"
                class="hidden"
                @change="(e) => handleRefreshFile(e, index)"
              />
              <button 
                class="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center"
                @click.stop="triggerRefreshFile(index)"
                @mousedown.stop
                @touchstart.stop
                title="Update file"
              >
                <i class="pi pi-refresh text-xs"></i>
              </button>
              <button 
                class="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center"
                @click.stop="removeFile(index)"
                @mousedown.stop
                @touchstart.stop
              >×</button>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    // Initialize refs and state
    const fileInput = Vue.ref(null);
    const fileNameInput = Vue.ref(null);
    const refreshInputs = Vue.ref([]);
    const editingIndex = Vue.ref(-1);
    const editingName = Vue.ref("");

    // Initialize card setup utilities
    const {
      socketRegistry,
      connections,
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    // Initialize local card data with no default sockets
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Input Card",
        description: "File Input Node",
        defaultData: {
          filesData: [],
        },
      })
    );

    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    // Setup socket watcher with detailed change handling
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      // Custom comparison for file data
      compareFunction: (a, b) => {
        if (a === b) return true;
        if (!a || !b) return false;
        
        if (a.content !== undefined && b.content !== undefined) {
          // For text content
          if (typeof a.content === "string" && typeof b.content === "string") {
            return (
              a.content === b.content &&
              a.metadata?.name === b.metadata?.name &&
              a.metadata?.type === b.metadata?.type
            );
          }
          // For binary content, compare metadata
          return (
            a.metadata?.name === b.metadata?.name &&
            a.metadata?.type === b.metadata?.type &&
            a.metadata?.size === b.metadata?.size
          );
        }
        return false;
      },
      // Input sockets are rarely used in InputCard
      onInputChange: (change) => {
        console.log('Input socket change:', change);
        switch (change.type) {
          case "modified":
            // Handle any input value changes if needed
            console.log('Input socket modified:', change.content);
            handleCardUpdate();
            break;
          case "added":
            // Handle new input socket
            console.log('Input socket added:', change.content);
            break;
          case "removed":
            // Handle input socket removal
            console.log('Input socket removed:', change.content);
            break;
        }
      },
      // Handle output socket changes
      onOutputChange: (change) => {
        console.log('Output socket change:', change);
        switch (change.type) {
          case "added":
            // New file socket added
            console.log('Output socket added:', change.content);
            if (!localCardData.value.data.filesData[change.position]) {
              localCardData.value.data.filesData[change.position] = {
                name: change.value?.metadata?.name || `File ${change.position + 1}`,
                type: change.value?.metadata?.type || "text/plain",
                size: change.value?.metadata?.size || 0,
                lastModified: change.value?.metadata?.lastModified || Date.now(),
              };
              handleCardUpdate();
            }
            break;

          case "removed":
            // File socket removed
            console.log('Output socket removed:', change.content);
            if (localCardData.value.data.filesData[change.position]) {
              handleCardUpdate();
            }
            break;

          case "modified":
            // File content or metadata updated
            console.log('Output socket modified:', change.content);
            if (localCardData.value.data.filesData[change.position]) {
              const fileData = change.newValue;
              if (fileData?.metadata) {
                localCardData.value.data.filesData[change.position] = {
                  name: fileData.metadata.name ||
                    localCardData.value.data.filesData[change.position].name,
                  type: fileData.metadata.type ||
                    localCardData.value.data.filesData[change.position].type,
                  size: fileData.metadata.size ||
                    localCardData.value.data.filesData[change.position].size,
                  lastModified: fileData.metadata.lastModified || Date.now(),
                };
                handleCardUpdate();
              }
            }
            break;
        }
      },
    });

    // Set up watchers for UI changes
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

    // Set the minimum height of the card based on number of files
    const contentMinHeight = Vue.computed(() => 
      30 + localCardData.value.data.sockets.outputs.length * 36
    );

    // File content reading utility
    const readFileContent = async (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          let content = reader.result;

          if (
            file.type.includes("json") ||
            file.name.toLowerCase().endsWith(".json")
          ) {
            try {
              content = JSON.parse(reader.result);
            } catch {
              console.warn("JSON parsing failed, using raw text content");
            }
          }

          resolve({
            content,
            metadata: {
              type: file.type,
              name: file.name,
              size: file.size,
              lastModified: file.lastModified,
            },
          });
        };

        if (
          file.type.startsWith("text/") ||
          file.type.includes("json") ||
          file.type.includes("javascript") ||
          file.name.toLowerCase().endsWith(".md") ||
          file.name.toLowerCase().endsWith(".txt")
        ) {
          reader.readAsText(file);
        } else if (file.type.startsWith("image/")) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      });
    };

    // Process multiple files
    const processFiles = async (files) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const processedFiles = await Promise.all(
          Array.from(files).map(async (file) => {
            const fileData = await readFileContent(file);
            return {
              fileInfo: {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified,
              },
              fileData,
            };
          })
        );

        // Add new files
        const newFilesData = processedFiles.map((pf) => pf.fileInfo);
        localCardData.value.data.filesData = [
          ...localCardData.value.data.filesData,
          ...newFilesData,
        ];

        // Create corresponding sockets
        const currentLength = localCardData.value.data.sockets.outputs.length;
        const newSockets = processedFiles.map((pf, idx) => ({
          ...createSocket({
            type: "output",
            value: pf.fileData,
            index: currentLength + idx,  // Use current length as base
          }),
          name: pf.fileInfo.name,
        }));
        
        localCardData.value.data.sockets.outputs = [
          ...localCardData.value.data.sockets.outputs,
          ...newSockets,
        ];

      } finally {
        isProcessing.value = false;
        handleCardUpdate();
      }
    };

    // File handling event handlers
    const handleFileSelect = (event) => {
      if (!event.target.files?.length) return;
      processFiles(event.target.files);
    };

    const handleFileDrop = (event) => {
      processFiles(event.dataTransfer.files);
    };

    const handleRefreshFile = async (event, index) => {
      const file = event.target.files?.[0];
      if (!file || isProcessing.value) return;

      isProcessing.value = true;
      try {
        const fileData = await readFileContent(file);

        // Update file data
        localCardData.value.data.filesData[index] = {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
        };

        // Update corresponding socket
        if (localCardData.value.data.sockets.outputs[index]) {
          const existingSocket = localCardData.value.data.sockets.outputs[index];
          localCardData.value.data.sockets.outputs[index] = {
            ...existingSocket,
            name: file.name,
            value: fileData,
          };
        }

      } finally {
        isProcessing.value = false;
        handleCardUpdate();
        event.target.value = "";
      }
    };

    const removeFile = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        // Get socket ID before removing
        const socketId = localCardData.value.data.sockets.outputs[index]?.id;

        // Remove file data
        localCardData.value.data.filesData.splice(index, 1);

        // Remove corresponding socket
        localCardData.value.data.sockets.outputs =
          localCardData.value.data.sockets.outputs.filter(
            (_, i) => i !== index
          );

      } finally {
        isProcessing.value = false;
        handleCardUpdate();
      }
    };

    // File name editing methods
    const startEditing = (index, name) => {
      editingIndex.value = index;
      editingName.value = name;
      Vue.nextTick(() => {
        if (fileNameInput.value) {
          fileNameInput.value.focus();
          fileNameInput.value.select();
        }
      });
    };

    const saveFileName = (index) => {
      if (editingName.value.trim()) {
        const newName = editingName.value.trim();

        // Update file data name
        localCardData.value.data.filesData[index].name = newName;

        // Update corresponding socket name
        if (localCardData.value.data.sockets.outputs[index]) {
          localCardData.value.data.sockets.outputs[index].name = newName;
        }

        handleCardUpdate();
      }
      cancelEdit();
    };

    const cancelEdit = () => {
      editingIndex.value = -1;
      editingName.value = "";
    };

    // UI helper methods
    const triggerFileInput = (event) => {
      event.stopPropagation();
      fileInput.value?.click();
    };

    const triggerRefreshFile = (index) => {
      if (refreshInputs.value[index]) {
        refreshInputs.value[index].click();
      }
    };

    // Lifecycle hooks
    Vue.onMounted(() => {
      console.log("InputCard mounted, emitting initial state");
      Vue.nextTick(() => {
        // Ensure all reactivity is set up before emitting
        handleCardUpdate();
      });
    });

    // Cleanup
    Vue.onUnmounted(cleanup);

    return {
      fileInput,
      fileNameInput,
      localCardData,
      refreshInputs,
      getSocketConnections,
      handleSocketMount,
      handleFileSelect,
      handleFileDrop,
      removeFile,
      triggerFileInput,
      handleCardUpdate,
      editingIndex,
      editingName,
      startEditing,
      saveFileName,
      cancelEdit,
      triggerRefreshFile,
      handleRefreshFile,
      contentMinHeight,
    };
  },
};