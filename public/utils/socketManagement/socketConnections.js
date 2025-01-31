// utils/socketManagement/socketConnections.js

export const createSocketConnections = (props) => {
  const {
    activeCanvas,
    cards,
    selectedCardIds,
    connections,
    canvasRef,
    zoomLevel,
    calculateConnectionPoint,
    calculateConnectionPoints,
    selectedConnectionId,
    activeConnection,
    onConnectionCreated,
    onConnectionRemoved,
    onValuePropagated,
    getScaledPoint,
    onConnectionStart,
  } = props;


 
  
  // Constants remain unchanged
  const SNAP_RADIUS = 50;
  const CONNECTION_STATES = {
    DEFAULT: "default",
    SELECTED: "selected",
    ACTIVE: "active",
    PREVIEW: "preview",
  };
  const SOCKET_TYPES = {
    INPUT: "input",
    OUTPUT: "output",
  };
  const CONNECTION_STYLES = {
    [CONNECTION_STATES.DEFAULT]: {
      stroke: "#64748b",
      strokeWidth: "2",
      fill: "transparent",
    },
    [CONNECTION_STATES.SELECTED]: {
      stroke: "#FFD700",
      strokeWidth: "4",
      fill: "transparent",
    },
    [CONNECTION_STATES.ACTIVE]: {
      stroke: "#4CAF50",
      strokeWidth: "2",
      fill: "transparent",
    },
    [CONNECTION_STATES.PREVIEW]: {
      stroke: "#64748b",
      strokeWidth: "2",
      fill: "transparent",
      strokeDasharray: "5,5",
    },
  };

  // Helper functions with updated card structure references
  const getDistance = (p1, p2) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const findSocket = (cardId, socketId) => {
    const card = cards.value.find((c) => c.uuid === cardId);
    if (!card) return null;
    
    const allSockets = [
      ...card.data.sockets.inputs,
      ...card.data.sockets.outputs
    ];
    return allSockets.find(s => s.id === socketId);
  };


  const getSocketType = (cardId, socketId) => {
    const card = cards.value.find((c) => c.uuid === cardId);
    if (!card?.data?.sockets) {
      console.warn("getSocketType: Card or sockets not found", { cardId });
      return null;
    }

    if (card.data.sockets.inputs?.some((s) => s.id === socketId)) {
      return SOCKET_TYPES.INPUT;
    }

    if (card.data.sockets.outputs?.some((s) => s.id === socketId)) {
      return SOCKET_TYPES.OUTPUT;
    }

    return null;
  };


  //   // Find nearest compatible socket
  //   const findNearestSocket = (point, sourceType) => {
  //     if (!point || !sourceType) return null;

  //     const targetType =
  //       sourceType === SOCKET_TYPES.OUTPUT
  //         ? SOCKET_TYPES.INPUT
  //         : SOCKET_TYPES.OUTPUT;

  //     let nearest = null;
  //     let minDistance = SNAP_RADIUS;

  //     cards.value.forEach((card) => {
  //       const sockets =
  //         targetType === SOCKET_TYPES.INPUT
  //           ? card.sockets.inputs
  //           : card.sockets.outputs;

  //       if (!sockets) return;

  //       sockets.forEach((socket) => {
  //         const socketPos = {
  //           x: card.x + socket.x,
  //           y: card.y + socket.y,
  //         };

  //         const distance = getDistance(point, socketPos);

  //         if (distance < minDistance) {
  //           minDistance = distance;
  //           nearest = {
  //             cardId: card.uuid,
  //             socketId: socket.id,
  //             center: socketPos,
  //             distance: distance,
  //             type: targetType,
  //           };
  //         }
  //       });
  //     });

  //     return nearest;
  //   };

  // In socketConnections.js
  const findNearestSocket = (point, sourceType) => {
    if (!point || !sourceType) return null;

    const allSockets = document.querySelectorAll(".socket");
    let nearest = null;
    let minDistance = SNAP_RADIUS;

    allSockets.forEach((socket) => {
      const socketType = socket.dataset.type;
      if (
        (sourceType === "output" && socketType !== "input") ||
        (sourceType === "input" && socketType !== "output")
      ) {
        return;
      }

      const rect = socket.getBoundingClientRect();
      const socketCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const distance = getDistance(point, socketCenter);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = {
          element: socket,
          center: socketCenter,
          cardId: socket.closest("[data-card-id]").dataset.cardId,
          socketId: socket.dataset.socketId,
          type: socketType,
          distance,
        };
      }
    });

    return nearest;
  };


  // Connection style and state management
  const getConnectionStyle = (connection) => {
    if (!connection) return CONNECTION_STYLES[CONNECTION_STATES.DEFAULT];



    if (connection.id === selectedConnectionId.value) {
      return CONNECTION_STYLES[CONNECTION_STATES.SELECTED];
    }

    if (connection.isActive) {
      return CONNECTION_STYLES[CONNECTION_STATES.ACTIVE];
    }

    if (connection === activeConnection.value) {
      return CONNECTION_STYLES[CONNECTION_STATES.PREVIEW];
    }

    return CONNECTION_STYLES[CONNECTION_STATES.DEFAULT];
  };

  const getConnectionState = (connection) => {
    if (connection.id === selectedConnectionId.value)
      return CONNECTION_STATES.SELECTED;
    if (connection.isActive) return CONNECTION_STATES.ACTIVE;
    return CONNECTION_STATES.DEFAULT;
  };

  // Connection validation
  const validateConnection = (
    sourceCardId,
    sourceSocketId,
    targetCardId,
    targetSocketId
  ) => {
    if (!sourceCardId || !sourceSocketId || !targetCardId || !targetSocketId) {
      console.warn("Connection validation failed: Missing ID(s)");
      return false;
    }

    const sourceCard = cards.value.find((c) => c.uuid === sourceCardId);
    const targetCard = cards.value.find((c) => c.uuid === targetCardId);
    
    if (!sourceCard?.data?.sockets || !targetCard?.data?.sockets) {
      console.warn("Connection validation failed: Cards or sockets not found");
      return false;
    }

    if (sourceCardId === targetCardId) {
      console.warn("Connection validation failed: Self-connection attempted");
      return false;
    }

    if (
      connections.value.some(
        (conn) =>
          conn.targetCardId === targetCardId &&
          conn.targetSocketId === targetSocketId
      )
    ) {
      console.warn("Connection validation failed: Target input already connected");
      return false;
    }

    return true;
  };

  // In socketConnections.js
  const createConnection = (connectionData, event, eventType = "mouse") => {
    // console.log("Creating connection with data:", connectionData);
  
    const freshPoints = calculateConnectionPoints({
      sourceCardId: connectionData.sourceCardId,
      sourceSocketId: connectionData.sourceSocketId,
      targetCardId: connectionData.targetCardId,
      targetSocketId: connectionData.targetSocketId,
    });
  
    // console.log("Calculated fresh points:", freshPoints);
  
    const newConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceCardId: connectionData.sourceCardId,
      sourceSocketId: connectionData.sourceSocketId,
      targetCardId: connectionData.targetCardId,
      targetSocketId: connectionData.targetSocketId,
      sourcePoint: freshPoints.sourcePoint,
      targetPoint: freshPoints.targetPoint,
      isActive: false,
    };
  
    // console.log("New connection object:", newConnection);
    
    connections.value.push(newConnection);
    // console.log("Connections after push:", connections.value);
    
    onConnectionCreated?.(newConnection);
    return newConnection.id;
  };
  const removeConnection = (connectionId) => {
    const index = connections.value.findIndex(
      (conn) => conn.id === connectionId
    );
    if (index === -1) return false;

    const connection = connections.value[index];
    connections.value.splice(index, 1);
    onConnectionRemoved?.(connection);

    return true;
  };

  const getSocketValue = (cardId, socketId) => {
    const socket = findSocket(cardId, socketId);
    return socket ? socket.value : null;
  };

  const updateSocketValue = (cardId, socketId, value) => {
    const socket = findSocket(cardId, socketId);
    if (!socket) {
      console.warn(
        `Socket not found for card ${cardId} and socket ${socketId}`
      );
      return;
    }

    // Update the socket
    socket.value = Vue.toRaw(value);
    socket.momentUpdated = Date.now();

    // Propagate the value
    propagateValue(cardId, socketId, value);
  };


  
  const handleConnectionDragStart = ({ startPoint, socket, cardId, type }) => {
  if (!startPoint || !socket || !cardId) {
    // console.log("Missing required drag start data:", { startPoint, socket, cardId, type });
    return null;
  }

  const scaledPoint = getScaledPoint(startPoint);
  if (!scaledPoint) return null;

  // Create complete initial connection state
  const newConnection = {
    startPoint: scaledPoint,
    currentPoint: scaledPoint,
    sourceSocket: socket,
    sourceCardId: cardId,
    sourceType: type,
    snappedSocket: null,
    // Add explicit source details
    sourceDetails: {
      cardId: cardId,
      socketId: socket.id,
      type: type
    },
    targetDetails: null
  };

  // console.log("Starting new connection:", newConnection);
  // Call the callback to set activeConnection
  onConnectionStart(newConnection);

  return newConnection;
};

