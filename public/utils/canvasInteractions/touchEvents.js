// utils/canvasInteraction/touchEvents.js

export const createTouchEvents = (props) => {
    const {
        isPanning,
        panStart,
        lastScroll,
        lastTouchDistance,
        lastTouchCenter,
        connectionTouchStart,
        activeConnection,
        nearestSocket,
        findNearestSocket,
        canvasRef,
        zoomLevel,
        setZoom,
        getScaledPoint,
        handleConnectionDragStart,
handleConnectionDrag,
handleConnectionDragEnd,
createConnection,
validateConnection,

    } = props;

    // Constants for touch handling
    const TOUCH_CONFIG = {
        MIN_ZOOM: 0.1,
        MAX_ZOOM: 3,
        SNAP_RADIUS: 50,
        ZOOM_SPEED: 0.003,
        PAN_THRESHOLD: 10,
        // Time for which zoom state is considered "stable" before reset
        ZOOM_STABILITY_THRESHOLD: 100
    };

    // Enhanced state tracking
    const touchState = Vue.reactive({
        startZoom: 1,
        lastZoomTime: 0,
        lastScale: 1,
        currentGesture: null, // 'pan', 'zoom', or 'connection'
        initialTouchDistance: null,
        accumulatedScale: 1
    });

    // Core touch event handlers
    const handleTouchStart = (event) => {
        event.preventDefault();

        // Handle socket connection start
        if (event.touches.length === 1) {
            const socket = event.target.closest(".socket");
            if (socket) {
                initializeConnection(event, socket);
                touchState.currentGesture = 'connection';
                return;
            }
        }

        // Handle zoom or pan initiation
        if (event.touches.length === 2) {
            touchState.currentGesture = 'zoom';
            initializePinchZoom(event);
        } else if (event.touches.length === 1) {
            touchState.currentGesture = 'pan';
            initializePan(event);
        }
    };

    const handleTouchMove = (event) => {
        event.preventDefault();

        switch (touchState.currentGesture) {
            case 'zoom':
                handlePinchZoom(event);
                break;
            case 'pan':
                handlePan(event);
                break;
            case 'connection':
                handleConnectionDrag(event);
                break;
        }
    };

    const handleTouchEnd = (event) => {
        event.preventDefault();
    
        if (touchState.currentGesture === 'connection' && activeConnection.value) {
            createConnection(activeConnection.value, event, 'touch');
            activeConnection.value = null;
            connectionTouchStart.value = null;
            nearestSocket.value = null;
        }
    
        // Reset touch state
        touchState.currentGesture = null;
        touchState.startZoom = 1;
        touchState.lastScale = 1;
        touchState.initialTouchDistance = null;
        touchState.accumulatedScale = 1;
        lastTouchDistance.value = null;
        lastTouchCenter.value = null;
        isPanning.value = false;
    };

    // Zoom handling
    const initializePinchZoom = (event) => {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        // Calculate initial distance and center
        const initialDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        const center = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };

        // Store initial state
        touchState.startZoom = zoomLevel.value;
        touchState.initialTouchDistance = initialDistance;
        touchState.lastScale = 1;
        touchState.accumulatedScale = 1;
        lastTouchDistance.value = initialDistance;
        lastTouchCenter.value = center;
    };

    const handlePinchZoom = (event) => {
        if (event.touches.length !== 2) return;
    
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const viewportOffset = window.visualViewport?.offsetTop || 0;
    
        // Calculate center point of the pinch gesture
        const center = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2 - viewportOffset
        };
    
        // Calculate current distance
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    
        if (lastTouchDistance.value) {
            // Calculate scale change
            const scaleChange = currentDistance / touchState.initialTouchDistance;
            
            // Apply exponential smoothing to scale
            const smoothingFactor = 0.3;
            touchState.accumulatedScale = 
                touchState.accumulatedScale * (1 - smoothingFactor) + 
                scaleChange * smoothingFactor;
    
            // Calculate new zoom level
            const newZoom = touchState.startZoom * touchState.accumulatedScale;
    
            // Use requestAnimationFrame for smooth animation
            requestAnimationFrame(() => {
                setZoom(newZoom, center.x, center.y);
            });
        }
    
        lastTouchDistance.value = currentDistance;
        lastTouchCenter.value = center;
        touchState.lastZoomTime = Date.now();
    };

    // Pan handling
    const initializePan = (event) => {
        const touch = event.touches[0];
        isPanning.value = true;
        panStart.x = touch.clientX;
        panStart.y = touch.clientY;

        if (canvasRef.value) {
            lastScroll.x = canvasRef.value.scrollLeft;
            lastScroll.y = canvasRef.value.scrollTop;
        }
    };

    const handlePan = (event) => {
        if (!isPanning.value || !canvasRef.value || event.touches.length !== 1) return;

        const touch = event.touches[0];
        const dx = touch.clientX - panStart.x;
        const dy = touch.clientY - panStart.y;

        requestAnimationFrame(() => {
            canvasRef.value.scrollLeft = lastScroll.x - dx;
            canvasRef.value.scrollTop = lastScroll.y - dy;
        });
    };

    // Connection handling
    const initializeConnection = (event, socket) => {
        const touch = event.touches[0];
        const rect = socket.getBoundingClientRect();
        const viewportOffset = window.visualViewport?.offsetTop || 0;

        const socketType = socket.dataset.type;
        const startPoint = {
            x: socketType === "input" ? rect.left : rect.right,
            y: rect.top + rect.height / 2
        };

        connectionTouchStart.value = {
            startPoint,
            socket: {
                id: socket.dataset.socketId,
                type: socketType
            },
            cardId: socket.closest("[data-card-id]").dataset.cardId
        };

        activeConnection.value = {
            startPoint: getScaledPoint(startPoint),
            currentPoint: getScaledPoint({
                x: touch.clientX,
                y: touch.clientY - viewportOffset
            }),
            sourceSocket: connectionTouchStart.value.socket,
            sourceCardId: connectionTouchStart.value.cardId,
            sourceType: socketType,
            snappedSocket: null
        };
    };
 
 

    return {
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        touchState
    };
};