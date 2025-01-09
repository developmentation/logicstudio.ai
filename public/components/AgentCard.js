// AgentCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import SocketEditor from "./SocketEditor.js";
import { useConfigs } from "../composables/useConfigs.js";
import { useRealTime } from "../composables/useRealTime.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../utils/socketManagement/socketRemapping.js";

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
  <div>
    <BaseCard
      :card-data="localCardData"
      :zoom-level="zoomLevel"
      :z-index="zIndex"
      :is-selected="isSelected"
      @update-position="$emit('update-position', $event)"
      @update-card="handleCardUpdate"
      @close-card="$emit('close-card', $event)"
      @clone-card="uuid => $emit('clone-card', uuid )"
      @select-card="$emit('select-card', $event)"
    >

    <div class = "w-full" v-show = "localCardData.display == 'default'">
        <select
        v-model="localCardData.model"
        class="flex-1 bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer;" style = "border: 1px solid #374151; width:100%"
        @mousedown.stop
        @change="handleCardUpdate">
        <option v-for="model in models" :key="model.model" :value="model">
          {{model.name.en}}
        </option>
      </select>
      </div>

      <!-- Input Sockets -->
       <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 16px;">
        <div
          v-for="(socket, index) in inputSockets"
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
       v-if="localCardData.sockets.outputs?.[0]"
       class="absolute -right-[12px]" style="top: 16px;">
        <BaseSocket
          type="output"
          :socket-id="outputSocket.id"
          :card-id="localCardData.uuid"
          :name="outputSocket.name"
          :value="localCardData.sockets.outputs[0].value"
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
      <div class="space-y-4 text-gray-300">
        <!-- System Prompt -->
        <div class="space-y-1" v-show = "localCardData.display == 'default'">
          <label class="text-xs text-gray-400 font-medium">System Prompt</label>
          <SocketEditor
            v-model="localCardData.systemPrompt"
            type="system"
            placeholder="Enter system prompt..."
            :existing-sockets="localCardData.sockets.inputs"
            @update:modelValue="text => handlePromptChange('system', text)"
            @socket-update="handleSocketUpdate"
            @html-update="html => handleHtmlUpdate(html, 'systemPrompt')"
            />
        </div>

        <!-- User Prompt -->
        <div class="space-y-1" v-show = "localCardData.display == 'default'">
          <label class="text-xs text-gray-400 font-medium">User Prompt</label>
          <SocketEditor
            v-model="localCardData.userPrompt"
            type="user"
            placeholder="Enter user prompt..."
            :existing-sockets="localCardData.sockets.inputs"
            @update:modelValue="text => handlePromptChange('user', text)"
            @socket-update="handleSocketUpdate"
            @html-update="html => handleHtmlUpdate(html, 'userPrompt')"
          />
        </div>


      <!-- Output Display -->
      <div class="space-y-1" v-show = "localCardData.display == 'default'">
        <label class="text-xs text-gray-400 font-medium">Output</label>
        <div class="w-full min-h-[60px] max-h-[100px] overflow-y-auto bg-gray-900 text-xs text-gray-200 p-2 rounded"
        @mousedown.stop
        >
          {{ localCardData.output || 'No output yet...' }}
        </div>
      </div>


      <!--Trigger and status-->

      <div class="mt-4">
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="localCardData.triggerOnInput" class="form-checkbox" />
            <span class="text-xs text-gray-400">Trigger on input</span>
          </label>

          <div class="flex items-center gap-2"> <!-- New container for button and dot -->
            <button class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
              @click="triggerAgent">Trigger</button>

            <div class="status-dot" :class="{
                'idle': localCardData.status === 'idle',
                'complete': localCardData.status === 'complete',
                'in-progress': localCardData.status === 'inProgress',
                'error': localCardData.status === 'error'
              }"></div>
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
    const triggerPending = Vue.ref(false);

    const socketMap = Vue.ref(new Map());

    const { models } = useConfigs();
    const {
      wsUuid,
      sessions,
      sessionsContent,
      registerSession,
      unregisterSession,
      sendToServer,
    } = useRealTime();

    let websocketId = Vue.ref(uuidv4()); //Create a unique websocket ID for gathering the results back

    // Initialize card data with proper socket structure
    const initializeCardData = (data) => {
      return {
        //Unique and identification properties
        uuid: data.uuid,
        name: data.name || "Agent",
        description: data.description || "Agent Node",

        //Card specific properties
        model: data.model || "", //make this models in the near future to account for parallel processing
        temperature: data.temperature || 0.4,
        triggerOnInput: data.triggerOnInput || false,
        systemPrompt: data.systemPrompt || "",
        userPrompt: data.userPrompt || "",
        systemPromptHtml: data.systemPromptHtml || "",
        userPromptHtml: data.userPromptHtml || "",
        output: data.output || "",
        status: data.status || "idle",

        //Display
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,

        //Sockets
        sockets: data.sockets /*{
          inputs:
            data.sockets?.inputs?.map((socket, index) => ({
              ...createSocket({
                type: "input",
                index,
                existingId: socket.id,
                value: socket.value,
              }),
              name: socket.name,
              source: socket.source,
            })) || [],
          outputs: [
            createSocket({
              type: "output",
              index: 0,
              existingId: data.sockets?.outputs?.[0]?.id,
              value: data.sockets?.outputs?.[0]?.value,
            }),
          ],
        },*/,
      };
    };

    // Initialize local state
    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Computed properties
    const outputSocket = Vue.computed(
      () => localCardData.value.sockets.outputs[0]
    );
    const inputSockets = Vue.computed(() => localCardData.value.sockets.inputs);

    // Socket connection tracking
    const getSocketConnections = (socketId) => connections.value.has(socketId);
    const hasSocketError = () => false;

    Vue.onMounted(() => {
      //If no model is provided, then assign the first one automatically
      if (models.value.length && !localCardData.value.model) {
        localCardData.value.model = models.value[0];
      }

      //Register this agent into the websocket registry
      registerSession(websocketId.value, null);
    });

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, {
        element: event.element,
        cleanup: [],
      });
    };

    // Helper to emit events with card ID
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Parse socket declarations from prompts
    const parseSocketDeclarations = (text, source) => {
      const pattern = /<socket\s+name\s*=\s*"([^"]+)"\s*\/>/g;
      const matches = [...text.matchAll(pattern)];

      return matches.map((match) => ({
        name: match[1],
        source,
      }));
    };

    // Get both prompt's socket declarations
    const getMergedSocketDeclarations = () => {
      const systemDeclarations = parseSocketDeclarations(
        localCardData.value.systemPrompt,
        "system"
      );
      const userDeclarations = parseSocketDeclarations(
        localCardData.value.userPrompt,
        "user"
      );
      return systemDeclarations.concat(userDeclarations);
    };

    // Handle socket updates from SocketEditor
    const handleSocketUpdate = (event) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.inputs];
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
        localCardData.value.sockets.inputs = finalSockets;

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

    // Add logging to handleHtmlUpdate
    const handleHtmlUpdate = (html, source) => {
      if (source == "systemPrompt") {
        localCardData.value.systemPromptHtml = html;
      }
      if (source == "userPrompt") {
        localCardData.value.userPromptHtml = html;
      }
    };

    // Handle prompt changes
    const handlePromptChange = (type, text) => {
      if (isProcessing.value) return;

      if (type === "system") {
        localCardData.value.systemPrompt = text;
      } else {
        localCardData.value.userPrompt = text;
      }

      Vue.nextTick(() => {
        handleCardUpdate();
      });
    };

    // Socket value management
    const getSocketValue = (socketId) => {
      // First check the socket in localCardData
      const socket =
        localCardData.value.sockets.inputs.find((s) => s.id === socketId) ||
        localCardData.value.sockets.outputs.find((s) => s.id === socketId);
      if (socket) return socket.value;

      // Fallback to socketMap
      return socketMap.value.get(socketId)?.value;
    };

    // Card update handler
    const handleCardUpdate = (data) => {
      if(data) localCardData.value = data; 
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    //Agent management

    const triggerAgent = () => {
      // Don't allow triggering if already starting/partial and no pending request
      if (sessionStatus.value === 'inProgress') {
        triggerPending.value = true;
        return;
      }
    
      // We're idle, so clear any pending flag and proceed
      triggerPending.value = false;

      const resolvedSystemPrompt = resolveSocketContent(
        localCardData.value.systemPromptHtml,
        localCardData.value.sockets.inputs
      ); //|| localCardData.value.systemPrompt;

      const resolvedUserPrompt = resolveSocketContent(
        localCardData.value.userPromptHtml,
        localCardData.value.sockets.inputs
      ); //|| localCardData.value.userPrompt;

      let messageHistory = [
        { role: "system", content: resolvedSystemPrompt },
        { role: "user", content: resolvedUserPrompt },
      ];

      let temperature = localCardData.value.temperature;

      //System prompts not yet supported by some models.
      if (localCardData.value.model.model == "o1-mini-2024-09-12") {
        messageHistory[0].role = "user";
        temperature = 1;
      }

      console.log("Calling LLM:", messageHistory);

      //Set the output to null
      Vue.nextTick(() => {
        if (localCardData.value.sockets?.outputs?.length)
          // localCardData.value.sockets.outputs[0].value = null;
          emit("update-card", Vue.toRaw(localCardData.value));
      });

      sendToServer(
        wsUuid.value,
        websocketId.value,
        localCardData.value.model.provider || "openAi",
        localCardData.value.model.model || "gpt-4o",
        temperature,
        null,
        null,
        messageHistory,
        "prompt",
        false
      );
    };

    const sessionStatus = Vue.computed(() => {
      return sessions.value?.[websocketId.value]?.status || 'idle';
    });

    Vue.watch(sessionStatus, (newValue, oldValue) => {
      localCardData.value.status = newValue;
    })
    
    const partialMessage = Vue.computed(() => {
      if (sessions?.value) {
        const session = sessions.value[websocketId.value]; // Use the sessionId prop to access the correct session
        return session ? session?.partialMessage : "";
      } else return "";
    });

    const completedMessage = Vue.computed(() => {
      if (sessions?.value) {
        const session = sessions.value[websocketId.value]; // Use the sessionId prop to access the correct session
        return session ? session?.completedMessage : "";
      } else return "";
    });

    const errorMessage = Vue.computed(() => {
      if (sessions?.value) {
        const session = sessions.value[websocketId.value]; // Use the sessionId prop to access the correct session
        return session ? session?.errorMessage : "";
      } else return "";
    });

    Vue.watch(partialMessage, (newValue, oldValue) => {
      if (newValue && newValue.length) {
        localCardData.value.output = newValue;
      }
    });

    Vue.watch(completedMessage, (newValue, oldValue) => {
      if (newValue) {
        localCardData.value.output = newValue;
        
        if (localCardData.value.sockets?.outputs?.length) {
          localCardData.value.sockets.outputs[0].value = newValue;
        }
        emit("update-card", Vue.toRaw(localCardData.value));
    
        // Only trigger pending if session is actually complete
        if (triggerPending.value && sessionStatus.value === 'complete') {
          Vue.nextTick(() => {
            triggerAgent();
          });
        }
      }
    });
    
    Vue.watch(errorMessage, (newValue, oldValue) => {
      if (!oldValue?.length && newValue?.length) {
        localCardData.value.output = null;
        
        if (localCardData.value.sockets?.outputs?.length) {
          localCardData.value.sockets.outputs[0].value = null;
        }
        emit("update-card", Vue.toRaw(localCardData.value));
    
        // Handle pending trigger if session is in waiting/error state
        if (triggerPending.value && sessionStatus.value === 'waiting') {
          Vue.nextTick(() => {
            triggerAgent();
          });
        }
      }
    });

    const isJSON = (str) => {
      try {
        const obj = JSON.parse(str);
        return typeof obj === "object" && obj !== null;
      } catch (e) {
        return false;
      }
    };

    //Convert system and user prompts with the input value
    const resolveSocketContent = (html, sockets) => {
      if (!html || !sockets?.length) return html;

      try {
        // Create a socket map for faster lookups
        const socketMap = new Map(sockets.map((socket) => [socket.id, socket]));

        // Create a temporary DOM element to parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Find all socket tags
        const socketTags = doc.querySelectorAll("span.text-editor-tag");

        // Replace each socket tag with its corresponding value
        socketTags.forEach((tag) => {
          const socketId = tag.getAttribute("data-socket-id");
          const socket = socketMap.get(socketId);

          // If socket exists and has a value, replace with value, otherwise empty string
          let replacement = "";
          if (socket?.value?.content) {
            replacement = socket.value.content;
          } else if (socket?.value) {
            if (isJSON(socket.value)) {
              replacement = JSON.stringify(socket.value);
            } else {
              replacement = socket.value;
            }
          }
          // Create a text node with the replacement value
          const textNode = doc.createTextNode(replacement);
          tag.parentNode.replaceChild(textNode, tag);
        });

        // Return the body's inner HTML
        return doc.body.innerHTML;
      } catch (error) {
        console.error("Error resolving socket HTML:", error);
        return html; // Return original content on error
      }
    };

    // Add this computed property before initializing localCardData
    const inputSocketValues = Vue.computed(
      () =>
        localCardData.value.sockets?.inputs?.map((socket) => ({
          id: socket.id,
          value: socket.value,
          momentUpdated: socket.momentUpdated,
        })) || []
    );

    // Add this watcher after the other watchers but before onUnmounted
// Update socket watcher to use session status
Vue.watch(inputSocketValues, (newValues, oldValues) => {
  if (!localCardData.value.triggerOnInput || !oldValues) return;

  const hasValueChanged = newValues.some((newSocket, index) => {
    const oldSocket = oldValues[index];
    return oldSocket && JSON.stringify(newSocket.value) !== JSON.stringify(oldSocket.value);
  });

  if (hasValueChanged) {
    if (sessionStatus.value === 'inProgress') {
      triggerPending.value = true;
    } else {
      triggerAgent();
    }
  }
}, { deep: true });


    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData, oldData) => {
        if (!newData || isProcessing.value || !oldData) return;
        isProcessing.value = true;

        try {
          // Update position and output only if changed
          if (newData.x !== oldData.x) localCardData.value.x = newData.x;
          if (newData.y !== oldData.y) localCardData.value.y = newData.y;
          if (newData.output !== oldData.output) {
            localCardData.value.output = newData.output;
          }

          // Update socket values
          if (newData.sockets?.inputs) {
            newData.sockets.inputs.forEach((socket) => {
              const existingSocket = socketMap.value.get(socket.id);
              if (existingSocket) {
                existingSocket.value = socket.value;
              }
            });
          }
        } finally {
          isProcessing.value = false;
        }
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
      socketMap.value.clear();

      unregisterSession(websocketId.value);
    });

    return {
      localCardData,
      outputSocket,
      inputSockets,
      getSocketValue,
      getSocketConnections,
      hasSocketError,
      handlePromptChange,
      emitWithCardId,
      handleSocketMount,
      handleCardUpdate,
      handleSocketUpdate,
      handleHtmlUpdate,

      sessions,
      websocketId,
      triggerAgent,
      models,
      partialMessage,
      completedMessage,
    };
  },
};
