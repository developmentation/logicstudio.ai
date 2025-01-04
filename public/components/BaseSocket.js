// components/BaseSocket.js
export default {
  name: "BaseSocket",
  props: {
    type: {
      type: String,
      required: true,
      validator: (value) => ["input", "output"].includes(value),
    },
    socketId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    cardId: {
      type: String,
      required: true,
    },
    zoomLevel: {
      type: Number,
      default: 1,
    },
    value: {
      type: [String, Object, Array, Number, Boolean],
      default: null
    },
    hasError: {
      type: Boolean,
      default: false
    },
    isConnected: {
      type: Boolean,
      default: false
    }
  },

  template: `
  <div class="flex items-center relative">
    <!-- Input Label -->
    <span 
      v-if="type === 'input'"
      class="absolute right-full mr-2 text-xs text-white whitespace-nowrap"
    >
      {{ name }}
    </span>

    <!-- Socket Container -->
    <div class="relative">
      <div
        ref="socketElement"
        class="socket"
        :class="[
          'socket-' + type,
          {
            'socket-highlight': isHighlighted,
            'socket-error': hasError,
            'socket-active': isActive,
            'socket-connected': isConnected
          }
        ]"
        @mousedown.stop="handleMouseDown"
        @touchstart.prevent.stop="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @touchend.prevent="handleTouchEnd"
        @touchcancel.prevent="handleTouchEnd"
        :data-socket-id="socketId"
        :data-type="type"
        :data-card-id="cardId"
        :title="socketTooltip"
      >
        <div v-if="hasError" class="absolute -top-4 left-1/2 transform -translate-x-1/2 text-xs text-red-500">!</div>
      </div>

      <!-- Value Indicator -->
      <div 
        v-if="hasValue"
        class="absolute w-1 h-1 rounded-full z-50"
        :class="[type === 'input' ? 'bg-blue-400' : 'bg-green-400']"
        :style="{
          bottom: '-6px',
          left: 'calc(50%)',
          pointerEvents: 'none',
          boxShadow: '0 0 2px rgba(0,0,0,0.3)'
        }"
      ></div>
    </div>

    <!-- Output Label -->
    <span 
      v-if="type === 'output'"
      class="absolute left-full ml-2 text-xs text-white whitespace-nowrap"
    >
      {{ name }}
    </span>
  </div>
`,

  setup(props, { emit }) {
    // Refs
    const socketElement = Vue.ref(null);
    const isHighlighted = Vue.ref(false);
    const isActive = Vue.ref(false);
    const dragStartPoint = Vue.ref(null);

    // Throttling for move events
    let moveThrottleTimer = null;
    const MOVE_THROTTLE = 16; // ~60fps

    // Computed
    const hasValue = Vue.computed(() => {
      return props.value !== null && props.value !== undefined;
    });

    const socketTooltip = Vue.computed(() => {
      if (props.hasError) {
        return "Error in socket connection";
      }
      return props.name || `${props.type} socket`;
    });

    // Calculate socket position
    const calculateSocketPosition = () => {
        if (!socketElement.value) return null;
    
        const rect = socketElement.value.getBoundingClientRect();
        const canvasElem = document.querySelector('.canvas-container'); // Add this selector to your main container
        const canvasRect = canvasElem.getBoundingClientRect();
    

        // console.log("basesocket calculateSocketPosition", {
        //     x: props.type === "input" ? rect.left : rect.right,
        //     y: rect.top + (rect.height / 2) ,
        //     // Add these for debugging
        //     rect: rect,
        //     canvasRect: canvasRect
        // })
        // Calculate relative position within canvas
        return {
            x: props.type === "input" ? rect.left : rect.right,
            y: rect.top + (rect.height / 2) ,
            // Add these for debugging
            rect: rect,
            canvasRect: canvasRect
        };
    };

    // Event Handlers
    const handleMouseDown = (event) => {
      if (event.button !== 0) return; // Left click only
      startDrag(event);
    };

    const startDrag = (event) => {
      event.stopPropagation();
      isActive.value = true;

      const position = calculateSocketPosition();
      if (!position) return;

      dragStartPoint.value = {
        x: event.clientX,
        y: event.clientY
      };

      emit("connection-drag-start", {
        startPoint: position,
        socket: {
          id: props.socketId,
          type: props.type
        },
        cardId: props.cardId,
        type: props.type
      });

      if (event.type === "mousedown") {
        document.addEventListener("mousemove", handleDrag);
        document.addEventListener("mouseup", handleDragEnd);
      }
    };

    const handleDrag = (event) => {
      if (!isActive.value) return;

      // Throttle move events
      if (moveThrottleTimer) return;

      moveThrottleTimer = setTimeout(() => {
        moveThrottleTimer = null;

        const point = event.type.includes("mouse")
          ? { x: event.clientX, y: event.clientY }
          : { x: event.touches[0].clientX, y: event.touches[0].clientY - (window.visualViewport?.offsetTop || 0) };

        emit("connection-drag", {
          socketId: props.socketId,
          currentPoint: point
        });
      }, MOVE_THROTTLE);
    };

    const handleDragEnd = (event) => {
      if (!isActive.value) return;

      isActive.value = false;
      dragStartPoint.value = null;

      if (moveThrottleTimer) {
        clearTimeout(moveThrottleTimer);
        moveThrottleTimer = null;
      }

      emit("connection-drag-end", {
        socketId: props.socketId
      });

      // Clean up event listeners
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchmove", handleDrag);
      document.removeEventListener("touchend", handleDragEnd);
      document.removeEventListener("touchcancel", handleDragEnd);
    };

    // Touch handlers
    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) return;

      event.preventDefault();
      event.stopPropagation();

      const touch = event.touches[0];
      const position = calculateSocketPosition();
      if (!position) return;

      isActive.value = true;
      dragStartPoint.value = {
        x: touch.clientX,
        y: touch.clientY - (window.visualViewport?.offsetTop || 0)
      };

      emit("connection-drag-start", {
        startPoint: position,
        socket: {
          id: props.socketId,
          type: props.type
        },
        cardId: props.cardId,
        type: props.type
      });

      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
      document.addEventListener("touchcancel", handleTouchEnd);
    };

    const handleTouchMove = (event) => {
      if (!isActive.value || event.touches.length !== 1) return;
      event.preventDefault();
      handleDrag(event);
    };

    const handleTouchEnd = (event) => {
      handleDragEnd(event);
    };

    // Set/clear highlight state
    const setHighlight = (value) => {
      isHighlighted.value = value;
    };

    Vue.onMounted(() => {
      emit("socket-mounted", {
        socketId: props.socketId,
        element: socketElement.value,
        setHighlight
      });
    });

    // Cleanup
    Vue.onBeforeUnmount(() => {
      if (moveThrottleTimer) {
        clearTimeout(moveThrottleTimer);
      }
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    });

    return {
      socketElement,
      isHighlighted,
      isActive,
      hasValue,
      socketTooltip,
      handleMouseDown,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      setHighlight
    };
  }
};