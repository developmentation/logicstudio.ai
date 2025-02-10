// GitHubCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import TreeViewer from "./TreeViewer.js";
import { useGitHub } from "../composables/useGitHub.js";
import {
  CardInitializer,
  SocketInitializer,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
} from "../utils/socketManagement/socketRemapping.js";


export default {
  name: "GitHubCard",
  components: { BaseCard, BaseSocket, TreeViewer },
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
    style="min-width: 500px;"
  >
        <!-- Input Socket for Trigger -->
        <div class="absolute -left-[12px]" style="top: 16px;">
          <BaseSocket
            type="input"
            :socket-id="localCardData.data.sockets.inputs[0].id"
            :card-id="localCardData.uuid"
            name="Trigger Input"
            :value="localCardData.data.sockets.inputs[0].value"
            :is-connected="getSocketConnections(localCardData.data.sockets.inputs[0].id)"
            :has-error="hasSocketError(localCardData.data.sockets.inputs[0].id)"
            :zoom-level="zoomLevel"
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Output Sockets -->
        <div 
          class="absolute -right-[12px] flex flex-col gap-1" 
          style="top: 16px;"
        >
          <div 
            v-for="(socket, index) in localCardData.data.sockets.outputs"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 6) + 'px)' }"
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
        <div class="space-y-4 text-gray-300 p-4" v-show="localCardData.ui.display === 'default'">
          <!-- Repository Info - Only shown before initial load -->
          <div v-if="!localCardData.data.treeData" class="space-y-4">
            <div class="space-y-1">
              <label class="text-xs text-gray-400">GitHub URL</label>
              <input
                v-model="localCardData.data.url"
                type="text"
                class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
                placeholder="Paste GitHub URL or owner/repo"
                @input="handleUrlInput"
                @mousedown.stop
              />
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Owner</label>
                <input
                  v-model="localCardData.data.owner"
                  type="text"
                  class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
                  placeholder="Owner"
                  @change="handleCardUpdate"
                  @mousedown.stop
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Repository</label>
                <input
                  v-model="localCardData.data.repo"
                  type="text"
                  class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
                  placeholder="Repository"
                  @change="handleCardUpdate"
                  @mousedown.stop
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-400">Branch</label>
                <input
                  v-model="localCardData.data.branch"
                  type="text"
                  class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
                  placeholder="Branch (default: main)"
                  @change="handleCardUpdate"
                  @mousedown.stop
                />
              </div>
            </div>

            <!-- Token Input -->
            <div class="space-y-1">
              <label class="text-xs text-gray-400">GitHub Token (Optional)</label>
              <input
                v-model="localCardData.data.token"
                type="password"
                class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded border border-gray-800"
                placeholder="Enter GitHub token for private repos"
                @change="handleCardUpdate"
                @mousedown.stop
              />
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
                {{ localCardData.data.owner }}/{{ localCardData.data.repo }} ({{ localCardData.data.branch }})
              </div>
              <button 
                class="text-xs text-gray-400 hover:text-white"
                @click="resetRepository"
              >
                Change Repository
              </button>
            </div>

            <!-- Refresh Selected Button -->
            <div class="flex justify-center">
              <button 
                class="px-6 py-2 text-sm font-medium rounded bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
                @click="refreshSelected"
                :disabled="!hasSelectedFiles || isProcessing"
              >
                {{ isProcessing ? 'Refreshing...' : 'Refresh Selected' }}
              </button>
            </div>

            <!-- Tree View -->
            <div class="bg-gray-900 rounded p-2">
              <TreeViewer
                v-model:selectedKeys="localCardData.data.selectedNodes"
                :nodes="localCardData.data.treeData"
                :expandedKeys="localCardData.data.expandedNodes"
                @node-select="handleNodeSelect"
                @node-unselect="handleNodeUnselect"
                @node-expand="handleNodeExpand"
                @node-collapse="handleNodeCollapse"
              />
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const { loadGitHubContent, loadFileContent } = useGitHub();
    
    // Initialize card setup utilities
    const {
      socketRegistry,
      connections,
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    // Define additional utility functions
    const hasSocketError = () => false; // GitHub card doesn't implement socket errors
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Initialize local card data with default configuration
    const localCardData = Vue.ref(
      CardInitializer.initializeCardData(props.cardData, {
        name: "GitHub Card",
        description: "GitHub Repository Browser",
        defaultData: {
          url: "",
          owner: "developmentation",
          repo: "logicstudio.ai",
          branch: "main",
          token: "",
          trigger: null,
          treeData: null,
          selectedNodes: {},
          expandedNodes: {},
          loadedFiles: new Set(),
        },
        defaultSockets: {
          inputs: [{ name: "Trigger Input" }],
          outputs: []
        }
      })
    );

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



    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: async ({ type, content }) => {
        if (type === "modified" && content.old.value !== content.new.value) {
          localCardData.value.data.trigger = Date.now();
          
          if (!localCardData.value.data.treeData) {
            await loadRepository();
          } else if (hasSelectedFiles.value) {
            await refreshSelected();
          }
        }
      },
      onOutputChange: ({ type, content }) => {
        // Handle output socket changes if needed
      }
    });

    // Card-specific computed properties
    const canLoadRepo = Vue.computed(() => {
      return localCardData.value.data.owner && localCardData.value.data.repo;
    });

    const hasSelectedFiles = Vue.computed(() => {
      if (!localCardData.value.data.selectedNodes) return false;
      return Object.keys(localCardData.value.data.selectedNodes).some((key) => {
        const node = findNodeByPath(localCardData.value.data.treeData, key);
        return node && node.leaf;
      });
    });

    // Card-specific methods
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    // GitHub-specific utility functions
    const parseGitHubUrl = (url) => {
      if (!url) return null;
      const patterns = [
        {
          name: "HTTPS format",
          regex: /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)$/,
        },
        {
          name: "SSH format",
          regex: /^git@github\.com:([^\/]+)\/([^\/]+?)$/,
        },
        {
          name: "Simple format",
          regex: /^([^\/]+)\/([^\/]+?)$/,
        },
      ];

      for (const pattern of patterns) {
        const match = url.trim().match(pattern.regex);
        if (match) {
          const repo = match[2].replace(/\.git$/, "");
          return {
            owner: match[1],
            repo: repo,
          };
        }
      }

      return null;
    };

    const handleUrlInput = () => {
      const parsed = parseGitHubUrl(localCardData.value.data.url);
      if (parsed) {
        localCardData.value.data.owner = parsed.owner;
        localCardData.value.data.repo = parsed.repo;
        handleCardUpdate();
      }
    };

    // Node tree utility functions
    const findNodeByPath = (nodes, path) => {
      for (const node of nodes) {
        // Check both key and data.path
        if (node.key === path || node.data.path === path) {
          return node;
        }
        if (node.children) {
          const found = findNodeByPath(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };
    const updateNodeStatus = (node, status) => {
      if (!node?.data) return;

      node.data.status = status;

      const updateParentStatus = (nodes, targetPath) => {
        const pathParts = targetPath.split("/");
        pathParts.pop();

        while (pathParts.length > 0) {
          const parentPath = pathParts.join("/");
          const parentNode = findNodeByPath(nodes, parentPath);

          if (parentNode) {
            const allChildrenStatus = getAllChildrenStatus(parentNode);
            if (allChildrenStatus.length === 0) {
              parentNode.data.status = "idle";
            } else if (allChildrenStatus.every((s) => s === "loaded")) {
              parentNode.data.status = "loaded";
            } else if (allChildrenStatus.some((s) => s === "loading")) {
              parentNode.data.status = "loading";
            } else if (allChildrenStatus.some((s) => s === "error")) {
              parentNode.data.status = "error";
            } else {
              parentNode.data.status = "idle";
            }
          }
          pathParts.pop();
        }
      };

      updateParentStatus(localCardData.value.data.treeData, node.data.path);
    };

    const getAllChildrenStatus = (node) => {
      const statuses = [];
      const traverse = (n) => {
        if (n.leaf) {
          if (localCardData.value.data.selectedNodes[n.data.path]) {
            statuses.push(n.data.status || "idle");
          }
        } else if (n.children) {
          n.children.forEach(traverse);
        }
      };
      traverse(node);
      return statuses;
    };

 
    // Repository management functions
    const loadRepository = async () => {
      if (!canLoadRepo.value || isProcessing.value) return;

      isProcessing.value = true;
      try {
        const result = await loadGitHubContent(
          localCardData.value.data.owner,
          localCardData.value.data.repo,
          localCardData.value.data.branch,
          localCardData.value.data.token
        );

        if (result?.treeData) {
          const addStatusToNodes = (nodes) => {
            nodes.forEach((node) => {
              node.data.status = "idle";
              if (node.children) {
                addStatusToNodes(node.children);
              }
            });
          };

          addStatusToNodes(result.treeData);

          localCardData.value.data.treeData = result.treeData;
          localCardData.value.data.selectedNodes = {};
          localCardData.value.data.expandedNodes = {};
          localCardData.value.data.loadedFiles = new Set();
          localCardData.value.data.sockets.outputs = [];

          handleCardUpdate();

          if (hasSelectedFiles.value) {
            await refreshSelected();
          }
        }
      } catch (error) {
        console.error("Error loading repository:", error);
      } finally {
        isProcessing.value = false;
      }
    };

    const resetRepository = () => {
      localCardData.value.data.treeData = null;
      localCardData.value.data.selectedNodes = {};
      localCardData.value.data.expandedNodes = {};
      localCardData.value.data.loadedFiles = new Set();
      localCardData.value.data.sockets.outputs = [];
      handleCardUpdate();
    };

    const refreshSelected = async () => {
      if (!hasSelectedFiles.value || isProcessing.value) return;

      isProcessing.value = true;

      try {
        const selectedPaths = Object.keys(
          localCardData.value.data.selectedNodes
        ).filter((key) => {
          const node = findNodeByPath(localCardData.value.data.treeData, key);
          return node && node.leaf;
        });

        selectedPaths.forEach((path) => {
          const node = findNodeByPath(localCardData.value.data.treeData, path);
          if (node) {
            updateNodeStatus(node, "idle");
            localCardData.value.data.loadedFiles.delete(path);
          }
        });

        await loadSelectedFiles(selectedPaths);
      } catch (error) {
        console.error("Error refreshing selected files:", error);
      } finally {
        isProcessing.value = false;
      }
    };


// GitHubCard - update loadSelectedFiles
const loadSelectedFiles = async (selectedPaths) => {
  if (!selectedPaths.length) return;

  const filesToLoad = selectedPaths.filter(
    (path) => !localCardData.value.data.loadedFiles.has(path)
  );

  let loadResults = null;

  try {
    if (filesToLoad.length) {
      const fileObjects = filesToLoad.map((path) => {
        const node = findNodeByPath(localCardData.value.data.treeData, path);
        if (!node) {
          throw new Error(`Node not found for path: ${path}`);
        }
        updateNodeStatus(node, "loading");
        return {
          name: node.label,
          path: path,
          download_url: node.data.download_url,
        };
      });

      loadResults = await loadFileContent(fileObjects, localCardData.value.data.token);

      if (loadResults?.successful) {
        loadResults.successful.forEach((file) => {
          const node = findNodeByPath(localCardData.value.data.treeData, file.path);
          if (node) {
            updateNodeStatus(node, "loaded");
            localCardData.value.data.loadedFiles.add(file.path);
          }
        });
      }
    }

    // Get all currently selected paths from selectedNodes
    const allSelectedPaths = Object.keys(localCardData.value.data.selectedNodes)
      .filter(key => {
        const node = findNodeByPath(localCardData.value.data.treeData, key);
        return node?.leaf;
      })
      .map(key => {
        const node = findNodeByPath(localCardData.value.data.treeData, key);
        return node.data.path;
      });

    // Get current outputs for comparison
    const oldSockets = [...localCardData.value.data.sockets.outputs];

    // Create new sockets array preserving existing socket values
    const newSockets = allSelectedPaths.map((path, index) => {
      const existingSocket = oldSockets.find((s) => s.path === path);
      const node = findNodeByPath(localCardData.value.data.treeData, path);
      const fileName = node?.label || path.split("/").pop();

      if (existingSocket) {
        // Preserve existing socket
        return {
          ...existingSocket,
          index,
        };
      } else {
        // Create new socket only for newly loaded files
        const loadedFile = loadResults?.successful?.find((f) => f.path === path);
        return {
          id: `${localCardData.value.uuid}-output-${index}`,
          type: "output",
          name: fileName,
          path: path,
          index,
          value: loadedFile?.content || null,
          momentUpdated: Date.now()
        };
      }
    });

    // Calculate deleted socket IDs
    const deletedSocketIds = oldSockets
      .filter((s) => !newSockets.find((ns) => ns.path === s.path))
      .map((s) => s.id);

    // Update socket array with proper remapping
    const { reindexMap, reindexedSockets } = updateSocketArray({
      oldSockets,
      newSockets,
      type: "output",
      socketRegistry,
      connections: connections.value,
      deletedSocketIds,
    });

    localCardData.value.data.sockets.outputs = reindexedSockets;

    // Emit socket update event
    emit(
      "sockets-updated",
      createSocketUpdateEvent({
        cardId: localCardData.value.uuid,
        oldSockets,
        newSockets: reindexedSockets,
        reindexMap,
        deletedSocketIds,
        type: "output",
      })
    );

    handleCardUpdate();
  } catch (error) {
    console.error("Error loading files:", error);
    filesToLoad.forEach((path) => {
      const node = findNodeByPath(localCardData.value.data.treeData, path);
      if (node) {
        updateNodeStatus(node, "error");
      }
    });
    handleCardUpdate();
  }
};
    
const handleNodeSelect = async (event) => {
  const selectedPaths = [];
  
  if (event.affectedKeys) {
    event.affectedKeys.forEach(key => {
      const node = findNodeByPath(localCardData.value.data.treeData, key);
      if (node?.leaf) {
        selectedPaths.push(node.data.path);
      }
    });
  }

  if (selectedPaths.length) {
    await loadSelectedFiles(selectedPaths);
  }
};

const handleNodeUnselect = (event) => {
  const pathsToRemove = new Set();
  const affectedKeys = event.affectedKeys || [event.node?.key];
  
  affectedKeys.forEach(key => {
      const node = findNodeByPath(localCardData.value.data.treeData, key);
      if (node?.leaf) {
          pathsToRemove.add(node.data.path);
          updateNodeStatus(node, "idle");
          localCardData.value.data.loadedFiles.delete(node.data.path);
          // Also ensure selection state is cleared
          delete localCardData.value.data.selectedNodes[node.key];
      }
  });

  if (pathsToRemove.size === 0) return;

  // Remove sockets for unselected files
  const oldSockets = [...localCardData.value.data.sockets.outputs];
  const newSockets = oldSockets.filter(socket => !pathsToRemove.has(socket.path));
  const deletedSocketIds = oldSockets
      .filter(socket => pathsToRemove.has(socket.path))
      .map(socket => socket.id);

  const { reindexMap, reindexedSockets } = updateSocketArray({
      oldSockets,
      newSockets,
      type: "output",
      socketRegistry,
      connections: connections.value,
      deletedSocketIds,
  });

  localCardData.value.data.sockets.outputs = reindexedSockets;

  emit(
      "sockets-updated",
      createSocketUpdateEvent({
          cardId: localCardData.value.uuid,
          oldSockets,
          newSockets: reindexedSockets,
          reindexMap,
          deletedSocketIds,
          type: "output",
      })
  );

  handleCardUpdate();
};
    const handleNodeExpand = (event) => {
      localCardData.value.data.expandedNodes[event.key] = true;
      handleCardUpdate();
    };

    const handleNodeCollapse = (event) => {
      delete localCardData.value.data.expandedNodes[event.key];
      handleCardUpdate();
    };

    // Lifecycle hooks
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    Vue.onUnmounted(cleanup);

    return {
      localCardData,
      isProcessing,
      canLoadRepo,
      hasSelectedFiles,
      getSocketConnections,
      hasSocketError,
      handleSocketMount,
      emitWithCardId,
      handleCardUpdate,
      handleUrlInput,
      loadRepository,
      resetRepository,
      refreshSelected,
      handleNodeSelect,
      handleNodeUnselect,
      handleNodeExpand,
      handleNodeCollapse,
    };
  },
};