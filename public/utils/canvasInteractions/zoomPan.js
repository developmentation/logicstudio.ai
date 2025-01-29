// utils/canvasInteraction/zoomPan.js

export const createZoomPanControls = (props) => {
    const {
        zoomLevel,
        canvasRef,
        connections,
        updateConnections,
        calculateConnectionPoint,
        
        ZOOM_SETTINGS = {
            MIN: 0.1,
            MAX: 3,
            PAN_SPEED: 0.5,
            ANIMATION_DURATION: 200
        }
    } = props;

    const isZooming = Vue.ref(false);
    const isPanning = Vue.ref(false);
    const lastZoomCenter = Vue.ref(null);

    const setZoom = (newZoom, centerX, centerY) => {
        const oldZoom = zoomLevel.value;
        zoomLevel.value = Math.max(ZOOM_SETTINGS.MIN, Math.min(ZOOM_SETTINGS.MAX, newZoom));

        if (centerX !== undefined && centerY !== undefined) {
            const container = canvasRef.value;
            const rect = container.getBoundingClientRect();

            // Calculate relative to the fixed 8000x8000 space
            const worldX = (centerX - rect.left + container.scrollLeft - 4000) / oldZoom;
            const worldY = (centerY - rect.top + container.scrollTop - 4000) / oldZoom;

            const newScrollLeft = (worldX * zoomLevel.value + 4000) - (centerX - rect.left);
            const newScrollTop = (worldY * zoomLevel.value + 4000) - (centerY - rect.top);

            container.scrollLeft = newScrollLeft;
            container.scrollTop = newScrollTop;

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

    const handleWheel = (event) => {
        if (!canvasRef.value) return;

        try {
            if (event.ctrlKey || event.metaKey || event.deltaMode === 0) {
                event.preventDefault();
                
                const delta = -event.deltaY;
                const zoomFactor = Math.pow(1.002, delta);
                const newZoom = zoomLevel.value * zoomFactor;

                setZoom(
                    newZoom,
                    event.clientX,
                    event.clientY
                );
            } else {
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

    const zoomIn = () => {
        if (!canvasRef.value) return;
        
        try {
            const container = canvasRef.value;
            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const currentPercent = Math.round(zoomLevel.value * 100);
            const roundedPercent = Math.round(currentPercent / 10) * 10;
            const nextPercent = roundedPercent + 10;
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

            const currentPercent = Math.round(zoomLevel.value * 100);
            const roundedPercent = Math.round(currentPercent / 10) * 10;
            const prevPercent = roundedPercent - 10;
            const newZoom = Math.max(prevPercent / 100, ZOOM_SETTINGS.MIN);

            setZoom(newZoom, centerX, centerY);
        } catch (error) {
            console.error('Error in zoomOut:', error);
        }
    };

    const centerCanvas = (animate = true) => {
        if (!canvasRef.value) return;
    
        try {
            const container = canvasRef.value;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            const targetLeft = 4000 - containerWidth / 2;
            const targetTop = 4000 - containerHeight / 2;
    
            container.scrollTo({
                left: targetLeft,
                top: targetTop,
                behavior: animate ? 'smooth' : 'auto'
            });
        } catch (error) {
            console.error('Error centering canvas:', error);
        }
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
        // updateContentSize
    };
};