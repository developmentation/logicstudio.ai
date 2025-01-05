// CanvasToolbar.js
export default {
    name: "CanvasToolbar",
    template: `
    <!-- Main toolbar container - fixed position above canvas -->
    <div class="fixed left-0 top-[73px]">
      <!-- Expanded State -->
      <template v-if="expanded">
        <div 
          class="flex flex-col h-[calc(100vh-73px)] bg-gray-800 border-r border-gray-700 shadow-lg"
          :class="{ 'w-52': showText, 'w-10': !showText }"
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
              
              <!-- Add Tools -->
              <button
                v-for="item in addTools"
                :key="item.id"
                class="w-full h-10 flex items-center text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                @click="handleToolClick(item)"
              >
                <span class="w-10 flex items-center justify-center">
                  <i :class="item.icon"></i>
                </span>
                <span v-if="showText" class="text-sm">{{ item.label }}</span>
              </button>
            </div>
  
            <!-- Export Category -->
            <div class="py-2">
              <div class="px-3 text-xs text-gray-400 uppercase" :class="{ 'hidden': !showText }">
                Export
              </div>
              
              <!-- Export Tools -->
              <button
                v-for="item in exportTools"
                :key="item.id"
                class="w-full h-10 flex items-center text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                @click="handleToolClick(item)"
              >
                <span class="w-10 flex items-center justify-center">
                  <i :class="item.icon"></i>
                </span>
                <span v-if="showText" class="text-sm">{{ item.label }}</span>
              </button>
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
        { id: 'agent', label: 'Agent', icon: 'pi pi-microchip-ai', type: 'agent' },
        { id: 'text', label: 'Text', icon: 'pi pi-align-left', type: 'text' },
        { id: 'fileInput', label: 'File Input', icon: 'pi pi-upload', type: 'input' },
        { id: 'fileOutput', label: 'File Output', icon: 'pi pi-download', type: 'output' },
        { id: 'transcribe', label: 'Audio to Text', icon: 'pi pi-microphone', type: 'tool' },
        { id: 'web', label: 'Web Content', icon: 'pi pi-globe', type: 'tool' },
        { id: 'join', label: 'Logic / Join', icon: 'pi pi-plus', type: 'tool' },
        { id: 'trigger', label: 'Trigger', icon: 'pi pi-arrow-circle-right', type: 'tool' },
        { id: 'display', label: 'Display', icon: 'pi pi-image', type: 'tool' },
        // { id: 'tool', label: 'Tool', icon: 'pi pi-cog', type: 'tool' },
        { id: 'template', label: 'Template (Tester)', icon: 'pi pi-circle', type: 'template' },

      ];
  
      const exportTools = [
        { id: 'exportPNG', label: 'Export PNG', icon: 'pi pi-image', action: 'export-png' },
        { id: 'exportJSON', label: 'Export JSON', icon: 'pi pi-cloud-download', action: 'export-json' },
        { id: 'importJSON', label: 'Import JSON', icon: 'pi pi-cloud-upload', action: 'import-json' }
      ];
  
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
        toggleExpanded,
        toggleText,
        handleToolClick
      };
    }
  };