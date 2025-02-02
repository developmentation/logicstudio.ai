// TextCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import TextEditor from "./TextEditor.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";
import { createSocket } from "../utils/socketManagement/socketRemapping.js";

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
            v-if="localCardData.data.sockets.inputs[0]"
            type="input"
            :socket-id="localCardData.data.sockets.inputs[0].id"
            :card-id="localCardData.uuid"
            :name="localCardData.data.sockets.inputs[0].name"
            :value="localCardData.data.sockets.inputs[0].value"
            :is-connected="getSocketConnections(localCardData.data.sockets.inputs[0].id)"
            :has-error="false"
            :zoom-level="zoomLevel"
            @connection-drag-start="$emit('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Output Sockets -->
        <div class="absolute -right-[12px] flex flex-col gap-1" style="top: 16px;">
          <div
            v-for="(socket, index) in localCardData.data.sockets.outputs"
            :key="socket.id"
            class="flex items-center justify-end"
            :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
          >
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
          class="space-y-4 text-gray-300 mt-8"
          v-show="localCardData.ui.display === 'default'"
        >
          <div class="space-y-1">
            <TextEditor
              v-model="localCardData.data.content"
              placeholder="Enter text with break points..."
              :existing-breaks="localCardData.data.sockets.outputs"
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
    // Initialize card setup utilities
    const {
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    // Initialize local card data with default sockets
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Text Card",
        description: "Text Processing Node",
        defaultSockets: {
          inputs: [{ name: "Text Input" }],
          outputs: [],
        },
        defaultData: {
          content: "",
          contentHtml: "",
        },
      })
    );

    // Auto-sync ref
    const autoSync = Vue.ref(true);
    const currentSegments = Vue.ref([]);

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
      onInputChange: ({ type, content }) => {
        switch (type) {
          case "modified":
            if (content.old.value !== content.new.value && autoSync.value) {
              syncFromInput();
            }
            break;
        }
      },
      onOutputChange: ({ type, content }) => {
        switch (type) {
          case "modified":
            if (content.old.value !== content.new.value) {
              handleCardUpdate();
            }
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

    // Card-specific functions
    const syncFromInput = () => {
      const inputSocket = localCardData.value.data.sockets.inputs[0];
      if (!inputSocket || inputSocket.value === undefined) return;

      let content = inputSocket.value;
      if (typeof content === 'object') {
        content = JSON.stringify(content, null, 2);
      }

      content = String(content)
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      
      localCardData.value.data.content = content;
      handleCardUpdate();
    };

    const clearContent = () => {
      localCardData.value.data.content = "";
      localCardData.value.data.contentHtml = "";
      handleCardUpdate();
    };

    const handleSegmentsUpdate = (segments) => {
      if (isProcessing.value) return;
      currentSegments.value = segments;
    };

    const handleBreakUpdate = (event) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        // Update output sockets based on breaks
        const newOutputs = event.breaks.map((breakInfo, index) => {
          const segment = currentSegments.value[index];
          const existingSocket = localCardData.value.data.sockets.outputs
            .find(s => s.name === breakInfo.name);

          if (existingSocket) {
            return {
              ...existingSocket,
              value: segment?.text || "",
              index
            };
          }

          return createSocket({
            type: "output",
            name: breakInfo.name,
            value: segment?.text || "",
            index
          });
        });

        localCardData.value.data.sockets.outputs = newOutputs;
      } finally {
        isProcessing.value = false;
        Vue.nextTick(() => {
          handleCardUpdate();
        });
      }
    };

    const handleHtmlUpdate = (html) => {
      localCardData.value.data.contentHtml = html;
      handleCardUpdate();
    };

    // Mounted hook
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    // Cleanup
    Vue.onUnmounted(cleanup);

    return {
      localCardData,
      autoSync,
      getSocketConnections,
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