// utils/canvasInteraction/mouseEvents.js

export const createMouseEvents = (props) => {
    const {
        // State refs
        isPanning,
        isOverBackground,
        panStart,
        lastScroll,
        selectedCardIds,
        selectedConnectionId,
        findNearestSocket,
        activeConnection,
        nearestSocket,
        connections,
        canvasRef,
        getScaledPoint,
        SNAP_RADIUS,
        createConnection,
        dragState  // Add dragState to props
    } = props;

    // Throttling for mouse move events
    let moveThrottleTimer = null;
    const MOVE_THROTTLE = 16; // ~60fps

    // Track if we've attached global listeners
    let globalListenersAttached = false;

    // Core panning logic
    const startPanning = (event) => {
        isPanning.value = true;
        panStart.x = event.clientX;
        panStart.y = event.clientY;
        lastScroll.x = canvasRef.value?.scrollLeft || 0;
        lastScroll.y = canvasRef.value?.scrollTop || 0;
        document.body.style.cursor = 'grabbing';
        attachGlobalListeners();
    };

    const handleBackgroundMouseDown = (event) => {
        if (event.button !== 0 && event.button !== 1) return;

        const isInteractiveElement = event.target.closest(
            'select, input[type="file"],input[type="text"], .text-editor-input, button, .form-control, select, .p-select, path, .card, .socket, .p-inputtext, .p-button'
        );

        if (!isInteractiveElement) {
            event.preventDefault();
            event.stopPropagation();
            
            selectedCardIds.value.clear();
            selectedConnectionId.value = null;
            
            // Clear drag state instead of dragStartPositions
            dragState.value = {
                isDragging: false,
                dragOrigin: { x: 0, y: 0 },
                startPositions: new Map()
            };
        }

        if (event.button === 1 || (event.button === 0 && !isInteractiveElement)) {
            startPanning(event);
        }
    };

    const handleMouseMove = (event) => {
        if (event.target === event.currentTarget) {
            isOverBackground.value = true;
            if (!isPanning.value) {
                document.body.style.cursor = 'grab';
            }
        }
    
        if (activeConnection.value) {
            const point = { x: event.clientX, y: event.clientY };
            
            const nearest = findNearestSocket(
                point,
                activeConnection.value.sourceType
            );

            if (nearestSocket.value?.element) {
                nearestSocket.value.element.classList.remove('socket-highlight');
            }
    
            nearestSocket.value = nearest;
            if (nearest && nearest.distance < SNAP_RADIUS) {
                nearest.element.classList.add('socket-highlight');
                activeConnection.value = {
                    ...activeConnection.value,
                    currentPoint: getScaledPoint(nearest.center),
                    snappedSocket: nearest
                };
            } else {
                activeConnection.value = {
                    ...activeConnection.value,
                    currentPoint: getScaledPoint(point),
                    snappedSocket: null
                };
            }
        }
    };
   
    const handleMouseUp = (event) => {
        if (activeConnection.value) {
            const rawActiveConnection = Vue.toRaw(activeConnection.value);
            let snappedSocket = rawActiveConnection.snappedSocket;
            
            if (!snappedSocket) {
                const point = { x: event.clientX, y: event.clientY };
                snappedSocket = findNearestSocket(point, rawActiveConnection.sourceType);
            }
    
            if (snappedSocket && snappedSocket.distance < SNAP_RADIUS) {
                // Connection creation logic...
                // Existing connection handling code stays the same
            }
    
            if (nearestSocket.value?.element) {
                nearestSocket.value.element.classList.remove('socket-highlight');
            }
            activeConnection.value = null;
            nearestSocket.value = null;
        }
    
        // Clear drag state instead of dragStartPositions
        dragState.value = {
            isDragging: false,
            dragOrigin: { x: 0, y: 0 },
            startPositions: new Map()
        };
        
        isPanning.value = false;
        document.body.style.cursor = isOverBackground.value ? 'grab' : '';
    };

    const handleMouseLeave = () => {
        isOverBackground.value = false;
        if (!isPanning.value) {
            document.body.style.cursor = '';
        }
    };

    // Setup and cleanup
    const setup = () => {
        const cleanup = () => {
            removeGlobalListeners();
            if (moveThrottleTimer) {
                clearTimeout(moveThrottleTimer);
            }
        };
        return cleanup;
    };

    // Helper functions for panning
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

    return {
        handleBackgroundMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        setup
    };
};