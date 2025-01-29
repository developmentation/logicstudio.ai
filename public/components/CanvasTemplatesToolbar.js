// CanvasTemplatesToolbar.js
export default {
    name: "CanvasTemplatesToolbar",
    template: `
      <div class="fixed right-4 top-[60px] z-50">
        <!-- Expanded State -->
        <template v-if="expanded">
          <div 
            class="flex flex-col h-[calc(100vh-73px)] w-96 bg-gray-800 border-l border-gray-700 shadow-lg transform transition-transform duration-200 ease-in-out"
            style="transform-origin: right"
          >
            <!-- Header with close button -->
            <div class="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 class="text-white text-sm font-medium">Canvas Templates</h2>
              <button 
                class="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
                @click="toggleExpanded"
                 
              >
                <i class="pi pi-times"></i>
              </button>
            </div>
  
            <!-- Template List -->
            <div class="flex-1 overflow-y-auto">
              <div class="py-2">
                <div v-for="template in canvasTemplates" :key="template.id" 
                  class="flex items-center justify-between px-4 py-2 hover:bg-gray-700 group transition-colors duration-200">
                  <span class="text-white text-sm">{{ template.name }}</span>
                  <button
                    class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
                    @click="addCanvas(template)"
                    
                  >
                    <i class="pi pi-plus"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
  
        <!-- Collapsed State - Just the menu button -->
        <template v-else>
          <button 
            class="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
            @click="toggleExpanded"
             
          >
            <i class="pi pi-list"></i>
          </button>
        </template>
      </div>
    `,
    
    props: {
      canvasTemplates: {
        type: Array,
        required: true
      }
    },
  
    setup(props, { emit }) {
      const expanded = Vue.ref(false);
  
      const toggleExpanded = () => {
        expanded.value = !expanded.value;
      };
  
      const addCanvas = (template) => {
        // Create a new canvas from the template
        const newCanvas = {
          ...template,
          id: crypto.randomUUID(), // Generate a new unique ID
          name: `${template.name}` // Optionally modify the name
        };
  
        emit('add-canvas', newCanvas);
        expanded.value = false; // Close the toolbar after adding
      };
  
      return {
        expanded,
        toggleExpanded,
        addCanvas
      };
    }
  };