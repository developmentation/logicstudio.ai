// Enhanced card migration utilities with socket handling

const UI_ATTRIBUTES = new Set([
  'name',
  'description',
  'display',
  'x',
  'y',
  'width',
  'height',
  'zIndex'
]);

const TOP_LEVEL_ATTRIBUTES = new Set([
  'uuid',
  'type'
]);

/**
 * Validates and processes socket data
 * @param {Object} socketData - Raw socket data
 * @returns {Object} Processed socket data
 */
const processSocket = (socketData) => {
  if (!socketData) return null;

  // Ensure required socket properties
  const processedSocket = {
    id: socketData.id,
    type: socketData.type,
    name: socketData.name,
    index: socketData.index || 0,
    value: socketData.value,
    momentUpdated: socketData.momentUpdated || Date.now(),
    sourceIndex: socketData.sourceIndex,
    source: socketData.source
  };

  // Additional socket properties that might exist
  if (socketData.status) processedSocket.status = socketData.status;
  if (socketData.error) processedSocket.error = socketData.error;

  return processedSocket;
};

/**
 * Processes socket arrays ensuring proper structure
 * @param {Array} sockets - Array of socket data
 * @returns {Array} Processed socket array
 */
const processSocketArray = (sockets) => {
  if (!Array.isArray(sockets)) return [];
  
  return sockets
    .filter(socket => socket && socket.id) // Filter out invalid sockets
    .map(socket => processSocket(socket))
    .filter(Boolean); // Remove null results
};

/**
 * Processes socket structure ensuring proper format
 * @param {Object} socketData - Socket structure
 * @returns {Object} Processed socket structure
 */
const processSocketStructure = (socketData) => {
  const defaultStructure = {
    inputs: [],
    outputs: []
  };

  if (!socketData) return defaultStructure;

  return {
    inputs: processSocketArray(socketData.inputs),
    outputs: processSocketArray(socketData.outputs)
  };
};

/**
 * Migrates a card from any previous format to the new structure
 * @param {Object} oldCard - Card in any previous format
 * @returns {Object} Card in new format with ui/data separation
 */

export const migrateCardToNewFormat = (oldCard) => {
  if (!oldCard || typeof oldCard !== 'object') {
    throw new Error('Invalid card data provided');
  }

  // Initialize new card structure
  const newCard = {
    uuid: oldCard.uuid,
    type: oldCard.type,
    ui: {},
    data: {}
  };

  // If the card is already in the new format, preserve its structure
  if (oldCard.ui) {
    newCard.ui = { ...oldCard.ui };
    newCard.data = { ...oldCard.data };
    return newCard;
  }

  // Extract UI properties, checking both root level and .ui
  UI_ATTRIBUTES.forEach(attr => {
    // First check if it exists at root level
    if (oldCard[attr] !== undefined) {
      newCard.ui[attr] = oldCard[attr];
    }
    // Then check if it exists in a ui property (and wasn't found at root)
    else if (oldCard.ui && oldCard.ui[attr] !== undefined) {
      newCard.ui[attr] = oldCard.ui[attr];
    }
  });

  // Move all other properties to data, except top-level attributes and those already processed
  Object.entries(oldCard).forEach(([key, value]) => {
    if (!UI_ATTRIBUTES.has(key) && !TOP_LEVEL_ATTRIBUTES.has(key) && key !== 'ui' && key !== 'data') {
      if (key === 'sockets') {
        newCard.data.sockets = processSocketStructure(value);
      } else {
        newCard.data[key] = value;
      }
    }
  });

  // If there was a data property in the original card, merge it
  if (oldCard.data) {
    newCard.data = {
      ...newCard.data,
      ...oldCard.data
    };
  }

  // Ensure required UI properties have defaults
  const uiDefaults = {
    name: 'Untitled Card',
    description: '',
    display: 'default',
    x: 0,
    y: 0,
    width: 300,
    height: 150,
    zIndex: 1
  };

  newCard.ui = {
    ...uiDefaults,
    ...newCard.ui
  };

  // Ensure socket structure exists
  if (!newCard.data.sockets) {
    newCard.data.sockets = {
      inputs: [],
      outputs: []
    };
  }

  return newCard;
};
/**
 * Migrates an entire canvas data structure to the new format
 * @param {Object} canvasData - Old canvas data
 * @returns {Object} Migrated canvas data
 */
export const migrateCanvasData = (canvasData) => {
  if (!canvasData || !Array.isArray(canvasData.cards)) {
    throw new Error('Invalid canvas data structure');
  }

  const migratedCanvas = {
    ...canvasData,
    cards: canvasData.cards.map(card => migrateCardToNewFormat(card)),
    lastModified: Date.now()
  };

  console.log("migratedCanvas",)
  // Ensure all connections reference valid cards and sockets
  if (Array.isArray(migratedCanvas.connections)) {
    migratedCanvas.connections = migratedCanvas.connections.filter(conn => {
      const sourceCard = migratedCanvas.cards.find(c => c.uuid === conn.sourceCardId);
      const targetCard = migratedCanvas.cards.find(c => c.uuid === conn.targetCardId);
      return sourceCard && targetCard;
    });
  }

  return migratedCanvas;
};