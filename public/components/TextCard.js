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
              ref="textEditor"
              v-model="localCardData.data.content"
              :height="localCardData.ui.height - 180"
              placeholder="Enter text with break points..."
              :existing-breaks="localCardData.data.sockets.outputs"
              @break-update="handleBreakUpdate"
              @segments-update="handleSegmentsUpdate"
              @html-update="handleHtmlUpdate"
            />
          </div>
          
          <!-- Break Controls -->
          <div class="flex items-center gap-2 mt-4">
            <button
              @click="addBreaksFromPattern"
              @mousedown.stop
              class="px-2 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded whitespace-nowrap"
            >
              Split
            </button>
            <input
              type="text"
              v-model="breakPattern"
              placeholder="Split by text or regex pattern"
              class="w-full px-2 py-1 bg-gray-800 text-gray-300 rounded text-sm border border-gray-700"
              @mousedown.stop
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
                @click="removeHtmlTags"
                @mousedown.stop
                class="px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded"
              >
                Strip HTML
              </button>


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
          outputs: [{ name: "Start" }],
        },
        defaultData: {
          content: "",
          contentHtml: "",
        },
      })
    );

    // Add ref for TextEditor component
    const textEditor = Vue.ref(null);

    // Auto-sync ref and pattern matching refs
    const autoSync = Vue.ref(true);
    const currentSegments = Vue.ref([]);
    const breakPattern = Vue.ref("");
    const nextBreakNumber = Vue.ref(1);

    // Function to detect if a string is a valid regex
    const isValidRegex = (pattern) => {
      try {
        new RegExp(pattern);
        return /[\[\]\(\)\{\}\^\$\*\+\?\\\|\.]/.test(pattern);
      } catch (e) {
        return false;
      }
    };

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
              localCardData.value.data.sockets.outputs = [{
                ...localCardData.value.data.sockets.outputs[0] || createSocket({
                  type: 'output',
                  name: 'Start',
                  index: 0
                }),
                value: ""
              }];
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

    // Add breaks based on pattern
    const addBreaksFromPattern = () => {
      console.log("Adding breaks for pattern:", breakPattern.value);
      if (!breakPattern.value) return;

      const editorComponent = textEditor.value;
      if (!editorComponent || !editorComponent.editor) {
        console.error("Editor element not found");
        return;
      }

      const editor = editorComponent.editor;
      
      // Get the pure text content without HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = editor.innerHTML;
      
      // Get positions and lengths of existing break tags
      const breakTags = Array.from(editor.querySelectorAll('.text-editor-tag'));
      const existingBreaks = breakTags.map(tag => {
        const range = document.createRange();
        range.selectNode(tag);
        return {
          startOffset: getTextPosition(editor, tag),
          length: tag.textContent.length
        };
      });

      // Sort breaks by position for offset calculation
      existingBreaks.sort((a, b) => a.startOffset - b.startOffset);

      // Function to adjust position based on existing breaks
      const adjustPosition = (pos) => {
        let adjustment = 0;
        for (const breakTag of existingBreaks) {
          if (breakTag.startOffset < pos) {
            adjustment += breakTag.length;
          } else {
            break;
          }
        }
        return pos + adjustment;
      };

      // Remove break tags from temp div for clean matching
      const tempBreakTags = Array.from(tempDiv.querySelectorAll('.text-editor-tag'));
      tempBreakTags.forEach(tag => tag.remove());

      // Get clean text content
      const content = tempDiv.textContent;
      
      const isRegex = isValidRegex(breakPattern.value);
      console.log("Is regex pattern:", isRegex);
      
      const pattern = isRegex
        ? new RegExp(breakPattern.value, 'g')
        : breakPattern.value;

      // Find all matches in the clean text
      const matches = [];
      if (isRegex) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          matches.push(match.index);
        }
      } else {
        let pos = 0;
        while ((pos = content.indexOf(pattern, pos)) !== -1) {
          matches.push(pos);
          pos += pattern.length;
        }
      }

      console.log("Found matches at positions:", matches);

      // Sort all positions in reverse order (from end to start)
      const allPositions = [...matches].sort((a, b) => b - a);

      console.log("Processing matches in reverse order:", allPositions);

      // Insert breaks
      let offset = 0;
      let highestSocket = matches.length;
      for (const pos of allPositions) {
        let breakName;
        if (isRegex) {
          const matchText = content.slice(pos).match(pattern)[0];
          breakName = matchText;
        } else {
          // Start numbering from the total number of matches and count down
          breakName = `${breakPattern.value} ${highestSocket--}`;
        }

        // Adjust position based on existing break tags
        const adjustedPos = adjustPosition(pos);
        // Find the actual position in the editor
        const targetPos = findActualPosition(editor, adjustedPos);
        if (targetPos) {
          const { node, offset: nodeOffset } = targetPos;
          const range = document.createRange();
          range.setStart(node, nodeOffset);
          range.setEnd(node, nodeOffset);
          
          const breakSpan = document.createElement('span');
          breakSpan.className = 'text-editor-tag';
          breakSpan.setAttribute('contenteditable', 'false');
          breakSpan.setAttribute('data-socket-id', `break-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          breakSpan.setAttribute('data-break-name', breakName);
          breakSpan.textContent = `[${breakName}]`;
          
          range.insertNode(breakSpan);
        }
      }

      // Trigger update
      const event = new Event('input', { bubbles: true });
      editor.dispatchEvent(event);
    };

    // Helper function to find text position of an element
    const getTextPosition = (root, element) => {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let pos = 0;
      let node;
      
      while ((node = walker.nextNode())) {
        if (element.contains(node)) {
          break;
        }
        pos += node.textContent.length;
      }
      
      return pos;
    };

    // Helper function to find the actual position in the editor
    const findActualPosition = (editor, targetPos) => {
      let currentPos = 0;
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        const nodeLength = node.textContent.length;
        if (currentPos + nodeLength > targetPos) {
          return {
            node,
            offset: targetPos - currentPos
          };
        }
        currentPos += nodeLength;
      }

      return null;
    };
   
    const removeHtmlTags = () => {
      const editorComponent = textEditor.value;
      if (!editorComponent || !editorComponent.editor) return;
      
      // Create a document to parse the HTML while preserving whitespace
      const parser = new DOMParser();
      const doc = parser.parseFromString(localCardData.value.data.content, 'text/html');
      
      // First handle block elements
      const blockElements = doc.querySelectorAll('div, p, br, h1, h2, h3, h4, h5, h6, li, tr, pre');
      blockElements.forEach(el => {
        // For BR tags, just convert to newline
        if (el.tagName.toLowerCase() === 'br') {
          el.replaceWith(document.createTextNode('\n'));
          return;
        }
        
        // For PRE tags, preserve exact whitespace
        if (el.tagName.toLowerCase() === 'pre') {
          const text = el.textContent;
          el.replaceWith(document.createTextNode(text + '\n'));
          return;
        }
        
        // For other block elements, add newlines if there's content
        if (el.textContent.trim()) {
          // Check if previous sibling already ends with newline
          const prevSibling = el.previousSibling;
          if (!prevSibling || !prevSibling.textContent.endsWith('\n')) {
            el.before(document.createTextNode('\n'));
          }
          // Add newline after if there's a next element
          if (el.nextSibling) {
            el.after(document.createTextNode('\n'));
          }
        }
      });
      
      // Get the text content while preserving processed whitespace
      let content = doc.body.textContent;
      
      // Clean up whitespace without removing intended formatting
      content = content
        // Replace multiple spaces with single space
        .replace(/[ \t]+/g, ' ')
        // Preserve multiple newlines but limit to max 2
        .replace(/\n{3,}/g, '\n\n')
        // Remove space before newline
        .replace(/[ \t]+\n/g, '\n')
        // Remove space after newline
        .replace(/\n[ \t]+/g, '\n')
        // Trim any whitespace at start/end
        .trim();
    
      // Update the model with preserved whitespace
      localCardData.value.data.content = content;
      localCardData.value.data.contentHtml = content;
      
      // Reset output sockets but maintain whitespace
      localCardData.value.data.sockets.outputs = [{
        ...localCardData.value.data.sockets.outputs[0] || createSocket({
          type: 'output',
          name: 'Start',
          index: 0
        }),
        value: content
      }];
      
      // Force updates
      handleCardUpdate();
    };
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
        // Keep the initial "Start" output socket
        const newOutputs = [{
          ...localCardData.value.data.sockets.outputs[0],
          value: currentSegments.value[0]?.text || ""
        }];
    
        // Add outputs for each break
        event.breaks.forEach((breakInfo, index) => {
          // Get the segment that comes AFTER this break
          const segmentIndex = index + 1;
          const segment = currentSegments.value[segmentIndex];
    
          const existingSocket = localCardData.value.data.sockets.outputs
            .find(s => s.name === breakInfo.name);
    
          if (existingSocket) {
            newOutputs.push({
              ...existingSocket,
              value: segment?.text || "",
              index: segmentIndex
            });
          } else {
            newOutputs.push(createSocket({
              type: "output",
              name: breakInfo.name,
              value: segment?.text || "",
              index: segmentIndex
            }));
          }
        });
    
        localCardData.value.data.sockets.outputs = newOutputs;
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
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
      breakPattern,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      handleBreakUpdate,
      handleHtmlUpdate,
      handleSegmentsUpdate,
      syncFromInput,
      clearContent,
      addBreaksFromPattern,
      textEditor,
      removeHtmlTags,

    };
  },
};