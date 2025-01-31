// components/Studio.js

import { useCanvases } from "../composables/useCanvases.js";
import ModelCard from "./ModelCard.js";
import TriggerCard from "./TriggerCard.js";
import AgentCard from "./AgentCard.js";
import TextCard from "./TextCard.js";
import ChatCard from "./ChatCard.js";
import InputCard from "./InputCard.js";
import OutputCard from "./OutputCard.js";
import JoinCard from "./JoinCard.js";
import ViewCard from "./ViewCard.js";
import LabelCard from "./LabelCard.js";
import TemplateCard from "./TemplateCard.js";
import WebCard from "./WebCard.js";
import GitHubCard from "./GitHubCard.js";
import ApiCard from "./ApiCard.js";
import PDFCard from "./PDFCard.js";
import TranscribeCard from "./TranscribeCard.js";
import CanvasToolbar from "./CanvasToolbar.js";
import CanvasTemplatesToolbar from "./CanvasTemplatesToolbar.js";

import ConnectionsLayer from "./ConnectionsLayer.js";

export default {
  name: "Studio",
  components: {
    ModelCard,
    TriggerCard,
    AgentCard,
    TextCard,
    ChatCard,
    InputCard,
    OutputCard,
    JoinCard,
    ViewCard,
    LabelCard,
    TemplateCard,
    WebCard,
    GitHubCard,
    ApiCard,
    PDFCard,
    TranscribeCard,
    CanvasToolbar,
    CanvasTemplatesToolbar,
    ConnectionsLayer,
  },
  template: `
  <div class="absolute inset-0 flex flex-col overflow-hidden">
    <!-- Top Toolbar -->
    <div class="flex items-center space-x-2 p-2 bg-gray-800 select-none z-40">
        <div class="flex items-center gap-2">
            <button
                class="px-2 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                @click="createCanvas()">
                <i class="pi pi-plus mt-1"></i>
            </button>


            <input type="text" v-if="activeCanvas" v-model="activeCanvas.name" placeholder="Canvas Name"
                class="w-[32rem] !px-3 !py-2 !bg-gray-800 !text-gray-100 border-gray-700 !rounded-md" :class="[
                  'hover:border-gray-600',
                  'focus:!ring-2 focus:!ring-green-500 focus:!border-transparent !outline-none'
              ]" />
            <div v-if="canvases.length > 0" class="flex items-center gap-2">
                <button @click="moveCanvasLeft"
                    class="px-2 py-1 text-gray-300 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                    <i class="pi pi-chevron-left"></i>
                </button>
                <span class="text-sm text-gray-300">
                    {{ (activeCanvasIndex || 0) + 1 }} of {{ canvases.length }}
                </span>
                <button @click="moveCanvasRight"
                    class="px-2 py-1 text-gray-300 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                    <i class="pi pi-chevron-right"></i>
                </button>
            </div>

            <button
                class="px-2 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                @click="cloneCanvas">
                <i class="pi pi-copy mt-1"></i>
            </button>

            <button
                class="px-2 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                @click="importFromJSON">
                <i class="pi pi-cloud-upload mt-1"></i>
            </button>
            <button
                class="px-2 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                @click="exportToJSON">
                <i class="pi pi-cloud-download mt-1"></i>
            </button>
        </div>

        <div class="flex-1"></div>
        <button
            class="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            @click="zoomIn">
            <i class="pi pi-search-plus mt-1"></i>
        </button>
        <button
            class="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            @click="zoomOut">
            <i class="pi pi-search-minus mt-1"></i>
        </button>
        <div class="text-gray-400 text-sm ml-2">
            {{ getZoomPercent() }}%
        </div>

        <button
            class="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            @click="closeCanvas">
            <i class="pi pi-times mt-1 "></i>
        </button>
    </div>

    <!-- Main Content Area -->
    <div class="relative flex-1 bg-gray-900">
        <!-- Toolbars stay the same -->
        <CanvasToolbar class="z-50" @add-card="handleToolbarAction" @export-png="exportToPNG"
            @export-json="exportToJSON" @import-json="importFromJSON" @update:expanded="(val) => toolbarExpanded = val"
            @update:show-text="(val) => toolbarShowText = val" />
        <CanvasTemplatesToolbar :canvas-templates="canvasTemplates" @add-canvas="handleAddCanvas" />


        <!-- Scrollable Canvas Container -->
        <div class="absolute inset-0 canvas-container overflow-auto" ref="canvasRef" @wheel.prevent="handleWheel"
            @scroll="handleScroll" @touchstart.prevent="handleTouchStart" @touchmove.prevent="handleTouchMove"
            @touchend.prevent="handleTouchEnd">

            <!-- Pan Background - Fixed 8000x8000 -->
            <div class="absolute pan-background" ref="panBackground" @mousedown="handleBackgroundMouseDown"
                @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseLeave" :style="{
           cursor: isPanning ? 'grabbing' : isOverBackground ? 'grab' : 'default',
           width: '8000px',
           height: '8000px',
           position: 'absolute',
           top: '0',
           left: '0'
         }">
                <!-- Grid Background -->
                <div class="absolute inset-0" :style="{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: \`\${20 * zoomLevel}px \${20 * zoomLevel}px\`,
            backgroundPosition: 'center center',
            pointerEvents: 'none',
            width: '100%',
            height: '100%'
        }"></div>

                <!-- Content Layer -->
                <div class="absolute" :style="{
          transform: \`scale(\${zoomLevel})\`,
          top: '4000px',
          left: '4000px',
          transformOrigin: '0 0'
        }">
                    <!-- Rest of content -->
                    <ConnectionsLayer v-if="canvasRef" :connections="activeConnections"
                        :active-connection="activeConnection" :selected-connection-id="selectedConnectionId"
                        :zoom-level="zoomLevel" :canvas-ref="canvasRef" :pan-offset-x="panOffset.x"
                        :pan-offset-y="panOffset.y" @connection-click="handleConnectionClick" />

                    <div class="relative" style="pointer-events: none;">


                        <component v-for="card in activeCards" :key="card.uuid" :is="getCardComponent(card.type)"
                            :cardData="card" :zoomLevel="zoomLevel" :zIndex="card.ui.zIndex"
                            :is-selected="selectedCardIds.has(card.uuid)" @update-position="updateCardPosition"
                            @drag-start="handleDragStartCard" @drag="handleDragCard" @drag-end="handleDragEndCard"
                            @update-card="updateCard" @update-socket-value="updateSocketValue"
                            @connection-drag-start="handleConnectionDragStart" @connection-drag="handleConnectionDrag"
                            @connection-drag-end="handleConnectionDragEnd" @close-card="removeCard"
                            @clone-card="cloneCard" @manual-trigger="handleManualTrigger"
                            @sockets-updated="handleSocketsUpdated" @select-card="handleCardSelection"
                            style="pointer-events: auto;" />


                    </div>

                </div>
            </div>
        </div>

    </div>
</div>
  `,

  setup() {
    // Get canvas functionality from composable
    const {
      //Templates
      canvasTemplates,

      // Core state
      canvases,
      activeCanvas,
      activeCards,
      connections,
      zoomLevel,
      canvasRef,
      isPanning,
      isOverBackground,
      selectedCardIds,
      activeConnection,
      nearestSocket,
      activeConnections,
      activateConnection,

      activeCanvasId,
      activeCanvasIndex,
      moveCanvasLeft,
      moveCanvasRight,

      // Canvas management
      createCanvas,
      removeCanvas,
      cloneCanvas,

      // Card management
      createCard,
      removeCard,
      cloneCard,
      updateCardPosition,

      //Connections management
      createConnection,
      removeConnection,
      socketRegistry,
      socketConnections,
      updateConnections,
      updateSocketValue,
      updateCardSockets,

      // Event handlers - Note the renamed handler
      handleBackgroundMouseDown, // This is what we got from useCanvases
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleWheel,
      handleCardSelection,
      handleConnectionClick,
      handleConnectionDragStart,
      handleConnectionDrag,
      handleConnectionDragEnd,

      handleStartDrag,
      handleDrag,
      handleDragEnd,


      findNearestSocket,
      selectedConnectionId,

      // Drawing utilities
      drawSpline,
      getConnectionStyle,

      // Import/Export
      exportToPNG,
      exportToJSON,
      importFromJSON,

      // Zoom/Pan controls
      zoomIn,
      zoomOut,
      centerCanvas,
      getZoomPercent,
      setZoom,
      panBackground,

      // Other utilities
      getScaledPoint,
      getWorldPoint,

      Z_INDEX_LAYERS,
      validateConnection,
      calculateConnectionPoints,
    } = useCanvases();

    // Local state
    const toolbarExpanded = Vue.ref(true);
    const toolbarShowText = Vue.ref(true);
    const initialized = Vue.ref(false);

    const panOffset = Vue.reactive({ x: 0, y: 0 });

    Vue.onMounted(() => {
      // Add keyboard event listener
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", handleScroll);

      // Initial setup
      requestAnimationFrame(() => {
        if (!activeCanvas.value) {
          createCanvas();
        }

        if (canvasRef.value) {
          // Set initial pan offset
          panOffset.x = canvasRef.value.scrollLeft;
          panOffset.y = canvasRef.value.scrollTop;

          // Center the canvas
          centerCanvas(false);

          // Update offset after centering
          Vue.nextTick(() => {
            panOffset.x = canvasRef.value.scrollLeft;
            panOffset.y = canvasRef.value.scrollTop;
          });
        }
      });
    });

    Vue.onUnmounted(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScroll);
      initialized.value = false;
    });

    const closeCanvas = () => {
      removeCanvas(activeCanvasId.value);
    };

    // Component utility functions
    const getCardComponent = (type) => {
      switch (type) {
        case "model":
          return "ModelCard";
        case "trigger":
          return "TriggerCard";
        case "agent":
          return "AgentCard";
        case "text":
          return "TextCard";
        case "chat":
          return "ChatCard";
        case "input":
          return "InputCard";
        case "output":
          return "OutputCard";
        case "join":
          return "JoinCard";
        case "view":
          return "ViewCard";
        case "label":
          return "LabelCard";
        case "web":
          return "WebCard";
        case "github":
          return "GitHubCard";
        case "api":
          return "ApiCard";
          case "pdf":
            return "PDFCard";
          case "transcribe":
          return "TranscribeCard";
        case "template":
          return "TemplateCard";
      }
    };

    //
    const handleToolbarAction = (action) => {
      const cardId = createCard(action, null);
    
      if (cardId) {
        // Find the newly created card
        const newCard = activeCards.value.find(card => card.uuid === cardId);
        if (newCard) {
          // Preserve the position that was set in createCard
          const structuredCard = {
            uuid: newCard.uuid,
            type: newCard.type,
            ui: {
              name: newCard.name || '',
              description: newCard.description || '',
              display: newCard.display || '',
              x: newCard.ui.x,  // Preserve the x position
              y: newCard.ui.y,  // Preserve the y position
              width: newCard.width ,
              height: newCard.height ,
              zIndex: Z_INDEX_LAYERS.SELECTED
            },
            data: {
              sockets: {
                inputs: newCard.sockets?.inputs || [],
                outputs: newCard.sockets?.outputs || []
              }
            }
          };
          
          updateCard(structuredCard);
        }
      }
    };


    const handleAddCanvas = (newCanvas) => {
      canvases.value.push(newCanvas);
      activeCanvasId.value = newCanvas.id;
    };

    const handleManualTrigger = (cardData) => {
      const connections = activeConnections.value.filter(
        conn => conn.sourceCardId === cardData.uuid
      );
    
      connections.forEach(conn => {
        const sourceCard = activeCards.value.find(c => c.uuid === conn.sourceCardId);
        const targetCard = activeCards.value.find(c => c.uuid === conn.targetCardId);
    
        if (sourceCard && targetCard) {
          const sourceSocket = sourceCard.data.sockets.outputs.find(
            s => s.id === conn.sourceSocketId
          );
          if (sourceSocket && sourceSocket.value !== null) {
            updateSocketValue(
              targetCard.uuid,
              conn.targetSocketId,
              sourceSocket.value
            );
          }
        }
      });
    };
    

  
    const handleDragStartCard = ({ event, cardId }) => {
      // console.log('Drag Start Event:', { 
      //   type: event.type,
      //   clientX: event.clientX,
      //   clientY: event.clientY,
      //   cardId 
      // });
    
      // Ensure we have a valid event
      if (!event || (!event.clientX && !event.touches)) {
        console.warn('Invalid event in handleDragStartCard');
        return;
      }
    
      const result = handleStartDrag(event, cardId);
      if (!result) return;
    
      // console.log('Start Drag Results:', {
      //   dragOrigin: result.dragOrigin,
      //   isDragging: result.isDragging,
      //   selectedCards: Array.from(selectedCardIds.value)
      // });
    
      // Set initial positions for selected cards
      selectedCardIds.value.forEach((id) => {
        const card = activeCards.value.find(c => c.uuid === id);
        if (card) {
          card.ui = {
            ...card.ui,
            zIndex: Z_INDEX_LAYERS.DRAGGING
          };
        }
      });
    
      // Force reactivity update
      activeCards.value = [...activeCards.value];
    };
    
    const handleDragCard = ({ event }) => {
      // Ensure we have a valid event
      if (!event || (!event.clientX && !event.touches)) {
        console.warn('Invalid event in handleDragCard');
        return;
      }
    
      // console.log('Drag Event:', {
      //   type: event.type,
      //   clientX: event.clientX,
      //   clientY: event.clientY
      // });
    
      const result = handleDrag(event);
      // console.log('Drag Results:', { 
      //   hasUpdates: !!result?.updatedCards,
      //   cardCount: result?.updatedCards?.length
      // });
    
      if (!result?.updatedCards) return;
    
      // Update all cards in a batch
      activeCards.value = result.updatedCards;
    
      // Defer connection updates
      requestAnimationFrame(() => {
        selectedCardIds.value.forEach(cardId => {
          updateConnections(cardId);
        });
      });
    };
    
    const handleDragEndCard = ({ event }) => {
      // Ensure we have a valid event
      if (!event || (!event.clientX && !event.changedTouches)) {
        console.warn('Invalid event in handleDragEndCard');
        return;
      }
    
      // console.log('Drag End Event:', {
      //   type: event.type,
      //   clientX: event.clientX,
      //   clientY: event.clientY
      // });
    
      const result = handleDragEnd(event);
      if (!result?.updatedCards) return;
    
      // Batch update the cards
      activeCards.value = result.updatedCards;
    
      // Final connection update
      requestAnimationFrame(() => {
        selectedCardIds.value.forEach(cardId => {
          updateConnections(cardId);
        });
      });
    };
    
