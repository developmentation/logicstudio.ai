// ChatCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useModels } from "../composables/useModels.js";
import { useRealTime } from "../composables/useRealTime.js";

import {
  CardInitializer,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";

import {
  updateSocketArray,
  createSocket,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "ChatCard",
  components: { BaseCard, BaseSocket },
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
        <div class = "card"> <!-- Required Class-->

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
        <!-- Model Selection -->
        <div class="w-full" v-show="localCardData.ui.display === 'default'">
          <select
            v-model="localCardData.data.model"
            class="flex-1 bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
            style="border: 1px solid #374151; width:100%"
            @mousedown.stop
            @change="handleCardUpdate"
          >
            <option v-for="model in availableModels" :key="model.model" :value="model">
              {{model.provider.toUpperCase()}} {{model.name.en}}
            </option>
          </select>

          <button 
            class="mt-2 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
            @click="addInput"
          >+ Add System Input</button>

        </div>

        <!-- Input Sockets -->
        <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 40px;">
          <div
            v-for="(socket, index) in localCardData.data.sockets.inputs"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
          >
            <BaseSocket
              type="input"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
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

        <!-- Output Sockets -->
        <div class="absolute -right-[12px] flex flex-col gap-1" style="top: 16px;">
          <div
            v-for="(socket, index) in localCardData.data.sockets.outputs"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
          >
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
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

        <!-- Chat History -->
        <div class="mt-4 space-y-2">
          <div ref="chatContainer" 
          class="w-full   bg-gray-900 rounded overflow-y-auto p-2" 
          :style="{height: \`calc(\${localCardData.ui.height}px - 180px)\`}"
          
          @mousedown.stop @wheel.stop>
            <div v-for="(message, index) in localCardData.data.messageHistory" :key="index" class="mb-2">
              <div v-if="message.role === 'system'" 
                class="flex items-start justify-start mb-2 relative group">
                <div class="bg-gray-800 rounded-lg p-2 w-full text-xs text-gray-200">
                  <div class="flex justify-between items-center mb-1">
                    <span class="text-gray-400">System</span>
                    <div class="flex items-center gap-2">
                      <span v-if="message.flaggedAs" class="text-xs text-green-500">
                        {{message.flaggedAs}}
                      </span>
                      <i class="pi pi-copy cursor-pointer text-gray-600 hover:text-gray-400"
                        @click="copyToClipboard(message.content)"></i>
                      <i class="pi pi-check-circle cursor-pointer hover:text-gray-400"
                        :class="message.flagged ? 'text-green-500' : 'text-gray-600'"
                        @click="toggleFlag(index)"></i>
                      <i class="pi pi-times cursor-pointer text-gray-600 hover:text-gray-400"
                        @click="removeMessage(index)"></i>
                    </div>
                  </div>
                  <div class="markdown-content whitespace-pre-wrap break-words" v-html="renderMarkdown(message.content)"></div>
                  <div v-if="message.content.length > 200" 
                    class="flex justify-end items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                    <span v-if="message.flaggedAs" class="text-xs text-green-500">
                      {{message.flaggedAs}}
                    </span>
                    <i class="pi pi-copy cursor-pointer text-gray-600 hover:text-gray-400"
                      @click="copyToClipboard(message.content)"></i>
                    <i class="pi pi-check-circle cursor-pointer"
                      :class="message.flagged ? 'text-green-500' : 'text-gray-600'"
                      @click="toggleFlag(index)"></i>
                    <i class="pi pi-times cursor-pointer text-gray-600 hover:text-gray-400"
                      @click="removeMessage(index)"></i>
                  </div>                  
                </div>
              </div>

              <div v-else 
                class="flex items-start justify-end mb-2 relative group">
                <div class="bg-gray-700 rounded-lg p-2 max-w-full text-xs text-gray-200" style="min-width: 200px;">
                  <div class="flex justify-between items-center mb-1">
                    <span class="text-gray-400">User</span>
                    <div class="flex items-center gap-2">
                      <span v-if="message.flaggedAs" class="text-xs text-green-500">
                        {{message.flaggedAs}}
                      </span>
                      <i class="pi pi-copy cursor-pointer text-gray-600 hover:text-gray-400"
                        @click="copyToClipboard(message.content)"></i>
                      <i class="pi pi-check-circle cursor-pointer"
                        :class="message.flagged ? 'text-green-500' : 'text-gray-600'"
                        @click="toggleFlag(index)"></i>
                      <i class="pi pi-times cursor-pointer text-gray-600 hover:text-gray-400"
                        @click="removeMessage(index)"></i>
                    </div>
                  </div>
                  {{message.content}}
                </div>
              </div>
            </div>
          </div>

          <!-- User Input -->
          <div class="relative">
            <div
              ref="userInput"
              contenteditable="true"
              class="w-full min-h-[60px] max-h-[300px] overflow-y-auto bg-gray-800 text-xs text-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 cursor-text"
              @keydown.enter.prevent="handleUserInput"
              @mousedown.stop @wheel.stop
              placeholder="Type your message..."
            ></div>
            <div class="absolute bottom-2 right-2">
              <div class="status-dot" :class="{
                'idle': localCardData.data.status === 'idle',
                'complete': localCardData.data.status === 'complete',
                'in-progress': localCardData.data.status === 'inProgress',
                'error': localCardData.data.status === 'error'
              }"></div>
            </div>
          </div>
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

    // Refs
    const userInput = Vue.ref(null);
    const chatContainer = Vue.ref(null);
    const websocketId = Vue.ref(uuidv4());

    // Composables
    const { allModels: availableModels } = useModels();
    const {
      wsUuid,
      sessions,
      registerSession,
      unregisterSession,
      sendToServer,
    } = useRealTime();

    // Initialize card data
    const defaultConfig = {
      name: "Chat",
      description: "Chat Node",
      defaultSockets: {
        outputs: [
          { name: "Entire History" },
          { name: "System" },
          { name: "User" },
        ],
      },
      defaultData: {
        messageHistory: [],
        model: null,
        status: "idle",
      },
    };

    const localCardData = Vue.ref(
      CardInitializer.initializeCardData(props.cardData, defaultConfig)
    );

    // Socket watcher setup
// Update socket watcher to handle input value changes
setupSocketWatcher({
  props,
  localCardData,
  isProcessing,
  emit,
  onInputChange: ({ type, content }) => {
    if (type === "modified" && content.old.value !== content.new.value) {
      syncInputSocketToMessageHistory(content.new);
    }
  },
  onOutputChange: ({ type, content }) => {
    if (type === "modified" && content.old.value !== content.new.value) {
      // Handle output value changes if needed
    }
  }
});

const syncInputSocketToMessageHistory = (socket) => {
  console.log('Syncing socket to message history:', socket);
  // Find any existing message linked to this socket
  const existingMessageIndex = localCardData.value.data.messageHistory
    .findIndex(msg => msg._socketId === socket.id);

  if (socket.value) {
    // Create or update message
    const messageContent = {
      role: "system",
      content: socket.value,
      flagged: false,
      _socketId: socket.id // Internal tracking, won't be sent to LLM
    };

    if (existingMessageIndex !== -1) {
      // Update existing message
      localCardData.value.data.messageHistory[existingMessageIndex] = messageContent;
    } else {
      // Insert at the beginning for system messages
      localCardData.value.data.messageHistory.unshift(messageContent);
    }
  } else {
    // Remove message if socket value is null/empty
    if (existingMessageIndex !== -1) {
      localCardData.value.data.messageHistory.splice(existingMessageIndex, 1);
    }
  }

  // Update output sockets with new message history
  updateOutputSockets();
  handleCardUpdate();
};



    // Card data watchers
    const watchers = setupCardDataWatchers({
      props,
      localCardData,
      isProcessing,
      emit,
    });

    // Set up all necessary watchers
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

    // Session status watcher
    const sessionStatus = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.status || "idle";
    });

    Vue.watch(sessionStatus, (newValue) => {
      localCardData.value.data.status = newValue;
    });

    // Message watchers
    const partialMessage = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.partialMessage || "";
    });

    const completedMessage = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.completedMessage || "";
    });

    const errorMessage = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.errorMessage || "";
    });

    Vue.watch(partialMessage, (newValue, oldValue) => {
      if (newValue && newValue.length) {
        handlePartialMessage(newValue, oldValue);
      }
    });

    Vue.watch(completedMessage, (newValue) => {
      if (newValue) {
        handleCompletedMessage(newValue);
      }
    });

    Vue.watch(errorMessage, (newValue, oldValue) => {
      if (!oldValue?.length && newValue?.length) {
        handleErrorMessage();
      }
    });

    // Core card functions
    const handleCardUpdate = (data) => {
      if (data?.uuid) localCardData.value = data;
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const hasSocketError = () => false;

    // UI utility functions
    const scrollToBottom = () => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    };

    const showToast = (message, type = "success") => {
      const notification = document.createElement("div");
      notification.className = `fixed top-4 right-4 ${
        type === "success" ? "bg-green-500" : "bg-red-500"
      } text-white px-4 py-2 rounded shadow-lg z-50`;
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    };

    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!");
      } catch (error) {
        console.error("Failed to copy text:", error);
        showToast("Failed to copy to clipboard", "error");
      }
    };

    // Chat-specific functions
    const handleUserInput = async () => {
      if (!userInput.value || localCardData.value.data.status === "inProgress")
        return;

      const content = userInput.value.innerText.trim();
      if (!content) return;

      userInput.value.innerText = "";
      addMessage("user", content);
      await triggerLLM();
    };

    const addMessage = (role, content) => {
      localCardData.value.data.messageHistory.push({
        role,
        content,
        flagged: false,
      });
      Vue.nextTick(scrollToBottom);
      updateOutputSockets();
    };

    const addInput = () => {
      if (isProcessing.value) return;
    
      const newIndex = localCardData.value.data.sockets.inputs.length;
      const newSocket = createSocket({
        type: "input",
        index: newIndex,
        name: `System Prompt ${newIndex + 1}`,
        value: null
      });
    
      localCardData.value.data.sockets.inputs.push(newSocket);
      handleCardUpdate();
    };

    const updateOutputSockets = () => {
      // Update the values of default sockets (first 3)
      const outputs = localCardData.value.data.sockets.outputs;
      
      // Update the default socket values
      outputs[0].value = JSON.stringify(localCardData.value.data.messageHistory);
      outputs[1].value = localCardData.value.data.messageHistory
        .filter(m => m.role === "system")
        .map(m => m.content)
        .join("\n\n");
      outputs[2].value = localCardData.value.data.messageHistory
        .filter(m => m.role === "user")
        .map(m => m.content)
        .join("\n\n");
    
      // Update values for flagged sockets
      const flaggedMessages = localCardData.value.data.messageHistory
        .filter(m => m.flagged)
        .sort((a, b) => parseInt(a.flaggedAs.split(" ")[1]) - parseInt(b.flaggedAs.split(" ")[1]));
    
      // Update values of existing flagged sockets
      flaggedMessages.forEach((msg, idx) => {
        const socketIndex = idx + 3; // Skip the 3 default sockets
        if (outputs[socketIndex]) {
          outputs[socketIndex].value = msg.content;
        }
      });
    
      handleCardUpdate();
    };
    
   
    const reindexFlaggedMessages = () => {
      // Get all flagged messages in order of appearance in message history
      const flaggedMessages = localCardData.value.data.messageHistory
        .filter(m => m.flagged)
        .sort((a, b) => {
          const indexA = localCardData.value.data.messageHistory.indexOf(a);
          const indexB = localCardData.value.data.messageHistory.indexOf(b);
          return indexA - indexB;
        });
    
      // Update message flags with new sequential numbers
      flaggedMessages.forEach((msg, idx) => {
        msg.flaggedAs = `Item ${idx + 1}`;
      });
    
      // Rename sockets to match new message flags while preserving IDs
      const flaggedSockets = localCardData.value.data.sockets.outputs.slice(3);
      flaggedSockets.forEach((socket, idx) => {
        if (idx < flaggedMessages.length) {
          socket.name = `Item ${idx + 1}`;
          socket.value = flaggedMessages[idx].content;
          socket.index = idx + 3; // Preserve the base index offset
        }
      });
    
      // Remove any extra sockets if we have fewer flagged messages
      if (flaggedSockets.length > flaggedMessages.length) {
        localCardData.value.data.sockets.outputs.splice(
          3 + flaggedMessages.length, // Start after default sockets + valid flagged messages
          flaggedSockets.length - flaggedMessages.length // Remove extra sockets
        );
      }
    
      updateOutputSockets();
    };
    
    const removeMessage = (index) => {
      const message = localCardData.value.data.messageHistory[index];
      
      if (message.flagged) {
        // Find and remove the corresponding socket
        const socketIndex = localCardData.value.data.sockets.outputs
          .findIndex(s => s.name === message.flaggedAs);
        
        if (socketIndex >= 3) {
          localCardData.value.data.sockets.outputs.splice(socketIndex, 1);
        }
      }
    
      // Remove the message
      localCardData.value.data.messageHistory.splice(index, 1);
    
      // Reindex remaining flagged messages and their sockets
      reindexFlaggedMessages();
    };
    
    const toggleFlag = (index) => {
      const message = localCardData.value.data.messageHistory[index];
      
      if (!message.flagged) {
        // Flagging a message - add new socket
        message.flagged = true;
        const flaggedCount = localCardData.value.data.messageHistory
          .filter(m => m.flagged).length;
        message.flaggedAs = `Item ${flaggedCount}`;
    
        // Add new socket at the end
        const newSocket = createSocket({
          type: "output",
          index: localCardData.value.data.sockets.outputs.length,
          value: message.content
        });
        newSocket.name = message.flaggedAs;
        localCardData.value.data.sockets.outputs.push(newSocket);
      } else {
        message.flagged = false;
        message.flaggedAs = null;
      }
    
      // Reindex all flagged messages and their sockets
      reindexFlaggedMessages();
    };
    

