const CONNECTION_STATES = {
    DEFAULT: "default",
    SELECTED: "selected",
    ACTIVE: "active",
    PREVIEW: "preview"
  };
  
  const CONNECTION_STYLES = {
    [CONNECTION_STATES.DEFAULT]: {
      stroke: "#64748b",
      strokeWidth: "2",
      fill: "transparent"
    },
    [CONNECTION_STATES.SELECTED]: {
      stroke: "#FFD700",
      strokeWidth: "4",
      fill: "transparent"
    },
    [CONNECTION_STATES.ACTIVE]: {
      stroke: "#4CAF50",
      strokeWidth: "2",
      fill: "transparent"
    },
    [CONNECTION_STATES.PREVIEW]: {
      stroke: "#64748b",
      strokeWidth: "2",
      fill: "transparent",
      strokeDasharray: "5,5"
    }
  };
  
  // Custom throttle implementation
  function useThrottle(fn, delay) {
    let lastCall = 0;
    let timeout = null;
  
    const throttled = (...args) => {
      const now = Date.now();
  
      if (now - lastCall >= delay) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        fn(...args);
        lastCall = now;
      } else if (!timeout) {
        timeout = setTimeout(() => {
          fn(...args);
          lastCall = Date.now();
          timeout = null;
        }, delay - (now - lastCall));
      }
    };
  
    Vue.onUnmounted(() => {
      if (timeout) {
        clearTimeout(timeout);
      }
    });
  
    return throttled;
  }
  
  export default {
    name: 'ConnectionsLayer',
    
    props: {
      connections: {
        type: Array,
        required: true,
        default: () => []
      },
      activeConnection: {
        type: Object,
        default: null
      },
      selectedConnectionId: {
        type: String,
        default: null
      },
      zoomLevel: {
        type: Number,
        required: true
      },
      canvasRef: {
        type: Object,
        required: false,
        default: null
      }
    },
  
    template: `
      <svg 
        class="absolute connections-layer"
        :style="{
          width: '8000px',
          height: '8000px',
          top: '-4000px',
          left: '-4000px',
          pointerEvents: 'none',
          transform: 'translateZ(0)' // Force GPU acceleration
        }"
      >
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 -3 6 6"
            refX="4"
            refY="-.3"
            markerWidth="6" 
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M0,-2.0L5,0L0,2.0"
              stroke="#64748b"
              stroke-width=".5"
              fill="#64748b"
            />
          </marker>
        </defs>
        
        <g class="connections">
          <path 
            v-for="conn in memoizedConnections" 
            :key="conn.id"
            :d="conn.path"
            :stroke="conn.style.stroke"
            :stroke-width="conn.style.strokeWidth"
            fill="none"
            style="pointer-events: all; cursor: pointer;"
            marker-end="url(#arrowhead)"
            @mousedown.stop
            @click.stop="(e) => handleConnectionClick(e, conn.id)"
          />
        </g>
        
        <path
          v-if="activeConnection"
          :d="activePath"
          stroke="#64748b"
          stroke-dasharray="5,5"
          stroke-width="2"
          fill="transparent"
          marker-end="url(#arrowhead)"
        />
      </svg>
    `,
  
    emits: ['connection-click', 'update:connections'],
  
    setup(props, { emit }) {
      const canvasRect = Vue.ref(null);
      const connectionPaths = Vue.ref(new Map());
      const rafId = Vue.ref(null);
  
      // Computed properties for optimized rendering
      const memoizedConnections = Vue.computed(() => {
        return props.connections.map(conn => ({
          ...conn,
          path: connectionPaths.value.get(conn.id) || calculatePath(conn),
          style: getConnectionStyle(conn)
        }));
      });
  
      const activePath = Vue.computed(() => {
        if (!props.activeConnection) return '';
        return drawSpline(
          props.activeConnection.startPoint,
          props.activeConnection.currentPoint
        );
      });
  
      // Connection style calculation
      function getConnectionStyle(connection) {
        if (!connection) return CONNECTION_STYLES[CONNECTION_STATES.DEFAULT];
        
        if (connection.id === props.selectedConnectionId) {
          return CONNECTION_STYLES[CONNECTION_STATES.SELECTED];
        }
        
        if (connection.isActive) {
          return CONNECTION_STYLES[CONNECTION_STATES.ACTIVE];
        }
        
        if (connection === props.activeConnection) {
          return CONNECTION_STYLES[CONNECTION_STATES.PREVIEW];
        }
        
        return CONNECTION_STYLES[CONNECTION_STATES.DEFAULT];
      }
  
      function calculatePath(connection) {
        if (!connection.sourcePoint || !connection.targetPoint) return '';
        return drawSpline(connection.sourcePoint, connection.targetPoint);
      }
  
      function drawSpline(source, target) {
        if (!source || !target) return '';
  
        const sx = Number(source.x);
        const sy = Number(source.y);
        const tx = Number(target.x);
        const ty = Number(target.y);
  
        if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) {
          console.warn("Invalid coordinates in drawSpline:", { source, target });
          return '';
        }
  
        const offsetX = sx + 4000;
        const offsetY = sy + 4000;
        const offsetTX = tx + 4000;
        const offsetTY = ty + 4000;
  
        const dx = offsetTX - offsetX;
  
        // Control points for smooth curve
        const cx1 = offsetX + dx * 0.4;
        const cy1 = offsetY;
        const cx2 = offsetTX - dx * 0.4;
        const cy2 = offsetTY;
  
        return `M ${offsetX},${offsetY} C ${cx1},${cy1} ${cx2},${cy2} ${offsetTX},${offsetTY}`;
      }
  
      // Throttled update function
      const updateConnectionPaths = useThrottle(() => {
        if (!props.connections.length) return;
  
        const newPaths = new Map();
        let hasChanges = false;
  
        props.connections.forEach(conn => {
          const newPath = calculatePath(conn);
          const currentPath = connectionPaths.value.get(conn.id);
          
          if (newPath !== currentPath) {
            hasChanges = true;
            newPaths.set(conn.id, newPath);
          } else {
            newPaths.set(conn.id, currentPath);
          }
        });
  
        if (hasChanges) {
          connectionPaths.value = newPaths;
        }
      }, 16);
  
      // Watch for canvasRef changes
      Vue.watch(() => props.canvasRef?.value, (newRef) => {
        if (newRef) {
          updateBoundingRect();
        }
      });
  
      // Watch for changes that require path updates
      Vue.watch(() => [props.connections, props.zoomLevel], () => {
        if (rafId.value) {
          cancelAnimationFrame(rafId.value);
        }
        rafId.value = requestAnimationFrame(updateConnectionPaths);
      }, { deep: true });
  
      function handleConnectionClick(event, connectionId) {
        emit('connection-click', event, connectionId);
      }
  
      Vue.onMounted(() => {
        updateBoundingRect();
        window.addEventListener('resize', updateBoundingRect);
      });
  
      Vue.onUnmounted(() => {
        window.removeEventListener('resize', updateBoundingRect);
        if (rafId.value) {
          cancelAnimationFrame(rafId.value);
        }
      });
  
      function updateBoundingRect() {
        if (props.canvasRef?.value) {
          canvasRect.value = props.canvasRef.value.getBoundingClientRect();
        }
      }
  
      return {
        memoizedConnections,
        activePath,
        handleConnectionClick
      };
    },
  };