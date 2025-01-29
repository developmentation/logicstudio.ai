// cardUtils.js

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
} from "../socketManagement/socketRemapping.js";

/**
 * Creates a standard card data structure with proper defaults
 */

export const SOCKET_TYPES = {
  INPUT: "input",
  OUTPUT: "output",
};

const initializeSocket = (socketData, type = SOCKET_TYPES.INPUT) => {
  if (!socketData) return null;

  return {
    ...socketData,
    type: socketData.type || type, // Ensure type is preserved or defaulted
    id:
      socketData.id ||
      `socket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    value: socketData.value ?? null,
    momentUpdated: Date.now(),
  };
};

export const initializeCardData = (data, defaultConfig = {}) => {
  const {
    defaultName = "Card",
    defaultDescription = "Card Node",
    defaultWidth = 300,
    defaultHeight = 150,
    defaultDisplay = "default",
  } = defaultConfig;

  // Initialize socket arrays with proper typing
  const inputs = (data.data?.sockets?.inputs || []).map((socket) =>
    initializeSocket(socket, SOCKET_TYPES.INPUT)
  );

  const outputs = (data.data?.sockets?.outputs || []).map((socket) =>
    initializeSocket(socket, SOCKET_TYPES.OUTPUT)
  );

  return {
    uuid: data.uuid,
    type: data.type,
    ui: {
      name: data.ui?.name || defaultName,
      description: data.ui?.description || defaultDescription,
      display: data.ui?.display || defaultDisplay,
      x: data.ui?.x || 0,
      y: data.ui?.y || 0,
      width: data.ui?.width || defaultWidth,
      height: data.ui?.height || defaultHeight,
      zIndex: data.ui?.zIndex || 1,
    },
    data: {
      ...data.data,
      sockets: {
        inputs,
        outputs,
      },
    },
  };
};
/**
 * Creates base setup for card components with common state and utilities
 */
export const useCardSetup = (props, emit) => {
  const socketRegistry = new Map();
  const connections = Vue.ref(new Set());
  const isProcessing = Vue.ref(false);

  const getSocketConnections = (socketId) => connections.value.has(socketId);

  const handleSocketMount = (event) => {
    if (!event) return;
    socketRegistry.set(event.socketId, {
      element: event.element,
      cleanup: [],
    });
  };

  const cleanup = () => {
    socketRegistry.forEach((socket) =>
      socket.cleanup.forEach((cleanup) => cleanup())
    );
    socketRegistry.clear();
    connections.value.clear();
  };

  return {
    socketRegistry,
    connections,
    isProcessing,
    getSocketConnections,
    handleSocketMount,
    cleanup,
  };
};


/**
 * Setup watchers for card data updates
 */
// cardUtils.js - Updated setupCardDataWatchers
export const setupCardDataWatchers = (params) => {
  const { props, localCardData, isProcessing, emit } = params;

  // Watch for changes to x and y position
  const updatePosition = (newX, newY) => {
    if (!isProcessing.value) {
      if (newX !== undefined) localCardData.value.ui.x = newX;
      if (newY !== undefined) localCardData.value.ui.y = newY;
    }
  };

  // Watch for changes to display state
  const updateDisplay = (newDisplay) => {
    if (newDisplay !== undefined && !isProcessing.value) {
      localCardData.value.ui.display = newDisplay;
    }
  };

  return {
    position: (newVal, oldVal) => {
      if (newVal?.x !== oldVal?.x) updatePosition(newVal.x, undefined);
      if (newVal?.y !== oldVal?.y) updatePosition(undefined, newVal.y);
    },
    display: updateDisplay,
  };
};

//Comprehensive socket watcher
// Enhanced socket watcher that handles both inputs and outputs

function defaultCompare(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== "object") return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export const setupSocketWatcher = (params) => {
  const {
    props,
    localCardData,
    isProcessing,
    emit,
    onInputChange,
    onOutputChange,
    compareFunction = defaultCompare,
  } = params;

  const processingState = Vue.ref(null);

  // Track socket states by ID instead of index
  const socketStateSignature = (sockets = []) => {
    return sockets.map((socket) => ({
      id: socket.id,
      value: socket.value ?? null,
      name: socket.name ?? "",
      index: socket.index,
    }));
  };

  // Compute states with IDs
  const inputStateSignature = Vue.computed(() =>
    socketStateSignature(props.cardData.data?.sockets?.inputs)
  );

  const outputStateSignature = Vue.computed(() =>
    socketStateSignature(props.cardData.data?.sockets?.outputs)
  );

  const handleSocketUpdates = (newState, oldState, type) => {
    if (isProcessing.value) return;
    if (!oldState || !newState) return;
    if (processingState.value === newState) return;

    // Track socket changes
    const oldIds = new Set(oldState.map((s) => s.id));
    const newIds = new Set(newState.map((s) => s.id));

    const addedSockets = newState.filter((s) => !oldIds.has(s.id));
    const removedSockets = oldState.filter((s) => !newIds.has(s.id));

    const modifiedSockets = newState.filter((newSocket) => {
      const oldSocket = oldState.find((s) => s.id === newSocket.id);
      return oldSocket && !compareFunction(newSocket.value, oldSocket.value);
    });

    if (
      addedSockets.length > 0 ||
      removedSockets.length > 0 ||
      modifiedSockets.length > 0
    ) {
      isProcessing.value = true;
      processingState.value = newState;

      try {
        // Just do the socket update event
        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets: oldState,
            newSockets: newState,
            reindexMap: new Map(newState.map((s, i) => [s.id, i])),
            deletedSocketIds: removedSockets.map((s) => s.id),
            type,
          })
        );
      } finally {
        isProcessing.value = false;
        processingState.value = null;

        Vue.nextTick(() => {
          // Now after isProcessing is false, call the callbacks
          const callback = type === "input" ? onInputChange : onOutputChange;
          if (callback) {
            addedSockets.forEach((socket) => {
              callback({
                type: "added",
                socketId: socket.id,
                value: socket.value,
                position: socket.index,
              });
            });

            removedSockets.forEach((socket) => {
              callback({
                type: "removed",
                socketId: socket.id,
                position: socket.index,
              });
            });

            modifiedSockets.forEach((socket) => {
              const oldSocket = oldState.find((s) => s.id === socket.id);
              callback({
                type: "modified",
                socketId: socket.id,
                oldValue: oldSocket?.value,
                newValue: socket.value,
                position: socket.index,
              });
            });
          }
        });
      }
    }
  };

  // Set up watchers
  Vue.watch(
    inputStateSignature,
    (newState, oldState) => handleSocketUpdates(newState, oldState, "input"),
    { deep: true }
  );

  Vue.watch(
    outputStateSignature,
    (newState, oldState) => handleSocketUpdates(newState, oldState, "output"),
    { deep: true }
  );
};