const handleConnectionDrag = ({currentPoint}) => {

  if (!activeConnection?.value?.sourceDetails || !currentPoint) {
    // console.log("Missing required drag data:", { activeConnection:activeConnection.value, currentPoint });
    return null;
  }

  // console.log("currentPount", currentPoint)
  const scaledPoint = getScaledPoint(currentPoint);
  if (!scaledPoint) return null;
  // console.log("scaledPoint", scaledPoint)

  const nearest = findNearestSocket(scaledPoint, activeConnection.value.sourceDetails.type);
  // console.log("nearest", nearest)
  // If we found a valid snap target
  if (nearest && nearest.distance < SNAP_RADIUS) {
    // console.log("Found snap target:", nearest);
    return {
      ...activeConnection.value,
      currentPoint: nearest.center,
      snappedSocket: nearest,
      targetDetails: {
        cardId: nearest.cardId,
        socketId: nearest.socketId,
        type: nearest.type
      }
    };
  }

  

  // Return updated state without snap
  return {
    ...activeConnection.value,
    currentPoint: scaledPoint,
    snappedSocket: null,
    targetDetails: null
  };
};

const handleConnectionDragEnd = (event) => {

  // console.log('handleDragEnd', event)
  // // console.log("End", event)
  // // console.log("DragEnd full state:", activeConnection);

  // if (!activeConnection.value?.sourceDetails) {
  //   console.log("No source details in dragEnd");
  //   return null;
  // }

  // if (!activeConnection.value?.targetDetails) {
  //   console.log("No target details in dragEnd");
  //   return null;
  // }

  // const { sourceDetails, targetDetails } = activeConnection.value;

  // if (validateConnection(
  //   sourceDetails.cardId,
  //   sourceDetails.socketId,
  //   targetDetails.cardId,
  //   targetDetails.socketId
  // )) {
  //   const connectionData = {
  //     sourceCardId: sourceDetails.cardId,
  //     sourceSocketId: sourceDetails.socketId,
  //     targetCardId: targetDetails.cardId,
  //     targetSocketId: targetDetails.socketId
  //   };

  //   console.log("Creating connection with data:", connectionData);
  //   return createConnection(connectionData, event);
  // }

  // return null;
};


  const handleConnectionClick = (event, connectionId) => {

    selectedConnectionId.value = connectionId;
    // console.log("handleConnectionClick",     selectedConnectionId.value )
    event.preventDefault();
    event.stopPropagation();
    selectedCardIds.value.clear();
    return connectionId;
  };

  // Value propagation

  // Update socket value propagation for new structure
  const propagateValue = (
    sourceCardId,
    sourceSocketId,
    value,
    visited = new Set()
  ) => {
    const key = `${sourceCardId}-${sourceSocketId}`;
    if (visited.has(key)) return;
    visited.add(key);

    connections.value.forEach((conn) => {
      if (
        conn.sourceCardId === sourceCardId &&
        conn.sourceSocketId === sourceSocketId
      ) {
        const targetSocket = findSocket(conn.targetCardId, conn.targetSocketId);
        if (!targetSocket) return;

        targetSocket.value = Vue.toRaw(value);
        targetSocket.momentUpdated = Date.now();

        activateConnection(conn.id);
        propagateValue(conn.targetCardId, conn.targetSocketId, value, visited);

        onValuePropagated?.({
          connectionId: conn.id,
          sourceCardId,
          sourceSocketId,
          targetCardId: conn.targetCardId,
          targetSocketId: conn.targetSocketId,
          value,
        });
      }
    });
  };


  // Connection visualization
  // Enhance drawSpline with debugging

  // // In socketConnections.js
  // const drawSpline = (source, target) => {
  //     // Convert from Proxy objects and ensure numbers
  //     source = Vue.toRaw(source);
  //     target = Vue.toRaw(target);

  //     if (!source || !target ||
  //         typeof source.x !== 'number' || typeof source.y !== 'number' ||
  //         typeof target.x !== 'number' || typeof target.y !== 'number') {
  //         console.warn('Invalid points provided to drawSpline:', { source, target });
  //         return '';
  //     }

  //     // Add offset for SVG coordinates
  //     const sx = source.x + 4000;
  //     const sy = source.y + 4000;
  //     const tx = target.x + 4000;
  //     const ty = target.y + 4000;

  //     const dx = tx - sx;
  //     const dy = ty - sy;

  //     // Control points for smooth curve
  //     const cx1 = sx + dx * 0.4;
  //     const cy1 = sy;
  //     const cx2 = tx - dx * 0.4;
  //     const cy2 = ty;

  //     return `M ${sx},${sy} C ${cx1},${cy1} ${cx2},${cy2} ${tx},${ty}`;
  // };

  // socketConnections.js drawSpline implementation
  const drawSpline = (source, target) => {
    source = Vue.toRaw(source);
    target = Vue.toRaw(target);

    const sx = Number(source?.x);
    const sy = Number(source?.y);
    const tx = Number(target?.x);
    const ty = Number(target?.y);

    if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) {
      console.warn("Invalid coordinates in drawSpline:", { source, target });
      return "";
    }

    const offsetX = sx + 4000;
    const offsetY = sy + 4000;
    const offsetTX = tx + 4000;
    const offsetTY = ty + 4000;

    const dx = offsetTX - offsetX;
    const dy = offsetTY - offsetY;

    const cx1 = offsetX + dx * 0.4;
    const cy1 = offsetY;
    const cx2 = offsetTX - dx * 0.4;
    const cy2 = offsetTY;

    return `M ${offsetX},${offsetY} C ${cx1},${cy1} ${cx2},${cy2} ${offsetTX},${offsetTY}`;
  };

  // Connection animation
  const activateConnection = (connectionId, duration = 1000) => {
    if (!connectionId || connections.value.has(connectionId)) return;

    const connection = connections.value.find(
      (conn) => conn.id === connectionId
    );
    if (!connection) return;

    connections.value.add(connectionId);
    connection.isActive = true;

    setTimeout(() => {
      connection.isActive = false;
      connections.value.delete(connectionId);
    }, duration);
  };

  // Card cleanup
