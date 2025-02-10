// utils/cardManagement/cardPositioning.js

export const createCardPositioning = (props) => {
  const {
    cards,
    selectedCardIds,
    zoomLevel,
    connections,
    canvasRef,
    updateConnections,
    calculateConnectionPoint,
    calculateConnectionPoints,
    getScaledPoint,
    emit,
    GRID_SIZE,
    Z_INDEX_LAYERS,
    dragState
  } = props;

  // Simple bounds checking
  const CANVAS_BOUNDS = {
    MIN_X: -3950,
    MAX_X: 3950,
    MIN_Y: -3950,
    MAX_Y: 3950,
  };

  const constrainPosition = (x, y, card) => {
    return {
      x: Math.max(
        CANVAS_BOUNDS.MIN_X,
        Math.min(CANVAS_BOUNDS.MAX_X - (card.ui.width || 300), x)
      ),
      y: Math.max(
        CANVAS_BOUNDS.MIN_Y,
        Math.min(CANVAS_BOUNDS.MAX_Y - (card.ui.height || 200), y)
      ),
    };
  };

  const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;


  // In cardPositioning.js

const lastKnownPositions = new Map();

const handleStartDrag = (event, cardId) => {
  const isTouch = event.type === "touchstart";
  
  const point = {
    clientX: isTouch ? event.touches[0].clientX : event.clientX,
    clientY: isTouch ? event.touches[0].clientY : event.clientY
  };

  // Create a new Map instance for startPositions
  const newStartPositions = new Map();

  // Store initial positions
  selectedCardIds.value.forEach(id => {
    const card = cards.value.find(c => c.uuid === id);
    if (card) {
      newStartPositions.set(id, {
        x: card.ui.x || 0,
        y: card.ui.y || 0
      });
      // Also store as last known position
      lastKnownPositions.set(id, {
        x: card.ui.x || 0,
        y: card.ui.y || 0
      });
    }
  });

  dragState.value = {
    isDragging: true,
    dragOrigin: point,
    startPositions: newStartPositions
  };

  return true;
};

const handleDrag = (event) => {
  if (!dragState.value?.isDragging) return;

  const point = {
    clientX: event.type.includes('touch') ? event.touches[0].clientX : event.clientX,
    clientY: event.type.includes('touch') ? event.touches[0].clientY : event.clientY
  };

  // If we don't have valid coordinates, use last known positions
  if (typeof point.clientX !== 'number' || typeof point.clientY !== 'number') {
    return {
      updatedCards: cards.value.map(card => {
        if (!selectedCardIds.value.has(card.uuid)) return card;
        const lastKnown = lastKnownPositions.get(card.uuid);
        if (!lastKnown) return card;
        
        return {
          ...card,
          ui: {
            ...card.ui,
            x: lastKnown.x,
            y: lastKnown.y,
            zIndex: Z_INDEX_LAYERS.DRAGGING
          }
        };
      })
    };
  }

  // Calculate movement from original drag start point
  const dx = (point.clientX - dragState.value.dragOrigin.clientX) / zoomLevel.value;
  const dy = (point.clientY - dragState.value.dragOrigin.clientY) / zoomLevel.value;

  const updatedCards = cards.value.map((card) => {
    if (!selectedCardIds.value.has(card.uuid)) return card;

    const startPos = dragState.value.startPositions.get(card.uuid);
    if (!startPos) return card;

    const newX = startPos.x + dx;
    const newY = startPos.y + dy;

    // Update last known position
    lastKnownPositions.set(card.uuid, {
      x: newX,
      y: newY
    });

    return {
      ...card,
      ui: {
        ...card.ui,
        x: newX,
        y: newY,
        zIndex: Z_INDEX_LAYERS.DRAGGING
      }
    };
  });

  return { updatedCards };
};

const handleDragEnd = (event) => {
  if (!dragState.value?.isDragging) return;

  const point = {
    clientX: event.type.includes('touch') ? event.changedTouches[0].clientX : event.clientX,
    clientY: event.type.includes('touch') ? event.changedTouches[0].clientY : event.clientY
  };

  const updatedCards = cards.value.map((card) => {
    if (!selectedCardIds.value.has(card.uuid)) return card;

    let finalX, finalY;
    
    if (typeof point.clientX === 'number' && typeof point.clientY === 'number') {
      // Calculate final position from drag delta
      const dx = (point.clientX - dragState.value.dragOrigin.clientX) / zoomLevel.value;
      const dy = (point.clientY - dragState.value.dragOrigin.clientY) / zoomLevel.value;
      const startPos = dragState.value.startPositions.get(card.uuid);
      finalX = startPos.x + dx;
      finalY = startPos.y + dy;
    } else {
      // Use last known position
      const lastKnown = lastKnownPositions.get(card.uuid);
      finalX = lastKnown?.x ?? card.ui.x;
      finalY = lastKnown?.y ?? card.ui.y;
    }

    const { x: boundedX, y: boundedY } = constrainPosition(
      snapToGrid(finalX), 
      snapToGrid(finalY), 
      card
    );

    return {
      ...card,
      ui: {
        ...card.ui,
        x: boundedX,
        y: boundedY,
        zIndex: card.isSelected ? Z_INDEX_LAYERS.SELECTED : Z_INDEX_LAYERS.DEFAULT
      }
    };
  });

  // Reset states
  dragState.value = {
    isDragging: false,
    dragOrigin: { x: 0, y: 0 },
    startPositions: new Map()
  };
  lastKnownPositions.clear();

  return { updatedCards };
};

  const updateCardPosition = ({ uuid, x, y }) => {
    const movingCard = cards.value.find((card) => card.uuid === uuid);
    if (!movingCard) return;

    // Initialize start positions if needed
    if (dragState.value.startPositions.size === 0) {
      for (const selectedId of selectedCardIds) {
        const card = cards.value.find((c) => c.uuid === selectedId);
        if (card) {
          dragState.value.startPositions.set(selectedId, {
            x: card.ui.x,
            y: card.ui.y
          });
        }
      }
    }

    const startPos = dragState.value.startPositions.get(uuid);
    if (!startPos) return;

    const dx = x - startPos.x;
    const dy = y - startPos.y;

    // Create new cards array with updated positions
    const updatedCards = cards.value.map((card) => {
      if (!selectedCardIds.value.has(card.uuid)) return card;

      const cardStartPos = dragState.value.startPositions.get(card.uuid);
      if (!cardStartPos) return card;

      return {
        ...card,
        ui: {
          ...card.ui,
          x: cardStartPos.x + dx,
          y: cardStartPos.y + dy,
        }
      };
    });

    // Schedule connection update
    requestAnimationFrame(updateConnections);

    return updatedCards;
  };

  const getCardCenter = (card) => ({
    x: card.ui.x + (card.ui.width || 300) / 2,
    y: card.ui.y + (card.ui.height || 200) / 2,
  });

  const centerCardOnPoint = (cardId, point, snap = true) => {
    const card = cards.value.find((c) => c.uuid === cardId);
    if (!card) return;

    const width = card.ui.width || 300;
    const height = card.ui.height || 200;

    let x = point.x - width / 2;
    let y = point.y - height / 2;

    if (snap) {
      x = snapToGrid(x);
      y = snapToGrid(y);
    }

    return updateCardPosition({
      uuid: cardId,
      x,
      y
    });
  };

  return {
    updateCardPosition,
    handleStartDrag,
    handleDrag,
    handleDragEnd,
    getCardCenter,
    centerCardOnPoint,
    snapToGrid,
    constrainPosition,
    CANVAS_BOUNDS,
  };
};