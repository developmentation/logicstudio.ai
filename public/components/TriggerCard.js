// TriggerCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useCanvases } from "../composables/useCanvases.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "TriggerCard",
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
        <!-- Input Socket -->
        <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 16px;">
          <div class="flex items-center">
            <BaseSocket
              type="input"
              :socket-id="inputSocket.id"
              :card-id="localCardData.uuid"
              :name="inputSocket.name"
              :value="inputSocket.value"
              :is-connected="getSocketConnections(inputSocket.id)"
              :has-error="hasSocketError(inputSocket.id)"
              :zoom-level="zoomLevel"
              @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
              @connection-drag="$emit('connection-drag', $event)"
              @connection-drag-end="$emit('connection-drag-end', $event)"
              @socket-mounted="handleSocketMount($event)"
            />
          </div>
        </div>

        <!-- Output Socket (only shown when no sequence) -->
        <div 
          v-if="!hasSequence && localCardData.sockets.outputs?.[0]"
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
          <!-- Trigger Button -->
          <div class="flex justify-center mt-2">
            <button 
              class="px-6 py-2 text-sm font-medium rounded"
              :class="isRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'"
              @click="handleTriggerClick"
            >
              {{ isRunning ? 'Stop' : 'Trigger' }}
            </button>
          </div>

          <!-- Sequence Section -->
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-medium text-gray-400">Sequence:</label>
              <button 
                class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                @click="addSequenceItem"
              >+ Add</button>
            </div>
            
            <div class="space-y-2">
              <div 
                v-for="(item, index) in localCardData.sequence" 
                :key="item.id"
                class="flex items-center gap-2 bg-gray-900 p-2 rounded relative"
                :class="{'border border-red-500': item.errorCount > 0}"
              >
                <span class="text-xs text-gray-400 w-6">{{ index + 1 }}.</span>
                <select
                  v-model="item.cardId"
                  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
                  :class="{'border-red-500': item.errorCount > 0}"
                  @mousedown.stop
                  @change="handleCardUpdate"
                >
                  <option value="">Select card...</option>
                  <option 
                    v-for="card in availableCards" 
                    :key="card.uuid" 
                    :value="card.uuid"
                  >
                    {{ card.name }}
                  </option>
                </select>

                <span 
                  v-if="item.errorCount > 0" 
                  class="text-xs text-red-500 ml-2"
                >
                  Retry {{item.errorCount}}/3
                </span>

                <button 
                  class="text-gray-400 hover:text-gray-200 ml-2"
                  @click="removeSequenceItem(index)"
                  @mousedown.stop
                  @touchstart.stop
                >×</button>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const { activeCards, activeConnections } = useCanvases();
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const isRunning = Vue.ref(false);
    const currentSequenceIndex = Vue.ref(-1);
    const retryTimeout = Vue.ref(null);
    const isTransitioning = Vue.ref(false);

    // Initialize card data
    const initializeCardData = (data) => {
      const inputSocket = createSocket({
        type: "input",
        index: 0,
        existingId: data.sockets?.inputs?.[0]?.id,
        value: data.sockets?.inputs?.[0]?.value,
      });
      inputSocket.name = "Trigger Input";

      const outputSocket = createSocket({
        type: "output",
        index: 0,
        existingId: data.sockets?.outputs?.[0]?.id,
        value: data.sockets?.outputs?.[0]?.value,
      });
      outputSocket.name = "Trigger Output";

      emit(
        "sockets-updated",
        createSocketUpdateEvent({
          cardId: data.uuid,
          oldSockets: [],
          newSockets: [inputSocket],
          reindexMap: new Map([[null, inputSocket.id]]),
          deletedSocketIds: [],
          type: "input",
        })
      );

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
        name: data.name || "Trigger",
        description: data.description || "Trigger Node",
        type: "trigger",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        sequence: (data.sequence || []).map(item => ({
          ...item,
          errorCount: item.errorCount || 0
        })),
        sockets: {
          inputs: [inputSocket],
          outputs: [outputSocket],
        },
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Computed properties
    const inputSocket = Vue.computed(() => localCardData.value.sockets.inputs[0]);
    const outputSocket = Vue.computed(() => localCardData.value.sockets.outputs[0]);
    const hasSequence = Vue.computed(() => localCardData.value.sequence.length > 0);
    const availableCards = Vue.computed(() => {
      return activeCards.value.filter(
        (card) =>
          card.uuid !== localCardData.value.uuid &&
          (card.type === "agent" || card.type === "web")
      );
    });

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

    // Add sequence management
    const addSequenceItem = () => {
      localCardData.value.sequence.push({
        id: generateSocketId(),
        cardId: "",
        errorCount: 0
      });

      if (localCardData.value.sequence.length === 1) {
        localCardData.value.sockets.outputs = [];
      }

      handleCardUpdate();
    };

    const removeSequenceItem = (index) => {
      localCardData.value.sequence.splice(index, 1);

      if (localCardData.value.sequence.length === 0) {
        localCardData.value.sockets.outputs = [
          createSocket({
            type: "output",
            index: 0,
          }),
        ];
      }

      handleCardUpdate();
    };

    // Trigger functionality
    const triggerCard = (cardId) => {
      const card = activeCards.value.find((c) => c.uuid === cardId);
      if (card) {
        emit("update-card", {
          ...Vue.toRaw(card),
          trigger: Date.now(),
        });
      }
    };

    const handleDirectTrigger = () => {
      const connections = activeConnections.value.filter(
        (conn) => conn.sourceCardId === localCardData.value.uuid
      );

      connections.forEach((conn) => {
        const targetCard = activeCards.value.find(
          (card) => card.uuid === conn.targetCardId
        );
        if (
          targetCard &&
          (targetCard.type === "agent" || targetCard.type === "web")
        ) {
          triggerCard(targetCard.uuid);
        }
      });
    };

    // Handle retry logic
    const retryCard = (cardId, sequenceIndex) => {
      const sequenceItem = localCardData.value.sequence[sequenceIndex];
      if (sequenceItem.errorCount < 3) {
        // Clear any existing retry timeout
        if (retryTimeout.value) {
          clearTimeout(retryTimeout.value);
          retryTimeout.value = null;
        }

        // Increment error count
        sequenceItem.errorCount++;
        handleCardUpdate();

        // Set retry timeout
        retryTimeout.value = setTimeout(() => {
          if (isRunning.value) {
            triggerCard(cardId);
          }
          retryTimeout.value = null;
        }, 5000);
      } else {
        // Move to next card after 3 failures
        const nextIndex = currentSequenceIndex.value + 1;
        if (nextIndex < localCardData.value.sequence.length) {
          currentSequenceIndex.value = nextIndex;
          const nextCardId = localCardData.value.sequence[nextIndex].cardId;
          triggerCard(nextCardId);
        } else {
          completeSequence();
        }
      }
    };

    // Clean up sequence
    const completeSequence = () => {
      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value);
        retryTimeout.value = null;
      }

      isRunning.value = false;
      currentSequenceIndex.value = -1;
      isTransitioning.value = false;

      // Reset all cards in sequence
      localCardData.value.sequence.forEach((item) => {
        item.errorCount = 0;
        const card = activeCards.value.find((c) => c.uuid === item.cardId);
        if (card && card.status !== "idle") {
          emit("update-card", {
            ...Vue.toRaw(card),
            status: "idle",
            trigger: null
          });
        }
      });

      handleCardUpdate();
    };

    // Process sequence
    const processSequence = () => {
      if (isTransitioning.value) return;

      isTransitioning.value = true;

      // Reset error counts and clear timeouts
      localCardData.value.sequence.forEach((item) => {
        item.errorCount = 0;
      });

      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value);
        retryTimeout.value = null;
      }

      // Reset cards if needed
      const sequenceCardIds = new Set(
        localCardData.value.sequence.map((item) => item.cardId)
      );
      
      const cardsNeedingReset = activeCards.value.filter(
        (card) => sequenceCardIds.has(card.uuid) && card.status !== "idle"
      );

      if (cardsNeedingReset.length === 0) {
        currentSequenceIndex.value = 0;
        const firstCardId = localCardData.value.sequence[0].cardId;
        triggerCard(firstCardId);
        setTimeout(() => {
          isTransitioning.value = false;
        }, 100);
        return;
      }

      // Reset cards and start sequence
      cardsNeedingReset.forEach((card) => {
        emit("update-card", {
          ...Vue.toRaw(card),
          status: "idle",
          trigger: null
        });
      });

      handleCardUpdate();

      currentSequenceIndex.value = 0;
      const firstCardId = localCardData.value.sequence[0].cardId;
      triggerCard(firstCardId);
      
      setTimeout(() => {
        isTransitioning.value = false;
      }, 100);
    };

    // Watch for status changes
    Vue.watch(
      () => activeCards.value.map(card => ({
        id: card.uuid,
        status: card.status
      })),
      () => {
        if (
          isRunning.value &&
          hasSequence.value &&
          currentSequenceIndex.value >= 0 &&
          !isTransitioning.value
        ) {
          const currentCard = activeCards.value.find(
            (card) =>
              card.uuid ===
              localCardData.value.sequence[currentSequenceIndex.value]?.cardId
          );

          if (currentCard) {
            switch (currentCard.status) {
              case "complete":
                const nextIndex = currentSequenceIndex.value + 1;
                if (nextIndex < localCardData.value.sequence.length) {
                  isTransitioning.value = true;
                  currentSequenceIndex.value = nextIndex;
                  const nextCardId = localCardData.value.sequence[nextIndex].cardId;
                  triggerCard(nextCardId);
                  setTimeout(() => {
                    isTransitioning.value = false;
                  }, 100);
                } else {
                  completeSequence();
                }
                break;

              case "error":
                retryCard(currentCard.uuid, currentSequenceIndex.value);
                break;

              case "inProgress":
                // Card is still processing, continue watching
                break;
            }
          }
        }
      },
      { deep: true }
    );

    const handleTriggerClick = () => {
      if (isRunning.value) {
        completeSequence();
        return;
      }

      isRunning.value = true;
      if (hasSequence.value) {
        processSequence();
      } else {
        handleDirectTrigger();
      }
    };

    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    // Watch input socket for changes
    const inputSocketValue = Vue.computed(
      () => localCardData.value.sockets.inputs[0]?.value
    );

    Vue.watch(inputSocketValue, (newValue, oldValue) => {
      if (newValue !== oldValue && newValue !== null) {
        if (hasSequence.value) {
          isRunning.value = true;
          processSequence();
        } else {
          isRunning.value = true;
          handleDirectTrigger();
        }
      }
    });

    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData) => {
        if (!newData || isProcessing.value) return;
        isProcessing.value = true;
        try {
          if (newData.x !== localCardData.value.x)
            localCardData.value.x = newData.x;
          if (newData.y !== localCardData.value.y)
            localCardData.value.y = newData.y;
          if (newData.sequence) {
            // Ensure errorCount is preserved when updating sequence
            localCardData.value.sequence = newData.sequence.map((item, index) => ({
              ...item,
              errorCount: localCardData.value.sequence[index]?.errorCount || 0
            }));
          }
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Cleanup on component unmount
    Vue.onUnmounted(() => {
      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value);
      }
      socketRegistry.forEach((socket) =>
        socket.cleanup.forEach((cleanup) => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      localCardData,
      inputSocket,
      outputSocket,
      hasSequence,
      isRunning,
      availableCards,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      handleSocketMount,
      handleCardUpdate,
      addSequenceItem,
      removeSequenceItem,
      handleTriggerClick,
    };
  },
};