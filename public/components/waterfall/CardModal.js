// components/CardModal.js

export default {
    name: "CardModal",
    
    props: {
      card: {
        type: Object,
        required: true
      }
    },
  
    template: `
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <!-- Modal Container -->
        <div 
          class="bg-gray-900 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-800">
            <div class="flex items-center gap-3">
              <div 
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="[getTypeColor(card.type)]"
              >
                <i :class="['text-xl', getTypeIcon(card.type)]"></i>
              </div>
              <div>
                <h3 class="text-lg font-medium text-white">Edit {{ getTypeName(card.type) }}</h3>
                <p class="text-sm text-gray-400">Configure card settings and connections</p>
              </div>
            </div>
            <button 
              @click="$emit('close')"
              class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
  
          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4">
            <div class="space-y-6">
              <!-- Basic Info -->
              <div class="space-y-4">
                <label class="block">
                  <span class="text-sm font-medium text-gray-300">Name</span>
                  <input 
                    type="text"
                    v-model="formData.ui.name"
                    class="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter card name"
                  />
                </label>
  
                <label class="block">
                  <span class="text-sm font-medium text-gray-300">Description</span>
                  <textarea
                    v-model="formData.ui.description"
                    rows="3"
                    class="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter card description"
                  ></textarea>
                </label>
              </div>
  
              <!-- Card Type Specific Settings -->
              <div v-if="hasTypeSpecificSettings" class="space-y-4">
                <h4 class="text-sm font-medium text-gray-300">Settings</h4>
                
                <!-- Model Settings -->
                <template v-if="card.type === 'model'">
                  <label class="block">
                    <span class="text-sm font-medium text-gray-300">Model Name</span>
                    <input 
                      type="text"
                      v-model="formData.data.modelName"
                      class="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </label>
                  <label class="block">
                    <span class="text-sm font-medium text-gray-300">Temperature</span>
                    <input 
                      type="number"
                      v-model="formData.data.temperature"
                      min="0"
                      max="1"
                      step="0.1"
                      class="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </label>
                </template>
  
                <!-- Chat Settings -->
                <template v-if="card.type === 'chat'">
                  <label class="block">
                    <span class="text-sm font-medium text-gray-300">System Message</span>
                    <textarea
                      v-model="formData.data.systemMessage"
                      rows="3"
                      class="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    ></textarea>
                  </label>
                </template>
  
                <!-- API Settings -->
                <template v-if="card.type === 'api'">
                  <label class="block">
                    <span class="text-sm font-medium text-gray-300">Endpoint URL</span>
                    <input 
                      type="text"
                      v-model="formData.data.endpoint"
                      class="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </label>
                  <label class="block">
                    <span class="text-sm font-medium text-gray-300">Method</span>
                    <select 
                      v-model="formData.data.method"
                      class="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </label>
                </template>
              </div>
  
              <!-- Sockets Section -->
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-300">Connections</h4>
                  <div class="flex gap-2">
                    <button 
                      @click="addSocket('input')"
                      class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-white rounded"
                    >
                      Add Input
                    </button>
                    <button 
                      @click="addSocket('output')"
                      class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-white rounded"
                    >
                      Add Output
                    </button>
                  </div>
                </div>
  
                <!-- Input Sockets -->
                <div v-if="formData.data.sockets.inputs.length" class="space-y-2">
                  <span class="text-xs text-gray-400">Input Sockets</span>
                  <div class="space-y-2">
                    <div 
                      v-for="(socket, index) in formData.data.sockets.inputs" 
                      :key="socket.id"
                      class="flex items-center gap-2 bg-gray-800 p-2 rounded"
                    >
                      <input 
                        type="text"
                        v-model="socket.name"
                        class="flex-1 bg-gray-700 border-gray-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button 
                        @click="removeSocket('input', index)"
                        class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white"
                      >
                        <i class="pi pi-times"></i>
                      </button>
                    </div>
                  </div>
                </div>
  
                <!-- Output Sockets -->
                <div v-if="formData.data.sockets.outputs.length" class="space-y-2">
                  <span class="text-xs text-gray-400">Output Sockets</span>
                  <div class="space-y-2">
                    <div 
                      v-for="(socket, index) in formData.data.sockets.outputs" 
                      :key="socket.id"
                      class="flex items-center gap-2 bg-gray-800 p-2 rounded"
                    >
                      <input 
                        type="text"
                        v-model="socket.name"
                        class="flex-1 bg-gray-700 border-gray-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button 
                        @click="removeSocket('output', index)"
                        class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white"
                      >
                        <i class="pi pi-times"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
  
          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 p-4 border-t border-gray-800">
            <button 
              @click="$emit('close')"
              class="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button 
              @click="handleSave"
              class="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    `,
  
    setup(props, { emit }) {
      // Form data with deep clone of card data
      const formData = Vue.ref(JSON.parse(JSON.stringify({
        uuid: props.card.uuid,
        type: props.card.type,
        ui: props.card.ui || { name: '', description: '' },
        data: props.card.data || { 
          sockets: { inputs: [], outputs: [] },
          ...getDefaultDataForType(props.card.type)
        }
      })));
  
      // Helper to get default data structure for different card types
      function getDefaultDataForType(type) {
        switch (type) {
          case 'model':
            return { modelName: '', temperature: 0.7 };
          case 'chat':
            return { systemMessage: '' };
          case 'api':
            return { endpoint: '', method: 'GET' };
          default:
            return {};
        }
      }
  
      // Computed to check if card type has specific settings
      const hasTypeSpecificSettings = Vue.computed(() => {
        return ['model', 'chat', 'api'].includes(props.card.type);
      });
  
      // Socket management
      const addSocket = (type) => {
        const socket = {
          id: `${type}-${Date.now()}`,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${formData.value.data.sockets[type + 's'].length + 1}`,
          type: type
        };
        formData.value.data.sockets[type + 's'].push(socket);
      };
  
      const removeSocket = (type, index) => {
        formData.value.data.sockets[type + 's'].splice(index, 1);
      };
  
      // Save changes
      const handleSave = () => {
        emit('update', formData.value);
      };
  
      // Get icon and color helpers (reused from SkeuomorphicCard)
      const getTypeIcon = (type) => {
        const icons = {
          model: 'pi pi-box',
          trigger: 'pi pi-play-circle',
          agent: 'pi pi-microchip-ai',
          text: 'pi pi-pen-to-square',
          chat: 'pi pi-comments',
          input: 'pi pi-upload',
          output: 'pi pi-download',
          join: 'pi pi-plus',
          view: 'pi pi-desktop',
          label: 'pi pi-tag',
          web: 'pi pi-globe',
          github: 'pi pi-github',
          api: 'pi pi-server',
          pdf: 'pi pi-file-pdf',
          transcribe: 'pi pi-microphone',
          textToSpeech: 'pi pi-headphones',
          template: 'pi pi-circle'
        };
        return icons[type] || 'pi pi-circle';
      };
  
      const getTypeColor = (type) => {
        const colors = {
          model: 'bg-blue-600',
          trigger: 'bg-purple-600',
          agent: 'bg-green-600',
          text: 'bg-gray-600',
          chat: 'bg-indigo-600',
          input: 'bg-cyan-600',
          output: 'bg-orange-600',
          github: 'bg-gray-900',
          web: 'bg-blue-500',
          api: 'bg-violet-600',
          pdf: 'bg-red-600',
          transcribe: 'bg-emerald-600',
          textToSpeech: 'bg-pink-600',
          template: 'bg-amber-600',
          join: 'bg-purple-500',
          view: 'bg-teal-600',
          label: 'bg-rose-600'
        };
        return colors[type] || 'bg-gray-600';
      };
  
      const getTypeName = (type) => {
        return type.charAt(0).toUpperCase() + type.slice(1);
      };
  
      // Click outside to close
      const handleClickOutside = (event) => {
        if (event.target === event.currentTarget) {
          emit('close');
        }
      };
  
      return {
        formData,
        hasTypeSpecificSettings,
        addSocket,
        removeSocket,
        handleSave,
        getTypeIcon,
        getTypeColor,
        getTypeName,
        handleClickOutside
      };
    }
  };