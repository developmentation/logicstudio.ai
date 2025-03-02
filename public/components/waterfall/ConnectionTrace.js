// components/ConnectionTrace.js

export default {
    name: "ConnectionTrace",
    
    props: {
      sourceSlider: {
        type: Object,
        required: true
      },
      targetSlider: {
        type: Object,
        required: true
      },
      connections: {
        type: Array,
        required: true
      }
    },
  
    template: `
      <div 
        class="relative w-full h-16 my-2 bg-gray-850/50 rounded overflow-hidden"
        ref="traceContainer"
      >
        <!-- Circuit Board Pattern Background -->
        <div 
          class="absolute inset-0"
          :style="{
            backgroundImage: 'radial-gradient(circle, rgba(75,85,99,0.2) 1px, transparent 1px)',
            backgroundSize: '16px 16px'
          }"
        ></div>
  
        <!-- SVG Traces -->
        <svg 
          class="absolute inset-0 w-full h-full"
          :viewBox="'0 0 ' + containerWidth + ' ' + containerHeight"
          ref="svgContainer"
        >
          <!-- Connection Lines -->
          <g>
            <template v-for="(trace, index) in computedTraces" :key="index">
              <!-- Main Path -->
              <path
                :d="trace.path"
                :class="[
                  'transition-colors duration-200',
                  trace.isActive ? 'stroke-blue-500' : 'stroke-gray-600'
                ]"
                fill="none"
                stroke-width="2"
                :stroke-dasharray="trace.isAnimating ? '4 4' : 'none'"
              />
  
              <!-- Source Socket Indicator -->
              <circle
                :cx="trace.sourceX"
                :cy="trace.sourceY"
                r="3"
                :class="[
                  'transition-colors duration-200',
                  trace.isActive ? 'fill-blue-500' : 'fill-gray-600'
                ]"
              />
  
              <!-- Target Socket Indicator -->
              <circle
                :cx="trace.targetX"
                :cy="trace.targetY"
                r="3"
                :class="[
                  'transition-colors duration-200',
                  trace.isActive ? 'fill-blue-500' : 'fill-gray-600'
                ]"
              />
  
              <!-- Value Preview (if trace is hovered) -->
              <g 
                v-if="trace.isHovered && trace.value"
                :transform="'translate(' + trace.labelX + ',' + trace.labelY + ')'"
              >
                <rect
                  x="-40"
                  y="-12"
                  width="80"
                  height="24"
                  rx="4"
                  class="fill-gray-800"
                />
                <text
                  x="0"
                  y="4"
                  class="text-xs fill-gray-300 text-center"
                  text-anchor="middle"
                >
                  {{ getPreviewText(trace.value) }}
                </text>
              </g>
            </template>
          </g>
        </svg>
  
        <!-- Connection Count Badges -->
        <div 
          v-if="connections.length > 0"
          class="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 rounded-full text-xs text-gray-300"
        >
          {{ connections.length }} connection{{ connections.length !== 1 ? 's' : '' }}
        </div>
      </div>
    `,
  
    setup(props) {
      // Refs
      const traceContainer = Vue.ref(null);
      const svgContainer = Vue.ref(null);
      const hoveredTraceIndex = Vue.ref(null);
  
      // Constants
      const PADDING = 32;
      const SOCKET_SPACING = 24;
      const VERTICAL_OFFSET = 8;
  
      // Reactive container dimensions
      const containerWidth = Vue.ref(0);
      const containerHeight = Vue.ref(64); // Fixed height
  
      // Computed traces
      const computedTraces = Vue.computed(() => {
        if (!props.connections.length) return [];
  
        return props.connections.map((connection, index) => {
          // Get source and target points
          const sourceX = PADDING;
          const targetX = containerWidth.value - PADDING;
          const sourceY = VERTICAL_OFFSET + (index * SOCKET_SPACING);
          const targetY = sourceY;
  
          // Calculate control points for a circuit-board style path
          const midX = containerWidth.value / 2;
  
          // Create the path
          const path = `
            M ${sourceX} ${sourceY}
            H ${midX - 16}
            L ${midX} ${sourceY}
            L ${midX + 16} ${targetY}
            H ${targetX}
          `;
  
          return {
            sourceX,
            sourceY,
            targetX,
            targetY,
            path,
            labelX: midX,
            labelY: sourceY - 16,
            isActive: connection.isActive,
            isAnimating: connection.isActive,
            isHovered: hoveredTraceIndex.value === index,
            value: connection.value
          };
        });
      });
  
      // Methods
      const updateDimensions = () => {
        if (!traceContainer.value) return;
        containerWidth.value = traceContainer.value.offsetWidth;
      };
  
      const getPreviewText = (value) => {
        if (typeof value === 'string') {
          return value.length > 20 ? value.substring(0, 17) + '...' : value;
        }
        if (typeof value === 'number') {
          return value.toString();
        }
        if (typeof value === 'object') {
          return 'Object';
        }
        return 'Value';
      };
  
      // Event handlers
      const handleTraceHover = (index) => {
        hoveredTraceIndex.value = index;
      };
  
      const handleTraceLeave = () => {
        hoveredTraceIndex.value = null;
      };
  
      // Lifecycle
      Vue.onMounted(() => {
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
  
        // Add hover event listeners to SVG paths
        if (svgContainer.value) {
          const paths = svgContainer.value.querySelectorAll('path');
          paths.forEach((path, index) => {
            path.addEventListener('mouseenter', () => handleTraceHover(index));
            path.addEventListener('mouseleave', handleTraceLeave);
          });
        }
      });
  
      Vue.onUnmounted(() => {
        window.removeEventListener('resize', updateDimensions);
      });
  
      // Watch for changes that might affect dimensions
      Vue.watch(() => props.connections.length, updateDimensions);
  
      return {
        traceContainer,
        svgContainer,
        containerWidth,
        containerHeight,
        computedTraces,
        getPreviewText
      };
    }
  };