// AgentCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import SocketEditor from "./SocketEditor.js";
import { useModels } from "../composables/useModels.js";
import { useRealTime } from "../composables/useRealTime.js";

import {
  CardInitializer,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";

import { updateSocketArray , createSocket, createSocketUpdateEvent} from "../utils/socketManagement/socketRemapping.js";


export default {
  name: "AgentCard",
  components: {
    BaseCard,
    BaseSocket,
    SocketEditor,
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
        </div>

        <!-- Input Sockets -->
        <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 16px;">
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

        <!-- Output Socket -->
        <div 
          v-if="localCardData.data.sockets.outputs?.[0]"
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
        <div class="space-y-4 text-gray-300" v-show="localCardData.ui.display === 'default'">
          <!-- System Prompt -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400 font-medium">System Prompt</label>
            <SocketEditor
              v-model="localCardData.data.systemPrompt"
              type="system"
              placeholder="Enter system prompt..."
              :existing-sockets="localCardData.data.sockets.inputs"
              @update:modelValue="text => handlePromptChange('system', text)"
              @socket-update="handleSocketUpdate"
              @html-update="html => handleHtmlUpdate(html, 'systemPrompt')"
            />
          </div>

          <!-- User Prompt -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400 font-medium">User Prompt</label>
            <SocketEditor
              v-model="localCardData.data.userPrompt"
              type="user"
              placeholder="Enter user prompt..."
              :existing-sockets="localCardData.data.sockets.inputs"
              @update:modelValue="text => handlePromptChange('user', text)"
              @socket-update="handleSocketUpdate"
              @html-update="html => handleHtmlUpdate(html, 'userPrompt')"
            />
          </div>

          <!-- Output Display -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400 font-medium">Output</label>
            <div 
              class="w-full min-h-[60px] max-h-[100px] overflow-y-auto bg-gray-900 text-xs text-gray-200 p-2 rounded"
              @mousedown.stop
            >
              {{ localCardData.data.output || 'No output yet...' }}
            </div>
          </div>

          <!-- Trigger and Status -->
          <div class="mt-4">
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  v-model="localCardData.data.triggerOnInput" 
                  class="form-checkbox" 
                />
                <span class="text-xs text-gray-400">Trigger on input</span>
              </label>

              <div class="flex items-center gap-2">
                <button 
                  class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
                  @click="triggerAgent"
                >
                  Trigger
                </button>

                <div class="status-dot" :class="{
                  'idle': localCardData.data.status === 'idle',
                  'complete': localCardData.data.status === 'complete',
                  'in-progress': localCardData.data.status === 'inProgress',
                  'error': localCardData.data.status === 'error'
                }"></div>
              </div>
            </div>
          </div>

          <!-- Ollama Status -->
          <div v-if="ollamaStatus !== 'checking'" class="text-sm flex items-center gap-2 mt-2">
            <i :class="'pi ' + ollamaStatusDisplay.icon"></i>
            <span>{{ ollamaStatusDisplay.text }}</span>
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

    // Initialize local state
    const websocketId = Vue.ref(uuidv4());
    const triggerPending = Vue.ref(false);

    // Composables
    const { allModels: availableModels, isOllamaAvailable, ollamaStatus } = useModels();
    const {
      wsUuid,
      sessions,
      registerSession,
      unregisterSession,
      sendToServer,
    } = useRealTime();

    // Initialize card data with default configuration
    const defaultConfig = {
      name: "Agent",
      description: "Agent Node",
      defaultSockets: {
        inputs: [
          { name: "System Socket" },
          { name: "User Socket" }
        ],
        outputs: [
          { name: "Output" }
        ]
      },
      defaultData: {

        model: null,
        temperature : 0.4,
        systemPrompt: '<socket name="System Socket"/>',
        userPrompt: '<socket name="User Socket"/>',
        
        systemPromptHtml: '',
        userPromptHtml: '',
        output: '',
        status: 'idle',
        triggerOnInput: false,
        trigger: null,
        triggers: {
          andEnabled: false,
          orEnabled: false,
          autoTrigger: false,
        }
      }
    };

    const localCardData = Vue.ref(
      CardInitializer.initializeCardData(props.cardData, defaultConfig)
    );

    console.log("Card Data after initialization:", {
      inputs: localCardData.value.data.sockets.inputs,
      outputs: localCardData.value.data.sockets.outputs,
      defaultConfig
    });

    // Computed properties
    const outputSocket = Vue.computed(() => 
      localCardData.value.data.sockets.outputs[0]
    );

    const sessionStatus = Vue.computed(() => 
      sessions.value?.[websocketId.value]?.status || "idle"
    );

    // Message state computed properties
    const partialMessage = Vue.computed(() => 
      sessions.value?.[websocketId.value]?.partialMessage || ""
    );

    const completedMessage = Vue.computed(() => 
      sessions.value?.[websocketId.value]?.completedMessage || ""
    );

    const errorMessage = Vue.computed(() => 
      sessions.value?.[websocketId.value]?.errorMessage || ""
    );

    // Socket value computed property
    const inputSocketValues = Vue.computed(() =>
      localCardData.value.data.sockets.inputs.map(socket => ({
        id: socket.id,
        value: socket.value,
        momentUpdated: socket.momentUpdated,
      }))
    );

    // Add visual indicator for Ollama status
    const ollamaStatusDisplay = Vue.computed(() => {
      switch (ollamaStatus.value) {
        case 'checking':
          return { icon: 'pi-sync pi-spin', text: 'Checking Ollama...' };
        case 'available':
          return { icon: 'pi-check-circle', text: 'Ollama Available' };
        case 'unavailable':
          return { icon: 'pi-times-circle', text: 'Ollama Unavailable' };
        default:
          return { icon: 'pi-question-circle', text: 'Unknown Status' };
      }
    });

    // Card-specific functions
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

    // Handle HTML updates from SocketEditor
    const handleHtmlUpdate = (html, source) => {
      if (source === "systemPrompt") {
        localCardData.value.data.systemPromptHtml = html;
      } else if (source === "userPrompt") {
        localCardData.value.data.userPromptHtml = html;
      }
    };

    // Handle prompt changes
    const handlePromptChange = (type, text) => {
      if (isProcessing.value) return;

      if (type === "system") {
        localCardData.value.data.systemPrompt = text;
      } else {
        localCardData.value.data.userPrompt = text;
      }

      Vue.nextTick(() => handleCardUpdate());
    };

    // Get both prompt's socket declarations
    const getMergedSocketDeclarations = () => {
      const systemDeclarations = parseSocketDeclarations(
        localCardData.value.data.systemPrompt,
        "system"
      );
      const userDeclarations = parseSocketDeclarations(
        localCardData.value.data.userPrompt,
        "user"
      );
      return systemDeclarations.concat(userDeclarations);
    };


    // Handle socket updates from SocketEditor
     const handleSocketUpdate = (event) => {
       if (isProcessing.value) return;
       isProcessing.value = true;
 
       try {
         const oldSockets = [...localCardData.value.data.sockets.inputs];
         const declarations = getMergedSocketDeclarations();
 
         // Create new sockets using IDs from SocketEditor when available
         const newSockets = declarations.map((decl, index) => {
           const existingSocket = oldSockets.find(
             (s) => s.name === decl.name && s.source === decl.source
           );
 
           // Find matching socket info from the event
           const socketInfo = event.sockets?.find((s) => s.name === decl.name);
 
           const socket = createSocket({
             type: "input",
             index,
             existingId: socketInfo?.id || existingSocket?.id,
             value: existingSocket?.value,
           });
 
           socket.name = decl.name;
           socket.source = decl.source;
           return socket;
         });
 
         // Find deleted sockets
         const deletedSocketIds = oldSockets
           .filter(
             (old) =>
               !newSockets.some(
                 (n) => n.name === old.name && n.source === old.source
               )
           )
           .map((s) => s.id);
 
         // Use utility for socket array update
         const { reindexMap, reindexedSockets } = updateSocketArray({
           oldSockets,
           newSockets,
           type: "input",
           deletedSocketIds,
           socketRegistry,
           connections: connections.value,
         });
 
         // Ensure the reindexed sockets retain their names
         const finalSockets = reindexedSockets.map((socket, index) => {
           const declaration = declarations[index];
           return {
             ...socket,
             name: declaration.name,
             source: declaration.source,
           };
         });
 
         // Update local state with properly named sockets
         localCardData.value.data.sockets.inputs = finalSockets;
 
         // Emit socket update event
         emit(
           "sockets-updated",
           createSocketUpdateEvent({
             cardId: localCardData.value.uuid,
             oldSockets,
             newSockets: finalSockets,
             reindexMap,
             deletedSocketIds,
             type: "input",
           })
         );
       } finally {
         isProcessing.value = false;
         Vue.nextTick(() => {
           handleCardUpdate();
         });
       }
     };

    // Parse socket declarations from prompts
    const parseSocketDeclarations = (text, source) => {
      const pattern = /<socket\s+name\s*=\s*"([^"]+)"\s*\/>/g;
      return [...text.matchAll(pattern)].map((match) => ({
        name: match[1],
        source,
      }));
    };

    // Content resolution functions
    const isJSON = (str) => {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    };

    const resolveSocketContent = (html, sockets) => {
      if (!html || !sockets?.length) return html;

      try {
        // Create socket map for faster lookups
        const socketMap = new Map(sockets.map(socket => [socket.id, socket]));

        // Create a temporary DOM element to parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Find all socket tags
        const socketTags = doc.querySelectorAll("span.text-editor-tag");

        // Replace each socket tag with its corresponding value
        socketTags.forEach((tag) => {
          const socketId = tag.getAttribute("data-socket-id");
          const socket = socketMap.get(socketId);

          let replacement = "";
          if (socket?.value?.content) {
            replacement = socket.value.content;
          } else if (socket?.value) {
            replacement = isJSON(socket.value) 
              ? JSON.stringify(socket.value)
              : socket.value;
          }

          const textNode = doc.createTextNode(replacement);
          tag.parentNode.replaceChild(textNode, tag);
        });

        return doc.body.innerHTML;
      } catch (error) {
        console.error("Error resolving socket HTML:", error);
        return html;
      }
    };

    // Update sockets based on declarations
    const updateSockets = (declarations) => {
      const newSockets = declarations.map((decl, index) => {
        const existingSocket = localCardData.value.data.sockets.inputs.find(
          s => s.name === decl.name && s.source === decl.source
        );

        return {
          id: existingSocket?.id || generateSocketId(),
          type: 'input',
          name: decl.name,
          source: decl.source,
          index,
          value: existingSocket?.value || null,
          momentUpdated: Date.now()
        };
      });

      localCardData.value.data.sockets.inputs = newSockets;
    };

    // Agent trigger function
    const triggerAgent = () => {
      if (sessionStatus.value === "inProgress") {
        triggerPending.value = true;
        return;
      }

      if (localCardData.value.data.status === "inProgress") return;
      if (!localCardData.value?.data?.model?.provider) return;

      triggerPending.value = false;

      const resolvedSystemPrompt = resolveSocketContent(
        localCardData.value.data.systemPromptHtml,
        localCardData.value.data.sockets.inputs
      );

      const resolvedUserPrompt = resolveSocketContent(
        localCardData.value.data.userPromptHtml,
        localCardData.value.data.sockets.inputs
      );

      let messageHistory = [
        { role: "system", content: resolvedSystemPrompt },
        { role: "user", content: resolvedUserPrompt },
      ];

      let temperature = localCardData.value.data.temperature || 0.7;

      // Handle models that don't support system messages
      if (["o1-mini-2024-09-12", "o1-preview"].includes(localCardData.value.data.model.model)) {
        messageHistory[0].role = "user";
        temperature = 1;
      }

      // Clear current output
      if (localCardData.value.data.sockets?.outputs?.length) {
        localCardData.value.data.sockets.outputs[0].value = null;
      }
      
      sendToServer(
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
    };


    
    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: ({ type, content }) => {
        if (type === 'modified' && content.old.value !== content.new.value) {
          if (localCardData.value.data.triggerOnInput) {
            if (sessionStatus.value === "inProgress") {
              triggerPending.value = true;
            } else {
              triggerAgent();
            }
          }
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
      onTrigger: triggerAgent // Pass your triggerAgent function
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

    // Message watchers
    Vue.watch(sessionStatus, (newValue) => {
      localCardData.value.data.status = newValue;
    });

    // Add trigger watcher
    Vue.watch(() => props.cardData.data?.trigger, watchers.trigger);

    Vue.watch(partialMessage, (newValue) => {
      if (newValue && newValue.length) {
        localCardData.value.data.status = 'inProgress';
        localCardData.value.data.output = newValue;
      }
    });

    Vue.watch(completedMessage, (newValue) => {
      if (newValue) {
        localCardData.value.data.output = newValue;
        localCardData.value.data.sockets.outputs[0].value = newValue;
        localCardData.value.data.status = 'complete';
        handleCardUpdate();

        if (triggerPending.value && sessionStatus.value === "complete") {
          Vue.nextTick(() => triggerAgent());
        }
      }
    });

    Vue.watch(errorMessage, (newValue, oldValue) => {
      if (!oldValue?.length && newValue?.length) {
        localCardData.value.data.output = null;
        localCardData.value.data.sockets.outputs[0].value = null;
        localCardData.value.data.status = 'error';
        handleCardUpdate();
      }
    });

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

    // Handle model selection including Ollama models
    const handleModelSelect = (model) => {
      if (model.provider === 'ollama' && !isOllamaAvailable.value) {
        alert('Ollama is not available. Please ensure it is running locally.');
        return;
      }
      // ... existing model selection logic ...
    };

    const generateResponse = async (prompt, systemPrompt) => {
      try {
        if (localCardData.value.data.model?.provider === 'ollama') {
          // Special handling for Ollama models
          const response = await fetch('/api/ollama/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: localCardData.value.data.model.model,
              prompt: prompt,
              systemPrompt: systemPrompt
            })
          });

          if (!response.ok) {
            throw new Error('Ollama generation failed');
          }

          const data = await response.json();
          return data.text;
        }
        // ... existing code for other providers ...
      } catch (error) {
        console.error('Generation error:', error);
        return `Error: ${error.message}`;
      }
    };

    return {
      // Core setup
      localCardData,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      emitWithCardId,
      hasSocketError,

      // Computed
      availableModels,
      outputSocket,
      sessionStatus,
      ollamaStatus,
      ollamaStatusDisplay,

      // Card functions
      handlePromptChange,
      handleSocketUpdate,
      handleHtmlUpdate,
      triggerAgent,
      handleModelSelect,
      generateResponse
    };
  },
};