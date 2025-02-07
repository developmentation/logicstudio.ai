// LabelCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";
import { createSocket } from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "LabelCard",
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
        <!-- Input Sockets -->
        <div class="absolute -left-[12px] flex flex-col gap-4 py-4" style="top: 16px;">
          <div 
            v-for="(socket, index) in localCardData.data.sockets.inputs"
            :key="socket.id"
            class="flex items-center justify-start"
          >
            <BaseSocket
              type="input"
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
          class="p-4"
          v-show="localCardData.ui.display === 'default'"
        >
          <div
            ref="titleContent"
            contenteditable="true"
            class="text-xl font-bold mb-2 break-words text-white hover:cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            @input="updateTitle"
            @mousedown.stop
            v-text="localCardData.data.title"
          ></div>
          <div
            ref="subtitleContent"
            contenteditable="true"
            class="text-sm text-gray-400 break-words hover:cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            @input="updateSubtitle"
            @mousedown.stop
            v-text="localCardData.data.subtitle"
          ></div>
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

    const titleContent = Vue.ref(null);
    const subtitleContent = Vue.ref(null);

    // Initialize local card data with default sockets
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Label Card",
        description: "Displays customizable text labels",
        defaultSockets: {
          inputs: [
            { name: "Title", value: "" },
            { name: "Subtitle", value: "" }
          ],
          outputs: []
        },
        defaultData: {
          title: "Title",
          subtitle: "Subtitle"
        }
      })
    );

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
        if (type === "modified" && content.new.value !== content.old.value) {
          const socket = content.new;
          
          // Update title or subtitle based on socket name
          if (socket.name === "Title") {
            localCardData.value.data.title = socket.value || "Title";
            handleCardUpdate();
          } else if (socket.name === "Subtitle") {
            localCardData.value.data.subtitle = socket.value || "Subtitle";
            handleCardUpdate();
          }
        }
      },
      onOutputChange: () => {} // No outputs to handle
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

    
    // Watch height changes
    Vue.watch(() => props.cardData.ui?.height, watchers.height);

    
    // Card specific functions
    const updateTitle = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;
      try {
        const newTitle = titleContent.value.textContent;
        localCardData.value.data.title = newTitle;
        
        // Update the title input socket value
        const titleSocket = localCardData.value.data.sockets.inputs.find(
          socket => socket.name === "Title"
        );
        if (titleSocket) {
          titleSocket.value = newTitle;
          titleSocket.momentUpdated = Date.now();
        }
        
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const updateSubtitle = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;
      try {
        const newSubtitle = subtitleContent.value.textContent;
        localCardData.value.data.subtitle = newSubtitle;
        
        // Update the subtitle input socket value
        const subtitleSocket = localCardData.value.data.sockets.inputs.find(
          socket => socket.name === "Subtitle"
        );
        if (subtitleSocket) {
          subtitleSocket.value = newSubtitle;
          subtitleSocket.momentUpdated = Date.now();
        }
        
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    // Mounted hook
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    // Cleanup
    Vue.onUnmounted(cleanup);

    return {
      localCardData,
      titleContent,
      subtitleContent,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      updateTitle,
      updateSubtitle,
    };
  },
};