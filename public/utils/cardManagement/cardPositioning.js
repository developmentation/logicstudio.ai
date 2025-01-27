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

  const handleStartDrag = (event, cardId) => {
    const isTouch = event.type === "touchstart";
    
    // console.log('Starting drag operation with card:', cardId);
    
    const point = {
      clientX: isTouch ? event.touches[0].clientX : event.clientX,
      clientY: isTouch ? event.touches[0].clientY : event.clientY
    };
  
    // Create a NEW Map instance for startPositions
    const newStartPositions = new Map();
  
    // Store initial positions first
    selectedCardIds.value.forEach(id => {
      const card = cards.value.find(c => c.uuid === id);  // FIXED: added .value
      if (card) {
        newStartPositions.set(id, {
          x: card.ui.x || 0,
          y: card.ui.y || 0
        });
        // console.log('Storing start position for card:', id, {
        //   x: card.ui.x || 0,
        //   y: card.ui.y || 0
        // });
      }
    });
  
    // Then update dragState with all values at once
    dragState.value = {
      isDragging: true,
      dragOrigin: point,
      startPositions: newStartPositions
    };
  
    // console.log('dragState after start:', {
    //   isDragging: dragState.value.isDragging,
    //   dragOrigin: dragState.value.dragOrigin,
    //   startPositions: Array.from(dragState.value.startPositions.entries())
    // });
  
    return true;
  };

  const handleDrag = (event) => {
    // console.log('Drag state at drag:', {
    //   isDragging: dragState.value?.isDragging,
    //   hasStartPositions: dragState.value?.startPositions?.size > 0
    // });
  
    if (!dragState.value?.isDragging) {
      // console.log('Not dragging, returning early');
      return;
    }
  
    const point = {
      clientX: event.type.includes('touch') ? event.touches[0].clientX : event.clientX,
      clientY: event.type.includes('touch') ? event.touches[0].clientY : event.clientY
    };
  
    // Calculate movement from the original drag start point
    const dx = (point.clientX - dragState.value.dragOrigin.clientX) / zoomLevel.value;
    const dy = (point.clientY - dragState.value.dragOrigin.clientY) / zoomLevel.value;
  
    // console.log('Movement calculation:', {
    //   currentPoint: point,
    //   dragOrigin: dragState.value.dragOrigin,
    //   zoomLevel: zoomLevel.value,
    //   dx,
    //   dy
    // });
  
    // Update cards with new positions
    const updatedCards = cards.value.map((card) => {
      if (!selectedCardIds.value.has(card.uuid)) return card;
  
      const startPos = dragState.value.startPositions.get(card.uuid);
      if (!startPos) {
        // console.log('No start position for:', card.uuid);
        return card;
      }
  
      const newX = startPos.x + dx;
      const newY = startPos.y + dy;
  
      // console.log('Updating card:', {
      //   id: card.uuid,
      //   from: startPos,
      //   to: { x: newX, y: newY }
      // });
  
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
  
    // We don't update dragOrigin anymore - keeping our original reference point
    // This is the key change that fixes the shaking
  
    return { updatedCards };
  };
  const handleDragEnd = (event) => {
    if (!dragState.value?.isDragging) return;

    const point = getScaledPoint({
      x: event.type.includes('touch') ? event.changedTouches[0].clientX : event.clientX,
      y: event.type.includes('touch') ? event.changedTouches[0].clientY : event.clientY
    });

    const dx = (point.x - dragState.value.dragOrigin.x) / zoomLevel.value;
    const dy = (point.y - dragState.value.dragOrigin.y) / zoomLevel.value;

    const updatedCards = cards.value.map((card) => {
      if (!selectedCardIds.value.has(card.uuid)) return card;

      const startPos = dragState.value.startPositions.get(card.uuid);
      if (!startPos) return card;

      const newX = snapToGrid(startPos.x + dx);
      const newY = snapToGrid(startPos.y + dy);

      const { x: boundedX, y: boundedY } = constrainPosition(newX, newY, card);

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

    // Reset drag state
    dragState.value = {
      isDragging: false,
      dragOrigin: { x: 0, y: 0 },
      startPositions: new Map()
    };

    // Schedule final connection update
    requestAnimationFrame(updateConnections);

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