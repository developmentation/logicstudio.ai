// composables/useCanvases.js

import { createCanvasRegistry } from "../utils/canvasState/canvasRegistry.js";
import { createExportImport } from "../utils/canvasState/exportImport.js";
import { createSocketConnections } from "../utils/socketManagement/socketConnections.js";
import { createPointCalculation } from "../utils/canvasInteractions/pointCalculation.js";
import { createMouseEvents } from "../utils/canvasInteractions/mouseEvents.js";
import { createTouchEvents } from "../utils/canvasInteractions/touchEvents.js";
import { createZoomPanControls } from "../utils/canvasInteractions/zoomPan.js";
import { createCardPositioning } from "../utils/cardManagement/cardPositioning.js";
import { createCardSelection } from "../utils/cardManagement/cardSelection.js";
import { createCardRegistry } from "../utils/cardManagement/cardRegistry.js";

// Core canvas state
//The main array to handle all the user's canvases
//The concept being that you can have multiple / a full array loaded
const canvases = Vue.ref([]);
const activeCanvasId = Vue.ref(null); //Track the activeCanvas by ID

// UI Refs
const canvasRef = Vue.ref(null);
const zoomLevel = Vue.ref(1);
const isPanning = Vue.ref(false);
const isOverBackground = Vue.ref(false);

// Interaction state
const selectedCardIds = Vue.ref(new Set());
const dragStartPositions = Vue.ref(new Map());
const lastSelectionTime = Vue.ref(null);
const activeConnection = Vue.ref(null);
const nearestSocket = Vue.ref(null);
const selectedConnectionId = Vue.ref(null);

// Touch state
const lastTouchDistance = Vue.ref(null);
const lastTouchCenter = Vue.ref(null);
const connectionTouchStart = Vue.ref(null);

// Pan state
const panStart = Vue.reactive({ x: 0, y: 0 });
const lastScroll = Vue.reactive({ x: 0, y: 0 });
const panBackground = Vue.ref(null);

// Constants
const SNAP_RADIUS = 50;
const GRID_SIZE = 20;
const Z_INDEX_LAYERS = {
  DEFAULT: 1,
  HOVERED: 50,
  SELECTED: 100,
  DRAGGING: 1000,
};

// Actives are set as shortcuts for quick reference throughout the application
// const activeCanvas = Vue.ref(null);
// const activeCards = Vue.ref(null);
// const activeConnections = Vue.ref(null);

// Cache the active canvas index
const activeCanvasIndex = Vue.computed(() => {
  // console.log('Computing activeCanvasIndex...');
  // console.log('Current canvases:', canvases.value.map(c => c.id));
  // console.log('Current activeCanvasId:', activeCanvasId.value);

  if (!activeCanvasId.value || !canvases.value.length) {
    // console.log('Returning 0 due to no activeCanvasId or empty canvases');
    return 0;
  }

  const index = canvases.value.findIndex((c) => {
    // console.log('Comparing', c.id, 'with', activeCanvasId.value);
    return c.id === activeCanvasId.value;
  });

  // console.log('Found index:', index);
  return index;
});

const activeCanvas = Vue.computed({
  get: () => {
    return canvases.value[activeCanvasIndex.value] || null;
  },
  set: (canvas) => {
    if (activeCanvasIndex.value !== -1) {
      canvases.value[activeCanvasIndex.value] = canvas;
    }
  },
});

const activeCards = Vue.computed({
  get: () => {
    return canvases.value[activeCanvasIndex.value]?.cards || [];
  },
  set: (newCards) => {
    if (activeCanvasIndex.value !== -1) {
      canvases.value[activeCanvasIndex.value].cards = newCards;
    }
  },
});

const activeConnections = Vue.computed({
  get: () => {
    return canvases.value[activeCanvasIndex.value]?.connections || [];
  },
  set: (newConnections) => {
    if (activeCanvasIndex.value !== -1) {
      canvases.value[activeCanvasIndex.value].connections = newConnections;
    }
  },
});

