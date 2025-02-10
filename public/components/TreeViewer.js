// TreeViewer.js with fixed selection handling
const TreeNode = {
    name: "TreeNode",
    props: {
      node: {
        type: Object,
        required: true
      },
      selectedKeys: {
        type: Object,
        required: true
      },
      expandedKeys: {
        type: Object,
        required: true
      },
      indentLevel: {
        type: Number,
        default: 0
      }
    },
    emits: ['node-select', 'node-unselect', 'node-expand', 'node-collapse'],
    template: `
      <div 
        class="tree-node"
        :class="{ 'pl-6': indentLevel > 0 }"
      >
        <div 
          class="flex items-center py-1 px-2 rounded hover:bg-gray-800 cursor-pointer select-none"
          :class="{ 'bg-gray-800': isSelected }"
          @click="handleNodeClick"
        >
          <!-- Expand/Collapse Arrow -->
          <div 
            v-if="!node.leaf" 
            class="w-4 h-4 flex items-center justify-center mr-1 text-gray-400"
            @click.stop="toggleExpand"
          >
            <svg
              class="w-3 h-3 transition-transform duration-200"
              :class="{ 'rotate-90': isExpanded }"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div v-else class="w-4 mr-1"></div>
  
          <!-- Checkbox -->
          <div 
            class="w-4 h-4 mr-2 border rounded flex items-center justify-center"
            :class="checkboxClasses"
            @click.stop="toggleSelect"
          >
            <svg
              v-if="isSelected || isIndeterminate"
              class="w-3 h-3 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                v-if="isSelected"
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
              <rect
                v-else
                x="4"
                y="9"
                width="12"
                height="2"
                rx="1"
              />
            </svg>
          </div>
  
          <!-- Node Content -->
          <div class="flex items-center gap-2 min-w-0">
            <span :class="node.icon || 'pi pi-file'" class="text-gray-400"></span>
            <span class="truncate text-gray-200">{{ node.label }}</span>
            <span 
              v-if="node.data?.status"
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-gray-500': node.data.status === 'idle',
                'bg-yellow-500': node.data.status === 'loading',
                'bg-green-500': node.data.status === 'loaded',
                'bg-red-500': node.data.status === 'error'
              }"
            ></span>
          </div>
        </div>
  
        <!-- Child Nodes -->
        <div v-if="!node.leaf && isExpanded">
          <tree-node
            v-for="childNode in node.children"
            :key="childNode.key"
            :node="childNode"
            :selected-keys="selectedKeys"
            :expanded-keys="expandedKeys"
            :indent-level="indentLevel + 1"
            @node-select="handleChildSelect"
            @node-unselect="handleChildUnselect"
            @node-expand="$emit('node-expand', $event)"
            @node-collapse="$emit('node-collapse', $event)"
          />
        </div>
      </div>
    `,
    setup(props, { emit }) {
      const isSelected = Vue.computed(() => {
        if (props.node.leaf) {
          return props.selectedKeys[props.node.key] || false;
        }
        return getAllChildrenSelected(props.node);
      });
  
      const isIndeterminate = Vue.computed(() => {
        if (props.node.leaf) return false;
        const { someSelected, allSelected } = getChildrenSelectionState(props.node);
        return someSelected && !allSelected;
      });
  
      const isExpanded = Vue.computed(() => props.expandedKeys[props.node.key]);
  
      const checkboxClasses = Vue.computed(() => ({
        'border-gray-600 bg-gray-800': !isSelected.value && !isIndeterminate.value,
        'border-blue-500 bg-blue-500': isSelected.value || isIndeterminate.value
      }));

      const toggleSelect = () => {
        if (props.node.leaf) {
          if (isSelected.value) {
            emit('node-unselect', {
              node: props.node,
              key: props.node.key,
              affectedKeys: [props.node.key]
            });
          } else {
            emit('node-select', {
              node: props.node,
              key: props.node.key,
              affectedKeys: [props.node.key]
            });
          }
        } else {
          const affectedKeys = [];
          const collectLeafKeys = (node) => {
            if (node.leaf) {
              affectedKeys.push(node.key);
            } else if (node.children) {
              node.children.forEach(collectLeafKeys);
            }
          };
          collectLeafKeys(props.node);

          if (isSelected.value) {
            emit('node-unselect', {
              node: props.node,
              key: props.node.key,
              affectedKeys,
              propagateDown: true
            });
          } else {
            emit('node-select', {
              node: props.node,
              key: props.node.key,
              affectedKeys,
              propagateDown: true
            });
          }
        }
      };

      const getAllChildrenSelected = (node) => {
        if (node.leaf) return props.selectedKeys[node.key] || false;
        if (!node.children?.length) return false;
        
        return node.children.every(child => {
          if (child.leaf) return props.selectedKeys[child.key] || false;
          return getAllChildrenSelected(child);
        });
      };
  
      const getChildrenSelectionState = (node) => {
        if (node.leaf) {
          const isSelected = props.selectedKeys[node.key] || false;
          return { someSelected: isSelected, allSelected: isSelected };
        }
  
        let selectedCount = 0;
        const totalLeafNodes = countLeafNodes(node);
  
        const countSelectedLeaves = (n) => {
          if (n.leaf) {
            if (props.selectedKeys[n.key]) selectedCount++;
            return;
          }
          n.children?.forEach(countSelectedLeaves);
        };
  
        countSelectedLeaves(node);
  
        return {
          someSelected: selectedCount > 0,
          allSelected: selectedCount === totalLeafNodes
        };
      };
  
      const countLeafNodes = (node) => {
        if (node.leaf) return 1;
        return node.children?.reduce((sum, child) => sum + countLeafNodes(child), 0) || 0;
      };
  
      const handleChildSelect = (event) => {
        emit('node-select', event);
      };
  
      const handleChildUnselect = (event) => {
        emit('node-unselect', event);
      };
  
      const toggleExpand = () => {
        if (!props.node.leaf) {
          if (isExpanded.value) {
            emit('node-collapse', props.node);
          } else {
            emit('node-expand', props.node);
          }
        }
      };
  
      const handleNodeClick = () => {
        if (!props.node.leaf) {
          toggleExpand();
        }
      };
  
      return {
        isSelected,
        isIndeterminate,
        isExpanded,
        checkboxClasses,
        toggleSelect,
        handleChildSelect,
        handleChildUnselect,
        toggleExpand,
        handleNodeClick
      };
    }
};

