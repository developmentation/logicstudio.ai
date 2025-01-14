// ViewCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "ViewCard",
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
        style="width:600px"
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

        <!-- Content -->
        <div 
          class="p-4 text-sm" 
          v-show="localCardData.display == 'default'"
        >
          <div class="flex justify-between mb-2">
            <span class="text-xs text-gray-400">{{ isJsonContent ? 'JSON View' : 'Markdown View' }} (Editable)</span>
            <button 
              @click="copyToClipboard"
              @mousedown.stop
              class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-1"
            >
              <i class="pi pi-copy"></i>
              Copy
            </button>
          </div>

          <!-- JSON View -->
          <pre 
            v-if="isJsonContent" 
            ref="editableContent"
            contenteditable="true" 
            class="bg-[#12141a] border border-gray-800 rounded-lg p-4 max-h-[400px] overflow-y-auto text-gray-300 whitespace-pre-wrap font-mono cursor-text"
            @mousedown.stop
            @wheel.stop
            :key="inputKey + 'a'"
          >{{ formattedJson }}</pre>
          
          <!-- Markdown View -->
          <div 
            v-else 
            ref="editableContent"
            contenteditable="true"
            class="bg-[#12141a] border border-gray-800 rounded-lg p-4 max-h-[400px] overflow-y-auto markdown-dark cursor-text"
            @mousedown.stop
             @wheel.stop
            :key="inputKey + 'b'"
            v-html="renderedContent"
          ></div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const editableContent = Vue.ref(null);
    const inputKey = Vue.ref(0); // Key to force re-render when input changes

    // Initialize card data with a single input socket
    const initializeCardData = (data) => {
      const initialSocket = createSocket({
        type: "input",
        index: 0,
        existingId: data.sockets?.inputs?.[0]?.id,
        value: data.sockets?.inputs?.[0]?.value,
      });

      const baseData = {
        uuid: data.uuid,
        name: data.name || "View",
        description: data.description || "View Node",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        sockets: {
          inputs: [initialSocket],
          outputs: [],
        },
      };

      emit(
        "sockets-updated",
        createSocketUpdateEvent({
          cardId: data.uuid,
          oldSockets: [],
          newSockets: [initialSocket],
          reindexMap: new Map([[null, initialSocket.id]]),
          deletedSocketIds: [],
          type: "input",
        })
      );

      return baseData;
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Content processing and rendering
    const isJsonContent = Vue.computed(() => {
      const value = localCardData.value.sockets.inputs[0]?.value;
      if (!value) return false;

      if (typeof value === "object") {
        return true;
      }

      if (typeof value === "string") {
        try {
          const trimmed = value.trim();
          return (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
          );
        } catch {
          return false;
        }
      }

      return false;
    });

    const formattedJson = Vue.computed(() => {
      const value = localCardData.value.sockets.inputs[0]?.value;
      if (!value) return "";

      try {
        const content = typeof value === "string" ? JSON.parse(value) : value;
        return JSON.stringify(content, null, 2);
      } catch {
        return "";
      }
    });

    const renderedContent = Vue.computed(() => {
      const value = localCardData.value.sockets.inputs[0]?.value;
      if (!value && value !== 0) return ""; // Allow 0 as a valid value

      try {
        // If it's an object (including arrays), stringify it
        if (typeof value === "object") {
          return markdownit().render(JSON.stringify(value, null, 2));
        }

        // If it's any other type (number, boolean, etc), convert to string
        let content = value;
        if (typeof value !== "string") {
          content = String(value);
        }

        // Handle potential value.content structure
        if (value && typeof value === "object" && "content" in value) {
          content = String(value.content);
        }

        return markdownit().render(content);
      } catch (error) {
        console.error("Error rendering content:", error);
        return '<p class="text-red-500">Error rendering content</p>';
      }
    });

    const copyToClipboard = async () => {
      try {
        if (!editableContent.value) return;

        // Get the current content from the editable div
        const currentContent = editableContent.value.innerHTML;
        let plainText = editableContent.value.innerText;

        // If it's JSON content, try to format the plain text nicely
        if (isJsonContent.value) {
          try {
            const jsonObj = JSON.parse(plainText);
            plainText = JSON.stringify(jsonObj, null, 2);
          } catch (e) {
            // If parsing fails, use the plain text as is
            console.warn("Failed to parse JSON for formatting:", e);
          }
        }

        // Create the clipboard data
        const clipData = new ClipboardItem({
          "text/html": new Blob([currentContent], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        });

        await navigator.clipboard.write([clipData]);

        // Show success notification
        const notification = document.createElement("div");
        notification.className =
          "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50";
        notification.textContent = "Copied to clipboard!";
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
      } catch (error) {
        console.error("Error copying to clipboard:", error);

        // Show error notification
        const notification = document.createElement("div");
        notification.className =
          "fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50";
        notification.textContent = "Failed to copy to clipboard";
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
      }
    };

    // Socket connection tracking
    const getSocketConnections = (socketId) => connections.value.has(socketId);
    const hasSocketError = (socket) => false;

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
      if (isProcessing.value) return;
      if (data) {
        isProcessing.value = true;
        try {
          localCardData.value = data;
          emit("update-card", Vue.toRaw(localCardData.value));
        } finally {
          isProcessing.value = false;
        }
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

          // Update socket value and force re-render
          const newValue = newData.sockets?.inputs?.[0]?.value;
          const currentSocket = localCardData.value.sockets.inputs[0];

          if (
            currentSocket &&
            newValue !== undefined &&
            currentSocket.value !== newValue
          ) {
            currentSocket.value = newValue;
            currentSocket.momentUpdated = Date.now();
            inputKey.value++; // Force re-render of content
          }
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Initialize socket connections
    Vue.onMounted(() => {
      if (props.cardData.sockets?.inputs?.[0]) {
        connections.value = new Set([props.cardData.sockets.inputs[0].id]);
      }
    });

    // Cleanup on unmount
    Vue.onUnmounted(() => {
      socketRegistry.forEach((socket) => {
        socket.cleanup.forEach((cleanup) => cleanup());
      });
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      localCardData,
      editableContent,
      isJsonContent,
      formattedJson,
      renderedContent,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      handleCardUpdate,
      handleSocketMount,
      copyToClipboard,
      inputKey,
    };
  },
};
