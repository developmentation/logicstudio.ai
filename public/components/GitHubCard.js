// GitHubCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useGitHub } from "../composables/useGitHub.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
} from '../utils/socketManagement/socketRemapping.js';

export default {
  name: "GitHubCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false }
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
        style="width: 650px;"
      >
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
    <!-- Content -->
<div class="space-y-4 text-gray-300 p-4" v-show="localCardData.display == 'default'">
  <!-- Repository Info - Only shown before initial load -->
  <div v-if="!treeData" class="space-y-4">
    <div class="grid grid-cols-3 gap-2">
      <div class="space-y-1">
        <label class="text-xs text-gray-400">Owner</label>
        <input
          v-model="localCardData.owner"
          type="text"
          class="w-full bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
          placeholder="Owner"
          @change="handleCardUpdate"
          @mousedown.stop
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-gray-400">Repository</label>
        <input
          v-model="localCardData.repo"
          type="text"
          class="w-full bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
          placeholder="Repository"
          @change="handleCardUpdate"
          @mousedown.stop
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-gray-400">Branch</label>
        <input
          v-model="localCardData.branch"
          type="text"
          class="w-full bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded"
          placeholder="Branch (default: main)"
          @change="handleCardUpdate"
          @mousedown.stop
        />
      </div>
    </div>
    
    <!-- Load Repository Button -->
    <div class="flex justify-center">
      <button 
        class="px-6 py-2 text-sm font-medium rounded"
        :class="isProcessing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'"
        @click="loadRepository"
        :disabled="isProcessing || !canLoadRepo"
      >
        {{ isProcessing ? 'Loading Repository...' : 'Load Repository' }}
      </button>
    </div>
  </div>

  <!-- Repository Content - Only shown after initial load -->
  <div v-else class="space-y-4">
    <!-- Repository Info Display -->
    <div class="flex items-center justify-between bg-gray-800 p-2 rounded">
      <div class="text-xs text-gray-400">
        {{ localCardData.owner }}/{{ localCardData.repo }} ({{ localCardData.branch }})
      </div>
      <button 
        class="text-xs text-gray-400 hover:text-white"
        @click="resetRepository"
      >
        Change Repository
      </button>
    </div>

    <!-- Options -->
    <div class="flex items-center justify-between">
      <label class="flex items-center gap-2">
        <input 
          type="checkbox" 
          v-model="localCardData.isRecursive"
          @change="handleCardUpdate"
          class="form-checkbox" 
        />
        <span class="text-xs text-gray-400">Recursive</span>
      </label>
      <label class="flex items-center gap-2">
        <input 
          type="checkbox" 
          v-model="localCardData.autoLoad"
          @change="handleCardUpdate"
          class="form-checkbox" 
        />
        <span class="text-xs text-gray-400">Automatically load contents</span>
      </label>
    </div>

    <!-- Tree View -->
    <div class="bg-gray-900 rounded p-2">
      <Tree
        v-model:selectionKeys="selectedNodes"
        :value="treeData.children"
        selectionMode="checkbox"
        class="text-xs"
        :pt="{
          root: { class: 'dark-tree' },
          container: { class: 'dark-tree-container' },
          nodeContainer: { class: 'dark-tree-node-container' },
          node: { class: 'dark-tree-node' },
          content: { class: 'dark-tree-content' },
          toggler: { 
            class: ['dark-tree-toggler', 'pi', 'text-gray-400'],
            style: 'color: rgb(156, 163, 175) !important'
          },
          checkbox: { 
            class: 'dark-tree-checkbox',
            style: 'background-color: rgb(31, 41, 55) !important; border: 1px solid rgb(75, 85, 99) !important'
          },
          nodeicon: { class: 'dark-tree-icon pi text-gray-400' },
          label: { 
            class: 'dark-tree-label',
            style: 'color: rgb(255, 255, 255) !important'
          }
        }"
        @nodeSelect="handleNodeSelect"
        @nodeUnselect="handleNodeUnselect"
      />
    </div>

    <!-- Load Files Button -->
    <div class="flex justify-center">
      <button 
        class="px-6 py-2 text-sm font-medium rounded"
        :class="isProcessing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'"
        @click="handleLoad"
        :disabled="isProcessing || !canLoadFiles"
      >
        {{ loadButtonText }}
      </button>
    </div>
  </div>
