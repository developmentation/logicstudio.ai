// GitHubCard.js
import BaseCard from "../BaseCard.js";
import BaseSocket from "../BaseSocket.js";
import { useGitHub } from "../../composables/useGitHub.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
} from "../../utils/socketManagement/socketRemapping.js";

export default {
  name: "GitHubCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
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
        style="min-width: 500px;"
      >
        <!-- Input Socket for Trigger -->
        <div class="absolute -left-[12px]" style="top: 16px;">
          <BaseSocket
            type="input"
            :socket-id="localCardData.sockets.inputs[0].id"
            :card-id="localCardData.uuid"
            name="Trigger Input"
            :value="localCardData.sockets.inputs[0].value"
            :is-connected="getSocketConnections(localCardData.sockets.inputs[0].id)"
            :has-error="hasSocketError(localCardData.sockets.inputs[0].id)"
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
            v-for="(socket, index) in localCardData.sockets.outputs"
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
        <div class="space-y-4 text-gray-300 p-4" v-show="localCardData.display == 'default'">
          <!-- Repository Info - Only shown before initial load -->
          <div v-if="!localCardData.treeData" class="space-y-4">

            <div class="space-y-1">
              <label class="text-xs text-gray-400">GitHub URL</label>
              <input
                v-model="localCardData.url"
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
                  v-model="localCardData.owner"
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
                  v-model="localCardData.repo"
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
                  v-model="localCardData.branch"
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
                v-model="localCardData.token"
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
                {{ localCardData.owner }}/{{ localCardData.repo }} ({{ localCardData.branch }})
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
              <Tree
                v-model:selectionKeys="localCardData.selectedNodes"
                :value="localCardData.treeData"
                selectionMode="checkbox"
                :propagateSelectionDown="true"
                :propagateSelectionUp="true"
                :metaKeySelection="false"
                :expandedKeys="localCardData.expandedNodes"
                class="custom-tree"
                @node-select="handleNodeSelect"
                @node-unselect="handleNodeUnselect"
                @node-expand="handleNodeExpand"
                @node-collapse="handleNodeCollapse"
              >
                <template #default="{ node }">
                  <div class="flex items-center gap-2">
                    <span>{{ node.label }}</span>
                    <span 
                      v-if="node.data.status"
                      class="w-2 h-2 rounded-full"
                      :class="{
                        'bg-gray-500': node.data.status === 'idle',
                        'bg-yellow-500': node.data.status === 'loading',
                        'bg-green-500': node.data.status === 'loaded',
                        'bg-red-500': node.data.status === 'error'
                      }"
                    ></span>
                  </div>
                </template>
              </Tree>
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

    // Initialize card data
    const initializeCardData = (data) => {
      const createLoadedFilesSet = (loadedFiles) => {
        if (!loadedFiles) return new Set();
        if (loadedFiles instanceof Set) return loadedFiles;
        if (Array.isArray(loadedFiles)) return new Set(loadedFiles);
        if (typeof loadedFiles === "object") {
          return new Set(Object.values(loadedFiles));
        }
        return new Set();
      };

      const baseData = {
        uuid: data.uuid,
        name: data.name || "GitHub Card",
        description: data.description || "GitHub Repository Browser",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        url: data.url || "",
        owner: data.owner || "",
        repo: data.repo || "",
        branch: data.branch || "main",
        token: data.token || "",
        trigger: data.trigger || null,
        treeData: data.treeData || null,
        selectedNodes: data.selectedNodes || {},
        expandedNodes: data.expandedNodes || {},
        loadedFiles: createLoadedFilesSet(data.loadedFiles),

        sockets: {
          inputs: [
            createSocket({
              type: "input",
              index: 0,
              existingId: data.sockets?.inputs?.[0]?.id,
              value: data.sockets?.inputs?.[0]?.value,
            }),
          ],
          outputs: [],
        },
      };

      // Initialize outputs if they exist, preserving all socket data
      if (data.sockets?.outputs?.length) {
        baseData.sockets.outputs = data.sockets.outputs.map(
          (socket, index) => ({
            ...createSocket({
              type: "output",
              index,
              existingId: socket.id,
              value: socket.value,
            }),
            name: socket.name,
            path: socket.path,
          })
        );
      }

      // Emit initial socket registration
      emit(
        "sockets-updated",
        createSocketUpdateEvent({
          cardId: data.uuid,
          oldSockets: [],
          newSockets: [...baseData.sockets.inputs, ...baseData.sockets.outputs],
          reindexMap: new Map(),
          deletedSocketIds: [],
          type: "output",
        })
      );

      return baseData;
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Computed properties
    const canLoadRepo = Vue.computed(() => {
      return localCardData.value.owner && localCardData.value.repo;
    });

    // Socket management
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

    // Find node by path in tree
    const findNodeByPath = (nodes, path) => {
      for (const node of nodes) {
        if (node.data.path === path) {
          return node;
        }
        if (node.children) {
          const found = findNodeByPath(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    // Update node status in tree, including parent folders
    // Update node status in tree, including parent folders
    const updateNodeStatus = (node, status) => {
      if (!node?.data) return;

      node.data.status = status;

      // Update parent folder statuses
      const updateParentStatus = (nodes, targetPath) => {
        const pathParts = targetPath.split("/");
        pathParts.pop(); // Remove file name

        while (pathParts.length > 0) {
          const parentPath = pathParts.join("/");
          const parentNode = findNodeByPath(nodes, parentPath);

          if (parentNode) {
            const allChildrenStatus = getAllChildrenStatus(parentNode);
            if (allChildrenStatus.length === 0) {
              // If no children have status (all unselected), set parent to idle
              parentNode.data.status = "idle";
            } else if (allChildrenStatus.every((s) => s === "loaded")) {
              parentNode.data.status = "loaded";
            } else if (allChildrenStatus.some((s) => s === "loading")) {
              parentNode.data.status = "loading";
            } else if (allChildrenStatus.some((s) => s === "error")) {
              parentNode.data.status = "error";
            } else {
              // If children are mix of idle/unselected, set to idle
              parentNode.data.status = "idle";
            }
          }
          pathParts.pop();
        }
      };

      updateParentStatus(localCardData.value.treeData, node.data.path);
    };

    // Get status of all children in a folder
    const getAllChildrenStatus = (node) => {
      const statuses = [];
      const traverse = (n) => {
        if (n.leaf) {
          // Only include status if the node is selected
          if (localCardData.value.selectedNodes[n.data.path]) {
            statuses.push(n.data.status || "idle");
          }
        } else if (n.children) {
          n.children.forEach(traverse);
        }
      };
      traverse(node);
      return statuses;
    };
    // Get all files in tree order
    const getAllFilesInOrder = (nodes, selectedOnly = true) => {
      const files = [];
      const traverse = (node) => {
        if (node.leaf) {
          if (!selectedOnly || localCardData.value.selectedNodes[node.key]) {
            files.push({
              path: node.data.path,
              name: node.data.path, // Use full path as name
              node: node,
            });
          }
        } else if (node.children) {
          node.children.forEach(traverse);
        }
      };

      nodes.forEach(traverse);
      return files;
    };

    // Load file content and update sockets
    const loadSelectedFiles = async (selectedPaths) => {
      if (!selectedPaths.length) return;

      const filesToLoad = selectedPaths.filter(
        (path) => !localCardData.value.loadedFiles.has(path)
      );

      let loadResults = null; // Define result variable in proper scope

      try {
        // Load new files
        if (filesToLoad.length) {
          const fileObjects = filesToLoad.map((path) => {
            const node = findNodeByPath(localCardData.value.treeData, path);
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

          loadResults = await loadFileContent(
            fileObjects,
            localCardData.value.token
          );

          if (loadResults?.successful) {
            loadResults.successful.forEach((file) => {
              const node = findNodeByPath(
                localCardData.value.treeData,
                file.path
              );
              if (node) {
                updateNodeStatus(node, "loaded");
                localCardData.value.loadedFiles.add(file.path);
              }
            });
          }
        }

        // Get all selected paths in tree order
        const allSelectedPaths = Object.keys(
          localCardData.value.selectedNodes
        ).filter((key) => {
          const node = findNodeByPath(localCardData.value.treeData, key);
          return node && node.leaf;
        });

        // Prepare socket arrays, carefully preserving existing data
        const oldSockets = [...localCardData.value.sockets.outputs];
        const newSockets = allSelectedPaths.map((path, index) => {
          const existingSocket = oldSockets.find((s) => s.path === path);
          const node = findNodeByPath(localCardData.value.treeData, path);
          const fileName = node?.label || path.split("/").pop();

          // Check if this is a newly loaded file
          const loadedFile = filesToLoad.includes(path)
            ? loadResults?.successful?.find((f) => f.path === path)
            : null;

          if (existingSocket) {
            // Preserve existing socket data, only update if it's a newly loaded file
            return {
              ...existingSocket,
              index,
              name: fileName,
              value: loadedFile ? loadedFile.content : existingSocket.value,
            };
          }

          // Create new socket for newly selected files
          return {
            ...createSocket({
              type: "output",
              index,
              value: loadedFile?.content || null,
            }),
            name: fileName,
            path,
          };
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

        localCardData.value.sockets.outputs = reindexedSockets;

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
          const node = findNodeByPath(localCardData.value.treeData, path);
          if (node) {
            updateNodeStatus(node, "error");
          }
        });

        // Clean up any affected sockets
        const oldSockets = [...localCardData.value.sockets.outputs];
        const affectedSockets = oldSockets.filter((s) =>
          filesToLoad.includes(s.path)
        );

        if (affectedSockets.length) {
          emit(
            "sockets-updated",
            createSocketUpdateEvent({
              cardId: localCardData.value.uuid,
              oldSockets,
              newSockets: oldSockets.filter(
                (s) => !filesToLoad.includes(s.path)
              ),
              reindexMap: new Map(),
              deletedSocketIds: affectedSockets.map((s) => s.id),
              type: "output",
            })
          );
        }

        handleCardUpdate();
      }
    };

    // Node selection handlers
    const handleNodeSelect = async (event) => {
      // Find the node in the tree data using the event key
      const findNode = (nodes, key) => {
        for (const node of nodes) {
          if (node.key === key) return node;
          if (node.children) {
            const found = findNode(node.children, key);
            if (found) return found;
          }
        }
        return null;
      };

      const collectAllChildPaths = (node) => {
        const paths = [];
        if (node.leaf) {
          paths.push(node.data.path);
        } else if (node.children) {
          node.children.forEach((child) => {
            // Keep this exactly as is - no selection state modifications
            paths.push(...collectAllChildPaths(child));
          });
        }
        return paths;
      };

      const node = findNode(localCardData.value.treeData, event.key);
      if (!node) return;

      const selectedPaths = [];
      if (node.leaf) {
        selectedPaths.push(node.data.path);
      } else {
        // For folders, automatically select all child files and update UI state
        selectedPaths.push(...collectAllChildPaths(node));
      }

      // Force a UI update for the tree component first
      localCardData.value = {
        ...localCardData.value,
        selectedNodes: { ...localCardData.value.selectedNodes },
      };

      // Now handle the file loading
      if (selectedPaths.length) {
        console.log("Selected paths to load:", selectedPaths);
        await loadSelectedFiles(selectedPaths);
      }

      handleCardUpdate();

      if (selectedPaths.length && (localCardData.value.autoLoad || node.leaf)) {
        await loadSelectedFiles(selectedPaths);
      }

      handleCardUpdate();
    };

    const handleNodeUnselect = (event) => {
      const findNode = (nodes, key) => {
        for (const node of nodes) {
          if (node.key === key) return node;
          if (node.children) {
            const found = findNode(node.children, key);
            if (found) return found;
          }
        }
        return null;
      };

      const node = findNode(localCardData.value.treeData, event.key);
      if (!node) return;

      // Get paths to remove (either single node or recursive children)
      const pathsToRemove = new Set();
      const collectPaths = (node) => {
        if (node.leaf) {
          pathsToRemove.add(node.data.path);
          // Reset node status to idle
          updateNodeStatus(node, "idle");
          // Remove from loadedFiles
          localCardData.value.loadedFiles.delete(node.data.path);
        } else if (node.children) {
          node.children.forEach(collectPaths);
        }
      };
      collectPaths(node);

      // if (localCardData.value.isRecursive && !node.leaf) {
      //     // Recursively unselect all child nodes
      //     const unselectChildren = (node) => {
      //         if (node.children) {
      //             node.children.forEach(child => {
      //                 delete localCardData.value.selectedNodes[child.data.path];
      //                 if (!child.leaf) {
      //                     unselectChildren(child);
      //                 }
      //             });
      //         }
      //     };
      //     unselectChildren(node);
      // }

      // Remove corresponding sockets
      const oldSockets = [...localCardData.value.sockets.outputs];
      const newSockets = oldSockets.filter(
        (socket) => !pathsToRemove.has(socket.path)
      );

      // Update socket array with proper remapping
      const { reindexMap, reindexedSockets } = updateSocketArray({
        oldSockets,
        newSockets,
        type: "output",
        socketRegistry,
        connections: connections.value,
        deletedSocketIds: oldSockets
          .filter((s) => pathsToRemove.has(s.path))
          .map((s) => s.id),
      });

      localCardData.value.sockets.outputs = reindexedSockets;

      // Emit socket update event
      emit(
        "sockets-updated",
        createSocketUpdateEvent({
          cardId: localCardData.value.uuid,
          oldSockets,
          newSockets: reindexedSockets,
          reindexMap,
          deletedSocketIds: oldSockets
            .filter((s) => pathsToRemove.has(s.path))
            .map((s) => s.id),
          type: "output",
        })
      );

      handleCardUpdate();
    };

    // Node expansion handlers
    const handleNodeExpand = (event) => {
      localCardData.value.expandedNodes[event.key] = true;
      handleCardUpdate();
    };

    const handleNodeCollapse = (event) => {
      delete localCardData.value.expandedNodes[event.key];
      handleCardUpdate();
    };

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
          // Always remove trailing .git from the repo name if it exists
          const repo = match[2].replace(/\.git$/, "");
          const result = {
            owner: match[1],
            repo: repo,
          };

          return result;
        }
      }

      return null;
    };
    const handleUrlInput = () => {
      const parsed = parseGitHubUrl(localCardData.value.url);
      if (parsed) {
        localCardData.value.owner = parsed.owner;
        localCardData.value.repo = parsed.repo;
        handleCardUpdate();
      }
    };

    // Load repository content
    // Load repository content
    const loadRepository = async () => {
      if (!canLoadRepo.value) return;

      isProcessing.value = true;
      try {
        const result = await loadGitHubContent(
          localCardData.value.owner,
          localCardData.value.repo,
          localCardData.value.branch,
          localCardData.value.token
        );

        if (result?.treeData) {
          // Add status property to each node
          const addStatusToNodes = (nodes) => {
            nodes.forEach((node) => {
              node.data.status = "idle";
              if (node.children) {
                addStatusToNodes(node.children);
              }
            });
          };

          addStatusToNodes(result.treeData);

          localCardData.value.treeData = result.treeData;
          localCardData.value.selectedNodes = {};
          localCardData.value.expandedNodes = {};
          localCardData.value.loadedFiles = new Set();
          localCardData.value.sockets.outputs = [];

          handleCardUpdate();

          // After loading, refresh if there are any selected files
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

    // Add computed property for selected files
    const hasSelectedFiles = Vue.computed(() => {
      if (!localCardData.value.selectedNodes) return false;
      return Object.keys(localCardData.value.selectedNodes).some((key) => {
        const node = findNodeByPath(localCardData.value.treeData, key);
        return node && node.leaf;
      });
    });

    // Add new method to refresh selected files
    const refreshSelected = async () => {
      if (!hasSelectedFiles.value || isProcessing.value) return;

      isProcessing.value = true;

      try {
        // Get all selected file paths
        const selectedPaths = Object.keys(
          localCardData.value.selectedNodes
        ).filter((key) => {
          const node = findNodeByPath(localCardData.value.treeData, key);
          return node && node.leaf;
        });

        // Reset loaded status for selected files
        selectedPaths.forEach((path) => {
          const node = findNodeByPath(localCardData.value.treeData, path);
          if (node) {
            updateNodeStatus(node, "idle");
            localCardData.value.loadedFiles.delete(path);
          }
        });

        // Reload the files
        await loadSelectedFiles(selectedPaths);
      } catch (error) {
        console.error("Error refreshing selected files:", error);
      } finally {
        isProcessing.value = false;
      }
    };

    // Reset repository state
    const resetRepository = () => {
      localCardData.value.treeData = null;
      localCardData.value.selectedNodes = {};
      localCardData.value.expandedNodes = {};
      localCardData.value.loadedFiles = new Set();
      localCardData.value.sockets.outputs = [];
      handleCardUpdate();
    };

    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData, oldData) => {
        if (!newData || isProcessing.value) return;

        const updatedData = { ...localCardData.value };
        if (newData.x !== undefined) updatedData.x = newData.x;
        if (newData.y !== undefined) updatedData.y = newData.y;

        // Deep merge of tree data and selection state if changed
        if (
          newData.treeData &&
          JSON.stringify(newData.treeData) !== JSON.stringify(oldData?.treeData)
        ) {
          updatedData.treeData = newData.treeData;
          updatedData.selectedNodes = newData.selectedNodes || {};
          updatedData.expandedNodes = newData.expandedNodes || {};
        }

        localCardData.value = updatedData;
      },
      { deep: true }
    );

    // Watch for changes in the trigger input socket
    Vue.watch(
      () => localCardData.value.sockets.inputs[0].value,
      async (newValue, oldValue) => {
        if (newValue === oldValue) return;

        localCardData.value.trigger = Date.now();

        if (!localCardData.value.treeData) {
          // If no tree data, load repository
          await loadRepository();
        } else if (hasSelectedFiles.value) {
          // If tree data exists and files are selected, refresh
          await refreshSelected();
        }
      }
    );

    const handleCardUpdate = () => {
      emit("update-card", Vue.toRaw(localCardData.value));
    };

    // Cleanup
    Vue.onUnmounted(() => {
      socketRegistry.forEach((socket) =>
        socket.cleanup.forEach((cleanup) => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      localCardData,
      isProcessing,
      canLoadRepo,
      getSocketConnections,
      hasSocketError,
      handleSocketMount,
      emitWithCardId,
      handleNodeSelect,
      handleNodeUnselect,
      handleNodeExpand,
      handleNodeCollapse,
      handleCardUpdate,
      loadRepository,
      resetRepository,
      refreshSelected,
      hasSelectedFiles,

      handleUrlInput,
    };
  },
};
