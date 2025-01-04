// utils/canvasState/canvasRegistry.js
export const createCanvasRegistry = (props) => {
  const {
    // State refs from parent
    canvases,
    activeCanvas,
    activeCanvasId,
    activeCards,
    activeConnections,
    serializeCards,
    deserializeCards,
    serializeConnectionState,
    deserializeConnectionState,
  } = props;

  // Canvas Management
  const createCanvas = (
    name = "Untitled Canvas",
    description = "A new canvas for building AI agent operations."
  ) => {
    const canvas = {
      id: uuidv4(),
      name,
      description,
      cards: [],
      connections: [],
      created: Date.now(),
      lastModified: Date.now(),
      viewport: {
        zoomLevel: 1,
        centerX: 0,
        centerY: 0,
      },
    };

    canvases.value = [...canvases.value, canvas];
    setActiveCanvas(canvas);
    console.log("Canvas Created", canvas);
    return canvas.id;
  };

  const removeCanvas = (canvasId) => {
    const index = canvases.value.findIndex((c) => c.id === canvasId);
    if (index === -1) return false;

    const newCanvases = [...canvases.value];
    newCanvases.splice(index, 1);
    canvases.value = newCanvases;

    if (activeCanvasId.value === canvasId) {
      const nextCanvas = newCanvases[index] || newCanvases[index - 1];
      if (nextCanvas) {
        activeCanvas.value = canvases.value[nextCanvas.id];
      } else {
        activeCanvasId.value = null;
      }
    }

    return true;
  };

  // Manual state management
  const saveCanvasState = () => {
    const canvas = activeCanvas.value;
    if (!canvas) return;
    canvas.cards = serializeCards();
    canvas.connectionState = serializeConnectionState();
    canvas.lastModified = Date.now();
    canvases.value = [...canvases.value];
  };

  // Export/Import
  const exportCanvas = (canvasId = activeCanvasId.value) => {
    const canvas =activeCanvas.value;
    if (!canvas) return null;

    saveCanvasState(); // Save current state before export

    return {
      id: canvas.id,
      name: canvas.name,
      cards: canvas.cards,
        connections: canvas.connections,
      connectionState: canvas.connectionState,
      viewport: canvas.viewport,
      created: canvas.created,
      lastModified: canvas.lastModified,
      version: "2.0",
    };
  };

  const importCanvas = (canvasData) => {
    const canvas = {
      id: canvasData.id || uuidv4(),
      name: canvasData.name || "Imported Canvas",
      cards: canvasData.cards || [],
      connections: canvasData.connections || [],
      connectionState: canvasData.connectionState || {},
      viewport: canvasData.viewport || {
        zoomLevel: 1,
        centerX: 0,
        centerY: 0,
      },
      created: canvasData.created || Date.now(),
      lastModified: Date.now(),
    };

    canvases.value = [...canvases.value, canvas];
    setActiveCanvas(canvas);

    return canvas.id;
  };

  const setActiveCanvas = (canvas) => {
    activeCanvas.value = canvas;
    activeCanvasId.value = canvas.id;
    activeCards.value = canvas.cards;
    activeConnections.value = canvas.connections;
  };

  return {
    // Core functionality
    createCanvas,
    removeCanvas,
    setActiveCanvas,

    exportCanvas,
    importCanvas,
  };
};
