// TextCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import TextEditor from "./TextEditor.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "TextCard",
  components: {
    BaseCard,
    BaseSocket,
    TextEditor,
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
      >
        <!-- Input Socket -->
        <div class="absolute -left-[12px]" style="top: 16px;">
          <BaseSocket
            v-if="localCardData.sockets.inputs[0]"
            type="input"
            :socket-id="localCardData.sockets.inputs[0].id"
            :card-id="localCardData.uuid"
            :name="localCardData.sockets.inputs[0].name"
            :value="localCardData.sockets.inputs[0].value"
            :is-connected="getSocketConnections(localCardData.sockets.inputs[0].id)"
            :has-error="hasSocketError(localCardData.sockets.inputs[0])"
            :zoom-level="zoomLevel"
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Output Sockets -->
        <div class="absolute -right-[12px] flex flex-col gap-1" style="top: 16px;">
          <div
            v-for="(socket, index) in outputSockets"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
          >
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
              :value="socket.value"
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

        <!-- Content -->
        <div class="space-y-4 text-gray-300 mt-8">
          <div class="space-y-1">
            <TextEditor
              v-model="localCardData.content"
              placeholder="Enter text with break points..."
              :existing-breaks="localCardData.sockets.outputs"
              @break-update="handleBreakUpdate"
              @segments-update="handleSegmentsUpdate"
              @html-update="handleHtmlUpdate"
            />
          </div>
          
          <!-- Bottom Controls -->
          <div class="flex justify-between items-center mt-4">
            <label class="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                v-model="autoSync"
                class="form-checkbox h-3 w-3"
                @mousedown.stop
              />
              Auto-sync from input
            </label>
            <button
              @click="clearContent"
              @mousedown.stop
              class="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded"
            >
              Clear
            </button>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const currentSegments = Vue.ref([]);

    // Initialize card data with proper socket structure
    const initializeCardData = (data) => {
      const initialInputSocket = createSocket({
        type: "input",
        index: 0,
        existingId: data.sockets?.inputs?.[0]?.id,
        value: data.sockets?.inputs?.[0]?.value,
      });

      const baseData = {
        uuid: data.uuid,
        name: data.name || "Text",
        description: data.description || "Text Node",
        content: data.content || "",
        contentHtml: data.contentHtml || "",
        x: data.x || 0,
        y: data.y || 0,
        sockets: {
          inputs: [initialInputSocket],
          outputs: data.sockets?.outputs || [],
        },
      };

      // Emit socket update event to register the initial input socket
      emit(
        "sockets-updated",
        createSocketUpdateEvent({
          cardId: data.uuid,
          oldSockets: [],
          newSockets: [initialInputSocket],
          reindexMap: new Map([[null, initialInputSocket.id]]),
          deletedSocketIds: [],
          type: "input",
        })
      );

      return baseData;
    };

    // Initialize local state
    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Computed properties
    const outputSockets = Vue.computed(() => localCardData.value.sockets.outputs);
    // Add autoSync ref with default true
    const autoSync = Vue.ref(true);

    // Watch input socket value for auto-sync
    Vue.watch(
      () => localCardData.value.sockets.inputs[0]?.value,
      (newValue) => {
        if (
          autoSync.value &&
          newValue !== undefined && 
          newValue !== null
        ) {
          syncFromInput();
        }
      }
    );

    // Socket connection tracking
    const getSocketConnections = (socketId) => connections.value.has(socketId);
    const hasSocketError = () => false;

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, {
        element: event.element,
        cleanup: [],
      });
    };

    // Helper to emit events with card ID
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Sync content from input
    const syncFromInput = () => {
      const inputSocket = localCardData.value.sockets.inputs[0];
      if (!inputSocket || inputSocket.value === undefined) return;

      let content = inputSocket.value;
      if (typeof content === 'object') {
        content = JSON.stringify(content, null, 2);
      }

      // Properly preserve carriage returns
      content = String(content)
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      
      // Update content
      localCardData.value.content = content;

      // Trigger TextEditor events to create initial socket
      Vue.nextTick(() => {
        const segments = [{
          text: content,
          startPosition: 0,
          endPosition: content.length,
          precedingBreak: null,
          followingBreak: null
        }];

        handleSegmentsUpdate(segments);
        handleBreakUpdate({ breaks: [] });
      });
    };

    // Clear content
    const clearContent = () => {
      localCardData.value.content = "";
      handleCardUpdate();
    };

    // Handle segments update from TextEditor
    const handleSegmentsUpdate = (segments) => {
      if (isProcessing.value) return;
      currentSegments.value = segments;
    };

    // Handle break updates from TextEditor
    const handleBreakUpdate = (event) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.outputs];
        let newSockets = [];

        // First, handle the initial segment if it exists
        if (currentSegments.value.length > 0 && currentSegments.value[0].precedingBreak === null) {
          const existingInitialSocket = oldSockets.find(s => s.name === "Initial");
          
          if (existingInitialSocket) {
            newSockets.push({
              ...existingInitialSocket,
              value: currentSegments.value[0].text || "",
              index: 0
            });
          } else {
            const initialSocket = createSocket({
              type: "output",
              index: 0,
              value: currentSegments.value[0].text || "",
            });
            initialSocket.name = "Initial";
            newSockets.push(initialSocket);
          }
        }

        // Then map breaks to sockets with their corresponding segment texts
        event.breaks.forEach((breakInfo, index) => {
          const existingSocket = oldSockets.find(s => s.name === breakInfo.name);
          const segmentIndex = newSockets.length;
          const segment = currentSegments.value[segmentIndex];
          
          if (existingSocket) {
            newSockets.push({
              ...existingSocket,
              value: segment ? segment.text : (existingSocket.value || ""),
              index: newSockets.length
            });
          } else {
            const socket = createSocket({
              type: "output",
              index: newSockets.length,
              value: segment ? segment.text : "",
            });
            socket.name = breakInfo.name;
            newSockets.push(socket);
          }
        });

        // Find deleted sockets
        const deletedSocketIds = oldSockets
          .filter(old => !newSockets.some(n => n.id === old.id))
          .map(s => s.id);

        // Use utility for socket array update
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "output",
          deletedSocketIds,
          socketRegistry,
          connections: connections.value,
        });

        // Update local state
        localCardData.value.sockets.outputs = reindexedSockets;

        // Emit socket update event
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
      } finally {
        isProcessing.value = false;
        Vue.nextTick(() => {
          handleCardUpdate();
        });
      }
    };

    // Handle HTML updates
    const handleHtmlUpdate = (html) => {
      localCardData.value.contentHtml = html;
    };

    // Card update handler
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
        if (!newData || isProcessing.value || !oldData) return;
        isProcessing.value = true;

        try {
          // Update position if changed
          if (newData.x !== oldData.x) localCardData.value.x = newData.x;
          if (newData.y !== oldData.y) localCardData.value.y = newData.y;
          
          // Update content if changed
          if (newData.content !== oldData.content) {
            // Preserve carriage returns when updating content
            localCardData.value.content = newData.content.replace(/\\n/g, '\n');
          }

          // Update input socket if changed
          const newInputSocket = newData.sockets?.inputs?.[0];
          if (newInputSocket && (!localCardData.value.sockets.inputs[0] || 
              localCardData.value.sockets.inputs[0].value !== newInputSocket.value)) {
            localCardData.value.sockets.inputs[0] = {
              ...localCardData.value.sockets.inputs[0],
              value: newInputSocket.value
            };
          }
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Cleanup on unmount
    Vue.onUnmounted(() => {
      socketRegistry.forEach(socket => 
        socket.cleanup.forEach(cleanup => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();
    });

          return {
      localCardData,
      outputSockets,
      autoSync,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      handleSocketMount,
      handleCardUpdate,
      handleBreakUpdate,
      handleHtmlUpdate,
      handleSegmentsUpdate,
      syncFromInput,
      clearContent,
    };
  },
};