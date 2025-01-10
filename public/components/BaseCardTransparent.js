// BaseCardTransparent.js
import BaseCardHeader from "./BaseCardHeader.js";

export default {
  name: "BaseCardTransparent",
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
      class="node-card select-none"
      :class="[
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        isSelected ? 'ring-2 ring-blue-500 ring-opacity-50 rounded-md' : ''
      ]"
      :style="{
        position: 'absolute',
        left: localCardData.x + 'px',
        top: localCardData.y + 'px',
        zIndex: isDragging ? 1000 : zIndex,
        width: '300px'
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
      
      <div class="relative">
        <div class="relative">
          <!-- Minimize Button -->
          <div class="absolute right-2 top-1">
            <button 
              class="text-gray-400 hover:text-gray-200"
              @click.stop="toggleDisplay"
            >
              <i :class="['pi text-xs', localCardData.display === 'default' ? 'pi-caret-up' : 'pi-caret-down']"></i>
            </button>
          </div>

          <!-- Content -->
          <div v-show="localCardData.display === 'default'">
            <slot></slot>
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props, { emit }) {
    const localCardData = Vue.reactive({ ...props.cardData });
    const isDragging = Vue.ref(false);
    const dragStart = Vue.reactive({ x: 0, y: 0 });
    const wasDragging = Vue.ref(false);

    const handleCardClick = (event) => {
      if (wasDragging.value) return;

      if (
        event.target.matches(
          'input, textarea, [contenteditable="true"], button'
        ) ||
        event.target.closest(
          'input, textarea, [contenteditable="true"], button'
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

    const startDrag = (event) => {
      const isTouch = event.type === "touchstart";
      const isHeaderDrag = event.isHeader;

      if (
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

      isDragging.value = true;

      const clientX = isTouch ? event.touches[0].clientX : event.clientX;
      const clientY = isTouch ? event.touches[0].clientY : event.clientY;
      dragStart.x = clientX;
      dragStart.y = clientY;

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

    const handleHeaderClick = ({ shiftKey }) => {
      emit("select-card", {
        uuid: localCardData.uuid,
        shiftKey,
      });
    };

    const toggleDisplay = () => {
      localCardData.display = localCardData.display === "default" ? "minimized" : "default";
      emit("update-card", localCardData);
    };

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
      handleCardClick,
      startDrag,
      updateTitle,
      handleHeaderClick,
      handleTouchMove,
      handleTouchEnd,
      toggleDisplay,
    };
  },
};