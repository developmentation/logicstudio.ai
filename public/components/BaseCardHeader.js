// BaseCardHeader.js
export default {
  name: "BaseCardHeader",
  props: {
    title: {
      type: String,
      required: true,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
  },
  template: `
 <div 
      class="p-2 bg-gray-700 rounded-t-md flex items-center justify-between select-none"
      :class="{'bg-blue-700': isSelected}"
      @mousedown="handleHeaderMouseDown"
    >
        <div class="flex items-center gap-2">
          <div v-if="!isEditingTitle" class="flex items-center gap-1">
            <h2 class="text-sm font-medium text-gray-200">{{ localTitle }}</h2>
            <button 
              class="text-gray-400 hover:text-gray-200"
              @click.stop="startTitleEdit"
            >
              <i class="pi pi-pencil text-xs"></i>
            </button>
          </div>
          <input
            v-else
            ref="titleInput"
            v-model="localTitle"
            class="bg-gray-800 text-sm text-gray-200 px-1 py-0.5 rounded w-32"
            @blur="finishTitleEdit"
            @keyup.enter="finishTitleEdit"
            @mousedown.stop
          />
        </div>
        <button 
          class="text-gray-400 hover:text-gray-200"
          @click.stop="$emit('close')"
        >×</button>
      </div>
    `,
  setup(props, { emit }) {
    const isEditingTitle = Vue.ref(false);
    const titleInput = Vue.ref(null);
    const localTitle = Vue.ref(props.title);

    const startTitleEdit = () => {
      isEditingTitle.value = true;
      Vue.nextTick(() => {
        titleInput.value?.focus();
      });
    };

    const finishTitleEdit = () => {
      isEditingTitle.value = false;
      emit("update:title", localTitle.value);
    };

    // In BaseCardHeader.js
    // In BaseCardHeader.js - Update handleHeaderClick
    // In BaseCardHeader.js
    const handleHeaderClick = (event) => {
        if (event.target.closest("button")) return;
      
        // Prevent text selection
        window.getSelection().removeAllRanges();
      
        emit("header-click", {
          shiftKey: event.shiftKey,
        });
      };

    const handleHeaderMouseDown = (event) => {
        // Preserve button and input interaction behavior
        if (
          event.target.closest('button') ||
          event.target.matches('input, textarea, [contenteditable="true"]') ||
          event.target.closest('input, textarea, [contenteditable="true"]')
        ) {
          return;
        }
        
        // Allow text selection in inputs while maintaining header behavior elsewhere
        if (!event.target.matches('input, textarea, [contenteditable="true"]')) {
          event.preventDefault();
        }
        
        // Maintain header click behavior if not already selected
        if (!props.isSelected && (event.target === event.currentTarget || event.target.closest('.bg-gray-700'))) {
          emit('header-click', {
            shiftKey: event.shiftKey
          });
        }
        
        // Preserve drag initialization with group drag flag
        emit('header-mousedown', {
          ...event,
          isHeader: true
        });
      };

    // Watch for prop changes
    Vue.watch(
      () => props.title,
      (newTitle) => {
        localTitle.value = newTitle;
      }
    );

    return {
      isEditingTitle,
      titleInput,
      localTitle,
      startTitleEdit,
      finishTitleEdit,
      handleHeaderClick,
      handleHeaderMouseDown
    };
  },
};
