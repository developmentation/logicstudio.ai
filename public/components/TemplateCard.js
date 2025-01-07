// New TemplateCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  createSocket,
  updateSocketArray,
  createSocketUpdateEvent,
} from "../utils/socketManagement/socketRemapping.js";

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
  <div>
    <BaseCard
      :card-data="localCardData"
      :zoom-level="zoomLevel"
      :z-index="zIndex"
      :is-selected="isSelected"
      @update-position="$emit('update-position', $event)"
      @update-card="handleCardUpdate"
      @close-card="$emit('close-card', $event)"
      @clone-card="$emit('clone-card', $event)"
      @select-card="$emit('select-card', $event)"
    >
      <!-- Socket List Component - Reused for both inputs and outputs -->
      <template v-for="type in ['input', 'output']">
        <div 
          :class="type === 'input' ? 'absolute -left-[12px]' : 'absolute -right-[12px]'"
          class="flex flex-col gap-1"
          style="top: 16px;"
        >
          <div 
            v-for="(socket, index) in localCardData.sockets[type + 's']"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
          >
            <BaseSocket
              v-if="socket"
              :type="type"
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
      </template>

      <!-- Content -->
      <div class="space-y-4 text-gray-300 p-4">
        <!-- Socket Configuration Tables -->
        <template v-for="type in ['input', 'output']">
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-gray-400">{{ type.charAt(0).toUpperCase() + type.slice(1) }}s</label>
              <button 
                class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                @click="addSocket(type)"
                @mousedown.stop
              >+ Add {{ type.charAt(0).toUpperCase() + type.slice(1) }}</button>
            </div>
            
            <div class="bg-gray-800 rounded overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-gray-900">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-400">Name</th>
                    <th class="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="(socket, index) in localCardData.sockets[type + 's']" 
                    :key="socket.id"
                    class="border-t border-gray-700"
                  >
                    <td class="px-4 py-2">
                      <input
                        type="text"
                        v-model="socket.name"
                        @input="handleSocketNameUpdate(socket)"
                        class="w-full bg-gray-700 text-xs px-2 py-1 rounded"
                        @mousedown.stop
                      />
                    </td>
                    <td class="px-4 py-2">
                      <button 
                        class="text-gray-400 hover:text-white"
                        @click.stop="removeSocket(type, index)"
                        @mousedown.stop
                      >×</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- Extendable Content Area -->
        <slot name="content"></slot>
      </div>
    </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);

    // Initialize card data
    const localCardData = Vue.ref({
      ...props.cardData,
    });

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

    const addSocket = (type) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const socketType = type + "s";
        const oldSockets = [...localCardData.value.sockets[socketType]];
        const newSocket = createSocket({
          type,
          index: oldSockets.length,
        });

        const newSockets = [...oldSockets, newSocket];

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type,
          socketRegistry,
          connections: connections.value,
        });

        // Update local state
        localCardData.value.sockets[socketType] = reindexedSockets;

        // Emit update event
        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type,
          })
        );

        Vue.nextTick(() => handleCardUpdate());
      } finally {
        isProcessing.value = false;
      }
    };

    const removeSocket = (type, index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const socketType = type + "s";
        const oldSockets = [...localCardData.value.sockets[socketType]];
        const deletedSocket = oldSockets[index];

        if (deletedSocket) {
          const newSockets = oldSockets.filter((_, i) => i !== index);
          const deletedSocketIds = [deletedSocket.id];

          const { reindexMap, reindexedSockets } = updateSocketArray({
            oldSockets,
            newSockets,
            type,
            deletedSocketIds,
            socketRegistry,
            connections: connections.value,
          });

          // Update local state
          localCardData.value.sockets[socketType] = reindexedSockets;

          // Emit update event
          emit(
            "sockets-updated",
            createSocketUpdateEvent({
              cardId: localCardData.value.uuid,
              oldSockets,
              newSockets: reindexedSockets,
              reindexMap,
              deletedSocketIds,
              type,
            })
          );
        }

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const handleSocketNameUpdate = (socket) => {
      if (isProcessing.value) return;
      socket.momentUpdated = Date.now();
      handleCardUpdate();
    };

    const handleCardUpdate = () => {
      if (isProcessing.value) return;
      emit("update-card", Vue.toRaw(localCardData.value));
    };

    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData, oldData) => {
        if (!newData || isProcessing.value) return;
        isProcessing.value = true;

        try {
          if (newData.x !== oldData?.x) localCardData.value.x = newData.x;
          if (newData.y !== oldData?.y) localCardData.value.y = newData.y;

          if (
            newData.sockets &&
            (!oldData?.sockets ||
              newData.sockets.inputs?.length !==
                oldData.sockets.inputs?.length ||
              newData.sockets.outputs?.length !==
                oldData.sockets.outputs?.length)
          ) {
            ["inputs", "outputs"].forEach((socketType) => {
              if (newData.sockets[socketType]) {
                const type = socketType.slice(0, -1);
                const oldSockets = oldData?.sockets?.[socketType] || [];
                const newSockets = newData.sockets[socketType].map(
                  (socket, index) =>
                    createSocket({
                      type,
                      index,
                      existingId: socket.id,
                      value: socket.value,
                    })
                );

                const { reindexMap, reindexedSockets } = updateSocketArray({
                  oldSockets,
                  newSockets,
                  type,
                  socketRegistry,
                  connections: connections.value,
                });

                localCardData.value.sockets[socketType] = reindexedSockets;

                emit(
                  "sockets-updated",
                  createSocketUpdateEvent({
                    cardId: localCardData.value.uuid,
                    oldSockets,
                    newSockets: reindexedSockets,
                    reindexMap,
                    deletedSocketIds: [],
                    type,
                  })
                );
              }
            });
          }
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
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
      localCardData,
      getSocketConnections,
      emitWithCardId,
      addSocket,
      removeSocket,
      handleCardUpdate,
      handleSocketMount,
      handleSocketNameUpdate,
    };
  },
};
