
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
} from "../socketManagement/socketRemapping.js";

/**
 * Card and Socket Initiation
 * Class based Card and Sockets
 * 
 */


// Card initialization constants and types
const DEFAULT_CARD_CONFIG = {
  name: 'Card',
  description: 'Card Node',
  width: 300,
  height: 150,
  display: 'default',
  position: { x: 0, y: 0 },
  zIndex: 1
};

const SOCKET_TYPES = {
  INPUT: 'input',
  OUTPUT: 'output'
};

// Socket initialization and validation
class SocketInitializer {
  static validateSocket(socket) {
    const required = ['id', 'type', 'index'];
    const missing = required.filter(prop => !socket.hasOwnProperty(prop));
    
    if (missing.length > 0) {
      console.warn(`Socket missing required properties: ${missing.join(', ')}`);
      return false;
    }
    
    if (!Object.values(SOCKET_TYPES).includes(socket.type)) {
      console.warn(`Invalid socket type: ${socket.type}`);
      return false;
    }
    
    return true;
  }

  static createDefaultSocket(type, index, options = {}) {
    return {
      id: options.id || `socket-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      name: options.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
      index,
      value: options.value !== undefined ? options.value : null,
      momentUpdated: Date.now()
    };
  }

  static initializeSockets(existingSockets = [], defaultSockets = [], type) {
    // Validate socket type
    if (!Object.values(SOCKET_TYPES).includes(type)) {
      throw new Error(`Invalid socket type: ${type}`);
    }

    // If we have existing sockets, validate and preserve them
    if (existingSockets.length > 0) {
      return existingSockets
        .filter(socket => this.validateSocket(socket))
        .map((socket, idx) => ({
          ...this.createDefaultSocket(type, idx, {
            id: socket.id,
            name: socket.name,
            value: socket.value
          }),
          ...socket,
          type,
          index: idx,
          momentUpdated: Date.now()
        }));
    }

    // If no existing sockets but we have defaults, create new sockets
    if (defaultSockets.length > 0) {
      return defaultSockets.map((socketData, idx) => 
        this.createDefaultSocket(type, idx, socketData)
      );
    }

    return [];
  }
}

// Card data initialization and validation

class CardInitializer {
  static validateCardData(data) {
    if (!data.uuid || !data.type) {
      console.warn('Card missing required uuid or type');
      return false;
    }
    return true;
  }

  static initializeUI(data, defaultConfig) {
    return {
      name: data.ui?.name || defaultConfig.name,
      description: data.ui?.description || defaultConfig.description,
      display: data.ui?.display || defaultConfig.display,
      x: data.ui?.x || defaultConfig.position.x,
      y: data.ui?.y || defaultConfig.position.y,
      width: data.ui?.width || defaultConfig.width,
      height: data.ui?.height || defaultConfig.height,
      zIndex: data.ui?.zIndex || defaultConfig.zIndex,
    };
  }

  static preserveExistingData(data, config) {
    // If there's no existing data, return default data
    if (!data.data) {
      return config.defaultData || {};
    }

    // Create a deep copy of the existing data, excluding sockets
    const { sockets, ...restData } = data.data;
    
    // Merge with default data, preserving existing values
    return {
      ...config.defaultData,
      ...restData
    };
  }

  static initializeCardData(data, config = {}) {
    // Validate input data
    if (!this.validateCardData(data)) {
      throw new Error('Invalid card data provided');
    }

    // Merge default config with provided config
    const defaultConfig = {
      ...DEFAULT_CARD_CONFIG,
      ...config
    };

    // Preserve existing data first
    const preservedData = this.preserveExistingData(data, config);

    // Initialize sockets, preserving existing ones
    const inputs = SocketInitializer.initializeSockets(
      data.data?.sockets?.inputs,  // Pass existing inputs if any
      config.defaultSockets?.inputs || [],
      SOCKET_TYPES.INPUT
    );

    const outputs = SocketInitializer.initializeSockets(
      data.data?.sockets?.outputs,  // Pass existing outputs if any
      config.defaultSockets?.outputs || [],
      SOCKET_TYPES.OUTPUT
    );

    // Build complete card structure
    return {
      uuid: data.uuid,
      type: data.type,
      ui: this.initializeUI(data, defaultConfig),
      data: {
        ...preservedData,
        sockets: {
          inputs,
          outputs,
        }
      }
    };
  }
}

// Card setup utilities
class CardSetupManager {
  constructor(props, emit) {
    this.socketRegistry = new Map();
    this.connections = Vue.ref(new Set());
    this.isProcessing = Vue.ref(false);
  }

  getSocketConnections(socketId) {
    return this.connections.value.has(socketId);
  }

  handleSocketMount(event) {
    if (!event?.socketId || !event?.element) return;
    
    this.socketRegistry.set(event.socketId, {
      element: event.element,
      cleanup: []
    });
  }

  cleanup() {
    // Cleanup socket registry
    this.socketRegistry.forEach(socket => {
      socket.cleanup.forEach(cleanupFn => {
        try {
          cleanupFn();
        } catch (error) {
          console.error('Error during socket cleanup:', error);
        }
      });
    });
    
    this.socketRegistry.clear();
    this.connections.value.clear();
  }
}

// Setup watchers for card data
class CardWatcherManager {
  constructor(params) {
    const { props, localCardData, isProcessing, emit, onTrigger } = params;
    this.props = props;
    this.localCardData = localCardData;
    this.isProcessing = isProcessing;
    this.emit = emit;
    this.onTrigger = onTrigger;
  }

  updatePosition(newX, newY) {
    if (this.isProcessing.value) return;
    
    if (newX !== undefined) {
      this.localCardData.value.ui.x = newX;
    }
    if (newY !== undefined) {
      this.localCardData.value.ui.y = newY;
    }
    
    this.emit('update-card', Vue.toRaw(this.localCardData.value));
  }

  updateDisplay(newDisplay) {
    if (newDisplay !== undefined && !this.isProcessing.value) {
      this.localCardData.value.ui.display = newDisplay;
      this.emit('update-card', Vue.toRaw(this.localCardData.value));
    }
  }

  updateWidth(newWidth) {
    if (newWidth !== undefined && !this.isProcessing.value) {
      this.localCardData.value.ui.width = newWidth;
      this.emit('update-card', Vue.toRaw(this.localCardData.value));
    }
  }

  updateTrigger(newTrigger, oldTrigger) {
    if (newTrigger !== oldTrigger && newTrigger !== null && !this.isProcessing.value) {
      this.localCardData.value.data.trigger = newTrigger;
      if (this.onTrigger) {
        Vue.nextTick(() => this.onTrigger());
      }
    }
  }


  getWatchers() {
    return {
      position: (newVal, oldVal) => {
        if (newVal?.x !== oldVal?.x) this.updatePosition(newVal.x, undefined);
        if (newVal?.y !== oldVal?.y) this.updatePosition(undefined, newVal.y);
      },
      display: this.updateDisplay.bind(this),
      width: this.updateWidth.bind(this),
      trigger: this.updateTrigger.bind(this)
    };
  }
}

// Export refactored utilities
export {
  SOCKET_TYPES,
  CardInitializer,
  SocketInitializer,
  CardSetupManager,
  CardWatcherManager
};

// Maintain backward compatibility
export const initializeCardData = CardInitializer.initializeCardData.bind(CardInitializer);

export const useCardSetup = (props, emit) => {
  const manager = new CardSetupManager(props, emit);
  
  return {
    socketRegistry: manager.socketRegistry,
    connections: manager.connections,
    isProcessing: manager.isProcessing,
    getSocketConnections: manager.getSocketConnections.bind(manager),
    handleSocketMount: manager.handleSocketMount.bind(manager),
    cleanup: manager.cleanup.bind(manager)
  };
};

export const setupCardDataWatchers = (params) => {
  const watcherManager = new CardWatcherManager(params);
  return watcherManager.getWatchers();
};


/** Socket Management
* Class based Socket Change Management
*/
const SOCKET_CHANGE_TYPES = {
  ADDED: 'added',
  REMOVED: 'removed',
  MODIFIED: 'modified'
};

// Change detection utilities
class SocketChangeDetector {
  static compareValues(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (typeof a !== 'object') return a === b;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  static detectChanges(currentSockets, previousSockets) {
    const changes = [];

    // Detect additions
    const additions = currentSockets.filter(
      socket => !previousSockets.some(prev => prev.id === socket.id)
    );
    additions.forEach(socket => {
      changes.push({
        type: SOCKET_CHANGE_TYPES.ADDED,
        socketId: socket.id,
        content: socket
      });
    });

    // Detect removals
    const removals = previousSockets.filter(
      socket => !currentSockets.some(curr => curr.id === socket.id)
    );
    removals.forEach(socket => {
      changes.push({
        type: SOCKET_CHANGE_TYPES.REMOVED,
        socketId: socket.id,
        content: socket
      });
    });

    // Detect modifications
    currentSockets.forEach(socket => {
      const prevSocket = previousSockets.find(s => s.id === socket.id);
      if (prevSocket && (!this.compareValues(prevSocket.value, socket.value) ||
          prevSocket.name !== socket.name)) {
        changes.push({
          type: SOCKET_CHANGE_TYPES.MODIFIED,
          socketId: socket.id,
          content: {
            old: prevSocket,
            new: socket
          }
        });
      }
    });

    return changes;
  }
}

// Change event management
class ChangeEventManager {
  constructor() {
    this.lastEmittedChange = {
      socketId: null,
      momentUpdated: null,
      processingSource: null
    };
  }

  isDuplicateChange(change, source) {
    if (source === 'initialization') return false;
    
    const currentMoment = change.content?.momentUpdated || change.content?.new?.momentUpdated;
    return (
      change.socketId === this.lastEmittedChange.socketId &&
      currentMoment === this.lastEmittedChange.momentUpdated &&
      source === this.lastEmittedChange.processingSource
    );
  }

  recordChange(change, source) {
    if (source !== 'initialization') {
      this.lastEmittedChange = {
        socketId: change.socketId,
        momentUpdated: change.content?.momentUpdated || change.content?.new?.momentUpdated,
        processingSource: source
      };
    }
  }
}

// Socket state management
class SocketStateManager {
  constructor(localCardData, emit) {
    this.localCardData = localCardData;
    this.emit = emit;
    this.previousSockets = {
      inputs: [],
      outputs: [],
      lastSource: null
    };
  }

  updateSocketState(type, reindexedSockets) {
    if (type === 'inputs') {
      this.localCardData.value.data.sockets.inputs = reindexedSockets;
    } else {
      this.localCardData.value.data.sockets.outputs = reindexedSockets;
    }
  }

  updatePreviousState(type, currentSockets, source) {
    this.previousSockets = {
      ...this.previousSockets,
      [type]: JSON.parse(JSON.stringify(currentSockets)),
      lastSource: source
    };
    this.emit('update-card', Vue.toRaw(this.localCardData.value));
  }
}

export const setupSocketWatcher = (params) => {
  const { props, localCardData, isProcessing, emit, onInputChange, onOutputChange } = params;

  const isDestroyed = Vue.ref(false);
  const isMounted = Vue.ref(false);
  
  const changeEventManager = new ChangeEventManager();
  const socketStateManager = new SocketStateManager(localCardData, emit);

  const handleSocketChanges = (
    newSockets,
    oldSockets,
    type,
    onChange,
    source = 'unknown'
  ) => {
    // Early return conditions
    if (isDestroyed.value || 
        (!isMounted.value && source !== 'initialization') || 
        !newSockets || 
        (isProcessing.value && source !== 'initialization')) {
      return;
    }

    // Skip if same source (except initialization)
    if (source === socketStateManager.previousSockets.lastSource && 
        source !== 'initialization') {
      return;
    }

    const currentSockets = type === 'inputs' ? 
      localCardData.value.data.sockets.inputs : 
      localCardData.value.data.sockets.outputs;

    try {
      // Detect all changes
      const changes = SocketChangeDetector.detectChanges(
        currentSockets,
        socketStateManager.previousSockets[type]
      );

      let hasChanges = false;

      // Process changes
      changes.forEach(change => {
        if (!changeEventManager.isDuplicateChange(change, source)) {
          // Handle removals specially
          if (change.type === SOCKET_CHANGE_TYPES.REMOVED) {
            const { reindexedSockets } = updateSocketArray({
              oldSockets: socketStateManager.previousSockets[type],
              newSockets: currentSockets,
              type,
              deletedSocketIds: [change.socketId],
            });
            socketStateManager.updateSocketState(type, reindexedSockets);
          }

          onChange(change);
          changeEventManager.recordChange(change, source);
          hasChanges = true;
        }
      });

      // Update state if needed
      if (hasChanges) {
        socketStateManager.updatePreviousState(type, currentSockets, source);
      }
    } catch (error) {
      console.error('Error in socket change handler:', error);
    }
  };

  // Set up watchers
  const setupWatcher = (socketType, onChange) => {
    const localWatcher = Vue.watch(
      () => localCardData.value.data.sockets[socketType],
      (newVal, oldVal) => {
        handleSocketChanges(newVal, oldVal, socketType, onChange, 'local');
      },
      { deep: true, immediate: true }
    );

    const propsWatcher = Vue.watch(
      () => props.cardData.data?.sockets?.[socketType],
      (newVal, oldVal) => {
        handleSocketChanges(newVal, oldVal, socketType, onChange, 'props');
      },
      { deep: true, immediate: true }
    );

    return [localWatcher, propsWatcher];
  };

  // Initialize watchers
  const stopWatchers = [
    ...setupWatcher('inputs', onInputChange),
    ...setupWatcher('outputs', onOutputChange)
  ];

  // Lifecycle hooks
  Vue.onMounted(() => {
    isMounted.value = true;
    ['inputs', 'outputs'].forEach(type => {
      handleSocketChanges(
        localCardData.value.data.sockets[type],
        [],
        type,
        type === 'inputs' ? onInputChange : onOutputChange,
        'initialization'
      );
    });
  });

  Vue.onBeforeUnmount(() => {
    isDestroyed.value = true;
    stopWatchers.forEach(stop => stop());
  });
};