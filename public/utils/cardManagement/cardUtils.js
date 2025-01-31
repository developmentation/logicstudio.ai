
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

const initializeSockets = (
  existingSockets = [],
  defaultSockets = [],
  type = SOCKET_TYPES.INPUT
) => {
  // If we have existing sockets, preserve them completely
  if (existingSockets.length > 0) {
    return existingSockets.map((socket, idx) => ({
      ...socket,
      type: type, // Ensure type is set
      index: idx, // Update index
    }));
  }

  // If no existing sockets but we have defaults, create new sockets from defaults
  if (defaultSockets.length > 0) {
    return defaultSockets.map((socketData, idx) =>
      createSocket({
        type,
        name:
          socketData.name ||
          `${type.charAt(0).toUpperCase() + type.slice(1)} ${idx + 1}`,
        value: socketData.value || null,
        index: idx,
      })
    );
  }

  // Return empty array if no sockets
  return [];
};

export const initializeCardData = (data, defaultConfig = {}) => {
  const {
    defaultName = "Card",
    defaultDescription = "Card Node",
    defaultWidth = 300,
    defaultHeight = 150,
    defaultDisplay = "default",
    defaultData = {},
    defaultSockets = { inputs: [], outputs: [] },
  } = defaultConfig;

  // Get existing sockets from data if they exist
  const existingInputs = data.data?.sockets?.inputs || [];
  const existingOutputs = data.data?.sockets?.outputs || [];

  // Initialize sockets, preserving existing ones or creating from defaults
  const inputs = initializeSockets(
    existingInputs,
    defaultSockets.inputs,
    SOCKET_TYPES.INPUT
  );

  const outputs = initializeSockets(
    existingOutputs,
    defaultSockets.outputs,
    SOCKET_TYPES.OUTPUT
  );

  // Initialize the base card structure
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
      ...defaultData,
      ...(data.data || {}),
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
      // Emit update after position change
      emit("update-card", Vue.toRaw(localCardData.value));
    }
  };

  // Watch for changes to display state
  const updateDisplay = (newDisplay) => {
    if (newDisplay !== undefined && !isProcessing.value) {
      localCardData.value.ui.display = newDisplay;
      // Emit update after display change
      emit("update-card", Vue.toRaw(localCardData.value));
    }
  };

  // Watch for changes to display state
  const updateWidth = (newWidth) => {
    if (newWidth !== undefined && !isProcessing.value) {
      localCardData.value.ui.width = newWidth;
      // Emit update after width change
      emit("update-card", Vue.toRaw(localCardData.value));
    }
  };

  return {
    position: (newVal, oldVal) => {
      if (newVal?.x !== oldVal?.x) updatePosition(newVal.x, undefined);
      if (newVal?.y !== oldVal?.y) updatePosition(undefined, newVal.y);
    },
    display: updateDisplay,
    width: updateWidth,
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

// cardUtils.js - Updated setupSocketWatcher
// cardUtils.js - Fixed setupSocketWatcher
// cardUtils.js - Fixed setupSocketWatcher
export const setupSocketWatcher = (params) => {
  const {
    props,
    localCardData,
    isProcessing,
    emit,
    onInputChange,
    onOutputChange,
  } = params;
 
  const isDestroyed = Vue.ref(false);
  const isMounted = Vue.ref(false);
  const lastEmittedChange = Vue.ref({
    socketId: null,
    momentUpdated: null
  });
 
  Vue.onBeforeUnmount(() => {
    isDestroyed.value = true;
  });
 
  Vue.onMounted(() => {
    isMounted.value = true;
  });

  // Track previous state
  const previousSockets = Vue.ref({
    inputs: [...(props.cardData.data?.sockets?.inputs || [])],
    outputs: [...(props.cardData.data?.sockets?.outputs || [])]
  });

  const isDuplicateChange = (change) => {
    const currentMoment = change.content?.momentUpdated || change.content?.new?.momentUpdated;
    return (
      change.socketId === lastEmittedChange.value.socketId && 
      currentMoment === lastEmittedChange.value.momentUpdated
    );
  };

  const recordChange = (change) => {
    lastEmittedChange.value = {
      socketId: change.socketId,
      momentUpdated: change.content?.momentUpdated || change.content?.new?.momentUpdated
    };
  };
 
  const handleSocketChanges = (newSockets, oldSockets, type, onChange, source = 'unknown') => {
    if (isDestroyed.value || !isMounted.value) return;
    if (!newSockets || !oldSockets) return;

    const currentSockets = type === 'inputs' 
      ? localCardData.value.data.sockets.inputs 
      : localCardData.value.data.sockets.outputs;
    
    const prevSockets = previousSockets.value[type];

    try {
      // Handle socket removal first
      const removedSockets = prevSockets.filter(socket => 
        !currentSockets.some(curr => curr.id === socket.id)
      );
      
      removedSockets.forEach(socket => {
        const change = {
          type: 'removed',
          socketId: socket.id,
          content: socket,
          position: prevSockets.findIndex(s => s.id === socket.id),
          source
        };

        if (!isDuplicateChange(change)) {
          onChange(change);
          recordChange(change);
        }
      });

      // Then handle additions
      const addedSockets = currentSockets.filter(socket => 
        !prevSockets.some(prev => prev.id === socket.id)
      );
      
      addedSockets.forEach(socket => {
        const change = {
          type: 'added',
          socketId: socket.id,
          content: socket,
          position: currentSockets.findIndex(s => s.id === socket.id),
          source
        };
        onChange(change);
      });

      // Finally handle modifications
      currentSockets.forEach((socket, index) => {
        const prevSocket = prevSockets.find(s => s.id === socket.id);
        if (prevSocket && (
          !defaultCompare(prevSocket.value, socket.value) ||
          prevSocket.name !== socket.name
        )) {
          const change = {
            type: 'modified',
            socketId: socket.id,
            content: {
              old: prevSocket,
              new: socket
            },
            position: index,
            source
          };

          if (!isDuplicateChange(change)) {
            onChange(change);
            recordChange(change);
          }
        }
      });

      // Update previous state after all changes are processed
      previousSockets.value[type] = JSON.parse(JSON.stringify(currentSockets));
    } catch (error) {
      console.error('Error in socket change handler:', error);
    }
  };

  // Set up watchers
  const watchLocalSockets = (socketType, onChange) => {
    return Vue.watch(
      () => localCardData.value.data.sockets[socketType],
      (newVal, oldVal) => {
        if (!isProcessing.value) {
          handleSocketChanges(newVal, oldVal, socketType, onChange, 'local');
        }
      },
      { deep: true, immediate: true }
    );
  };

  const watchPropSockets = (socketType, onChange) => {
    return Vue.watch(
      () => props.cardData.data?.sockets?.[socketType],
      (newVal, oldVal) => {
        if (!isProcessing.value) {
          handleSocketChanges(newVal, oldVal, socketType, onChange, 'props');
        }
      },
      { deep: true, immediate: true }  // Add immediate: true and remove the newVal !== oldVal check
    );
  };

  // Set up all watchers
  const stopWatchers = [
    watchLocalSockets('inputs', onInputChange),
    watchLocalSockets('outputs', onOutputChange),
    watchPropSockets('inputs', onInputChange),
    watchPropSockets('outputs', onOutputChange)
  ];

  // Cleanup
  Vue.onBeforeUnmount(() => {
    stopWatchers.forEach(stop => stop());
  });
};