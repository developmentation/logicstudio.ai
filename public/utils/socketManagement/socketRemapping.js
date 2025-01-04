// utils/socketManagement/socketRemapping.js

/**
 * Creates a remapping for socket indices after socket operations
 * @param {Object} params - Parameters for socket remapping
 * @param {Array} params.oldSockets - Original array of sockets before operation
 * @param {Array} params.newSockets - New array of sockets after operation
 * @param {Array} params.deletedSocketIds - Array of socket IDs that were deleted
 * @param {string} params.type - Type of socket ('input' or 'output')
 * @returns {Object} Mapping of old indices to new indices and reindexed sockets
 */
export const createSocketRemapping = ({
    oldSockets = [],
    newSockets = [],
    deletedSocketIds = [],
    type = 'input'
  }) => {
    // Initialize reindexMap
    const reindexMap = {};
    let newIndex = 0;
  
    // Map old indices to new indices
    oldSockets.forEach((socket, oldIndex) => {
      if (deletedSocketIds.includes(socket?.id)) {
        reindexMap[oldIndex] = -1; // Mark deleted sockets
      } else {
        reindexMap[oldIndex] = newIndex++; // Assign new index to remaining sockets
      }
    });
  
    // Create reindexed sockets with updated names and indices
    // const reindexedSockets = newSockets.map((socket, index) => ({
    //   ...socket,
    //   sourceIndex: index,
    //   name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
    //   momentUpdated: Date.now()
    // }));
  

    const reindexedSockets = newSockets.map((socket, index) => ({
        ...socket,
        sourceIndex: index,
        // Only set default name if none exists
        name: socket.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
        momentUpdated: Date.now()
      }));
      
    return {
      reindexMap,
      reindexedSockets
    };
  };
  
  /**
   * Handles cleanup of deleted sockets
   * @param {Object} params - Cleanup parameters
   * @param {string} params.socketId - ID of socket to clean up
   * @param {Map} params.socketRegistry - Registry of socket references
   * @param {Set} params.connections - Set of active connections
   */
  export const cleanupSocket = ({
    socketId,
    socketRegistry,
    connections
  }) => {
    connections.delete(socketId);
    const socketData = socketRegistry.get(socketId);
    if (socketData) {
      socketData.cleanup.forEach(cleanup => cleanup());
      socketRegistry.delete(socketId);
    }
  };
  
  /**
   * Updates socket array while maintaining connection integrity
   * @param {Object} params - Socket update parameters
   * @param {Array} params.oldSockets - Original socket array
   * @param {Array} params.newSockets - New socket array
   * @param {string} params.type - Socket type ('input' or 'output')
   * @param {Array} params.deletedSocketIds - Array of deleted socket IDs
   * @param {Map} params.socketRegistry - Registry of socket references
   * @param {Set} params.connections - Set of active connections
   * @returns {Object} Updated socket information and remapping data
   */
  export const updateSocketArray = ({
    oldSockets = [],
    newSockets = [],
    type = 'input',
    deletedSocketIds = [],
    socketRegistry,
    connections
  }) => {
    // Clean up deleted sockets
    if (deletedSocketIds.length > 0) {
      deletedSocketIds.forEach(socketId => {
        cleanupSocket({ socketId, socketRegistry, connections });
      });
    }
  
    // Create remapping
    const { reindexMap, reindexedSockets } = createSocketRemapping({
      oldSockets,
      newSockets,
      deletedSocketIds,
      type
    });
  
    return {
      reindexMap,
      reindexedSockets,
      oldSockets,
      deletedSocketIds,
      type
    };
  };
  
  /**
   * Creates event payload for socket updates
   * @param {Object} params - Event parameters
   * @param {string} params.cardId - ID of the card
   * @param {Array} params.oldSockets - Original socket array
   * @param {Array} params.newSockets - New socket array
   * @param {Object} params.reindexMap - Mapping of old indices to new indices
   * @param {Array} params.deletedSocketIds - Array of deleted socket IDs
   * @param {string} params.type - Socket type ('input' or 'output')
   * @returns {Object} Event payload for socket updates
   */
  export const createSocketUpdateEvent = ({
    cardId,
    oldSockets,
    newSockets,
    reindexMap,
    deletedSocketIds,
    type
  }) => ({
    cardId,
    oldSockets,
    newSockets,
    reindexMap,
    deletedSocketIds,
    type
  });
  
  /**
   * Generates a unique socket ID
   * @returns {string} Unique socket ID
   */
  export const generateSocketId = () => 
    `socket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  /**
   * Creates a new socket with specified properties
   * @param {Object} params - Socket parameters
   * @param {string} params.type - Socket type ('input' or 'output')
   * @param {number} params.index - Socket index
   * @param {string} [params.existingId] - Existing socket ID to preserve
   * @param {*} [params.value] - Initial socket value
   * @returns {Object} New socket object
   */
  export const createSocket = ({
    type,
    index,
    existingId = null,
    value = null
  }) => ({
    id: existingId || generateSocketId(),
    type,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
    sourceIndex: index,
    value,
    momentUpdated: Date.now()
  });