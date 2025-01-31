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
  type = "input",
}) => {
  // Initialize reindexMap
  const reindexMap = {};

  // For each old socket, find its new position in newSockets array
  oldSockets.forEach((oldSocket, oldIndex) => {
    if (deletedSocketIds.includes(oldSocket?.id)) {
      reindexMap[oldIndex] = -1; // Mark deleted sockets
    } else {
      // Find where this socket ended up in the new array
      const newPosition = newSockets.findIndex((s) => s.id === oldSocket.id);
      reindexMap[oldIndex] = newPosition; // Map to its new position
    }
  });

  // Create reindexed sockets using their new array positions
  const reindexedSockets = newSockets.map((socket, index) => ({
    ...socket,
    index, // Use new array position as sourceIndex
    name:
      socket.name ||
      `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
    momentUpdated: Date.now(),
  }));

  return {
    reindexMap,
    reindexedSockets,
  };
};

/**
 * Handles cleanup of deleted sockets
 * @param {Object} params - Cleanup parameters
 * @param {string} params.socketId - ID of socket to clean up
 * @param {Map} params.socketRegistry - Registry of socket references
 * @param {Set} params.connections - Set of active connections
 */

// Fix 2: Update socket cleanup in socketRemapping.js
export const cleanupSocket = ({
  socketId,
  socketRegistry,
  connections,
  activeCanvas, // Add activeCanvas parameter to access connections
}) => {
  if (!socketId) return;

  // First find and remove any connections that use this socket
  if (Array.isArray(connections)) {
    // Remove connections where this socket is either source or target
    const connectionsToRemove = connections.filter(
      (conn) =>
        conn.sourceSocketId === socketId || conn.targetSocketId === socketId
    );

    // Remove these connections
    connectionsToRemove.forEach((conn) => {
      const idx = connections.findIndex((c) => c.id === conn.id);
      if (idx !== -1) {
        connections.splice(idx, 1);
      }
    });
  }

  // Then clean up the socket registry
  const socketData = socketRegistry?.get(socketId);
  if (socketData) {
    socketData.cleanup.forEach((cleanup) => cleanup());
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
  connections,
  activeCanvas  
}) => {
  // Clean up deleted sockets
  if (deletedSocketIds.length > 0) {
    deletedSocketIds.forEach(socketId => {
      cleanupSocket({ 
        socketId, 
        socketRegistry, 
        connections,
        activeCanvas 
      });
    });
  }

  // Create remapping with enhanced validation
  const { reindexMap, reindexedSockets } = createSocketRemapping({
    oldSockets: oldSockets.filter(Boolean),
    newSockets: newSockets.filter(Boolean),
    deletedSocketIds,
    type,
  });
  
  // Missing return statement! Should be:
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
  type,
}) => ({
  cardId,
  oldSockets,
  newSockets,
  reindexMap,
  deletedSocketIds,
  type,
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
  value = null,
}) => ({
  id: existingId || generateSocketId(),
  type,
  name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
  index,
  value,
  momentUpdated: Date.now(),
});
