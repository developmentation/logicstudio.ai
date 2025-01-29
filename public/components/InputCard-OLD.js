// InputCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  generateSocketId,
  createSocket,
} from "../utils/socketManagement/socketRemapping.js";

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
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
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
            :key="fileData.name + index"
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
  `,

  setup(props, { emit }) {
    const fileInput = Vue.ref(null);
    const fileNameInput = Vue.ref(null);
    const refreshInputs = Vue.ref([]);
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const editingIndex = Vue.ref(-1);
    const editingName = Vue.ref("");
    const contentMinHeight = Vue.ref(0);

    const initializeCardData = (data) => {
      return {
        uuid: data.uuid,
        type: data.type,
        ui: {
          name: data.ui?.name || "Input Card",
          description: data.ui?.description || "File Input Node",
          display: data.ui?.display || "default",
          x: data.ui?.x || 0,
          y: data.ui?.y || 0,
          width: data.ui?.width || 300,
          height: data.ui?.height || 150,
          zIndex: data.ui?.zIndex || 1,
        },
        data: {
          filesData: data.data?.filesData || [],
          files: data.data?.files || [],
          sockets: {
            inputs: data.data?.sockets?.inputs || [],
            outputs: data.data?.sockets?.outputs || [],
          },
        },
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Socket handling
    const getSocketConnections = (socketId) => connections.value.has(socketId);

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, {
        element: event.element,
        cleanup: [],
      });
    };

    const triggerRefreshFile = (index) => {
      if (refreshInputs.value[index]) {
        refreshInputs.value[index].click();
      }
    };

    // File name editing functions
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
        localCardData.value.data.filesData[index].name = newName;
        // Update the socket name as well
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

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const readFileContent = async (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          let content = reader.result;

          // Handle JSON files
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

        // Determine how to read the file
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

    const handleRefreshFile = async (event, index) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const fileData = await readFileContent(file);

        // Update the file data
        localCardData.value.data.filesData[index] = {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
        };

        if (localCardData.value.data.sockets.outputs[index]) {
          const updatedSocket = {
            ...createSocket({
              type: "output",
              index,
              existingId: localCardData.value.data.sockets.outputs[index].id,
              value: fileData, // Direct assignment of fileData object
            }),
            name: file.name,
          };

          const newSockets = [...localCardData.value.data.sockets.outputs];
          newSockets[index] = updatedSocket;

          const { reindexedSockets, reindexMap } = updateSocketArray({
            oldSockets: localCardData.value.data.sockets.outputs,
            newSockets,
            type: "output",
            deletedSocketIds: [],
            socketRegistry,
            connections: connections.value,
          });

          localCardData.value.data.sockets.outputs = reindexedSockets;

          emit(
            "sockets-updated",
            createSocketUpdateEvent({
              cardId: localCardData.value.uuid,
              oldSockets: localCardData.value.data.sockets.outputs,
              newSockets: reindexedSockets,
              reindexMap,
              deletedSocketIds: [],
              type: "output",
            })
          );
        }
      } finally {
        isProcessing.value = false;
        handleCardUpdate();
        event.target.value = "";
      }
    };

    // For processing new files
    // File processing functions updated to use new structure
    const processFiles = async (files) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.data.sockets.outputs];
        const startIndex = localCardData.value.data.filesData.length;

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

        // Update filesData state
        localCardData.value.data.filesData = [
          ...localCardData.value.data.filesData,
          ...processedFiles.map((pf) => pf.fileInfo),
        ];

        // Create new sockets for the files
        const newSockets = [
          ...oldSockets,
          ...processedFiles.map((pf, index) => ({
            ...createSocket({
              type: "output",
              index: startIndex + index,
              value: pf.fileData,
            }),
            name: pf.fileInfo.name,
          })),
        ];

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "output",
          deletedSocketIds: [],
          socketRegistry,
          connections: connections.value,
        });

        localCardData.value.data.sockets.outputs = reindexedSockets;
        handleCardUpdate();

        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type: "output",
          })
        );
      } finally {
        isProcessing.value = false;
      }
    };

    const removeFile = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.data.sockets.outputs];
        const deletedSocket = oldSockets[index];
        const deletedSocketIds = deletedSocket ? [deletedSocket.id] : [];

        // Remove file and create new sockets array
        localCardData.value.data.filesData.splice(index, 1);
        const newSockets = oldSockets.filter((_, i) => i !== index);

        // Update socket array with proper remapping
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "output",
          deletedSocketIds,
          socketRegistry,
          connections: connections.value,
        });

        // Apply updates - this was wrong, using sockets instead of data.sockets
        localCardData.value.data.sockets.outputs = reindexedSockets;

        // Emit the socket update event
        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets, // These parameters need to match what the handler expects
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds,
            type: "output",
          })
        );

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };
    // File handling functions remain largely the same, but updated to use new structure
    const handleFileSelect = (event) => {
      if (!event.target.files?.length) return;
      processFiles(event.target.files);
    };

    const handleFileDrop = (event) => {
      processFiles(event.dataTransfer.files);
    };

    const triggerFileInput = (event) => {
      event.stopPropagation();
      fileInput.value?.click();
    };

    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    //Card and socket updates
    // Helper computed to get a minimal representation of the socket state
    const socketStateSignature = Vue.computed(() => {
      const sockets = props.cardData.data?.sockets?.outputs;
      if (!sockets) return [];

      // Return minimal representation of the state we care about
      return sockets.map((socket) => ({
        id: socket.id,
        value: socket.value ?? null, // Ensure value is never undefined
        name: socket.name ?? "", // Ensure name is never undefined
      }));
    });

    const processingState = Vue.ref(null);

    // Single watcher that handles all socket changes efficiently

    // Update the watcher with safer comparison logic
    Vue.watch(
      socketStateSignature,
      (newState, oldState) => {
        if (isProcessing.value) return;
        if (!oldState || !newState) return;
        if (processingState.value === newState) return;

        const changes = newState
          .map((socket, index) => {
            const oldSocket = oldState[index] || { value: null, name: "" };
            return {
              id: socket.id,
              hasValueChange:
                JSON.stringify(socket.value) !==
                JSON.stringify(oldSocket.value),
              hasMetaChange: socket.name !== oldSocket.name,
            };
          })
          .filter((change) => change.hasValueChange || change.hasMetaChange);

        if (changes.length > 0) {
          isProcessing.value = true;
          processingState.value = newState;
          try {
            // Update local state first
            localCardData.value.data.sockets.outputs =
              localCardData.value.data.sockets.outputs.map((socket, index) => {
                const newStateSocket = newState[index];
                return {
                  ...socket,
                  value: newStateSocket?.value ?? null,
                  name: newStateSocket?.name ?? "",
                };
              });

            // Emit update event
            emit(
              "sockets-updated",
              createSocketUpdateEvent({
                cardId: localCardData.value.uuid,
                oldSockets: oldState.map((state, index) => ({
                  ...localCardData.value.data.sockets.outputs[index],
                  value: state?.value ?? null,
                  name: state?.name ?? "",
                })),
                newSockets: localCardData.value.data.sockets.outputs,
                reindexMap: localCardData.value.data.sockets.outputs.map(
                  (_, i) => i
                ),
                deletedSocketIds: [],
                type: "output",
              })
            );
          } finally {
            isProcessing.value = false;
            processingState.value = null;
          }
        }
      },
      { deep: true }
    );

    // Watch for specific property changes instead of deep watching
    Vue.watch(
      () => props.cardData.ui?.x,
      (newX) => {
        if (newX !== undefined && !isProcessing.value) {
          localCardData.value.ui.x = newX;
        }
      }
    );

    Vue.watch(
      () => props.cardData.ui?.y,
      (newY) => {
        if (newY !== undefined && !isProcessing.value) {
          localCardData.value.ui.y = newY;
        }
      }
    );

    Vue.watch(
      () => props.cardData.ui?.display,
      (newDisplay) => {
        if (newDisplay !== undefined && !isProcessing.value) {
          localCardData.value.ui.display = newDisplay;
        }
      }
    );

    // Watch socket count for height adjustment
    Vue.watch(
      () => localCardData.value.data.sockets.outputs.length,
      (newSocketCount) => {
        contentMinHeight.value = 30 + newSocketCount * 36;
      },
      { immediate: true }
    );

    // Cleanup
    Vue.onUnmounted(() => {
      socketRegistry.forEach((socket) =>
        socket.cleanup.forEach((cleanup) => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      fileInput,
      localCardData,
      refreshInputs,
      getSocketConnections,
      handleSocketMount,
      emitWithCardId,
      handleFileSelect,
      handleFileDrop,
      removeFile,
      triggerFileInput,
      handleCardUpdate,

      // File editing
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
