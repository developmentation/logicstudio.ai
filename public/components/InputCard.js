// InputCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  generateSocketId,
  createSocket
} from '../utils/socketManagement/socketRemapping.js';

export default {
  name: "InputCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false }
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
      <!-- Output Sockets -->
      <div class="absolute -right-[12px] flex flex-col gap-4 py-4"  style="top: 16px;">
        <div 
          v-for="(socket, index) in localCardData.sockets.outputs"
          :key="socket.id"
          class="flex items-center justify-end"
        >
          <BaseSocket
            type="output"
            :socket-id="socket.id"
            :card-id="localCardData.uuid"
            :name="socket.name || \`File \${index + 1}\`"
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
      <div class="space-y-2 text-gray-300 p-4 select-none">
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
        <div 
          class="bg-gray-800 rounded overflow-hidden select-none"
          @mousedown.stop
          @touchstart.stop.prevent
        >
          <table class="w-full text-sm">
            <thead class="bg-gray-900">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 w-8">#</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-400">File Name</th>
                <th class="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(fileData, index) in localCardData.filesData" 
                :key="fileData.name"
                class="border-t border-gray-700"
              >
                <td class="px-4 py-2">{{ index + 1 }}</td>
                <td class="px-4 py-2 text-xs overflow-auto">{{ fileData.name }}</td>
                <td class="px-4 py-2">
                  <button 
                    class="text-gray-400 hover:text-white"
                    @click.stop="removeFile(index)"
                    @mousedown.stop
                    @touchstart.stop
                  >×</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </BaseCard>
  `,
  
  setup(props, { emit }) {
    const fileInput = Vue.ref(null);
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);

   
    const initializeCardData = (data) => {
      // Extract file data from sockets
      const filesData = data.sockets?.outputs?.map(socket => ({
        name: socket.value?.metadata?.name || socket.name,
        type: socket.value?.metadata?.type || 'text/plain',
        size: socket.value?.metadata?.size || 0,
        lastModified: socket.value?.metadata?.lastModified || Date.now()
      })) || [];
    
      return {
        uuid: data.uuid,
        name: data.name || "Input Card",
        description: data.description || "File Input Node",
        x: data.x || 0,
        y: data.y || 0,
        filesData: filesData,
        sockets: {
          inputs: [],
          outputs: data.sockets?.outputs?.map((socket, index) => ({
            ...socket,
            type: 'output',
            index: socket.sourceIndex || index,
            // Preserve the existing socket ID and value
            id: socket.id,
            value: socket.value,
            name: socket.name
          })) || []
        }
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    const getSocketConnections = (socketId) => connections.value.has(socketId);

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, { element: event.element, cleanup: [] });
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const readFileContent = async (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          let content = reader.result;
          if (file.type.includes('json') || file.name.toLowerCase().endsWith('.json')) {
            try {
              content = JSON.parse(reader.result);
            } catch {
              console.warn('JSON parsing failed, using raw text content');
            }
          }
          resolve({
            content,
            metadata: {
              type: file.type,
              name: file.name,
              size: file.size,
              lastModified: file.lastModified
            }
          });
        };

        if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('javascript')) {
          reader.readAsText(file);
        } else if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      });
    };



    const processFiles = async (files) => {
      if (isProcessing.value) return;
      isProcessing.value = true;
    
      try {
        const oldSockets = [...(localCardData.value.sockets.outputs || [])];
        const startIndex = localCardData.value.filesData.length;
        
        const processedFiles = await Promise.all(Array.from(files).map(async (file) => {
          const fileData = await readFileContent(file);
          return {
            fileInfo: {
              name: file.name,
              type: file.type,
              size: file.size,
              lastModified: file.lastModified
            },
            fileData
          };
        }));
    
        // Update filesData state
        localCardData.value.filesData = [
          ...localCardData.value.filesData,
          ...processedFiles.map(pf => pf.fileInfo)
        ];
    
        // Create new sockets for the files
        const newSockets = [
          ...oldSockets,
          ...processedFiles.map((pf, index) => ({
            ...createSocket({
              type: 'output',
              index: startIndex + index,
              value: pf.fileData
            }),
            // Override the default name with the filename
            name: pf.fileInfo.name
          }))
        ];
    
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: 'output',
          deletedSocketIds: [],
          socketRegistry,
          connections: connections.value
        });
    
        // Update the sockets with the reindexed version
        localCardData.value.sockets.outputs = reindexedSockets;
    
        emit('sockets-updated', createSocketUpdateEvent({
          cardId: localCardData.value.uuid,
          oldSockets,
          newSockets: reindexedSockets,
          reindexMap,
          deletedSocketIds: [],
          type: 'output'
        }));
    
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
        const deletedSocket = oldSockets[index];
        const deletedSocketIds = deletedSocket ? [deletedSocket.id] : [];

        // Remove file and create new sockets array
        localCardData.value.filesData.splice(index, 1);
        const newSockets = oldSockets.filter((_, i) => i !== index);

        // Update socket array with proper remapping
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: 'output',
          deletedSocketIds,
          socketRegistry,
          connections: connections.value
        });

        // Apply updates
        localCardData.value.sockets.outputs = reindexedSockets;

        // Emit the socket update event
        emit('sockets-updated', createSocketUpdateEvent({
          cardId: localCardData.value.uuid,
          oldSockets,
          newSockets: reindexedSockets,
          reindexMap,
          deletedSocketIds,
          type: 'output'
        }));

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

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
        emit('update-card', Vue.toRaw(localCardData.value));
      }
    };

    // Watch for card data changes
    Vue.watch(() => props.cardData, (newData, oldData) => {
      if (!newData || isProcessing.value) return;
      isProcessing.value = true;

      try {
        // Update position
        if (newData.x !== oldData?.x) localCardData.value.x = newData.x;
        if (newData.y !== oldData?.y) localCardData.value.y = newData.y;

        // Update sockets if needed
        if (newData.sockets?.outputs && (!oldData?.sockets || 
            newData.sockets.outputs.length !== oldData.sockets.outputs?.length)) {
          const oldSockets = oldData?.sockets?.outputs || [];
          const newSockets = newData.sockets.outputs.map((socket, index) => 
            createSocket({
              type: 'output',
              index,
              existingId: socket.id,
              value: socket.value
            })
          );

          const { reindexMap, reindexedSockets } = updateSocketArray({
            oldSockets,
            newSockets,
            type: 'output',
            socketRegistry,
            connections: connections.value
          });

          localCardData.value.sockets.outputs = reindexedSockets;

          emit('sockets-updated', createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type: 'output'
          }));
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
    });

    return {
      fileInput,
      localCardData,
      getSocketConnections,
      handleSocketMount,
      emitWithCardId,
      handleFileSelect,
      handleFileDrop,
      removeFile,
      triggerFileInput,
      handleCardUpdate
    };
  }
};