// PDFCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { PdfParser } from "../utils/fileManagement/parsePdf.js";
import {
  CardInitializer,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";

// Add back the socket remapping utilities
import {
  updateSocketArray,
  createSocketUpdateEvent,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "PDFCard",
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
            class="flex items-center justify-end gap-2"
          >
            <div class="text-xs text-gray-400">
              <i :class="getSocketIcon(socket.contentType)"></i>
            </div>
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
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
              <p class="text-xs text-gray-400">Click or drag PDF files to upload</p>
            </div>
            <input
              type="file"
              ref="fileInput"
              class="hidden"
              multiple
              accept=".pdf,application/pdf"
              @change="handleFileSelect"
            />
          </div>

          <!-- File List -->
          <div class="space-y-2">
            <div 
              v-for="(fileData, index) in localCardData.data.files" 
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
                  class="space-y-1"
                >
                  <div
                    @click.stop="startEditing(index, fileData.name)"
                    class="truncate cursor-text hover:text-gray-100 text-xs"
                    :title="fileData.name"
                  >
                    {{ fileData.name }}
                  </div>
                  <div class="text-[10px] text-gray-500">
                    {{ getFileDetails(fileData) }}
                  </div>
                </div>
              </div>
              <input
                type="file"
                :ref="el => { if (el) refreshInputs[index] = el }"
                class="hidden"
                accept=".pdf,application/pdf"
                @change="(e) => handleRefreshFile(e, index)"
              />
              <button 
                class="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center"
                @click.stop="triggerRefreshFile(index)"
                @mousedown.stop
                @touchstart.stop
                title="Update PDF"
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
    // Initialize card setup utilities
    const {
      socketRegistry,
      connections,
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup
    } = useCardSetup(props, emit);

    // Initialize refs
    const fileInput = Vue.ref(null);
    const fileNameInput = Vue.ref(null);
    const refreshInputs = Vue.ref([]);
    const editingIndex = Vue.ref(-1);
    const editingName = Vue.ref("");
    const contentMinHeight = Vue.ref(0);

    // Initialize local card data with default sockets
    const localCardData = Vue.ref(
      CardInitializer.initializeCardData(props.cardData, {
        name: "PDF Card",
        description: "PDF Processing Node",
        defaultData: {
          files: [],
        }
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
      onInputChange: ({ type, content }) => {},
      onOutputChange: ({ type, content }) => {
        switch (type) {
          case "modified":
            handleCardUpdate();
            break;
          case "added":
          case "removed":
            updateContentMinHeight();
            handleCardUpdate();
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

    // Update minimum height based on socket count
    const updateContentMinHeight = () => {
      contentMinHeight.value = 60 + (localCardData.value.data.sockets.outputs.length * 36);
    };

    Vue.watch(
      () => localCardData.value.data.sockets.outputs.length,
      updateContentMinHeight,
      { immediate: true }
    );

    // PDF-specific utility functions
    const getSocketIcon = (type) => {
      switch (type) {
        case "text/plain":
          return "pi pi-file-edit";
        case "image/png":
          return "pi pi-image";
        default:
          return "pi pi-file";
      }
    };

    const getFileDetails = (fileData) => {
      const parts = [];
      parts.push(`${fileData.pageCount} pages`);
      if (fileData.isScanned) {
        parts.push("Scanned document");
      }
      if (fileData.imageCount) {
        parts.push(`${fileData.imageCount} images`);
      }
      return parts.join(" • ");
    };

    // File handling functions
    const readFileContent = async (file) => {
      if (!file.type.includes("pdf")) {
        throw new Error("Only PDF files are supported");
      }

      const parser = new PdfParser({
        imageScale: 2.0,
        imageQuality: 0.95,
        timeout: 30000,
      });

      const result = await parser.parse(file);

      const socketData = [];

      if (!result.isScanned && result.text.some((pageText) => pageText.length > 0)) {
        const textContent = result.text
          .map((pageItems, pageIndex) => {
            const pageText = pageItems.map((item) => item.text).join("");
            return pageText ? `[Page ${pageIndex + 1}]\n${pageText}` : "";
          })
          .filter(Boolean)
          .join("\n\n");

        socketData.push({
          content: textContent,
          metadata: {
            type: "text/plain",
            name: `${file.name}.txt`,
            size: textContent.length,
            lastModified: Date.now(),
            format: "text",
          },
        });
      }

      if (result.isScanned) {
        result.pages.forEach((page, idx) => {
          socketData.push({
            content: page.dataUrl,
            metadata: {
              type: "image/png",
              name: `${file.name}_page_${idx + 1}.png`,
              size: page.size,
              lastModified: Date.now(),
              width: page.width,
              height: page.height,
              pageNumber: idx + 1,
              isRasterized: true,
            },
          });
        });
      }

      result.images.forEach((img, idx) => {
        socketData.push({
          content: img.dataUrl,
          metadata: {
            type: "image/png",
            name: `${file.name}_image_${idx + 1}.png`,
            size: img.size,
            lastModified: Date.now(),
            width: img.width,
            height: img.height,
            pageNumber: img.pageNumber,
          },
        });
      });

      return {
        socketData,
        metadata: {
          type: file.type,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          pageCount: result.pageCount,
          isScanned: result.isScanned,
          imageCount: result.images.length
        }
      };
    };

    const processFiles = async (files) => {
      if (isProcessing.value) return;
      isProcessing.value = true;
    
      try {
        const processedFiles = await Promise.all(
          Array.from(files).map(async (file) => {
            const result = await readFileContent(file);
            return {
              fileInfo: {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified,
                socketCount: result.socketData.length,
                pageCount: result.metadata.pageCount,
                isScanned: result.metadata.isScanned,
                imageCount: result.metadata.imageCount,
              },
              socketData: result.socketData,
            };
          })
        );
    
        // Update files data
        localCardData.value.data.files = [
          ...localCardData.value.data.files,
          ...processedFiles.map((pf) => pf.fileInfo),
        ];
    
        // Create new sockets for all the PDF content
        const oldSockets = [...localCardData.value.data.sockets.outputs];
        const newSockets = processedFiles.flatMap((pf, fileIndex) =>
          pf.socketData.map((socketData, socketIndex) => ({
            id: `${localCardData.value.uuid}-${Date.now()}-${fileIndex}-${socketIndex}`,
            type: "output",
            name: socketData.metadata.name,
            value: socketData,
            contentType: socketData.metadata.type,
            index: oldSockets.length + socketIndex,
          }))
        );
    
        // Use proper socket remapping
        const { reindexedSockets, reindexMap } = updateSocketArray({
          oldSockets,
          newSockets: [...oldSockets, ...newSockets],
          type: "output",
          deletedSocketIds: [],
          socketRegistry,
          connections: connections.value,
        });
    
        localCardData.value.data.sockets.outputs = reindexedSockets;
    
        // Emit socket update event
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
    
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };
    
    const removeFile = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;
    
      try {
        const fileData = localCardData.value.data.files[index];
        
        // Calculate starting index for this file's sockets
        let startIdx = 0;
        for (let i = 0; i < index; i++) {
          startIdx += localCardData.value.data.files[i].socketCount;
        }
    
        // Get IDs of sockets to be deleted
        const deletedSocketIds = localCardData.value.data.sockets.outputs
          .slice(startIdx, startIdx + fileData.socketCount)
          .map(socket => socket.id);
    
        // Create new sockets array without the removed file's sockets
        const newSockets = [
          ...localCardData.value.data.sockets.outputs.slice(0, startIdx),
          ...localCardData.value.data.sockets.outputs.slice(startIdx + fileData.socketCount)
        ];
    
        // Update socket array with proper remapping
        const { reindexedSockets, reindexMap } = updateSocketArray({
          oldSockets: localCardData.value.data.sockets.outputs,
          newSockets,
          type: "output",
          deletedSocketIds,
          socketRegistry,
          connections: connections.value,
        });
    
        // Remove file data
        localCardData.value.data.files.splice(index, 1);
        
        // Update sockets
        localCardData.value.data.sockets.outputs = reindexedSockets;
    
        // Emit the socket update event
        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets: localCardData.value.data.sockets.outputs,
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
        localCardData.value.data.files[index].name = editingName.value.trim();
        handleCardUpdate();
      }
      cancelEdit();
    };

    const cancelEdit = () => {
      editingIndex.value = -1;
      editingName.value = "";
    };

    const handleFileSelect = (event) => {
      if (!event.target.files?.length) return;
      processFiles(event.target.files);
      event.target.value = ""; // Reset input
    };

    const handleFileDrop = (event) => {
      const pdfFiles = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.includes("pdf")
      );
      if (pdfFiles.length > 0) {
        processFiles(pdfFiles);
      }
    };

    const triggerFileInput = (event) => {
      event.stopPropagation();
      fileInput.value?.click();
    };

    const triggerRefreshFile = (index) => {
      if (refreshInputs.value[index]) {
        refreshInputs.value[index].click();
      }
    };


    const handleRefreshFile = async (event, index) => {
      const file = event.target.files?.[0];
      if (!file) return;
    
      if (isProcessing.value) return;
      isProcessing.value = true;
    
      try {
        const result = await readFileContent(file);
    
        // Update the file data
        localCardData.value.data.files[index] = {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          pageCount: result.metadata.pageCount,
          isScanned: result.metadata.isScanned,
          imageCount: result.metadata.imageCount,
          socketCount: result.socketData.length,
        };
    
        // Calculate socket indices for this file
        let startIdx = 0;
        for (let i = 0; i < index; i++) {
          startIdx += localCardData.value.data.files[i].socketCount;
        }
    
        // Get IDs of sockets to be deleted
        const deletedSocketIds = localCardData.value.data.sockets.outputs
          .slice(startIdx, startIdx + localCardData.value.data.files[index].socketCount)
          .map(socket => socket.id);
    
        // Create new sockets for the updated file
        const newSockets = result.socketData.map((socketData, idx) => ({
          id: `${localCardData.value.uuid}-${Date.now()}-${index}-${idx}`,
          type: "output",
          name: socketData.metadata.name,
          value: socketData,
          contentType: socketData.metadata.type,
          index: startIdx + idx,
        }));
    
        // Create complete new socket array
        const newSocketArray = [
          ...localCardData.value.data.sockets.outputs.slice(0, startIdx),
          ...newSockets,
          ...localCardData.value.data.sockets.outputs.slice(
            startIdx + localCardData.value.data.files[index].socketCount
          )
        ];
    
        // Update socket array with proper remapping
        const { reindexedSockets, reindexMap } = updateSocketArray({
          oldSockets: localCardData.value.data.sockets.outputs,
          newSockets: newSocketArray,
          type: "output",
          deletedSocketIds,
          socketRegistry,
          connections: connections.value,
        });
    
        // Update sockets
        localCardData.value.data.sockets.outputs = reindexedSockets;
    
        // Emit the socket update event
        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets: localCardData.value.data.sockets.outputs,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds,
            type: "output",
          })
        );
    
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
        event.target.value = ""; // Reset input
      }
    };
    
    // Lifecycle hooks
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    Vue.onBeforeUnmount(cleanup);

    return {
      fileInput,
      localCardData,
      refreshInputs,
      contentMinHeight,
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
      getSocketIcon,
      getFileDetails,
    };
  },
};