const updateCard = (updates) => {

  const cardIndex = activeCards.value.findIndex(c => c.uuid === updates.uuid);
  if (cardIndex === -1) return;

  // Create a new object preserving the structure
  const currentCard = activeCards.value[cardIndex];
  const updatedCard = {
    uuid: currentCard.uuid,
    type: currentCard.type,
    ui: {
      ...currentCard.ui,
      ...(updates.ui || {}),
    },
    data: {
      ...currentCard.data,
      ...(updates.data || {}),
    }
  };

  // For Legacy: Handle legacy updates that might come in flat
  // if (updates.x !== undefined) updatedCard.ui.x = updates.x;
  // if (updates.y !== undefined) updatedCard.ui.y = updates.y;
  // if (updates.width !== undefined) updatedCard.ui.width = updates.width;
  // if (updates.height !== undefined) updatedCard.ui.height = updates.height;
  // if (updates.zIndex !== undefined) updatedCard.ui.zIndex = updates.zIndex;
  
  // Update timestamp
  updatedCard.momentUpdated = Date.now();
  
  // Update the card in the array
  activeCards.value[cardIndex] = updatedCard;
  
  // Force reactivity update
  activeCards.value = [...activeCards.value];

  updateConnections(updates.uuid);
};


    // Throttle utility
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

    const handleScroll = useThrottle((event) => {
      if (canvasRef.value) {
        panOffset.x = canvasRef.value.scrollLeft;
        panOffset.y = canvasRef.value.scrollTop;
      }
    }, 16);


    const handleSocketsUpdated = async ({ oldSockets, newSockets, cardId, reindexMap, deletedSocketIds, type }) => {
      const card = activeCards.value.find(c => c.uuid === cardId);
      if (!card) return;
    
      // Filter out connections to deleted sockets
      activeConnections.value = activeConnections.value.filter(conn => {
        if (type === "input" && conn.targetCardId === cardId) {
          return !deletedSocketIds.includes(conn.targetSocketId);
        }
        if (type === "output" && conn.sourceCardId === cardId) {
          return !deletedSocketIds.includes(conn.sourceSocketId);
        }
        return true;
      });
    
      // Update remaining connections
      activeConnections.value = activeConnections.value.map(conn => {
        if (type === "input" && conn.targetCardId === cardId) {
          const oldIndex = oldSockets.findIndex(s => s.id === conn.targetSocketId);
          if (oldIndex !== -1) {
            const newIndex = reindexMap.get(conn.targetSocketId); // Use Map.get() instead of array indexing
            if (newIndex !== undefined) {  // Check if we got a valid index
              const newSocket = newSockets[newIndex];
              if (newSocket) {  // Verify we have a valid socket
                return { ...conn, targetSocketId: newSocket.id };
              }
            }
          }
        } else if (type === "output" && conn.sourceCardId === cardId) {
          const oldIndex = oldSockets.findIndex(s => s.id === conn.sourceSocketId);
          if (oldIndex !== -1) {
            const newIndex = reindexMap.get(conn.sourceSocketId); // Use Map.get() instead of array indexing
            if (newIndex !== undefined) {  // Check if we got a valid index
              const newSocket = newSockets[newIndex];
              if (newSocket) {  // Verify we have a valid socket
                return { ...conn, sourceSocketId: newSocket.id };
              }
            }
          }
        }
        return conn;
      });
    
      // Update card's socket structure
      if (type === "input") {
        card.data.sockets.inputs = newSockets;
      } else if (type === "output") {
        card.data.sockets.outputs = newSockets;
      }
    
      await Vue.nextTick();
    
      // Recalculate connection points
      requestAnimationFrame(() => {
        const updatedConnections = activeConnections.value.map(conn => {
          if ((type === "input" && conn.targetCardId === cardId) ||
              (type === "output" && conn.sourceCardId === cardId)) {
            const points = calculateConnectionPoints({
              sourceCardId: conn.sourceCardId,
              sourceSocketId: conn.sourceSocketId,
              targetCardId: conn.targetCardId,
              targetSocketId: conn.targetSocketId
            });
            return { ...conn, ...points };
          }
          return conn;
        });
    
        activeConnections.value = updatedConnections;
      });
    };
    
    const handleKeyDown = (event) => {
      // First check if we're in an input element
      const target = event.target;

      // Check if we're in any kind of input element
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true"
      ) {
        // Always allow normal typing in input elements
        return;
      }

      // Now handle deletion keys
      if (event.key === "Delete" || event.key === "Backspace") {
        // Handle connection deletion first if one is selected
        if (selectedConnectionId.value) {
          const connIndex = activeConnections.value.findIndex(
            (conn) => conn.id === selectedConnectionId.value
          );

          if (connIndex !== -1) {
            removeConnection(selectedConnectionId.value);
            // Force reactivity update
            activeConnections.value = [...activeConnections.value];
            selectedConnectionId.value = null;
          }
          event.preventDefault();
          return;
        }

        // Then handle card deletion if cards are selected
        if (selectedCardIds.value.size > 0) {
          const cardsToRemove = Array.from(selectedCardIds.value);
          cardsToRemove.forEach(removeCard);
          selectedCardIds.value.clear();
          event.preventDefault();
          return;
        }
      }
    };

    // Watch for zoom changes to update connections
    // Vue.watch(
    //   zoomLevel,
    //   () => {
    //     Vue.nextTick(() => {
    //       if (canvasRef.value) {
    //         panOffset.x = canvasRef.value.scrollLeft;
    //         panOffset.y = canvasRef.value.scrollTop;
    //       }
    //     });
    //   },
    //   { flush: "post" }
    // );

    return {
      //Templates
      canvasTemplates,

      // State
      canvases,
      activeCanvas,
      activeCards,
      activeConnections,
      connections,
      activateConnection,
      zoomLevel,
      canvasRef,
      isPanning,
      isOverBackground,
      selectedCardIds,
      activeConnection,
      nearestSocket,
      toolbarExpanded,
      toolbarShowText,
      selectedConnectionId,

      activeCanvasIndex,
      activeCanvasId,
      closeCanvas,
      moveCanvasLeft,
      moveCanvasRight,
      createCanvas,
      cloneCanvas,

      // Functions
      getCardComponent,
      getConnectionStyle,
      handleToolbarAction,
      handleAddCanvas,
      handleConnectionClick,
      handleManualTrigger,
      updateCard,
      handleSocketsUpdated,
      updateCardSockets,

      // Event handlers
      // Event handlers
      handleBackgroundMouseDown, // Changed from handleMouseDown
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleWheel,
      handleCardSelection,
      findNearestSocket,
      selectedConnectionId,

      handleConnectionDragStart,
      handleConnectionDrag,
      handleConnectionDragEnd,


      handleDragStartCard,
      handleDragCard,
      handleDragEndCard,
      
      //   handleSocketDragStart,
      //   handleSocketDrag,
      //   handleSocketDragEnd,

      // Operations
      updateCardPosition,
      removeCard,
      cloneCard,

      drawSpline,
      updateSocketValue,
      panBackground,

      // Zoom/Pan controls
      zoomIn,
      zoomOut,
      getZoomPercent,

      // Export/Import
      exportToPNG,
      exportToJSON,
      importFromJSON,

      panOffset,
      handleScroll,

      Z_INDEX_LAYERS,
    };
  },
};