</div>

      </BaseCard>
    </div>
  `,
  
  setup(props, { emit }) {
    const { loadGitHubContent, loadFileContent } = useGitHub();
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);
    const selectedNodes = Vue.ref({});
    const treeData = Vue.ref(null);

    // Initialize card data
    const initializeCardData = (data) => ({
      uuid: data.uuid,
      name: data.name || "GitHub Card",
      description: data.description || "GitHub Repository Browser",
      display: data.display || "default",
      x: data.x || 0,
      y: data.y || 0,
      owner: data.owner || "",
      repo: data.repo || "",
      branch: data.branch || "main",
      isRecursive: data.isRecursive || false,
      autoLoad: data.autoLoad || false,
      selectedFiles: data.selectedFiles || [],
      sockets: {
        outputs: data.sockets?.outputs || []
      }
    });

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Computed properties
    const canLoadRepo = Vue.computed(() => {
      return localCardData.value.owner && localCardData.value.repo;
    });

    const canLoadFiles = Vue.computed(() => {
      return Object.keys(selectedNodes.value).length > 0;
    });

    const loadButtonText = Vue.computed(() => {
      if (isProcessing.value) return "Loading...";
      return "Load Selected Files";
    });

    // Reset repository state
    const resetRepository = () => {
      treeData.value = null;
      selectedNodes.value = {};
      localCardData.value.sockets.outputs = [];
      handleCardUpdate();
    };

    // Socket management
    const getSocketConnections = (socketId) => connections.value.has(socketId);
    const hasSocketError = () => false;

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, { element: event.element, cleanup: [] });
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Tree node selection handlers
    const handleNodeSelect = async (node) => {
      if (localCardData.value.isRecursive && !node.leaf) {
        // Recursively select all child nodes
        const selectChildren = (node) => {
          if (node.children) {
            node.children.forEach(child => {
              selectedNodes.value[child.key] = true;
              if (!child.leaf) {
                selectChildren(child);
              }
            });
          }
        };
        selectChildren(node);
      }

      if (localCardData.value.autoLoad) {
        await processSelectedNodes();
      }

      handleCardUpdate();
    };

    const handleNodeUnselect = async (node) => {
      if (localCardData.value.isRecursive && !node.leaf) {
        // Recursively unselect all child nodes
        const unselectChildren = (node) => {
          if (node.children) {
            node.children.forEach(child => {
              delete selectedNodes.value[child.key];
              if (!child.leaf) {
                unselectChildren(child);
              }
            });
          }
        };
        unselectChildren(node);
      }

      // Remove corresponding sockets
      const oldSockets = [...localCardData.value.sockets.outputs];
      const newSockets = oldSockets.filter(socket => 
        socket.path !== node.data.path
      );

      updateSockets(oldSockets, newSockets);
      handleCardUpdate();
    };

    // Load repository content
    const loadRepository = async () => {
      if (!localCardData.value.owner || !localCardData.value.repo) return;

      isProcessing.value = true;
      try {
        const result = await loadGitHubContent(
          localCardData.value.owner,
          localCardData.value.repo,
          localCardData.value.branch
        );

        if (result?.treeData) {
          treeData.value = result.treeData;
        }
      } catch (error) {
        console.error("Error loading repository:", error);
      } finally {
        isProcessing.value = false;
      }
    };

    // Process selected nodes
    const processSelectedNodes = async () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const selectedFiles = [];
        const processNode = (node) => {
          if (node.leaf && selectedNodes.value[node.key]) {
            selectedFiles.push({
              name: node.label,
              path: node.data.path,
              download_url: node.data.download_url
            });
          }
          if (node.children) {
            node.children.forEach(processNode);
          }
        };

        treeData.value.children.forEach(processNode);

        if (selectedFiles.length > 0) {
          const result = await loadFileContent(selectedFiles);
          if (result?.successful) {
            // Update sockets with file contents
            const oldSockets = [...localCardData.value.sockets.outputs];
            const newSockets = result.successful.map((file, index) => ({
              ...createSocket({
                type: 'output',
                index,
                value: file.content
              }),
              name: file.name,
              path: file.path
            }));

            updateSockets(oldSockets, newSockets);
          }
        }
      } catch (error) {
        console.error("Error processing selected nodes:", error);
      } finally {
        isProcessing.value = false;
        handleCardUpdate();
      }
    };

    // Update sockets helper
    const updateSockets = (oldSockets, newSockets) => {
      const { reindexMap, reindexedSockets } = updateSocketArray({
        oldSockets,
        newSockets,
        type: 'output',
        socketRegistry,
        connections: connections.value
      });

      localCardData.value.sockets.outputs = reindexedSockets;

      emit('sockets-updated', createSocketUpdateEvent({
        cardId: localCardData.value.uuid,
        oldSockets,
        newSockets: reindexedSockets,
        reindexMap,
        deletedSocketIds: [],
        type: 'output'
      }));
    };

    // Button handlers
    const handleLoad = () => {
      processSelectedNodes();
    };

    const handleCardUpdate = () => {
      emit('update-card', Vue.toRaw(localCardData.value));
    };

 

    // Watch for card data changes
    Vue.watch(() => props.cardData, (newData) => {
      if (!newData || isProcessing.value) return;
      
      const updatedData = { ...localCardData.value };
      if (newData.x !== undefined) updatedData.x = newData.x;
      if (newData.y !== undefined) updatedData.y = newData.y;
      
      localCardData.value = updatedData;
    }, { deep: true });

    // Cleanup
    Vue.onUnmounted(() => {
      socketRegistry.forEach(socket => socket.cleanup.forEach(cleanup => cleanup()));
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
        localCardData,
        treeData,
        selectedNodes,
        isProcessing,
        canLoadRepo,
        canLoadFiles,
        loadButtonText,
        getSocketConnections,
        hasSocketError,
        handleSocketMount,
        emitWithCardId,
        handleNodeSelect,
        handleNodeUnselect,
        handleLoad,
        handleCardUpdate,
        loadRepository,
        resetRepository
      };
  }
};