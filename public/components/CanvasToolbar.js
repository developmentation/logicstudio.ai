// CanvasToolbar.js
export default {
  name: "CanvasToolbar",
  template: `
    <!-- Main toolbar container - fixed position above canvas -->
    <div class="fixed left-0 top-[73px]">
      <!-- Expanded State -->
      <template v-if="expanded">
        <div 
          class="flex flex-col h-[calc(100vh-73px)] bg-gray-800 border-r border-gray-700 shadow-lg transition-all duration-200"
          :style="containerWidth"
        >
          <!-- Close Button -->
          <button  
            class="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            @click="toggleExpanded"
          >
            <i class="pi pi-times"></i>
          </button>
  
          <!-- Text Toggle Button -->
          <button  
            class="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            @click="toggleText"
          >
            <i :class="showText ? 'pi pi-angle-left' : 'pi pi-angle-right'"></i>
          </button>
  
          <!-- Tool Categories -->
          <div class="flex-1 overflow-y-auto">
            <!-- Add Category -->
            <div class="py-2">
              <div class="px-3 text-xs text-gray-400 uppercase" :class="{ 'hidden': !showText }">
                Add
              </div>
              
              <!-- Add Tools Grid -->
              <div class="grid gap-1 p-1" :style="gridTemplateColumns">
                <button  
                  v-for="item in addTools"
                  :key="item.id"
                  :disabled="item.disabled"
                  class="h-10 flex items-center focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
                  :class="[
                    item.disabled ? 'text-gray-400' : 'text-white hover:bg-gray-700',
                    showText ? 'px-2' : 'justify-center'
                  ]"
                  @click="handleToolClick(item)"
                >
                  <span class="flex items-center justify-center" :class="showText ? 'w-8' : 'w-10'">
                    <i :class="item.icon"></i>
                  </span>
                  <span v-if="showText" class="text-sm truncate">{{ item.label }}</span>
                </button>
              </div>
            </div>
  
            <!-- Export Category -->
            <div class="py-2" v-if="exportTools.length">
              <div class="px-3 text-xs text-gray-400 uppercase" :class="{ 'hidden': !showText }">
                Export
              </div>
              
              <!-- Export Tools Grid -->
              <div class="grid gap-1 p-1" :style="gridTemplateColumns">
                <button
                  v-for="item in exportTools"
                  :key="item.id"
                  class="h-10 flex items-center text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
                  :class="showText ? 'px-2' : 'justify-center'"
                  @click="handleToolClick(item)"
                >
                  <span class="flex items-center justify-center" :class="showText ? 'w-8' : 'w-10'">
                    <i :class="item.icon"></i>
                  </span>
                  <span v-if="showText" class="text-sm truncate">{{ item.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
  
      <!-- Collapsed State - Just the menu button -->
      <template v-else>
        <button  
          class="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          @click="toggleExpanded"
        >
          <i class="pi pi-bars"></i>
        </button>
      </template>
    </div>
  `,
  setup(props, { emit }) {
    const expanded = Vue.ref(true);
    const showText = Vue.ref(false);
  
    const addTools = [
      { id: 'model', label: 'Model', icon: 'pi pi-box', type: 'model' },
      { id: 'trigger', label: 'Trigger', icon: 'pi pi-play-circle', type: 'trigger' },
      { id: 'agent', label: 'Agent', icon: 'pi pi-microchip-ai', type: 'agent' },
      { id: 'chat', label: 'Chat', icon: 'pi pi-comments', type: 'chat'  },
      { id: 'text', label: 'Text', icon: 'pi pi-pen-to-square', type: 'text'  },
      { id: 'web', label: 'Web Content', icon: 'pi pi-globe', type: 'web' },
      { id: 'fileInput', label: 'File Input', icon: 'pi pi-upload', type: 'input' },
      { id: 'fileOutput', label: 'File Output', icon: 'pi pi-download', type: 'output' },
      { id: 'github', label: 'GitHub', icon: 'pi pi-github', type: 'github' },
      { id: 'pdf', label: 'PDF', icon: 'pi pi-file-pdf', type: 'pdf' },
      { id: 'api', label: 'API', icon: 'pi pi-server', type: 'api' },
      { id: 'join', label: 'Join', icon: 'pi pi-plus', type: 'join'},

      { id: 'transcribe', label: 'Transcribe ', icon: 'pi pi-microphone', type: 'transcribe'},  
      { id: 'textToSpeech', label: 'Generate Audio', icon: 'pi pi-headphones', type: 'textToSpeech'}, 

      { id: 'view', label: 'View', icon: 'pi pi-desktop', type: 'view'},
      { id: 'label', label: 'Label', icon: 'pi pi-tag', type: 'label' },
      { id: 'template', label: 'Tester Template', icon: 'pi pi-circle', type: 'template' },
    ];
  
    const exportTools = [];

    // Computed properties for dynamic columns
    const columnCount = Vue.computed(() => {
      const totalTools = addTools.length;
      const maxToolsPerColumn = 10; // Maximum tools before adding a new column
      return Math.ceil(totalTools / maxToolsPerColumn);
    });

    const gridTemplateColumns = Vue.computed(() => {
      const cols = Math.min(columnCount.value, 4); // Max 4 columns
      return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
    });

    const containerWidth = Vue.computed(() => {
      const cols = Math.min(columnCount.value, 4); // Max 4 columns
      const baseWidth = showText.value ? 192 : 48; // Width per column (expanded/collapsed)
      return { width: `${baseWidth * cols}px` };
    });
  
    const toggleExpanded = () => {
      expanded.value = !expanded.value;
      if (!expanded.value) {
        showText.value = false;
      }
      emit('update:expanded', expanded.value);
      emit('update:show-text', showText.value);
    };
  
    const toggleText = () => {
      showText.value = !showText.value;
      emit('update:show-text', showText.value);
    };
  
    const handleToolClick = (item) => {
      if (item.type) {
        emit('add-card', item.type);
      } else if (item.action) {
        emit(item.action);
      }
    };
  
    return {
      expanded,
      showText,
      addTools,
      exportTools,
      gridTemplateColumns,
      containerWidth,
      toggleExpanded,
      toggleText,
      handleToolClick
    };
  }
};