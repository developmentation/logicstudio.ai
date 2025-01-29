// ViewCard.js
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
  name: "ViewCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
  },

  template: `
      <div class = "card">

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
          :name="localCardData.data.sockets.inputs[0].name || 'Input'"
          :value="localCardData.data.sockets.inputs[0].value"
          :is-connected="getSocketConnections(localCardData.data.sockets.inputs[0].id)"
          :has-error="false"
          :zoom-level="zoomLevel"
          @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
          @connection-drag="emitWithCardId('connection-drag', $event)"
          @connection-drag-end="emitWithCardId('connection-drag-end', $event)"
          @socket-mounted="handleSocketMount($event)"
        />
      </div>

      <!-- Content -->
      <div 
        class="p-4 text-sm" 
        v-show="localCardData.ui.display === 'default'"
      >
        <div class="flex justify-between mb-2">
          <span class="text-xs text-gray-400">
            {{ contentTypeLabel }}
            {{ isImageContent ? '' : '(Editable)' }}
          </span>
          <button 
            @click="copyToClipboard"
            @mousedown.stop
            class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-1"
          >
            <i class="pi pi-copy"></i>
            Copy
          </button>
        </div>

        <!-- Image View -->
        <div 
          v-if="isImageContent"
          class="bg-[#12141a] border border-gray-800 rounded-lg p-4 flex justify-center"
        >
          <img 
            :src="processedContent"
            :alt="contentMetadata?.name || 'Image'"
            class="max-w-full max-h-[400px] object-contain"
          />
        </div>

        <!-- JSON View -->
        <pre 
          v-else-if="isJsonContent" 
          ref="editableContent"
          contenteditable="true" 
          class="bg-[#12141a] border border-gray-800 rounded-lg p-4 max-h-[400px] overflow-y-auto text-gray-300 whitespace-pre-wrap font-mono cursor-text"
          @mousedown.stop
          @wheel.stop
          :key="contentKey+'JSON'"
        >{{ formattedJson }}</pre>
        
        <!-- Markdown View -->
        <div 
          v-else 
          ref="editableContent"
          contenteditable="true"
          class="bg-[#12141a] border border-gray-800 rounded-lg p-4 max-h-[400px] overflow-y-auto markdown-dark cursor-text"
          @mousedown.stop
          @wheel.stop
          :key="contentKey+'Markdown'"
          v-html="renderedContent"
        ></div>
      </div>
    </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    // Initialize card setup utilities
    const {
      socketRegistry,
      connections,
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    // Initialize editable content ref and content key for forcing re-renders
    const editableContent = Vue.ref(null);
    const contentKey = Vue.ref(0);

    // Initialize local card data with a single input socket
    const localCardData = Vue.ref(initializeCardData(props.cardData, {
      defaultName: "View",
      defaultDescription: "View Node",
      defaultWidth: 400,
      defaultHeight: 300,
    }));

    // console.log("localCardData", localCardData.value)
    // Ensure we have an input socket
    if (localCardData.value.data.sockets.inputs.length === 0) {
      localCardData.value.data.sockets.inputs.push(
        createSocket({ type: "input", index: 0 })
      );
    }

    // Define emitWithCardId locally
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const handleCardUpdate = () => {
      console.log("isProcessing", isProcessing.value)
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

 
    // Content processing utilities
    const getContentType = (value) => {
      if (!value) return 'empty';
      
      if (value.content !== undefined && value.metadata?.type) {
        const mimeType = value.metadata.type;
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType === 'application/json' || mimeType.includes('json')) return 'json';
        if (mimeType.startsWith('text/')) return 'text';
      }

      if (typeof value === 'object') {
        try {
          JSON.stringify(value);
          return 'json';
        } catch {
          return 'text';
        }
      }

      return 'text';
    };

    // Computed properties for content
    const currentValue = Vue.computed(() => 
      localCardData.value.data.sockets.inputs[0]?.value
    );

    const contentType = Vue.computed(() => 
      getContentType(currentValue.value)
    );

    const contentTypeLabel = Vue.computed(() => {
      switch (contentType.value) {
        case 'image': return 'Image View';
        case 'json': return 'JSON View';
        default: return 'Markdown View';
      }
    });

    const isJsonContent = Vue.computed(() => 
      contentType.value === 'json'
    );

    const isImageContent = Vue.computed(() => 
      contentType.value === 'image'
    );

    const contentMetadata = Vue.computed(() => 
      currentValue.value?.metadata
    );

    const processedContent = Vue.computed(() => {
      const value = currentValue.value;
      if (!value && value !== 0) return '';
      return value.content !== undefined ? value.content : value;
    });

    const formattedJson = Vue.computed(() => {
      try {
        const content = processedContent.value;
        if (typeof content === 'object') {
          return JSON.stringify(content, null, 2);
        }
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return '';
      }
    });

    const renderedContent = Vue.computed(() => {
      try {
        const content = processedContent.value;
        if (!content && content !== 0) return '';

        if (isImageContent.value) {
          return `<img src="${content}" alt="${contentMetadata.value?.name || 'Image'}" class="max-w-full"/>`;
        }
        
        if (isJsonContent.value) {
          return markdownit().render('```json\n' + formattedJson.value + '\n```');
        }

        return markdownit().render(String(content));
      } catch (error) {
        console.error('Error rendering content:', error);
        return '<p class="text-red-500">Error rendering content</p>';
      }
    });

    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: (change) => {

        console.log("onInputChange")
        if (change.type === "added") {
          contentKey.value++; // Force re-render on content change
          handleCardUpdate(); //Initial emit when the socket is created
        }

        if (change.type === "modified") {
          contentKey.value++; // Force re-render on content change
          handleCardUpdate();
        }


      },
    });

    // Set up watchers for position and display
    const watchers = setupCardDataWatchers({
      props,
      localCardData,
      isProcessing,
      emit,
    });

    Vue.watch(
      () => ({ x: props.cardData.ui?.x, y: props.cardData.ui?.y }),
      watchers.position
    );

    Vue.watch(() => props.cardData.ui?.display, watchers.display);

    // Clipboard functionality
    const copyToClipboard = async () => {
      try {
        if (!editableContent.value) return;

        const currentContent = editableContent.value.innerHTML;
        let plainText = editableContent.value.innerText;

        if (isJsonContent.value) {
          try {
            const jsonObj = JSON.parse(plainText);
            plainText = JSON.stringify(jsonObj, null, 2);
          } catch (e) {
            console.warn("Failed to parse JSON for formatting:", e);
          }
        }

        const clipData = new ClipboardItem({
          "text/html": new Blob([currentContent], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        });

        await navigator.clipboard.write([clipData]);

        // Show success notification
        emit('show-notification', {
          type: 'success',
          message: 'Copied to clipboard!'
        });
      } catch (error) {
        console.error("Error copying to clipboard:", error);
        emit('show-notification', {
          type: 'error',
          message: 'Failed to copy to clipboard'
        });
      }
    };


    Vue.onMounted(() => {
      console.log("ViewCard mounted, emitting initial state");
      Vue.nextTick(() => {
        // Ensure all reactivity is set up before emitting
        handleCardUpdate();
      });
    });


    // Cleanup on unmount
    Vue.onUnmounted(cleanup);

    return {
      localCardData,
      editableContent,
      contentKey,
      contentTypeLabel,
      isJsonContent,
      isImageContent,
      formattedJson,
      renderedContent,
      processedContent,
      contentMetadata,
      getSocketConnections,
      emitWithCardId,
      handleCardUpdate,
      handleSocketMount,
      copyToClipboard,
    };
  },
};