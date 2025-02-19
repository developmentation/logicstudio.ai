// components/SkeuomorphicCard.js

export default {
    name: "SkeuomorphicCard",
    
    props: {
      card: {
        type: Object,
        required: true
      },
      compact: {
        type: Boolean,
        default: false
      }
    },
  
    template: `
      <div 
        class="relative group cursor-pointer"
        @click="$emit('click', card)"
      >
        <!-- Card Container -->
        <div 
          class="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          :class="[
            compact ? 'w-24' : 'w-40',
            hasError ? 'border-red-500' : hasWarning ? 'border-yellow-500' : 'border-transparent',
            'border-2'
          ]"
        >
          <!-- Icon -->
          <div 
            class="flex items-center justify-center w-10 h-10 rounded-lg"
            :class="[getTypeColor(card.type)]"
          >
            <i :class="['text-xl', getTypeIcon(card.type)]"></i>
          </div>
  
          <!-- Card Info -->
          <div v-if="!compact" class="flex-1 min-w-0">
            <div class="text-sm font-medium text-white truncate">
              {{ card.ui?.name || getTypeName(card.type) }}
            </div>
            <div class="text-xs text-gray-400 truncate">
              {{ getSocketSummary() }}
            </div>
          </div>
  
          <!-- Status Indicators -->
          <div class="absolute -top-1 -right-1 flex gap-1">
            <div v-if="hasError" 
                 class="w-2 h-2 rounded-full bg-red-500" />
            <div v-if="hasWarning" 
                 class="w-2 h-2 rounded-full bg-yellow-500" />
            <div v-if="isActive" 
                 class="w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>
      </div>
    `,
  
    setup(props) {
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
  
      const getSocketSummary = () => {
        const inputs = props.card.data?.sockets?.inputs?.length || 0;
        const outputs = props.card.data?.sockets?.outputs?.length || 0;
        return `${inputs} in • ${outputs} out`;
      };
  
      // Computed properties for status
      const hasError = Vue.computed(() => {
        // Check for error conditions in card data
        return false; // Implement your error checking logic
      });
  
      const hasWarning = Vue.computed(() => {
        // Check for warning conditions in card data
        return false; // Implement your warning checking logic
      });
  
      const isActive = Vue.computed(() => {
        // Check if card has active connections or is processing
        return props.card.data?.isActive || false;
      });
  
      return {
        getTypeIcon,
        getTypeColor,
        getTypeName,
        getSocketSummary,
        hasError,
        hasWarning,
        isActive
      };
    }
  };