// utils/canvasInteraction/zoomPan.js

export const createZoomPanControls = (props) => {
    const {
        // State refs
        zoomLevel,
        canvasRef,
        connections,
        updateConnections,
        calculateConnectionPoint,
        
        // Constants
        ZOOM_SETTINGS = {
            MIN: 0.1,
            MAX: 3,
            PAN_SPEED: 0.5,
            ANIMATION_DURATION: 200
        }
    } = props;

    // Enhanced state tracking
    const isZooming = Vue.ref(false);
    const isPanning = Vue.ref(false);
    const lastZoomCenter = Vue.ref(null);

    // Set zoom level with proper coordinate handling
    const setZoom = (newZoom, centerX, centerY) => {
        const oldZoom = zoomLevel.value;
        zoomLevel.value = Math.max(ZOOM_SETTINGS.MIN, Math.min(ZOOM_SETTINGS.MAX, newZoom));

        if (centerX !== undefined && centerY !== undefined) {
            const container = canvasRef.value;
            const rect = container.getBoundingClientRect();

            // Calculate the world point under the zoom center
            const worldX = (centerX - rect.left + container.scrollLeft - 4000) / oldZoom;
            const worldY = (centerY - rect.top + container.scrollTop - 4000) / oldZoom;

            // Calculate where this point should be after zooming
            const newScrollLeft = worldX * zoomLevel.value - (centerX - rect.left) + 4000;
            const newScrollTop = worldY * zoomLevel.value - (centerY - rect.top) + 4000;

            // Update scroll position in a single operation
            container.scrollLeft = newScrollLeft;
            container.scrollTop = newScrollTop;

            // Update connections if they exist
            if (connections?.value) {
                requestAnimationFrame(() => {
                    const updatedCards = new Set();
                    
                    connections.value.forEach((conn) => {
                        if (conn.sourceCardId && !updatedCards.has(conn.sourceCardId)) {
                            updateConnections(conn.sourceCardId);
                            updatedCards.add(conn.sourceCardId);
                        }
                        if (conn.targetCardId && !updatedCards.has(conn.targetCardId)) {
                            updateConnections(conn.targetCardId);
                            updatedCards.add(conn.targetCardId);
                        }
                    });
                });
            }
        }
    };

    // Enhanced wheel handling
    const handleWheel = (event) => {
        if (!canvasRef.value) return;

        try {
            if (event.ctrlKey || event.metaKey || event.deltaMode === 0) {
                event.preventDefault();
                
                const delta = -event.deltaY;
                const zoomFactor = Math.pow(1.002, delta); // Original multiplier that worked
                const newZoom = zoomLevel.value * zoomFactor;

                setZoom(
                    newZoom,
                    event.clientX,
                    event.clientY
                );
            } else {
                // Regular pan operation
                const speedMultiplier = ZOOM_SETTINGS.PAN_SPEED / zoomLevel.value;
                requestAnimationFrame(() => {
                    canvasRef.value.scrollBy({
                        left: event.deltaX * speedMultiplier,
                        top: event.deltaY * speedMultiplier,
                        behavior: 'auto'
                    });
                });
            }
        } catch (error) {
            console.error('Error handling wheel event:', error);
        }
    };

    // Enhanced button zoom controls
    const zoomIn = () => {
        if (!canvasRef.value) return;
        
        try {
            const container = canvasRef.value;
            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate current zoom percentage and round to nearest 10
            const currentPercent = Math.round(zoomLevel.value * 100);
            const roundedPercent = Math.round(currentPercent / 10) * 10;
            // Next 10% increment
            const nextPercent = roundedPercent + 10;
            // Convert to zoom level
            const newZoom = Math.min(nextPercent / 100, ZOOM_SETTINGS.MAX);

            setZoom(newZoom, centerX, centerY);
        } catch (error) {
            console.error('Error in zoomIn:', error);
        }
    };

    const zoomOut = () => {
        if (!canvasRef.value) return;
        
        try {
            const container = canvasRef.value;
            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate current zoom percentage and round to nearest 10
            const currentPercent = Math.round(zoomLevel.value * 100);
            const roundedPercent = Math.round(currentPercent / 10) * 10;
            // Previous 10% increment
            const prevPercent = roundedPercent - 10;
            // Convert to zoom level
            const newZoom = Math.max(prevPercent / 100, ZOOM_SETTINGS.MIN);

            setZoom(newZoom, centerX, centerY);
        } catch (error) {
            console.error('Error in zoomOut:', error);
        }
    };

    // Center the canvas view
    const centerCanvas = (animate = true) => {
        if (!canvasRef.value) return;
    
        try {
            const container = canvasRef.value;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            const targetLeft = 4150 - containerWidth / 2;
            const targetTop = 4250 - containerHeight / 2;
    
            container.scrollTo({
                left: targetLeft,
                top: targetTop,
                behavior: animate ? 'smooth' : 'auto'
            });
        } catch (error) {
            console.error('Error centering canvas:', error);
        }
    };

    // Update content size based on zoom
    const updateContentSize = () => {
        const content = canvasRef.value?.querySelector('.pan-background');
        if (!content) return;
        
        const baseSize = 8000;
        const scaledSize = Math.ceil(baseSize * zoomLevel.value);
        
        content.style.width = `${scaledSize}px`;
        content.style.height = `${scaledSize}px`;
    };

    return {
        setZoom,
        handleWheel,
        zoomIn,
        zoomOut,
        centerCanvas,
        getZoomPercent: () => Math.round(zoomLevel.value * 100),
        isZooming,
        isPanning,
        lastZoomCenter,
        updateContentSize
    };
};