// In socketConnections.js
const cleanupCardConnections = (cardId) => {
  // First, find all connections that reference this card
  const connectionsToRemove = connections.value.filter(conn =>
    conn.sourceCardId === cardId || conn.targetCardId === cardId
  );

  // Remove each connection
  connectionsToRemove.forEach(conn => {
    const index = connections.value.findIndex(c => c.id === conn.id);
    if (index !== -1) {
      connections.value.splice(index, 1);
      onConnectionRemoved?.(conn);
    }
  });
};

// Add this new function
const cleanupSocketConnections = (socketId) => {
  if (!socketId) return;
  
  // Find all connections that use this socket
  const connectionsToRemove = connections.value.filter(conn =>
    conn.sourceSocketId === socketId || conn.targetSocketId === socketId
  );

  // Remove each connection
  connectionsToRemove.forEach(conn => {
    const index = connections.value.findIndex(c => c.id === conn.id);
    if (index !== -1) {
      connections.value.splice(index, 1);
      onConnectionRemoved?.(conn);
    }
  });
};


  
  const updateCanvasConnections = (newConnections) => {
    if (activeCanvas.value) {
      activeCanvas.value.connections = newConnections;
      activeCanvas.value.momentUpdated = Date.now();
    }
  };
  const updateConnections = async (cardId) => {
    await Vue.nextTick();
    
    await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Filter out connections where sockets no longer exist
            const validConnections = connections.value.filter(conn => {
                if (conn.sourceCardId === cardId || conn.targetCardId === cardId) {
                    // Try to calculate points - this will return null if sockets don't exist
                    const points = calculateConnectionPoints({
                        sourceCardId: conn.sourceCardId,
                        sourceSocketId: conn.sourceSocketId,
                        targetCardId: conn.targetCardId,
                        targetSocketId: conn.targetSocketId
                    });

                    // If points is null, the sockets don't exist anymore, so filter out this connection
                    return points !== null;
                }
                return true; // Keep connections not related to this card
            });

            // Now update the points for remaining valid connections
            const updatedConnections = validConnections.map(conn => {
                if (conn.sourceCardId === cardId || conn.targetCardId === cardId) {
                    const points = calculateConnectionPoints({
                        sourceCardId: conn.sourceCardId,
                        sourceSocketId: conn.sourceSocketId,
                        targetCardId: conn.targetCardId,
                        targetSocketId: conn.targetSocketId
                    });

                    // We know points exists because we filtered above
                    return {
                        ...conn,
                        sourcePoint: points.sourcePoint,
                        targetPoint: points.targetPoint
                    };
                }
                return conn;
            });

            // Update connections with only the valid ones
            connections.value = [...updatedConnections];
            resolve();
        });
    }));
};
   // Update card sockets with new structure
  const updateCardSockets = (cardId, { inputs, outputs }) => {
    const card = cards.value.find((c) => c.uuid === cardId);
    if (!card) {
      console.warn("Card not found:", cardId);
      return;
    }

    const CARD_WIDTH = card.ui.width || 300;
    const SOCKET_SPACING = 30;
    const SOCKET_MARGIN_TOP = 40;

    // Update sockets in card.data
    card.data.sockets = {
      inputs: inputs.map((input, index) => ({
        ...input,
        type: "input",
        x: 0,
        y: SOCKET_MARGIN_TOP + index * SOCKET_SPACING,
        value: null,
        momentUpdated: Date.now(),
      })),
      outputs: outputs.map((output, index) => ({
        ...output,
        type: "output",
        x: CARD_WIDTH,
        y: SOCKET_MARGIN_TOP + index * SOCKET_SPACING,
        value: null,
        momentUpdated: Date.now(),
      })),
    };

    // Force reactivity update on cards
    cards.value = [...cards.value];
    updateConnections(cardId);
  };
  return {
    // Core functions
    createConnection,
    removeConnection,
    propagateValue,
    activateConnection,
    cleanupCardConnections,
    cleanupSocketConnections,
    findNearestSocket,
    getSocketValue,
    handleConnectionDragStart,
    handleConnectionDrag,
    handleConnectionDragEnd,
    handleConnectionClick,
    updateSocketValue,
    updateCanvasConnections,
    updateCardSockets,

    // Visualization
    drawSpline,

    getConnectionStyle,
    getConnectionState,

    // Connection state
    CONNECTION_STATES,
    CONNECTION_STYLES,
    SOCKET_TYPES,
    SNAP_RADIUS,

    // Helpers
    findSocket,
    getSocketType,

    // Validation
    validateConnection,
    updateConnections,
  };
};
