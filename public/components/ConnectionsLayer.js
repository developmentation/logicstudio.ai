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
    },
    panOffsetX: {
      type: Number,
      default: 0
    },
    panOffsetY: {
      type: Number,
      default: 0
    }
  },

  template: `
    <div class="relative inset-0 pointer-events-none overflow-visible">
      <svg 
        class="absolute connections-layer"
        style="overflow: visible; pointer-events: none;"
      >
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 -3 6 6"
            refX="5.5"
            refY="0"
            markerWidth="6" 
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M0,-2L5,0L0,2"
              stroke="#64748b"
              stroke-width=".5"
              fill="#64748b"
            />
          </marker>
        </defs>
        
        <g v-if="memoizedConnections.length > 0" 
           >
          
          <path 
            v-for="conn in memoizedConnections" 
            :key="conn.id"
            :d="conn.path"
            :stroke="conn.style.stroke"
            :stroke-width="conn.style.strokeWidth"
            :stroke-dasharray="conn.style.strokeDasharray"
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
    </div>
  `,

  emits: ['connection-click'],

  setup(props, { emit }) {
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
    function calculatePath(connection) {
      if (!connection.sourcePoint || !connection.targetPoint) {
        return '';
      }

      const sx = Number(connection.sourcePoint.x);
      const sy = Number(connection.sourcePoint.y);
      const tx = Number(connection.targetPoint.x);
      const ty = Number(connection.targetPoint.y);

      if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) {
        return '';
      }

      const dx = tx - sx;
      const cx1 = sx + dx * 0.4;
      const cy1 = sy;
      const cx2 = tx - dx * 0.4;
      const cy2 = ty;

      return `M ${sx},${sy} C ${cx1},${cy1} ${cx2},${cy2} ${tx},${ty}`;
    }

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

    const activePath = Vue.computed(() => {
      if (!props.activeConnection) return '';
      return calculatePath({
        sourcePoint: props.activeConnection.startPoint,
        targetPoint: props.activeConnection.currentPoint
      });
    });

    const memoizedConnections = Vue.computed(() => {
      return props.connections.map(conn => ({
        ...conn,
        path: calculatePath(conn),
        style: getConnectionStyle(conn)
      }));
    });

    function handleConnectionClick(event, connectionId) {
      emit('connection-click', event, connectionId);
    }

    return {
      memoizedConnections,
      activePath,
      handleConnectionClick,
    };
  }
};