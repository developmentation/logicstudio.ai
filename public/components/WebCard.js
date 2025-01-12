// WebCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useCanvases } from "../composables/useCanvases.js";
import { useWeb } from "../composables/useWeb.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "WebCard",
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

        <!-- Output Sockets -->
        <div 
          class="absolute -right-[12px] flex flex-col gap-1" 
          style="top: 16px;"
        >
          <div 
            v-for="(socket, index) in localCardData.sockets.outputs"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 24) + 'px)' }"
          >
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="'Output ' + (index + 1)"
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
        <div class="space-y-4 text-gray-300" v-show="localCardData.display == 'default'">
          <!-- Trigger Button -->
          <div class="flex justify-center mt-2">
            <button 
              class="px-6 py-2 text-sm font-medium rounded"
              :class="isProcessing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'"
              @click="handleTriggerClick"
              :disabled="isProcessing"
            >
              {{ isProcessing ? 'Loading...' : 'Load Websites' }}
            </button>
          </div>

          <!-- Websites Section -->
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-medium text-gray-400">Websites:</label>
              <button 
                class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                @click="addWebsite"
              >+ Add</button>
            </div>
            
            <div class="space-y-2">
              <div 
                v-for="(website, index) in localCardData.websites" 
                :key="website.id"
                class="flex items-center gap-2 p-2 rounded relative"
                :class="{
                  'bg-gray-900': website.status === 'idle',
                  'bg-yellow-500/20': website.status === 'inProgress',
                  'bg-green-500/20': website.status === 'complete',
                  'bg-red-500/20': website.status === 'error'
                }"
              >
                <span class="text-xs text-gray-400 w-6">{{ index + 1 }}.</span>
                <input
                  v-model="website.url"
                  type="text"
                  class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
                  placeholder="Enter URL..."
                  @change="handleCardUpdate"
                  @mousedown.stop
                />
                
                <span 
                  v-if="website.status === 'error'" 
                  class="text-xs text-red-500 ml-2"
                >Error</span>

                <button 
                  class="text-gray-400 hover:text-gray-200"
                  @click="removeWebsite(index)"
                  @mousedown.stop
                >×</button>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const currentWebsiteIndex = Vue.ref(-1);


    const {loadWebContent} = useWeb();

    // Initialize card data with proper socket structure
    const initializeCardData = (data) => {
      const baseData = {
        uuid: data.uuid,
        name: data.name || "Web Content",
        description: data.description || "Web Content Node",
        type: "web",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        websites: data.websites || [],
        status: data.status || "idle",
        trigger: data.trigger || null,
        sockets: {
          inputs: [
            createSocket({
              type: "input",
              index: 0,
              existingId: data.sockets?.inputs?.[0]?.id,
              value: data.sockets?.inputs?.[0]?.value,
            }),
          ],
          outputs: [],
        },
      };

      // Initialize outputs if needed
      if (data.websites?.length) {
        baseData.sockets.outputs = data.websites.map((_, index) =>
          createSocket({
            type: "output",
            index,
            existingId: data.sockets?.outputs?.[index]?.id,
            value: data.sockets?.outputs?.[index]?.value,
          })
        );
      }

      return baseData;
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

    // Website management
    const addWebsite = () => {
      const newWebsite = {
        id: generateSocketId(),
        url: "",
        status: "idle",
        momentUpdated: Date.now(),
      };

      localCardData.value.websites.push(newWebsite);

      // Create new output socket
      const oldSockets = [...localCardData.value.sockets.outputs];
      const newSocket = createSocket({
        type: "output",
        index: localCardData.value.websites.length - 1,
      });

      const newSockets = [...oldSockets, newSocket];

      const { reindexMap, reindexedSockets } = updateSocketArray({
        oldSockets,
        newSockets,
        type: "output",
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
    };

    const removeWebsite = (index) => {
      localCardData.value.websites.splice(index, 1);

      // Update sockets
      const oldSockets = [...localCardData.value.sockets.outputs];
      const deletedSocket = oldSockets[index];
      const deletedSocketIds = deletedSocket ? [deletedSocket.id] : [];

      const newSockets = oldSockets.filter((_, i) => i !== index);

      const { reindexMap, reindexedSockets } = updateSocketArray({
        oldSockets,
        newSockets,
        type: "output",
        deletedSocketIds,
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
          deletedSocketIds,
          type: "output",
        })
      );

      handleCardUpdate();
    };

    // Extract URLs from input text
    const extractUrls = (text) => {
      const urlRegex = /https?:\/\/[^\s]+/g;
      return text.match(urlRegex) || [];
    };

    // Process websites
    const processWebsites = async () => {
        if (isProcessing.value) return;
      
        isProcessing.value = true;
        currentWebsiteIndex.value = 0;
        localCardData.value.status = "inProgress";
      
        try {
          for (let i = 0; i < localCardData.value.websites.length; i++) {
            const website = localCardData.value.websites[i];
            if (!website.url) continue;
      
            website.status = "inProgress";
            currentWebsiteIndex.value = i;
            handleCardUpdate();
      
            try {
              const response = await loadWebContent(website.url);
              website.status = "complete";
              
              // Extract just the text content from the API response
              let textContent;
              if (response?.payload?.text) {
                // Direct text content from payload
                textContent = response.payload.text;
              } else if (response?.text) {
                // Text directly on response
                textContent = response.text;
              } else if (typeof response === 'string') {
                // Response is already a string
                textContent = response;
              } else {
                // Fallback: stringify the whole response
                textContent = JSON.stringify(response);
              }
      
              localCardData.value.sockets.outputs[i].value = textContent;
            } catch (error) {
              console.error(`Error loading website ${website.url}:`, error);
              website.status = "error";
            }
      
            handleCardUpdate();
          }
      
          // Check if all websites are either complete or error
          const allProcessed = localCardData.value.websites.every(
            (site) => site.status === "complete" || site.status === "error"
          );
      
          if (allProcessed) {
            localCardData.value.status = "complete";
          }
        } catch (error) {
          console.error("Error processing websites:", error);
        } finally {
          isProcessing.value = false;
          currentWebsiteIndex.value = -1;
          handleCardUpdate();
        }
      };

    const handleTriggerClick = () => {
      processWebsites();
    };

    const handleCardUpdate = () => {
      emit("update-card", Vue.toRaw(localCardData.value));
    };

    // Input socket for watching changes
    const inputSocket = Vue.computed(
      () => localCardData.value.sockets.inputs[0]
    );

    // Watch for input value changes
    Vue.watch(
      () => inputSocket.value?.value,
      (newValue) => {
        if (newValue) {
          const urls = extractUrls(newValue);

          // Clear existing websites and create new ones
          localCardData.value.websites = urls.map((url) => ({
            id: generateSocketId(),
            url,
            status: "idle",
            momentUpdated: Date.now(),
          }));

          // Update output sockets
          const oldSockets = [...localCardData.value.sockets.outputs];
          const newSockets = urls.map((_, index) =>
            createSocket({
              type: "output",
              index,
            })
          );

          const { reindexMap, reindexedSockets } = updateSocketArray({
            oldSockets,
            newSockets,
            type: "output",
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
              deletedSocketIds: oldSockets.map((s) => s.id),
              type: "output",
            })
          );

          handleCardUpdate();
          processWebsites(); // Automatically start processing
        }
      }
    );

    // Watch for trigger changes
    Vue.watch(
      () => localCardData.value.trigger,
      (newValue, oldValue) => {
        if (newValue && newValue !== oldValue) {
          processWebsites();
        }
      }
    );

    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData) => {
        if (!newData || isProcessing.value) return;

        localCardData.value = {
          ...localCardData.value,
          x: newData.x,
          y: newData.y,
          display: newData.display,
          trigger: newData.trigger,
        };
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
      inputSocket,
      isProcessing,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      handleSocketMount,
      addWebsite,
      removeWebsite,
      handleCardUpdate,
      handleTriggerClick,
    };
  },
};