export default {
    name: "TreeViewer",
    components: {
        TreeNode
    },
    props: {
        nodes: {
            type: Array,
            required: true
        },
        selectedKeys: {
            type: Object,
            default: () => ({})
        },
        expandedKeys: {
            type: Object,
            default: () => ({})
        }
    },
    emits: [
        'update:selectedKeys',
        'node-select',
        'node-unselect',
        'node-expand',
        'node-collapse'
    ],
    template: `
        <div class="tree-viewer text-sm">
            <template v-for="node in nodes" :key="node.key">
                <tree-node
                    :node="node"
                    :selected-keys="selectedKeys"
                    :expanded-keys="expandedKeys"
                    :indent-level="0"
                    @node-select="handleNodeSelect"
                    @node-unselect="handleNodeUnselect"
                    @node-expand="handleNodeExpand"
                    @node-collapse="handleNodeCollapse"
                />
            </template>
        </div>
    `,
    setup(props, { emit }) {
        const handleNodeSelect = (event) => {
            const newSelectedKeys = { ...props.selectedKeys };
            
            if (event.affectedKeys) {
                event.affectedKeys.forEach(key => {
                    newSelectedKeys[key] = true;
                });
            }

            emit('update:selectedKeys', newSelectedKeys);
            emit('node-select', event);
        };
        
        const handleNodeUnselect = (event) => {
            const newSelectedKeys = { ...props.selectedKeys };
            
            if (event.affectedKeys) {
                event.affectedKeys.forEach(key => {
                    delete newSelectedKeys[key];
                });
            }

            emit('update:selectedKeys', newSelectedKeys);
            emit('node-unselect', event);
        };

        const handleNodeExpand = (node) => {
            emit('node-expand', { key: node.key, node });
        };

        const handleNodeCollapse = (node) => {
            emit('node-collapse', { key: node.key, node });
        };

        return {
            handleNodeSelect,
            handleNodeUnselect,
            handleNodeExpand,
            handleNodeCollapse
        };
    }
};