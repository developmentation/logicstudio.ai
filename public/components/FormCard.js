// TriggerCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useCanvases } from "../composables/useCanvases.js";
import { useRealTime } from "../composables/useRealTime.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "FormCard",
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
      >
        
        <!-- Output Socket -->
        <div 
          v-if="localCardData.sockets.outputs?.[0]"
          class="absolute -right-[12px]" 
          style="top: 16px;"
        >
          <BaseSocket
            type="output"
            :socket-id="outputSocket.id"
            :card-id="localCardData.uuid"
            :name="outputSocket.name"
            :value="outputSocket.value"
            :is-connected="getSocketConnections(outputSocket.id)"
            :has-error="hasSocketError(outputSocket.id)"
            :zoom-level="zoomLevel"
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Content -->
        <div class="space-y-4 text-gray-300" v-show="localCardData.display == 'default'">
          {{isConnecting ? (isConnected ? "Disconnecting..." : "Connecting...") : ""}}
          <!-- Connect Button -->
          <div class="flex justify-center mt-2">
            <button 
              class="px-6 py-2 text-sm font-medium rounded"
              :disabled="isConnecting"
              :class="isConnected ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'"
              @click="handleConnectClick"
            >
              {{ isConnected ? 'Disconnect' : 'Connect' }}
            </button>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const { activeCards, activeConnections, removeConnection } = useCanvases();
    const socketRegistry = new Map();
    const isProcessing = Vue.ref(false);
    const connections = Vue.ref(new Set());
    const isConnected = Vue.ref(false);
    const isConnecting = Vue.ref(false);

    const {
      wsUuid,
      sessions,
      registerSession,
      unregisterSession,
      sendMessage,
    } = useRealTime();
    let websocketId = Vue.ref(uuidv4()); //Create a unique websocket ID for gathering the results back

    // Initialize card data
    const initializeCardData = (data) => {
      const outputSocket = createSocket({
        type: "output",
        index: 0,
        existingId: data.sockets?.outputs?.[0]?.id,
        value: data.sockets?.outputs?.[0]?.value,
      });
      outputSocket.name = "Form Output";

      emit(
        "sockets-updated",
        createSocketUpdateEvent({
          cardId: data.uuid,
          oldSockets: [],
          newSockets: [outputSocket],
          reindexMap: new Map([[null, outputSocket.id]]),
          deletedSocketIds: [],
          type: "output",
        })
      );

      return {
        uuid: data.uuid,
        name: data.name || "On form",
        description: data.description || "Form Node",
        type: "form",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        status: data.status || "idle",
        sockets: {
          inputs: [],
          outputs: [outputSocket],
        },
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

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

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Computed properties
    const outputSocket = Vue.computed(
      () => localCardData.value.sockets.outputs[0]
    );

    const sessionStatus = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.streamConnected || false;
    });

    const formData = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.form;
    });

    Vue.watch(sessionStatus, (newValue) => {
      isConnecting.value = false;
      isConnected.value = newValue === true;
    });

    Vue.watch(formData, (newValue) => {
      localCardData.value.sockets.outputs[0].value = newValue;
      handleCardUpdate();
    });

    const handleConnectClick = () => {
      isConnecting.value = true;
      sendMessage(        
        wsUuid.value,
        websocketId.value,
        isConnected.value
          ? "disconnect-form-submissions"
          : "connect-form-submissions",
        {}
      );
    };

    const handleCardUpdate = (card) => {
      if (!isProcessing.value) {
        if (card?.uuid) localCardData.value = card;
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

          if (newData.display !== localCardData.value.display)
            localCardData.value.display = newData.display;
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    Vue.onMounted(() => {
      //Register this agent into the websocket registry
      registerSession(websocketId.value, null);
      localCardData.value.status = sessionStatus.value;
    });

    // Cleanup on component unmount
    Vue.onUnmounted(() => {
      socketRegistry.forEach((socket) =>
        socket.cleanup.forEach((cleanup) => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();

      unregisterSession(websocketId.value);
    });

    return {
      localCardData,
      outputSocket,
      getSocketConnections,
      hasSocketError,
      handleSocketMount,
      handleCardUpdate,
      emitWithCardId,
      isConnected,
      isConnecting,
      handleConnectClick,
      removeConnection,
    };
  },
};
