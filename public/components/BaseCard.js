// BaseCard.js
import BaseCardHeader from "./BaseCardHeader.js";

export default {
  name: "BaseCard",
  components: {
    BaseCardHeader,
  },
  props: {
    cardData: {
      type: Object,
      required: true,
    },
    zoomLevel: {
      type: Number,
      default: 1,
    },
    zIndex: {
      type: Number,
      default: 1,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
  },
  
  template: `
<div
    class="node-card rounded-md shadow-lg select-none relative"
    :class="[
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        isSelected ? 'ring-2 ring-blue-500' : ''
    ]"
    :style="{
        position: 'absolute',
        transform: \`translate3d(\${localCardData.ui.x}px, \${localCardData.ui.y}px, 0)\`,
        zIndex: isDragging ? 1000 : zIndex,
        width: (localCardData.ui.width || 300) + 'px'
    }"
    @click="handleCardClick"
    @mousedown="handleDragStart"
    @touchstart.passive="handleDragStart"
    @touchmove.passive="handleTouchMove"
    @touchend.passive="handleTouchEnd"
    :data-card-id="localCardData.uuid"
>

    <BaseCardHeader
    :title="localCardData.ui.name"
    :is-selected="isSelected"
    @update:title="updateTitle"
    @close="$emit('close-card', localCardData.uuid)"
    @clone-card="$emit('clone-card', localCardData.uuid)"
    @header-click="handleHeaderClick"
    @header-mousedown="handleDragStart"   
/>

      
      <div class="p-3 relative">
        <!-- Description -->
        <div class="mb-2">
          <div v-if="!isEditingDescription" class="flex items-center gap-1">
            <button v-if="localCardData.ui.display == 'default'"
              class="text-gray-400 hover:text-gray-200"
              @click.stop="toggleDisplay"
            >
              <i class="pi pi-caret-up text-xs"></i>
            </button>

            <button v-else 
              class="text-gray-400 hover:text-gray-200"
              @click.stop="toggleDisplay"
            >
              <i class="pi pi-caret-down text-xs"></i>
            </button>

            <p class="text-xs text-gray-300">{{ localCardData.ui.description }}</p>
            <button 
              class="text-gray-400 hover:text-gray-200"
              @click.stop="startDescriptionEdit"
            >
              <i class="pi pi-pencil text-xs"></i>
            </button>
          </div>
          <textarea
            v-else
            ref="descriptionInput"
            v-model="localCardData.ui.description"
            class="w-full bg-gray-900 text-xs text-gray-200 px-2 py-1 rounded"
            @blur="finishDescriptionEdit"
            @keyup.enter="finishDescriptionEdit"
            @mousedown.stop
          />
        </div>

        <slot></slot>
      </div>

      <!-- Resize Handle -->
      <div
        class="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 hover:opacity-50"
        @mousedown.stop="startResize"
        @touchstart.stop.passive="startResize"
      ></div>
    </div>
  `,
  setup(props, { emit }) {
    // Watch position changes with immediate flush for smooth dragging
    Vue.watch(() => ({
      x: props.cardData.ui?.x,
      y: props.cardData.ui?.y
    }), (newPos) => {
      if (newPos.x !== undefined) localCardData.ui.x = newPos.x;
      if (newPos.y !== undefined) localCardData.ui.y = newPos.y;
    }, { deep: true, flush: 'sync' });

    const localCardData = Vue.reactive({ ...props.cardData });
    const isDragging = Vue.ref(false);
    const isResizing = Vue.ref(false);
    const dragStart = Vue.reactive({ x: 0, y: 0 });
    const isEditingDescription = Vue.ref(false);
    const descriptionInput = Vue.ref(null);
    const wasDragging = Vue.ref(false);

    const startResize = (event) => {
      const isTouch = event.type === "touchstart";
      if (!isTouch && event.button !== 0) return;

      isResizing.value = true;
      dragStart.x = isTouch ? event.touches[0].clientX : event.clientX;
      
      const handleMove = (e) => {
        if (!isResizing.value) return;
        
        const currentX = isTouch ? e.touches[0].clientX : e.clientX;
        const dx = (currentX - dragStart.x) / props.zoomLevel;
        
        const newWidth = Math.max(200, (localCardData.ui.width || 300) + dx);
        localCardData.ui.width = newWidth;
        
        dragStart.x = currentX;
        
        emit("update-card", { ...localCardData });
      };

      const handleEnd = () => {
        if (!isResizing.value) return;
        isResizing.value = false;
        
        if (!isTouch) {
          document.removeEventListener("mousemove", handleMove);
          document.removeEventListener("mouseup", handleEnd);
        }
      };

      if (!isTouch) {
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleEnd);
      }
    };

    const handleCardClick = (event) => {
      if (wasDragging.value) return;

      if (
        event.target.matches(
          'input, textarea, [contenteditable="true"], button'
        ) ||
        event.target.closest(
          'input, textarea, [contenteditable="true"], button, .socket'
        )
      ) {
        return;
      }

      event.stopPropagation();

      emit("select-card", {
        uuid: localCardData.uuid,
        shiftKey: event.shiftKey,
      });
    };

    const startConnectionDrag = (event) => {
      const isTouch = event.type === "touchstart";
      if (!isTouch) {
        event.stopPropagation();
        const rect = event.target.getBoundingClientRect();
        const type = event.target.dataset.type;
        const startPoint = {
          x: type === "input" ? rect.left : rect.right,
          y: rect.top + rect.height / 2,
        };

        emit("connection-drag-start", {
          startPoint,
          socket: {
            id: event.target.dataset.socketId,
            type: type,
          },
          cardId: localCardData.uuid,
          type,
        });
      }
    };

    const handleDragStart = (event) => {

      console.log("BaseCard", event)
      const isTouch = event.type === "touchstart";
      const isHeaderDrag = event.isHeader;
    
      if (
        (!isHeaderDrag && event.target.classList.contains("socket")) ||
        (!isHeaderDrag && event.target.closest(".socket")) ||
        (!isHeaderDrag && event.target.matches('input, textarea, [contenteditable="true"]')) ||
        (!isHeaderDrag && event.target.closest('input, textarea, [contenteditable="true"]')) ||
        (!isHeaderDrag && event.target.closest("button"))
      ) {
        return;
      }
    
      if (!isTouch && event.button !== 0) return;
    
      // event.stopPropagation();
      // event.preventDefault();
    
      isDragging.value = true;
      wasDragging.value = false;
    
      if (!props.isSelected) {
        emit("select-card", {
          uuid: localCardData.uuid,
          shiftKey: event.shiftKey,
        });
      }
    
      const point = {
        clientX: isTouch ? event.touches[0].clientX : event.clientX,
        clientY: isTouch ? event.touches[0].clientY : event.clientY,
        type: event.type
      };
    
      emit('drag-start', {
        event: point,
        cardId: localCardData.uuid
      });
    
      if (!isTouch) {
        document.addEventListener("mousemove", handleDrag);
        document.addEventListener("mouseup", handleDragEnd);
      }
    };
    
    const handleDrag = (event) => {
      if (!isDragging.value) return;
      
      event.preventDefault();
      wasDragging.value = true;
    
      const eventData = {
        clientX: event.type.includes('touch') ? event.touches[0].clientX : event.clientX,
        clientY: event.type.includes('touch') ? event.touches[0].clientY : event.clientY,
        type: event.type
      };
    
      emit('drag', { event: eventData });
    };
    
    const handleDragEnd = (event) => {
      if (!isDragging.value) return;
    
      event.preventDefault();
      event.stopPropagation();
    
      const eventData = {
        clientX: event.type.includes('touch') ? event.changedTouches[0].clientX : event.clientX,
        clientY: event.type.includes('touch') ? event.changedTouches[0].clientY : event.clientY,
        type: event.type
      };
    
      emit('drag-end', { event: eventData });
    
      isDragging.value = false;
      window.removeEventListener("mousemove", handleDrag);
      window.removeEventListener("mouseup", handleDragEnd);
    
      setTimeout(() => {
        wasDragging.value = false;
      }, 100);
    };

    const handleTouchMove = (event) => {
      if (!isDragging.value || event.touches.length !== 1) return;
      handleDrag(event);
    };
    
    const handleTouchEnd = (event) => {
      if (!isDragging.value) return;
      handleDragEnd(event);
    };
    
    const updateTitle = (newTitle) => {
      localCardData.ui.name = newTitle;
      emit("update-card", localCardData);
    };

    const startDescriptionEdit = () => {
      isEditingDescription.value = true;
      Vue.nextTick(() => {
        descriptionInput.value?.focus();
      });
    };

    const finishDescriptionEdit = () => {
      isEditingDescription.value = false;
      emit("update-card", localCardData);
    };

    const handleHeaderClick = ({ shiftKey }) => {
      emit("select-card", {
        uuid: localCardData.uuid,
        shiftKey,
      });
    };

    const toggleDisplay = () => {
      if (localCardData.ui.display == "default")
        localCardData.ui.display = "minimized";
      else localCardData.ui.display = "default";
    
      emit("update-card", localCardData);
    };

    // Watch for external changes to cardData
    Vue.watch(
      () => props.cardData,
      (newData) => {
        Object.assign(localCardData, newData);
      },
      { deep: true }
    );

    return {
      localCardData,
      isDragging,
      isResizing,
      isEditingDescription,
      descriptionInput,
      handleCardClick,
      startResize,
      handleDragStart,
      handleDrag,
      handleDragEnd,
      handleTouchMove,
      handleTouchEnd,
      startConnectionDrag,
      updateTitle,
      startDescriptionEdit,
      finishDescriptionEdit,
      handleHeaderClick,
      toggleDisplay,
    };
  },
};