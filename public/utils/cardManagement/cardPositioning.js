// utils/cardManagement/cardPositioning.js

export const createCardPositioning = (props) => {
  const {
    cards,
    selectedCardIds,
    dragStartPositions,
    zoomLevel,
    connections,
    canvasRef,
    updateConnections,
    calculateConnectionPoint,
    calculateConnectionPoints,
    getScaledPoint,
    emit,
    GRID_SIZE,
    Z_INDEX_LAYERS
  } = props;

  const dragOrigin = Vue.reactive({ x: 0, y: 0 });
  const isDragging = Vue.ref(false);
  const lastValidPosition = Vue.reactive(new Map());

  // Simple bounds checking
  const CANVAS_BOUNDS = {
    MIN_X: -3950,
    MAX_X: 3950,
    MIN_Y: -3950,
    MAX_Y: 3950,
  };

  const constrainPosition = (x, y, cardWidth = 300, cardHeight = 200) => {
    return {
      x: Math.max(
        CANVAS_BOUNDS.MIN_X,
        Math.min(CANVAS_BOUNDS.MAX_X - cardWidth, x)
      ),
      y: Math.max(
        CANVAS_BOUNDS.MIN_Y,
        Math.min(CANVAS_BOUNDS.MAX_Y - cardHeight, y)
      ),
    };
  };

  const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

//   // Improved drag handling
//   const startDrag = (event, cardId) => {
//     console.log("startDrag", event)
//     isDragging.value = true;
//     const point = event.touches ? event.touches[0] : event;

//     dragOrigin.x = point.clientX;
//     dragOrigin.y = point.clientY;

//     selectedCardIds.value.forEach((id) => {
//       const card = cards.value.find((c) => c.uuid === id);
//       if (card) {
//         dragStartPositions.value.set(id, { x: card.x, y: card.y });
//       }
//     });
//   };

//   // Updates needed in cardPositioning.js

//   const handleDrag = (event) => {
//     console.log('handleDrag', event)
//     if (!isDragging.value) return;

//     const point = event.touches ? event.touches[0] : event;

//     const dx = (point.clientX - dragOrigin.x) / zoomLevel.value;
//     const dy = (point.clientY - dragOrigin.y) / zoomLevel.value;

//     // Track all cards that need connection updates
//     const affectedCards = new Set();

//     const updatedCards = cards.value.map((card) => {
//       if (!selectedCardIds.value.has(card.uuid)) return card;

//       const startPos = dragStartPositions.value.get(card.uuid);
//       if (!startPos) return card;

//       const newX = startPos.x + dx;
//       const newY = startPos.y + dy;

//       const { x: boundedX, y: boundedY } = constrainPosition(
//         newX,
//         newY,
//         card.width,
//         card.height
//       );

//       // Add both the card and any connected cards to affected set
//       affectedCards.add(card.uuid);
//       if (connections?.value) {
//         connections.value.forEach((conn) => {
//           if (conn.sourceCardId === card.uuid) {
//             affectedCards.add(conn.targetCardId);
//           }
//           if (conn.targetCardId === card.uuid) {
//             affectedCards.add(conn.sourceCardId);
//           }
//         });
//       }

//       return {
//         ...card,
//         x: boundedX,
//         y: boundedY,
//       };
//     });

//     emit("update:cards", updatedCards);

//     // Update connections for all affected cards
//     requestAnimationFrame(() => {
//       affectedCards.forEach((cardId) => {
//         updateConnections(cardId);
//       });
//     });
//   };

//   const endDrag = () => {
//     console.log('endDrag')
//     if (!isDragging.value) return;

//     // Track affected cards for connection updates
//     const affectedCards = new Set();

//     // Final position update with snapping
//     if (selectedCardIds.value.size > 0) {
//       const updatedCards = cards.value.map((card) => {
//         if (!selectedCardIds.value.has(card.uuid)) return card;

//         // Add card and its connections to affected set
//         affectedCards.add(card.uuid);
//         if (connections?.value) {
//           connections.value.forEach((conn) => {
//             if (conn.sourceCardId === card.uuid) {
//               affectedCards.add(conn.targetCardId);
//             }
//             if (conn.targetCardId === card.uuid) {
//               affectedCards.add(conn.sourceCardId);
//             }
//           });
//         }

//         return {
//           ...card,
//           x: snapToGrid(card.x),
//           y: snapToGrid(card.y),
//         };
//       });

//       emit("update:cards", updatedCards);
//     }

//     isDragging.value = false;
//     dragStartPositions.value.clear();
//     lastValidPosition.clear();

//     // Update connections for all affected cards after final position
//     requestAnimationFrame(() => {
//       affectedCards.forEach((cardId) => {
//         updateConnections(cardId);
//       });
//     });
//   };
// // Updated updateCardPosition function for cardPositioning.js
// In cardPositioning.js, update the updateCardPosition function:
// In cardPositioning.js

const updateCardPosition = ({ uuid, x, y }) => {
    const movingCard = cards.value.find((card) => card.uuid === uuid);
    if (!movingCard) return;

    // Store initial positions at drag start
    if (dragStartPositions.value.size === 0) {
        selectedCardIds.value.forEach((selectedId) => {
            const card = cards.value.find((c) => c.uuid === selectedId);
            if (card) {
                dragStartPositions.value.set(selectedId, { x: card.x, y: card.y });
            }
        });
    }

    const startPos = dragStartPositions.value.get(uuid);
    if (!startPos) return;

    const dx = x - startPos.x;
    const dy = y - startPos.y;

    // Update positions
    cards.value = cards.value.map((card) => {
        if (selectedCardIds.value.has(card.uuid)) {
            const cardStartPos = dragStartPositions.value.get(card.uuid);
            if (cardStartPos) {
                return {
                    ...card,
                    x: cardStartPos.x + dx,
                    y: cardStartPos.y + dy,
                };
            }
        }
        return card;
    });

    // Wait for DOM update before recalculating connection points
   // After updating card positions
   Vue.nextTick(() => {
    requestAnimationFrame(() => {
        const affectedConnections = connections.value.filter(conn =>
            selectedCardIds.value.has(conn.sourceCardId) ||
            selectedCardIds.value.has(conn.targetCardId)
        );

        connections.value = connections.value.map(conn => {
            if (affectedConnections.includes(conn)) {
                const points = calculateConnectionPoints({
                    sourceCardId: conn.sourceCardId,
                    sourceSocketId: conn.sourceSocketId,
                    targetCardId: conn.targetCardId,
                    targetSocketId: conn.targetSocketId
                });

                if (points) {
                    return {
                        ...conn,
                        sourcePoint: points.sourcePoint,
                        targetPoint: points.targetPoint
                    };
                }
            }
            return conn;
        });

        connections.value = [...connections.value];
    });
});
};

  // Card center calculations
  const getCardCenter = (card) => {
    return {
      x: card.x + (card.width || 300) / 2,
      y: card.y + (card.height || 200) / 2,
    };
  };

  const centerCardOnPoint = (cardId, point, snap = true) => {
    const card = cards.value.find((c) => c.uuid === cardId);
    if (!card) return;

    const width = card.width || 300;
    const height = card.height || 200;

    let x = point.x - width / 2;
    let y = point.y - height / 2;

    if (snap) {
      x = snapToGrid(x);
      y = snapToGrid(y);
    }

    updateCardPosition({
      uuid: cardId,
      x,
      y,
      snap,
    });
  };


  return {
    // Core positioning
    updateCardPosition,
    // startDrag,
    // handleDrag,
    // endDrag,

    // Utilities
    getCardCenter,
    centerCardOnPoint,
    snapToGrid,
    constrainPosition,

   
    // State
    isDragging,
    dragStartPositions,
    lastValidPosition,
    CANVAS_BOUNDS,
  };
};
