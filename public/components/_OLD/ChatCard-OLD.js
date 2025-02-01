// ChatCard.js
import BaseCard from "../BaseCard.js";
import BaseSocket from "../BaseSocket.js";
import { useConfigs } from "../../composables/useConfigs.js";
import { useCanvases } from "../../composables/useCanvases.js";
import { useRealTime } from "../../composables/useRealTime.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../../utils/socketManagement/socketRemapping.js";

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
        <!-- Model Selection -->
        <div class="w-full" v-show="localCardData.display == 'default'">
          <select
            v-model="localCardData.model"
            class="flex-1 bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
            style="border: 1px solid #374151; width:100%"
            @mousedown.stop
            @change="handleCardUpdate"
          >
            <option v-for="model in availableModels" :key="model.model" :value="model">
             {{model.provider.toUpperCase()}} {{model.name.en}}
            </option>
          </select>
        </div>

        <!-- Input Sockets -->
        <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 40px;">
          <div
            v-for="(socket, index) in localCardData.sockets.inputs"
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
        <button 
          class="mt-2 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
          @click="addInput"
        >+ Add System Input</button>

        <!-- Output Sockets -->
        <div class="absolute -right-[12px] flex flex-col gap-1" style="top: 16px;">
          <div
            v-for="(socket, index) in localCardData.sockets.outputs"
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

        <div ref="chatContainer" class="w-full h-[300px] bg-gray-900 rounded overflow-y-auto p-2" @mousedown.stop  @wheel.stop>
            <div v-for="(message, index) in localCardData.messageHistory" :key="index" class="mb-2">
              
            
           
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
        <i class="pi pi-check-circle cursor-pointer"
          :class="message.flagged ? 'text-green-500' : 'text-gray-600'"
          @click="toggleFlag(index)"></i>
        <i class="pi pi-times cursor-pointer text-gray-600 hover:text-gray-400"
          @click="removeMessage(index)"></i>
      </div>
    </div>
    <div class="markdown-content whitespace-pre-wrap break-words" v-html="renderMarkdown(message.content)"></div>
    
    <!-- Bottom icons for long messages -->
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
    
    <!-- Bottom icons for long messages -->
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



            </div>
          </div>

          <!-- User Input -->
          <div class="relative">
            <div
              ref="userInput"
              contenteditable="true"
              class="w-full min-h-[60px] max-h-[300px] overflow-y-auto bg-gray-800 text-xs text-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 cursor-text"
              @keydown.enter.prevent="handleUserInput"
              @mousedown.stop  @wheel.stop
              placeholder="Type your message..."
            ></div>
            <div class="absolute bottom-2 right-2">
              <div class="status-dot" :class="{
                'idle': localCardData.status === 'idle',
                'complete': localCardData.status === 'complete',
                'in-progress': localCardData.status === 'inProgress',
                'error': localCardData.status === 'error'
              }"></div>
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
    const userInput = Vue.ref(null);

    const { canvasModels } = useCanvases(); // Add this import
    const { models: configModels } = useConfigs();

    // Add this computed property
    const availableModels = Vue.computed(() => {
      // Use canvas models if available, otherwise fall back to config models
      return canvasModels.value.length > 0
        ? canvasModels.value
        : configModels.value;
    });

    const chatContainer = Vue.ref(null);

    const {
      wsUuid,
      sessions,
      registerSession,
      unregisterSession,
      sendToServer,
    } = useRealTime();

    let websocketId = Vue.ref(uuidv4());

    const initializeCardData = (data) => {
      // First preserve any existing sockets
      const existingSockets = data.sockets?.outputs || [];

      // Create new sockets only if they don't exist
      const outputs = existingSockets.length
        ? existingSockets
        : [
            {
              ...createSocket({
                type: "output",
                index: 0,
                existingId: data.sockets?.outputs?.[0]?.id,
                value: data.messageHistory || [],
              }),
              name: "Entire History", // Explicitly set name
            },
            {
              ...createSocket({
                type: "output",
                index: 1,
                existingId: data.sockets?.outputs?.[1]?.id,
                value: "",
              }),
              name: "System", // Explicitly set name
            },
            {
              ...createSocket({
                type: "output",
                index: 2,
                existingId: data.sockets?.outputs?.[2]?.id,
                value: "",
              }),
              name: "User", // Explicitly set name
            },
          ];

      return {
        uuid: data.uuid,
        name: data.name || "Chat",
        description: data.description || "Chat Node",
        model: data.model || "",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        status: data.status || "idle",
        messageHistory: data.messageHistory || [],
        sockets: {
          inputs: data.sockets?.inputs || [],
          outputs: outputs,
        },
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Socket Management
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

    // Input Socket Management
    const addInput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.inputs];
        const newSocket = createSocket({
          type: "input",
          index: oldSockets.length,
          name: `System Input ${oldSockets.length + 1}`,
        });

        const newSockets = [...oldSockets, newSocket];
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          socketRegistry,
          connections: connections.value,
        });

        localCardData.value.sockets.inputs = reindexedSockets;

        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type: "input",
          })
        );

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const renderMarkdown = (content) => {
      if (!content) return "";

      try {
        // Convert to string if not already
        let textContent =
          typeof content === "object"
            ? JSON.stringify(content, null, 2)
            : String(content);

        // Check if the content already contains markdown code blocks
        const hasCodeBlocks = textContent.includes("```");

        // Check if there's JSON within regular text
        const isPureJsonInText = () => {
          const trimmed = textContent.trim();
          return (
            trimmed.includes("{") &&
            !trimmed.includes("```") &&
            trimmed.indexOf("{") > 0
          );
        };

        // Handle JSON within text first
        if (isPureJsonInText()) {
          const jsonStartIndex = textContent.indexOf("{");
          const prefix = textContent.substring(0, jsonStartIndex);
          const jsonPart = textContent.substring(jsonStartIndex);

          try {
            // Try to parse and format the JSON part
            const parsed = JSON.parse(jsonPart);
            // Check if it's a table-like structure
            if (
              Array.isArray(parsed) &&
              parsed.every((item) => typeof item === "object")
            ) {
              // Convert JSON array to markdown table
              const headers = Object.keys(parsed[0]);
              let tableMarkdown = "\n| " + headers.join(" | ") + " |\n";
              tableMarkdown +=
                "| " + headers.map(() => "---").join(" | ") + " |\n";
              tableMarkdown += parsed
                .map(
                  (row) =>
                    "| " +
                    headers
                      .map((header) => String(row[header] || ""))
                      .join(" | ") +
                    " |"
                )
                .join("\n");
              textContent = prefix + tableMarkdown;
            } else {
              // Regular JSON formatting
              const prettyJson = JSON.stringify(parsed, null, 2);
              textContent = prefix + "\n```json\n" + prettyJson + "\n```";
            }
          } catch (e) {
            // If JSON is incomplete, just wrap it in code block
            textContent = prefix + "\n```json\n" + jsonPart + "\n```";
          }
        }
        // Handle standalone JSON (no prefix text)
        else if (
          !hasCodeBlocks &&
          (textContent.trim().startsWith("{") ||
            textContent.trim().startsWith("["))
        ) {
          try {
            const parsed = JSON.parse(textContent);
            // Check if it's a table-like structure
            if (
              Array.isArray(parsed) &&
              parsed.every((item) => typeof item === "object")
            ) {
              // Convert JSON array to markdown table
              const headers = Object.keys(parsed[0]);
              let tableMarkdown = "| " + headers.join(" | ") + " |\n";
              tableMarkdown +=
                "| " + headers.map(() => "---").join(" | ") + " |\n";
              tableMarkdown += parsed
                .map(
                  (row) =>
                    "| " +
                    headers
                      .map((header) => String(row[header] || ""))
                      .join(" | ") +
                    " |"
                )
                .join("\n");
              textContent = tableMarkdown;
            } else {
              // Regular JSON formatting
              textContent =
                "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
            }
          } catch (e) {
            // If parsing fails (incomplete JSON), wrap in code block without parsing
            textContent = "```json\n" + textContent + "\n```";
          }
        }

        // Configure markdown-it with table support and custom rendering
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

        // Enable tables plugin
        md.enable("table");

        return md.render(textContent);
      } catch (error) {
        console.error("Error in renderMarkdown:", error);
        return `<pre class="hljs"><code>${content}</code></pre>`;
      }
    };

    // Message Management
    const toggleFlag = (index) => {
      const message = localCardData.value.messageHistory[index];
      if (!message.flagged) {
        message.flagged = true;
        const flaggedCount = localCardData.value.messageHistory.filter(
          (m) => m.flagged
        ).length;
        const itemNumber = `Item ${flaggedCount}`;
        message.flaggedAs = itemNumber;

        // Add new output socket for flagged item
        const oldSockets = [...localCardData.value.sockets.outputs];
        const newSocket = {
          ...createSocket({
            type: "output",
            index: oldSockets.length,
            value: message.content,
          }),
          name: itemNumber,
        };

        const newSockets = [...oldSockets, newSocket];
        const { reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "output",
          socketRegistry,
          connections: connections.value,
        });

        localCardData.value.sockets.outputs = reindexedSockets;
      } else {
        message.flagged = false;
        const flaggedAs = message.flaggedAs;
        message.flaggedAs = null;

        // Remove corresponding output socket and update remaining sockets
        const oldSockets = [...localCardData.value.sockets.outputs];
        const newSockets = oldSockets.filter((s) => s.name !== flaggedAs);

        // Reindex remaining flagged messages
        const flaggedMessages = localCardData.value.messageHistory
          .filter((m) => m.flagged)
          .sort(
            (a, b) =>
              parseInt(a.flaggedAs.split(" ")[1]) -
              parseInt(b.flaggedAs.split(" ")[1])
          );

        flaggedMessages.forEach((msg, idx) => {
          const newItemNumber = `Item ${idx + 1}`;
          msg.flaggedAs = newItemNumber;
        });

        // Update sockets with new ordering
        updateOutputSockets();
      }

      handleCardUpdate();
    };

    const removeMessage = (index) => {
      const message = localCardData.value.messageHistory[index];
      if (message.flagged) {
        const flaggedAs = message.flaggedAs;
        const socketIndex = localCardData.value.sockets.outputs.findIndex(
          (s) => s.name === flaggedAs
        );
        if (socketIndex !== -1) {
          localCardData.value.sockets.outputs.splice(socketIndex, 1);
        }
      }

      localCardData.value.messageHistory.splice(index, 1);
      updateOutputSockets();
      handleCardUpdate();
    };

    // Handle user input and LLM interaction
    const handleUserInput = async (event) => {
      if (!userInput.value || localCardData.value.status === "inProgress")
        return;

      const content = userInput.value.innerText.trim();
      if (!content) return;

      userInput.value.innerText = "";

      localCardData.value.messageHistory.push({
        role: "user",
        content,
        flagged: false,
      });

      Vue.nextTick(scrollToBottom); // Add scroll after user message

      updateOutputSockets();
      await triggerLLM();
    };

    const updateOutputSockets = () => {
      // Always update sockets, even if history is empty
      const systemMessages = localCardData.value.messageHistory
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");

      const userMessages = localCardData.value.messageHistory
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n\n");

      // Get existing sockets for preservation
      const oldSockets = [...localCardData.value.sockets.outputs];

      // Create new sockets array with proper names
      const newSockets = [];

      // Add or update the three default sockets
      const defaultSocketConfigs = [
        {
          name: "Entire History",
          value: JSON.stringify(localCardData.value.messageHistory),
        }, // Stringify the messageHistory
        { name: "System", value: systemMessages },
        { name: "User", value: userMessages },
      ];

      defaultSocketConfigs.forEach((config, index) => {
        const existingSocket = oldSockets[index];
        newSockets.push({
          ...createSocket({
            type: "output",
            index,
            existingId: existingSocket?.id,
            value: config.value,
          }),
          name: config.name,
        });
      });

      // Add flagged message sockets
      localCardData.value.messageHistory.forEach((msg) => {
        if (msg.flagged) {
          const existingSocket = oldSockets.find(
            (s) => s.name === msg.flaggedAs
          );
          // Ensure content is stringified if it's an object
          const value =
            typeof msg.content === "object"
              ? JSON.stringify(msg.content)
              : msg.content;
          newSockets.push({
            ...createSocket({
              type: "output",
              index: newSockets.length,
              existingId: existingSocket?.id,
              value: value,
            }),
            name: msg.flaggedAs,
          });
        }
      });

      // Update socket array with proper remapping
      const { reindexedSockets } = updateSocketArray({
        oldSockets,
        newSockets,
        type: "output",
        socketRegistry,
        connections: connections.value,
      });

      localCardData.value.sockets.outputs = reindexedSockets;
    };

    const triggerLLM = async () => {

      if (localCardData.value.status === "inProgress") return; //Reject requests while in progress
      if (!localCardData?.value?.model?.provider) return; //Must have a model

      // Process input sockets first
      if (localCardData.value.sockets.inputs.length > 0) {
        localCardData.value.sockets.inputs.forEach((socket) => {
          if (socket.value) {
            localCardData.value.messageHistory.unshift({
              role: "system",
              content: socket.value,
              flagged: false,
            });
          }
        });
      }

      // Clean message history to only include role and content
      let messageHistory = localCardData.value.messageHistory.map((msg) => {
        // Ensure the content is a string
        const content =
          typeof msg.content === "object"
            ? JSON.stringify(msg.content)
            : String(msg.content || "");

        return {
          role: msg.role,
          content: content,
        };
      });

      let temperature = 0.7;

      // System prompts not yet supported by some models
      if (localCardData.value.model.model === "o1-mini-2024-09-12" || localCardData.value.model.model === "o1-preview") {
        messageHistory = messageHistory.map((msg) => ({
          ...msg,
          role: msg.role === "system" ? "user" : msg.role,
        }));
        temperature = 1;
      }

      updateOutputSockets();

      console.log("Message History for Chat", messageHistory);

      try {
        await sendToServer(
          wsUuid.value,
          websocketId.value,
          localCardData.value.model,
          temperature,
          null,
          null,
          messageHistory,
          "prompt", // Changed from "chat" to "prompt"
          false
        );
      } catch (error) {
        console.error("Error in triggerLLM:", error);
        localCardData.value.status = "error";
      }
    };

    // Handle card updates and socket management
    const handleCardUpdate = (data) => {
      if (data?.uuid) localCardData.value = data;
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    // Watch for responses from the LLM
    const sessionStatus = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.status || "idle";
    });

    Vue.watch(sessionStatus, (newValue) => {
      localCardData.value.status = newValue;
    });

    const partialMessage = Vue.computed(() => {
      if (sessions?.value) {
        const session = sessions.value[websocketId.value];
        return session ? session?.partialMessage : "";
      }
      return "";
    });

    const completedMessage = Vue.computed(() => {
      if (sessions?.value) {
        const session = sessions.value[websocketId.value];
        return session ? session?.completedMessage : "";
      }
      return "";
    });

    const errorMessage = Vue.computed(() => {
      if (sessions?.value) {
        const session = sessions.value[websocketId.value];
        return session ? session?.errorMessage : "";
      }
      return "";
    });

    Vue.watch(partialMessage, (newValue, oldValue) => {
      if (newValue && newValue.length) {
        localCardData.value.status = "inProgress";

        // If this is the start of a new message (no previous partial message)
        if (!oldValue) {
          localCardData.value.messageHistory.push({
            role: "system",
            content: "",
            flagged: false,
            isPartial: true,
          });
        }

        // Update the content of the last message
        const lastMessage =
          localCardData.value.messageHistory[
            localCardData.value.messageHistory.length - 1
          ];
        if (lastMessage && lastMessage.isPartial) {
          lastMessage.content = newValue;
          Vue.nextTick(scrollToBottom);
        }
      }
    });

    Vue.watch(completedMessage, (newValue) => {
      if (newValue) {
        // Find and update the partial message, or create a new one if none exists
        const lastMessage =
          localCardData.value.messageHistory[
            localCardData.value.messageHistory.length - 1
          ];
        if (lastMessage && lastMessage.isPartial) {
          lastMessage.content = newValue;
          lastMessage.isPartial = false;
        } else {
          localCardData.value.messageHistory.push({
            role: "system",
            content: newValue,
            flagged: false,
          });
        }

        localCardData.value.status = "complete";
        updateOutputSockets();
        handleCardUpdate();
        Vue.nextTick(scrollToBottom);
      }
    });

    Vue.watch(errorMessage, (newValue, oldValue) => {
      if (!oldValue?.length && newValue?.length) {
        localCardData.value.status = "error";
        handleCardUpdate();
      }
    });

    const scrollToBottom = () => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    };

    // Add this utility function to the setup:
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
        const clipData = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
        });
        await navigator.clipboard.write([clipData]);
        showToast("Copied to clipboard!");
      } catch (error) {
        console.error("Failed to copy text:", error);
        showToast("Failed to copy to clipboard", "error");
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

          // Update socket values
          if (newData.sockets?.inputs) {
            newData.sockets.inputs.forEach((socket, index) => {
              if (localCardData.value.sockets.inputs[index]) {
                localCardData.value.sockets.inputs[index].value = socket.value;
              }
            });
          }
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Initialize
    Vue.onMounted(() => {
       //If no model is provided, then assign the first one automatically
       if (availableModels.value.length && !localCardData.value.model) {
        localCardData.value.model = availableModels.value[0];
      }

      // Handle initial socket setup
      // Only emit socket update if we created new sockets (not loading existing ones)
      const hadExistingSockets = props.cardData.sockets?.outputs?.length > 0;
      if (!hadExistingSockets) {
        const oldSockets = localCardData.value.sockets.outputs;
        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: localCardData.value.sockets.outputs,
            reindexMap: new Map(oldSockets.map((s) => [s.id, s.id])),
            deletedSocketIds: [],
            type: "output",
          })
        );
      }
      registerSession(websocketId.value, null);
      localCardData.value.status = sessionStatus.value;
    });

    // Cleanup
    Vue.onUnmounted(() => {
      socketRegistry.forEach((socket) =>
        socket.cleanup.forEach((cleanup) => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();
      unregisterSession(websocketId.value);
    });

    return {
      chatContainer,
      localCardData,
      userInput,
      availableModels,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      handleSocketMount,
      handleCardUpdate,
      addInput,
      toggleFlag,
      removeMessage,
      handleUserInput,
      renderMarkdown,
      copyToClipboard,
      showToast,
    };
  },
};
