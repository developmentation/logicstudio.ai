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
        <div class="space-y-4 text-gray-300 p-4" v-show="localCardData.display == 'default'">
          <!-- Repository Info - Only shown before initial load -->
          <div v-if="!localCardData.treeData" class="space-y-4">
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
                v-model:selectionKeys="localCardData.selectedNodes"
                :value="localCardData.treeData"
                selectionMode="checkbox"
                :expandedKeys="localCardData.expandedNodes"
                class="custom-tree"
                @node-select="handleNodeSelect"
                @node-unselect="handleNodeUnselect"
                @node-expand="handleNodeExpand"
                @node-collapse="handleNodeCollapse"
              >
              
              </Tree>
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

    // Initialize card data
    const initializeCardData = (data) => ({
        uuid: data.uuid,
        name: data.name || "GitHub Card",
        description: data.description || "GitHub Repository Browser",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,

        owner: data.owner || "developmentation",
        repo: data.repo || "logicstudio.ai",
        branch: data.branch || "main",

        treeData: data.treeData || null,
        selectedNodes: data.selectedNodes || {},
        expandedNodes: data.expandedNodes || {},
        selectedFiles: data.selectedFiles || [],

        isRecursive: data.isRecursive || false,
        autoLoad: data.autoLoad || false,

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
        return Object.keys(localCardData.value.selectedNodes).length > 0;
    });

    const loadButtonText = Vue.computed(() => {
        if (isProcessing.value) return "Loading...";
        const selectedCount = Object.keys(localCardData.value.selectedNodes).length;
        return `Load Selected Files (${selectedCount})`;
    });

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

    // Node expansion handlers
    const handleNodeExpand = (event) => {
        localCardData.value.expandedNodes[event.key] = true;
    };

    const handleNodeCollapse = (event) => {
        delete localCardData.value.expandedNodes[event.key];
    };

    const initializeExpandedState = (nodes) => {
        if (!nodes) return;
        nodes.forEach(node => {
            if (!node.leaf) {
                localCardData.value.expandedNodes[node.key] = true;
                if (node.children) {
                    initializeExpandedState(node.children);
                }
            }
        });
    };

    // Tree node selection handlers
    const handleNodeSelect = async (event) => {
        const node = event.node;
        if (localCardData.value.isRecursive && !node.leaf) {
            // Recursively select all child nodes
            const selectChildren = (node) => {
                if (node.children) {
                    node.children.forEach(child => {
                        localCardData.value.selectedNodes[child.key] = true;
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

    const handleNodeUnselect = async (event) => {
        const node = event.node;
        if (localCardData.value.isRecursive && !node.leaf) {
            // Recursively unselect all child nodes
            const unselectChildren = (node) => {
                if (node.children) {
                    node.children.forEach(child => {
                        delete localCardData.value.selectedNodes[child.key];
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
    
            if (result?.treeData) {  // Changed from result?.payload?.treeData
                localCardData.value.treeData = result.treeData;
                localCardData.value.selectedNodes = {};
                localCardData.value.expandedNodes = {};
                // initializeExpandedState(result.treeData);
            } else {
                console.error("Invalid tree data received:", result);
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
            const findSelectedFiles = (nodes) => {
                if (!nodes) return;
                nodes.forEach(node => {
                    if (node.leaf && localCardData.value.selectedNodes[node.key]) {
                        selectedFiles.push({
                            name: node.label,
                            path: node.data.path,
                            download_url: node.data.download_url
                        });
                    }
                    if (node.children) {
                        findSelectedFiles(node.children);
                    }
                });
            };

            findSelectedFiles(localCardData.value.treeData);

            if (selectedFiles.length > 0) {
                const result = await loadFileContent(selectedFiles);
                if (result?.successful) {
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

    // Reset repository state
    const resetRepository = () => {
        localCardData.value.treeData = null;
        localCardData.value.selectedNodes = {};
        localCardData.value.expandedNodes = {};
        localCardData.value.sockets.outputs = [];
        handleCardUpdate();
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
        handleNodeExpand,
        handleNodeCollapse,
        handleLoad,
        handleCardUpdate,
        loadRepository,
        resetRepository
    };
}
};