// Modify triggerLLM to clean message history before sending
const cleanMessageForLLM = (msg) => {
  const { _socketId, ...cleanMsg } = msg;
  return cleanMsg;
};

const triggerLLM = async () => {
  if (localCardData.value.data.status === "inProgress") return;
  if (!localCardData.value.data?.model?.provider) return;

  // Clean message history to only include role and content
  let messageHistory = localCardData.value.data.messageHistory.map(msg => {
    // First remove internal tracking properties
    const cleanMsg = cleanMessageForLLM(msg);
    
    // Then ensure content is a string
    return {
      ...cleanMsg,
      content: typeof cleanMsg.content === "object" 
        ? JSON.stringify(cleanMsg.content) 
        : String(cleanMsg.content || "")
    };
  });

  let temperature = 0.7;

  // Special handling for models that don't support system messages
  const unsupportedSystemModels = [
    "o1-mini-2024-09-12",
    "o1-preview",
    "o3-mini-2025-01-31",
  ];
  
  if (unsupportedSystemModels.includes(localCardData.value.data.model.model)) {
    messageHistory = messageHistory.map(msg => ({
      ...msg,
      role: msg.role === "system" ? "user" : msg.role,
    }));
    temperature = 1;
  }

  updateOutputSockets();

  try {
    await sendToServer(
      wsUuid.value,
      websocketId.value,
      localCardData.value.data.model,
      temperature,
      null,
      null,
      messageHistory,
      "prompt",
      false
    );
  } catch (error) {
    console.error("Error in triggerLLM:", error);
    localCardData.value.data.status = "error";
  }
};

    const handlePartialMessage = (newValue, oldValue) => {
      localCardData.value.data.status = "inProgress";

      if (!oldValue) {
        localCardData.value.data.messageHistory.push({
          role: "system",
          content: "",
          flagged: false,
          isPartial: true,
        });
      }

      const lastMessage =
        localCardData.value.data.messageHistory[
          localCardData.value.data.messageHistory.length - 1
        ];

      if (lastMessage && lastMessage.isPartial) {
        lastMessage.content = newValue;
        Vue.nextTick(scrollToBottom);
      }
    };

    const handleCompletedMessage = (newValue) => {
      const lastMessage =
        localCardData.value.data.messageHistory[
          localCardData.value.data.messageHistory.length - 1
        ];

      if (lastMessage && lastMessage.isPartial) {
        lastMessage.content = newValue;
        lastMessage.isPartial = false;
      } else {
        localCardData.value.data.messageHistory.push({
          role: "system",
          content: newValue,
          flagged: false,
        });
      }

      localCardData.value.data.status = "complete";
      updateOutputSockets();
      handleCardUpdate();
      Vue.nextTick(scrollToBottom);
    };

    const handleErrorMessage = () => {
      localCardData.value.data.status = "error";
      handleCardUpdate();
    };

    const renderMarkdown = (content) => {
      if (!content) return "";

      try {
        let textContent =
          typeof content === "object"
            ? JSON.stringify(content, null, 2)
            : String(content);

        // Handle JSON content
        if (
          textContent.trim().startsWith("{") ||
          textContent.trim().startsWith("[")
        ) {
          try {
            const parsed = JSON.parse(textContent);
            textContent =
              "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
          } catch (e) {
            // If JSON parsing fails, wrap as-is
            textContent = "```json\n" + textContent + "\n```";
          }
        }

        const md = markdownit({
          html: true,
          breaks: true,
          linkify: true,
          typographer: true,
          highlight: function (str, lang) {
            if (lang === "json") {
              try {
                const parsed = JSON.parse(str);
                str = JSON.stringify(parsed, null, 2);
              } catch (e) {
                // Keep original string if parsing fails
              }
            }
            return '<pre class="hljs"><code>' + str + "</code></pre>";
          },
        });

        md.enable("table");
        return md.render(textContent);
      } catch (error) {
        console.error("Error in renderMarkdown:", error);
        return `<pre class="hljs"><code>${content}</code></pre>`;
      }
    };

    // Lifecycle hooks
    Vue.onMounted(() => {
      if (availableModels.value.length && !localCardData.value.data.model) {
        localCardData.value.data.model = availableModels.value[0];
      }
      registerSession(websocketId.value, null);
      localCardData.value.data.status = sessionStatus.value;
      handleCardUpdate();
    });

    Vue.onUnmounted(() => {
      cleanup();
      unregisterSession(websocketId.value);
    });

    return {
      // Core setup
      localCardData,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      emitWithCardId,
      hasSocketError,
      addInput,

      // Refs
      chatContainer,
      userInput,

      // Computed
      availableModels,

      // Chat functions
      handleUserInput,
      toggleFlag,
      removeMessage,
      renderMarkdown,
      copyToClipboard,
      showToast,
    };
  },
};
