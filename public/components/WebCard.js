// WebCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useWeb } from "../composables/useWeb.js";

import {
  CardInitializer,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";

import { createSocket } from "../utils/socketManagement/socketRemapping.js";

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
      >
        <!-- Input Socket -->
        <div class="absolute -left-[12px]" style="top: 16px;">
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

        <!-- Output Sockets -->
        <div 
          class="absolute -right-[12px] flex flex-col gap-1" 
          style="top: 16px;"
        >
          <div 
            v-for="(socket, index) in localCardData.data.sockets.outputs"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 24) + 'px)' }"
          >
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name || 'Output ' + (index + 1)"
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
        <div class="space-y-4 text-gray-300" v-show="localCardData.ui.display === 'default'">
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
                v-for="(website, index) in localCardData.data.websites" 
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

              <div class="flex items-center justify-between">
                <label class="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    v-model="localCardData.data.useHtml" 
                    class="form-checkbox" 
                  />
                  <span class="text-xs text-gray-400">Use HTML</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    // Initialize card setup utilities
    const {
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    const { loadWebContent } = useWeb();

    // Initialize local card data with proper defaults
    const localCardData = Vue.ref(
      CardInitializer.initializeCardData(props.cardData, {
        name: "Web Content",
        description: "Web Content Node",
        defaultSockets: {
          inputs: [{ name: "Website URLs" }],
          outputs: []
        },
        defaultData: {
          websites: [],
          useHtml: false,
          status: "idle",
          trigger: null
        }
      })
    );

    // Computed properties
    const inputSocket = Vue.computed(() => localCardData.value.data.sockets.inputs[0]);

    //----------------------------------------
    // Card Specific Functions
    //----------------------------------------
    
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const hasSocketError = () => false;

    const extractUrls = (text) => {
      const urlRegex = /https?:\/\/[^\s]+/g;
      return text?.match(urlRegex) || [];
    };

    const updateWebsites = (urls) => {
      // Create new websites array
      localCardData.value.data.websites = urls.map(url => ({
        id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        status: "idle",
        momentUpdated: Date.now()
      }));

      // Update output sockets to match website count
      localCardData.value.data.sockets.outputs = urls.map((_, index) =>
        createSocket({
          type: "output",
          index,
          name: `Output ${index + 1}`,
          value: null
        })
      );

      handleCardUpdate();
    };

    const handleInputChange = (newValue) => {
      if (newValue) {
        const urls = extractUrls(newValue);
        updateWebsites(urls);
      }
    };

    const addWebsite = () => {
      const newWebsite = {
        id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: "",
        status: "idle",
        momentUpdated: Date.now()
      };

      localCardData.value.data.websites.push(newWebsite);

      // Add corresponding output socket
      const newSocket = createSocket({
        type: "output",
        index: localCardData.value.data.websites.length - 1,
        name: `Output ${localCardData.value.data.websites.length}`
      });

      localCardData.value.data.sockets.outputs.push(newSocket);
      handleCardUpdate();
    };

    const removeWebsite = (index) => {
      localCardData.value.data.websites.splice(index, 1);
      localCardData.value.data.sockets.outputs.splice(index, 1);

      // Reindex remaining sockets
      localCardData.value.data.sockets.outputs.forEach((socket, i) => {
        socket.index = i;
        socket.name = `Output ${i + 1}`;
      });

      handleCardUpdate();
    };

    const processWebContent = async (response, website, index) => {
      if (response) {
        website.status = "complete";
        const useSource = localCardData.value.data.useHtml ? "html" : "text";
        let content;

        if (response?.payload) {
          content = response.payload[useSource];
        } else if (response[useSource]) {
          content = response[useSource];
        } else if (typeof response === "string") {
          content = response;
        } else {
          content = JSON.stringify(response);
        }

        localCardData.value.data.sockets.outputs[index].value = content;
      } else {
        localCardData.value.data.sockets.outputs[index].value = null;
        website.status = "error";
      }
    };

    const processWebsites = async () => {
      if (isProcessing.value) return;

      isProcessing.value = true;
      localCardData.value.data.status = "inProgress";

      try {
        for (let i = 0; i < localCardData.value.data.websites.length; i++) {
          const website = localCardData.value.data.websites[i];
          if (!website.url) continue;

          website.status = "inProgress";
          handleCardUpdate();

          try {
            const response = await loadWebContent(website.url);
            await processWebContent(response, website, i);
          } catch (error) {
            console.error(`Error loading website ${website.url}:`, error);
            website.status = "error";
            localCardData.value.data.sockets.outputs[i].value = null;
          }

          handleCardUpdate();
        }

        const allProcessed = localCardData.value.data.websites.every(
          (site) => site.status === "complete" || site.status === "error"
        );

        if (allProcessed) {
          localCardData.value.data.status = "complete";
        }
      } catch (error) {
        console.error("Error processing websites:", error);
      } finally {
        isProcessing.value = false;
        handleCardUpdate();
      }
    };

    const handleTriggerClick = () => {
      processWebsites();
    };

    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: ({ type, content }) => {
        if (type === 'modified' && content.old.value !== content.new.value) {
          handleInputChange(content.new.value);
        }
      },
      onOutputChange: ({ type, content }) => {
        if (type === 'modified' && content.old.value !== content.new.value) {
          handleCardUpdate();
        }
      }
    });

    // Set up watchers
    const watchers = setupCardDataWatchers({
      props,
      localCardData,
      isProcessing,
      emit,
      onTrigger: processWebsites
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

    // Watch trigger changes
    Vue.watch(() => props.cardData.data?.trigger, watchers.trigger);

    // Watch height changes
    Vue.watch(() => props.cardData.ui?.height, watchers.height);

    // Lifecycle hooks
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    Vue.onUnmounted(cleanup);

    return {
      // Core setup
      localCardData,
      isProcessing,
      inputSocket,
      getSocketConnections,
      hasSocketError,
      handleSocketMount,
      emitWithCardId,

      // Card functions
      handleCardUpdate,
      handleTriggerClick,
      addWebsite,
      removeWebsite,
    };
  },
};