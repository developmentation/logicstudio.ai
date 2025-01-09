// utils/canvasInteraction/mouseEvents.js

export const createMouseEvents = (props) => {
    const {
        // State refs
        isPanning,
        isOverBackground,
        panStart,
        lastScroll,
        selectedCardIds,
        dragStartPositions,
        selectedConnectionId,
        findNearestSocket,
        activeConnection,
        nearestSocket,
        connections,
        canvasRef,
        getScaledPoint,
        SNAP_RADIUS,
        createConnection,
        onConnectionStart,
validateConnection,
completeConnection, 

    } = props;

    // Throttling for mouse move events
    let moveThrottleTimer = null;
    const MOVE_THROTTLE = 16; // ~60fps

    // Track if we've attached global listeners
    let globalListenersAttached = false;

    // Core panning logic
    const startPanning = (event) => {
        // console.log('start panning', event)
        isPanning.value = true;
        panStart.x = event.clientX;
        panStart.y = event.clientY;
        lastScroll.x = canvasRef.value?.scrollLeft || 0;
        lastScroll.y = canvasRef.value?.scrollTop || 0;
        document.body.style.cursor = 'grabbing';
        attachGlobalListeners();
    };

    const updatePanning = (event) => {
        if (!isPanning.value || !canvasRef.value) return;
        
        const dx = event.clientX - panStart.x;
        const dy = event.clientY - panStart.y;
        
        canvasRef.value.scrollLeft = lastScroll.x - dx;
        canvasRef.value.scrollTop = lastScroll.y - dy;
    };

    const stopPanning = () => {
        isPanning.value = false;
        document.body.style.cursor = '';
        removeGlobalListeners();
    };

    // Global event handlers
    const handleGlobalMouseMove = (event) => {
        if (moveThrottleTimer) return;

        moveThrottleTimer = setTimeout(() => {
            moveThrottleTimer = null;
            if (isPanning.value) {
                updatePanning(event);
            }
        }, MOVE_THROTTLE);
    };

    const handleGlobalMouseUp = () => {
        stopPanning();
    };

    // Attach/remove global listeners
    const attachGlobalListeners = () => {
        if (!globalListenersAttached) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            globalListenersAttached = true;
        }
    };

    const removeGlobalListeners = () => {
        if (globalListenersAttached) {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            globalListenersAttached = false;
        }
    };
    const handleBackgroundMouseDown = (event) => {
        if (event.button !== 0 && event.button !== 1) return;
    
        // Check if we're clicking on the InputText or its parent div
        // const isInputArea = event.target.closest('.flex.items-center.gap-2');
        // if (isInputArea) {
        //     // Don't prevent default behavior for input area
        //     return;
        // }
    

        // Check if we're clicking on any other interactive elements
        const isInteractiveElement = event.target.closest(
            'select, input[type="file"],input[type="text"], .text-editor-input, button, .form-control, select, .p-select, path, .card, .socket, .p-inputtext, .p-button'
        );
    
        // Only prevent default and stop propagation if we're not on an interactive element
        if (!isInteractiveElement) {
            event.preventDefault();
            event.stopPropagation();
            
            selectedCardIds.value.clear();
            selectedConnectionId.value = null;
            dragStartPositions.value.clear();
        }
    
        // Start panning only on middle click or left click on empty background
        if (event.button === 1 || (event.button === 0 && !isInteractiveElement)) {
            startPanning(event);
        }
    };
    
    // const handleMouseMove = (event) => {
    //     // Update cursor state for background interaction
    //     if (event.target === event.currentTarget) {
    //         isOverBackground.value = true;
    //         if (!isPanning.value) {
    //             document.body.style.cursor = 'grab';
    //         }
    //     }
    
    //     // Handle active connection dragging
    //     if (activeConnection.value) {
    //         console.log('mouseEvents handleMouseMove with activeConnection:', activeConnection.value);
    
    //         // Get current mouse position
    //         const point = { x: event.clientX, y: event.clientY };
            
    //         // Find nearest compatible socket
    //         const nearest = findNearestSocket(
    //             getScaledPoint(point), 
    //             activeConnection.value.sourceType
    //         );
    
    //         // Update nearest socket ref
    //         nearestSocket.value = nearest;
    
    //         // Important: Create a completely new object for reactivity
    //         const updatedConnection = {
    //             // Preserve all existing properties
    //             ...activeConnection.value,
                
    //             // Update the current point position
    //             currentPoint: nearest && nearest.distance < SNAP_RADIUS 
    //                 ? nearest.center   // Snap to the nearest socket
    //                 : getScaledPoint(point),  // Otherwise follow mouse
                
    //             // Update the snapped socket information
    //             snappedSocket: nearest && nearest.distance < SNAP_RADIUS 
    //                 ? nearest 
    //                 : null
    //         };
    
    //         // Assign the new object to trigger reactivity
    //         activeConnection.value = updatedConnection;
    
    //         // Force a redraw
    //         if (canvasRef.value) {
    //             canvasRef.value.dispatchEvent(new Event('mousemove'));
    //         }
    //     }
    // };

    // const handleMouseUp = (event) => {
    //     dragStartPositions.value.clear();
    
    //     if (activeConnection.value) {
    //         createConnection(activeConnection.value, event, 'mouse');
    //         activeConnection.value = null;
    //         nearestSocket.value = null;
    //     }
    
    //     isPanning.value = false;
    //     document.body.style.cursor = isOverBackground.value ? 'grab' : '';
    // };


    const handleMouseMove = (event) => {
        // Update cursor state for background interaction
        if (event.target === event.currentTarget) {
            isOverBackground.value = true;
            if (!isPanning.value) {
                document.body.style.cursor = 'grab';
            }
        }
    
        // Handle active connection dragging
        if (activeConnection.value) {
            const point = { x: event.clientX, y: event.clientY };
            
            // Use actual mouse coordinates for finding nearest socket
            const nearest = findNearestSocket(
                point,  // Don't scale the point for finding nearest
                activeConnection.value.sourceType
            );

    
            // Clear previous highlight if exists
            if (nearestSocket.value?.element) {
                nearestSocket.value.element.classList.remove('socket-highlight');
            }
    
            // Update nearest socket reference and highlight
            nearestSocket.value = nearest;
            if (nearest && nearest.distance < SNAP_RADIUS) {
                nearest.element.classList.add('socket-highlight');
                activeConnection.value = {
                    ...activeConnection.value,
                    currentPoint: getScaledPoint(nearest.center),  // Scale the point for display
                    snappedSocket: nearest
                };
            } else {
                activeConnection.value = {
                    ...activeConnection.value,
                    currentPoint: getScaledPoint(point),  // Scale the point for display
                    snappedSocket: null
                };
            }
        }
    };
   
    const handleMouseUp = (event) => {
        if (activeConnection.value) {
            const rawActiveConnection = Vue.toRaw(activeConnection.value);
            let snappedSocket = rawActiveConnection.snappedSocket;
            
            // If not snapped, try one last time to find nearest socket
            if (!snappedSocket) {
                const point = { x: event.clientX, y: event.clientY };
                snappedSocket = findNearestSocket(point, rawActiveConnection.sourceType);
            }
    
            if (snappedSocket && snappedSocket.distance < SNAP_RADIUS) {
                const targetCardId = snappedSocket.cardId;
                const targetSocketId = snappedSocket.socketId;
                const targetType = snappedSocket.type;
                const sourceType = rawActiveConnection.sourceType;
    
                // Check for existing input connection
                if (targetType === 'input') {
                    const hasExistingConnection = connections.value.some(
                        conn => conn.targetCardId === targetCardId && 
                               conn.targetSocketId === targetSocketId
                    );
    
                    if (hasExistingConnection) {
                        if (nearestSocket.value?.element) {
                            nearestSocket.value.element.classList.remove('socket-highlight');
                        }
                        activeConnection.value = null;
                        nearestSocket.value = null;
                        return;
                    }
                }
    
                // Create connection if types are compatible and not self-connecting
                if ((sourceType === 'output' && targetType === 'input') ||
                    (sourceType === 'input' && targetType === 'output')) {
                    if (rawActiveConnection.sourceCardId !== targetCardId) {
                        const connectionData = {
                            sourceCardId: rawActiveConnection.sourceCardId,
                            sourceSocketId: rawActiveConnection.sourceSocket.id,
                            targetCardId,
                            targetSocketId,
                            sourcePoint: {
                                x: rawActiveConnection.startPoint.x,
                                y: rawActiveConnection.startPoint.y
                            },
                            targetPoint: snappedSocket.center ? {
                                x: snappedSocket.center.x,
                                y: snappedSocket.center.y
                            } : rawActiveConnection.currentPoint
                        };
                        
                        // console.log("Creating connection with:", connectionData);
                        createConnection(connectionData, event, 'mouse');
                    }
                }
            }
    
            // Cleanup
            if (nearestSocket.value?.element) {
                nearestSocket.value.element.classList.remove('socket-highlight');
            }
            activeConnection.value = null;
            nearestSocket.value = null;
        }
    
        dragStartPositions.value.clear();
        isPanning.value = false;
        document.body.style.cursor = isOverBackground.value ? 'grab' : '';
    };


    const handleMouseLeave = () => {
        isOverBackground.value = false;
        if (!isPanning.value) {
            document.body.style.cursor = '';
        }
    };

    // Helper functions
    // const findNearestSocket = (point, sourceType, maxDistance = SNAP_RADIUS) => {
    //     const allSockets = document.querySelectorAll('.socket');
    //     let nearest = null;
    //     let minDistance = maxDistance;

    //     allSockets.forEach(socket => {
    //         const socketType = socket.dataset.type;
    //         if ((sourceType === "output" && socketType !== "input") ||
    //             (sourceType === "input" && socketType !== "output")) {
    //             return;
    //         }

    //         const rect = socket.getBoundingClientRect();
    //         const socketCenter = {
    //             x: rect.left + rect.width / 2,
    //             y: rect.top + rect.height / 2
    //         };

    //         const distance = Math.hypot(point.x - socketCenter.x, point.y - socketCenter.y);
    //         if (distance < minDistance) {
    //             minDistance = distance;
    //             nearest = { element: socket, center: socketCenter, distance };
    //         }
    //     });

    //     return nearest;
    // };
 

   

    // Setup function for initial event binding
    const setup = () => {
        const cleanup = () => {
            removeGlobalListeners();
            if (moveThrottleTimer) {
                clearTimeout(moveThrottleTimer);
            }
        };

        return cleanup;
    };

 

    return {
        handleBackgroundMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        setup
    };
};