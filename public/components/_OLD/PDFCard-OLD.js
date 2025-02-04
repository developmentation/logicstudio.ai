// PDFInputCard.js
import BaseCard from "../BaseCard.js";
import BaseSocket from "../BaseSocket.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  generateSocketId,
  createSocket,
} from "../../utils/socketManagement/socketRemapping.js";
import { PdfParser } from "../../utils/fileManagement/parsePdf.js";

export default {
  name: "PDFInputCard",
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
      :style="{ minHeight: contentMinHeight + 'px' }"
    >
      <!-- Output Sockets -->
      <div class="absolute -right-[12px] flex flex-col gap-4 py-4" style="top: 16px;">
        <div 
          v-for="(socket, index) in localCardData.sockets.outputs"
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
        v-show="localCardData.display == 'default'"
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
            v-for="(fileData, index) in localCardData.filesData" 
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
    const fileInput = Vue.ref(null);
    const fileNameInput = Vue.ref(null);
    const refreshInputs = Vue.ref([]);
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const editingIndex = Vue.ref(-1);
    const editingName = Vue.ref("");
    const contentMinHeight = Vue.ref(0);

    const getSocketIcon = (type) => {
      switch (type) {
        case "text":
          return "pi pi-file-edit";
        case "image":
          return "pi pi-image";
        case "page":
          return "pi pi-file";
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

    const triggerRefreshFile = (index) => {
      if (refreshInputs.value[index]) {
        refreshInputs.value[index].click();
      }
    };

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
      
        // If the PDF has text content, create a text socket
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
      
        // For rasterized PDFs, create page sockets
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
      
        // Add extracted images as separate sockets
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

      const handleRefreshFile = async (event, index) => {
        const file = event.target.files?.[0];
        if (!file) return;
      
        if (isProcessing.value) return;
        isProcessing.value = true;
      
        try {
          const result = await readFileContent(file);
      
          // Update the file data
          localCardData.value.filesData[index] = {
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
            startIdx += localCardData.value.filesData[i].socketCount;
          }
          const endIdx = startIdx + localCardData.value.filesData[index].socketCount;
      
          // Create new sockets array
          const newSockets = [
            ...localCardData.value.sockets.outputs.slice(0, startIdx),
            ...result.socketData.map((socketData, idx) => ({
              ...createSocket({
                type: "output",
                index: startIdx + idx,
                existingId: localCardData.value.sockets.outputs[startIdx + idx]?.id,
              }),
              name: socketData.metadata.name,
              value: socketData,  // The entire socketData object containing content and metadata
              contentType: socketData.metadata.type,
            })),
            ...localCardData.value.sockets.outputs.slice(endIdx),
          ];
      
          const { reindexedSockets, reindexMap } = updateSocketArray({
            oldSockets: localCardData.value.sockets.outputs,
            newSockets,
            type: "output",
            deletedSocketIds: [],
            socketRegistry,
            connections: connections.value,
          });
      
          localCardData.value.sockets.outputs = reindexedSockets;
      
          emit(
            "sockets-updated",
            createSocketUpdateEvent({
              cardId: localCardData.value.uuid,
              oldSockets: localCardData.value.sockets.outputs,
              newSockets: reindexedSockets,
              reindexMap,
              deletedSocketIds: [],
              type: "output",
            })
          );
        } finally {
          isProcessing.value = false;
          handleCardUpdate();
          event.target.value = "";
        }
      };

      const processFiles = async (files) => {
        if (isProcessing.value) return;
        isProcessing.value = true;
      
        try {
          const oldSockets = [...(localCardData.value.sockets.outputs || [])];
          const startIndex = oldSockets.length;
      
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
      
          // Update filesData state
          localCardData.value.filesData = [
            ...localCardData.value.filesData,
            ...processedFiles.map((pf) => pf.fileInfo),
          ];
      
          // Create new sockets for all the PDF content
          let newSockets = [...oldSockets];
          let currentIndex = startIndex;
      
          processedFiles.forEach((pf) => {
            pf.socketData.forEach((socketData) => {
              newSockets.push({
                ...createSocket({
                  type: "output",
                  index: currentIndex++,
                }),
                name: socketData.metadata.name,
                value: socketData,  // The entire socketData object containing content and metadata
                contentType: socketData.metadata.type,
              });
            });
          });
      
          const { reindexMap, reindexedSockets } = updateSocketArray({
            oldSockets,
            newSockets,
            type: "output",
            deletedSocketIds: [],
            socketRegistry,
            connections: connections.value,
          });
      
          localCardData.value.sockets.outputs = reindexedSockets;
      
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
        const oldSockets = [...localCardData.value.sockets.outputs];
        const fileData = localCardData.value.filesData[index];

        // Calculate starting index for this file's sockets
        let startIdx = 0;
        for (let i = 0; i < index; i++) {
          startIdx += localCardData.value.filesData[i].socketCount;
        }
        const endIdx = startIdx + fileData.socketCount;

        // Get all socket IDs to be deleted
        const deletedSocketIds = oldSockets
          .slice(startIdx, endIdx)
          .map((socket) => socket.id);

        // Remove file data
        localCardData.value.filesData.splice(index, 1);

        // Create new sockets array without the removed file's sockets
        const newSockets = [
          ...oldSockets.slice(0, startIdx),
          ...oldSockets.slice(endIdx),
        ];

        // Update socket array with proper remapping
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "output",
          deletedSocketIds,
          socketRegistry,
          connections: connections.value,
        });

        // Apply updates
        localCardData.value.sockets.outputs = reindexedSockets;

        // Emit the socket update event
        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
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
        const newName = editingName.value.trim();
        localCardData.value.filesData[index].name = newName;

        // Calculate starting index for this file's sockets
        let startIdx = 0;
        for (let i = 0; i < index; i++) {
          startIdx += localCardData.value.filesData[i].socketCount;
        }
        const endIdx =
          startIdx + localCardData.value.filesData[index].socketCount;

        // Update socket names
        for (let i = startIdx; i < endIdx; i++) {
          const socket = localCardData.value.sockets.outputs[i];
          const suffix = socket.name.split(" - ")[1]; // Preserve the socket type suffix
          socket.name = `${newName} - ${suffix}`;
        }

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

    const initializeCardData = (data) => {
      return {
        uuid: data.uuid,
        name: data.name || "PDF Input Card",
        description: data.description || "PDF Input Node",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        filesData: data.filesData || [],
        sockets: {
          inputs: [],
          outputs: data.sockets?.outputs || [],
        },
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    const getSocketConnections = (socketId) => connections.value.has(socketId);

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, {
        element: event.element,
        cleanup: [],
      });
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const handleCardUpdate = (data) => {
      if (data) localCardData.value = data;
      if (!isProcessing.value) {
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

          // Update sockets if needed
          if (
            newData.sockets?.outputs &&
            (!oldData?.sockets ||
              JSON.stringify(newData.sockets.outputs) !==
                JSON.stringify(oldData.sockets.outputs))
          ) {
            localCardData.value.sockets.outputs = newData.sockets.outputs;
          }
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Update minimum height based on socket count
    Vue.watch(
      () => localCardData.value.sockets.outputs.length,
      (newSocketCount) => {
        contentMinHeight.value = 60 + newSocketCount * 36;
      },
      { immediate: true }
    );

    // Cleanup on unmount
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
      editingIndex,
      editingName,
      startEditing,
      saveFileName,
      cancelEdit,
      triggerRefreshFile,
      handleRefreshFile,
      getSocketIcon,
      getFileDetails,
      contentMinHeight,
    };
  },
};