export const useCanvases = () => {
  //Global / common functions

  const calculateConnectionPoint = (cardId, socketId, type) => {
    const socketElement = document.querySelector(
      `[data-socket-id="${socketId}"]`
    );
    if (!socketElement) return null;

    const rect = socketElement.getBoundingClientRect();
    const canvasRect = canvasRef.value.getBoundingClientRect();

    const screenX = type === "source" ? rect.right : rect.left;
    const screenY = rect.top + rect.height / 2;

    const canvasX =
      (screenX - canvasRect.left + canvasRef.value.scrollLeft - 4000) /
      zoomLevel.value;
    const canvasY =
      (screenY - canvasRect.top + canvasRef.value.scrollTop - 4000) /
      zoomLevel.value;

    return { x: canvasX, y: canvasY };
  };

  const calculateConnectionPoints = (connectionData) => {
    const { sourceCardId, sourceSocketId, targetCardId, targetSocketId } =
      connectionData;

    const sourcePoint = calculateConnectionPoint(
      sourceCardId,
      sourceSocketId,
      "source"
    );
    const targetPoint = calculateConnectionPoint(
      targetCardId,
      targetSocketId,
      "target"
    );

    if (!sourcePoint || !targetPoint) {
      console.log("connectionData", connectionData);
      console.warn(
        "Could not calculate points for connection:",
        connectionData
      );
      return null;
    }

    return {
      sourcePoint,
      targetPoint,
    };
  };

  // Create registry instances
  //OK
  const canvasRegistry = createCanvasRegistry({
    canvases,
    activeCanvasId,
    activeCanvas,
    activeCards,
    activeConnections,
    activeCanvasIndex,
    serializeCards: () =>
      activeCards.value.map((card) => ({
        ...Vue.toRaw(card),
        zIndex: undefined,
      })),
    deserializeCards: (serializedCards) => {
      if (!activeCanvas.value) return;
      activeCanvas.value.cards = serializedCards.map((card) => ({
        ...card,
        zIndex: 1,
      }));
    },
    serializeConnectionState: () => ({
      connections: activeConnections.value.map((conn) => Vue.toRaw(conn)),
    }),
    deserializeConnectionState: (state) => {
      if (!activeCanvas.value) return;
      activeCanvas.value.connections = state.connections;
    },
  });

  // Create utility instances
  const pointCalculation = createPointCalculation({
    cards: activeCards,
    canvasRef,
    zoomLevel,
    GRID_SIZE,
  });

  const socketConnections = createSocketConnections({
    activeCanvas,
    cards: activeCards,
    connections: activeConnections,
    canvasRef,
    selectedCardIds,
    zoomLevel,
    selectedConnectionId,
    activeConnection,
    nearestSocket,
    selectedCardIds, // Needed for clearing selection
    panBackground, // Used in some connection operation
    selectedCardIds, // Add this to allow clearing card selection in connection clicks
    calculateConnectionPoint,
    calculateConnectionPoints,
    onConnectionStart: (connection) => {
      activeConnection.value = connection;
    },

    onConnectionCreated: (connection) => {
      if (activeCanvas.value) {
        socketConnections.updateCanvasConnections([...activeConnections.value]);
      }
    },
    onConnectionRemoved: (connection) => {
      if (activeCanvas.value) {
        socketConnections.updateCanvasConnections([...activeConnections.value]);
      }
    },
    onValuePropagated: ({ connectionId }) => {
      socketConnections.activateConnection(connectionId);
    },
    getScaledPoint: pointCalculation.getScaledPoint,
  });

  //OK
  const cardRegistry = createCardRegistry({
    updateCardSockets: socketConnections.updateCardSockets,
    activeCards,
    selectedCardIds,
    Z_INDEX_LAYERS,
    activeConnections,
    zoomLevel,
    canvasRef,
  });

  const cardSelection = createCardSelection({
    cards: activeCards,
    selectedCardIds,
    dragStartPositions,
    lastSelectionTime,
    canvasRef,
    Z_INDEX_LAYERS,
  });

  const cardPositioning = createCardPositioning({
    cards: activeCards,
    selectedCardIds,
    dragStartPositions,
    zoomLevel,
    connections: activeConnections,
    canvasRef,

    calculateConnectionPoint,
    calculateConnectionPoints,
    updateConnections: () => {
      activeConnections.value.forEach((conn) => {
        calculateConnectionPoints(conn);
      });
    },
    getScaledPoint: pointCalculation.getScaledPoint,
    emit: (event, value) => {
      if (event === "update:cards" && activeCanvas.value) {
        activeCanvas.value.cards = value;
      }
    },
    GRID_SIZE,
  });

  const zoomPan = createZoomPanControls({
    zoomLevel,
    canvasRef,
    activeConnections,
    updateConnections: () => {
      activeConnections.value.forEach((conn) => {
        calculateConnectionPoints(conn);
      });
    },
    getScaledPoint: pointCalculation.getScaledPoint,
  });

  const mouseEvents = createMouseEvents({
    isPanning,
    isOverBackground,
    panStart,
    lastScroll,
    selectedCardIds,
    dragStartPositions,
    selectedConnectionId,
    connections: activeConnections,
    panBackground,
    activeConnection,
    nearestSocket,
    canvasRef,
    zoomLevel,

    createConnection: socketConnections.createConnection,
    validateConnection: socketConnections.validateConnection,

    updateConnections: () => {
      activeConnections.value.forEach((conn) => {
        calculateConnectionPoints(conn);
      });
    },
    getScaledPoint: pointCalculation.getScaledPoint,
    SNAP_RADIUS: 50,
    findNearestSocket: (point, targetType) => {
      return socketConnections.findNearestSocket(point, targetType);
    },
    validateConnection: socketConnections.validateConnection,
    removeConnection: socketConnections.removeConnection,
    getConnectionStyle: socketConnections.getConnectionStyle,
  });

  const touchEvents = createTouchEvents({
    isPanning,
    panStart,
    lastScroll,
    lastTouchDistance,
    lastTouchCenter,
    connectionTouchStart,
    activeConnection,
    nearestSocket,
    connections: activeConnections,
    canvasRef,
    zoomLevel,
    setZoom: zoomPan.setZoom,
    updateConnections: () => {
      activeConnections.value.forEach((conn) => {
        calculateConnectionPoints(conn);
      });
    },
    getScaledPoint: pointCalculation.getScaledPoint,
    findNearestSocket: socketConnections.findNearestSocket,
    createConnection: socketConnections.createConnection,
    removeConnection: socketConnections.removeConnection,
    validateConnection: socketConnections.validateConnection,
  });

  const exportImport = createExportImport({
    canvases,
    activeCards,
    exportCanvas: canvasRegistry.exportCanvas,
    importCanvas: canvasRegistry.importCanvas,
    zoomLevel,
    canvasRef,
    activeCanvasId,
    cards: activeCards,
    connections: activeConnections,
  });

  const moveCanvasLeft = () => {
    if (!activeCanvasId.value || activeCanvasIndex.value <= 0) return;
    const newIndex = activeCanvasIndex.value - 1;
    if (newIndex >= 0 && newIndex < canvases.value.length) {
      activeCanvasId.value = canvases.value[newIndex].id;
    }
  };

  const moveCanvasRight = () => {
    if (
      !activeCanvasId.value ||
      activeCanvasIndex.value >= canvases.value.length - 1
    )
      return;
    const newIndex = activeCanvasIndex.value + 1;
    if (newIndex >= 0 && newIndex < canvases.value.length) {
      activeCanvasId.value = canvases.value[newIndex].id;
    }
  };

  // Lifecycle hooks
  Vue.onMounted(() => {
    mouseEvents.setup?.();
    touchEvents.setup?.();
    if (canvasRef.value) {
      Vue.nextTick(() => {
        zoomPan.centerCanvas(false);
      });
    }
  });

  Vue.onUnmounted(() => {
    mouseEvents.cleanup?.();
    touchEvents.cleanup?.();
  });

  /////////////// The Orchestrator
// Helper functions remain the same
const findSocketInCard = (card, socketId) => {
  const inputSocket = card.sockets.inputs.find(s => s.id === socketId);
  if (inputSocket) return { socket: inputSocket, type: 'input' };
  
  const outputSocket = card.sockets.outputs.find(s => s.id === socketId);
  if (outputSocket) return { socket: outputSocket, type: 'output' };
  
  return null;
};

const propagateValueThroughConnection = (connection, canvas) => {
  const sourceCard = canvas.cards.find(card => card.uuid === connection.sourceCardId);
  const targetCard = canvas.cards.find(card => card.uuid === connection.targetCardId);
  
  if (!sourceCard || !targetCard) return;

  const sourceResult = findSocketInCard(sourceCard, connection.sourceSocketId);
  const targetResult = findSocketInCard(targetCard, connection.targetSocketId);
  
  //Ive temporarily removed this. Sometimes null is valid.
  // if (!sourceResult || !targetResult) return; // Only update if not null
  // console.log("targetResult.socket.value = sourceResult.socket.value", {target:targetResult.socket.value , source:sourceResult.socket.value})
  targetResult.socket.value = sourceResult.socket.value;
  targetResult.socket.momentUpdated = Date.now();
};

// Helper to clear target socket value when connection is removed
const clearTargetSocket = (connection, canvas) => {
  const targetCard = canvas.cards.find(card => card.uuid === connection.targetCardId);
  if (!targetCard) return;

  const targetResult = findSocketInCard(targetCard, connection.targetSocketId);
  if (!targetResult) return;

  targetResult.socket.value = null;
  targetResult.socket.momentUpdated = Date.now();
};

// Create a computed that only extracts the data we need to watch
const socketAndConnectionState = Vue.computed(() => 
  canvases.value.map(canvas => ({
    id: canvas.id,
    connections: canvas.connections.map(conn => ({
      id: conn.id,
      sourceCardId: conn.sourceCardId,
      sourceSocketId: conn.sourceSocketId,
      targetCardId: conn.targetCardId,
      targetSocketId: conn.targetSocketId
    })),
    socketValues: canvas.cards.map(card => ({
      cardId: card.uuid,
      outputs: card.sockets.outputs.map(socket => ({
        id: socket.id,
        value: socket.value
      }))
    }))
  }))
);

// Watch the computed instead of the entire canvases array
Vue.watch(
  socketAndConnectionState,
  (newState, oldState) => {
    if (!newState?.length) return;
    
    newState.forEach((canvasState, canvasIndex) => {
      const canvas = canvases.value[canvasIndex];
      const oldCanvasState = oldState?.[canvasIndex];
      
      if (oldCanvasState) {
        // Check for deleted connections
        oldCanvasState.connections.forEach(oldConnection => {
          const stillExists = canvasState.connections.some(conn => conn.id === oldConnection.id);
          if (!stillExists) {
            clearTargetSocket(oldConnection, canvas);
          }
        });
      }

      // Check for new connections
      canvasState.connections.forEach(connection => {
        const oldConnection = oldCanvasState?.connections.find(c => c.id === connection.id);
        if (!oldConnection) {
          propagateValueThroughConnection(connection, canvas);
        }
      });

      // Check for socket value changes
      canvasState.socketValues.forEach((cardState) => {
        const oldCardState = oldCanvasState?.socketValues.find(c => c.cardId === cardState.cardId);
        
        cardState.outputs.forEach(output => {
          const oldOutput = oldCardState?.outputs.find(o => o.id === output.id);
          if (oldOutput && output.value !== oldOutput.value) {
            canvas.connections
              .filter(conn => conn.sourceCardId === cardState.cardId && conn.sourceSocketId === output.id)
              .forEach(conn => propagateValueThroughConnection(conn, canvas));
          }
        });
      });
    });
  },
  { 
    deep: true,
    immediate: true
  }
);

  // Comprehensive return statement:
  return {
    // Core State
    canvases,
    activeCanvasId,
    activeCanvas,
    activeCards,
    activeConnections,
    activeCanvasIndex,
    moveCanvasLeft,
    moveCanvasRight,

    // UI State
    canvasRef,
    isPanning,
    isOverBackground,
    zoomLevel,
    panBackground,

    // Selection State
    selectedCardIds,
    dragStartPositions,
    selectedConnectionId,

    // Connection State
    activeConnection,
    nearestSocket,

    // Canvas Management
    ...canvasRegistry,
    updateCanvasConnections: socketConnections.updateCanvasConnections,

    // Card Operations
    createCard: cardRegistry.createCard,
    removeCard: cardRegistry.removeCard,
    updateCardPosition: cardPositioning.updateCardPosition,
    handleCardSelection: cardSelection.handleCardSelection,

    // Connection Management
    createConnection: socketConnections.createConnection,
    removeConnection: socketConnections.removeConnection,
    drawSpline: socketConnections.drawSpline,
    updateConnections: socketConnections.updateConnections,

    // Socket Operations
    updateSocketValue: socketConnections.updateSocketValue,
    getSocketValue: socketConnections.getSocketValue,
    findSocket: socketConnections.findSocket,
    getSocketType: socketConnections.getSocketType,
    propagateValue: socketConnections.propagateValue,
    updateCardSockets: socketConnections.updateCardSockets,

    // Connection Styling & State
    getConnectionStyle: socketConnections.getConnectionStyle,
    getConnectionState: socketConnections.getConnectionState,
    activateConnection: socketConnections.activateConnection,

    // Connection Event Handlers
    handleConnectionDragStart: socketConnections.handleConnectionDragStart,
    handleConnectionDrag: socketConnections.handleConnectionDrag,
    handleConnectionDragEnd: socketConnections.handleConnectionDragEnd,
    handleConnectionClick: socketConnections.handleConnectionClick,
    updateSocketValue: socketConnections.updateSocketValue,
    calculateConnectionPoints,
    // Mouse Event Handlers
    handleBackgroundMouseDown: mouseEvents.handleBackgroundMouseDown,
    handleMouseMove: mouseEvents.handleMouseMove,
    handleMouseUp: mouseEvents.handleMouseUp,
    handleMouseLeave: mouseEvents.handleMouseLeave,

    // Touch Event Handlers
    handleTouchStart: touchEvents.handleTouchStart,
    handleTouchMove: touchEvents.handleTouchMove,
    handleTouchEnd: touchEvents.handleTouchEnd,

    // Zoom/Pan Controls
    handleWheel: zoomPan.handleWheel,
    zoomIn: zoomPan.zoomIn,
    zoomOut: zoomPan.zoomOut,
    centerCanvas: zoomPan.centerCanvas,
    getZoomPercent: zoomPan.getZoomPercent,
    setZoom: zoomPan.setZoom,

    // Point Calculation
    getScaledPoint: pointCalculation.getScaledPoint,
    getWorldPoint: pointCalculation.getScaledPoint,
    findNearestSocket: socketConnections.findNearestSocket,
    validateConnection: socketConnections.validateConnection,

    // Import/Export
    ...exportImport,

    // Constants
    CONNECTION_STATES: socketConnections.CONNECTION_STATES,
    CONNECTION_STYLES: socketConnections.CONNECTION_STYLES,
    SOCKET_TYPES: socketConnections.SOCKET_TYPES,
    SNAP_RADIUS: socketConnections.SNAP_RADIUS,
    Z_INDEX_LAYERS,

    // Cleanup
    cleanup: () => {
      mouseEvents.cleanup?.();
      touchEvents.cleanup?.();
      socketConnections.cleanup?.();
    },
  };
};
