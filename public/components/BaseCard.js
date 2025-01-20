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
        left: localCardData.x + 'px',
        top: localCardData.y + 'px',
        zIndex: isDragging ? 1000 : zIndex,
        width: (localCardData.width || 300) + 'px'
      }"
      @mousedown="startDrag"
      @click="handleCardClick"
      @touchstart.passive="startDrag"
      @touchmove.passive="handleTouchMove"
      @touchend.passive="handleTouchEnd"
      :data-card-id="localCardData.uuid"
    >
      <BaseCardHeader
        :title="localCardData.name"
        :is-selected="isSelected"
        @update:title="updateTitle"
        @close="$emit('close-card', localCardData.uuid)"
        @clone-card="$emit('clone-card', localCardData.uuid)"
        @header-click="handleHeaderClick"
        @header-mousedown="startDrag"  
      />
      
      <div class="p-3 relative">
        <!-- Description -->
        <div class="mb-2">
          <div v-if="!isEditingDescription" class="flex items-center gap-1">
            <button v-if="localCardData.display == 'default'"
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

            <p class="text-xs text-gray-300">{{ localCardData.description }}</p>
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
            v-model="localCardData.description"
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
    const localCardData = Vue.reactive({ ...props.cardData, width: props.cardData.width || 300 });
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
        
        const newWidth = Math.max(200, (localCardData.width || 300) + dx);
        localCardData.width = newWidth;
        
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
        // Existing mouse handling code
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

    const onDrag = (event) => {
      if (!isDragging.value) return;

      const dx = (event.clientX - dragStart.x) / props.zoomLevel;
      const dy = (event.clientY - dragStart.y) / props.zoomLevel;

      localCardData.x = (localCardData.x || 0) + dx;
      localCardData.y = (localCardData.y || 0) + dy;

      dragStart.x = event.clientX;
      dragStart.y = event.clientY;

      emit("update-position", {
        uuid: localCardData.uuid,
        x: localCardData.x,
        y: localCardData.y,
      });
    };

    const stopDrag = () => {
      isDragging.value = false;
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", stopDrag);
      document.removeEventListener("touchmove", onDrag);
      document.removeEventListener("touchend", stopDrag);
    };

    // In BaseCard.js - simplified drag handler
    const startDrag = (event) => {
      const isTouch = event.type === "touchstart";
      const isHeaderDrag = event.isHeader;

      if (
        (!isHeaderDrag && event.target.classList.contains("socket")) ||
        (!isHeaderDrag && event.target.closest(".socket")) ||
        (!isHeaderDrag &&
          event.target.matches('input, textarea, [contenteditable="true"]')) ||
        (!isHeaderDrag &&
          event.target.closest('input, textarea, [contenteditable="true"]')) ||
        (!isHeaderDrag && event.target.closest("button"))
      ) {
        return;
      }

      if (!isTouch && event.button !== 0) return;

      event.stopPropagation();
      event.preventDefault();

      // Set dragging state immediately
      isDragging.value = true;

      const clientX = isTouch ? event.touches[0].clientX : event.clientX;
      const clientY = isTouch ? event.touches[0].clientY : event.clientY;
      dragStart.x = clientX;
      dragStart.y = clientY;

      // Only emit selection if the card isn't selected
      if (!props.isSelected) {
        emit("select-card", {
          uuid: localCardData.uuid,
          shiftKey: event.shiftKey,
        });
      }

      const handleMove = (e) => {
        if (!isDragging.value) return;

        const currentX = isTouch ? e.touches[0].clientX : e.clientX;
        const currentY = isTouch ? e.touches[0].clientY : e.clientY;

        const dx = (currentX - dragStart.x) / props.zoomLevel;
        const dy = (currentY - dragStart.y) / props.zoomLevel;

        emit("update-position", {
          uuid: localCardData.uuid,
          x: localCardData.x + dx,
          y: localCardData.y + dy,
        });

        dragStart.x = currentX;
        dragStart.y = currentY;
      };

      const handleEnd = (e) => {
        if (!isDragging.value) return;

        const endX = isTouch ? e.changedTouches[0].clientX : e.clientX;
        const endY = isTouch ? e.changedTouches[0].clientY : e.clientY;

        const dx = (endX - dragStart.x) / props.zoomLevel;
        const dy = (endY - dragStart.y) / props.zoomLevel;

        emit("update-position", {
          uuid: localCardData.uuid,
          x: localCardData.x + dx,
          y: localCardData.y + dy,
        });

        isDragging.value = false;

        // Don't allow this mouseup to become a click
        e.stopPropagation();
        e.preventDefault();

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

    // In BaseCard.js

    const handleTouchMove = (event) => {
      if (!isDragging.value || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dx = (touch.clientX - dragStart.x) / props.zoomLevel;
      const dy = (touch.clientY - dragStart.y) / props.zoomLevel;

      emit("update-position", {
        uuid: localCardData.uuid,
        x: localCardData.x + dx,
        y: localCardData.y + dy,
        isGroupDrag: props.isSelected,
        preserveSelection: true,
        snap: false,
      });

      dragStart.x = touch.clientX;
      dragStart.y = touch.clientY;
    };

    const handleTouchEnd = (event) => {
      if (!isDragging.value) return;

      emit("update-position", {
        uuid: localCardData.uuid,
        x: localCardData.x,
        y: localCardData.y,
        isGroupDrag: props.isSelected,
        preserveSelection: true,
        snap: true,
      });

      isDragging.value = false;
    };

    const updateTitle = (newTitle) => {
      localCardData.name = newTitle;
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
      
      if (localCardData.display == "default")
        localCardData.display = "minimized";
      else localCardData.display = "default";
    
      emit("update-card", localCardData);

    };

    // Watch for external changes to cardData
    Vue.watch(
      () => props.cardData,
      (newData) => {
        Object.assign(localCardData, {
          ...newData,
          width: newData.width || localCardData.width || 300
        });
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
      startDrag,
      startConnectionDrag,
      updateTitle,
      startDescriptionEdit,
      finishDescriptionEdit,
      handleHeaderClick,
      handleTouchMove,
      handleTouchEnd,
      toggleDisplay,
    };
  },
};