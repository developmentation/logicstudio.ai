// utils/canvasState/canvasRegistry.js
export const createCanvasRegistry = (props) => {
  const {
    // State refs from parent
    canvases,
    activeCanvas,
    activeCanvasId,
    activeCards,
    activeConnections,
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
  
    const newCanvasesArray = [...canvases.value, canvas];
    canvases.value = newCanvasesArray;
    activeCanvasId.value = canvas.id;
    return canvas.id;
  };
  

  const removeCanvas = (canvasId) => {
    const index = canvases.value.findIndex((c) => c.id === canvasId);
    if (index === -1) return false;
  
    const newCanvases = [...canvases.value];
    newCanvases.splice(index, 1);
    canvases.value = newCanvases;
  
    if (activeCanvasId.value === canvasId) {
      // If there are no canvases left, create a new one
      if (newCanvases.length === 0) {
        createCanvas();
      } else {
        // Try to activate the next canvas, or the previous one if there is no next
        const targetCanvas = newCanvases[index] || newCanvases[index - 1];
        activeCanvasId.value = targetCanvas.id;
      }
    }
  
    return true;
  };

  // Export/Import
  const exportCanvas = (canvasId = activeCanvasId.value) => {
    const canvas =activeCanvas.value;
    if (!canvas) return null;

    console.log("exportCanvas", JSON.parse(JSON.stringify(activeCanvas.value)))

    return {
      id: canvas.id,
      name: canvas.name,
      cards: canvas.cards,
      connections: canvas.connections,
      viewport: canvas.viewport,
      created: canvas.created,
      lastModified: canvas.lastModified,
      version: "1.0", //Could load this fromt he configs
    };
  };


  const importCanvas = (canvasData) => {
    console.log("Import Data", canvasData)
    const canvas = {
        id:  uuidv4(), //Always assign an imported canvas a fresh UUID so they don't conflict if there are multiple instances canvasData.id ||
        name: canvasData.name || "Imported Canvas",
        cards: canvasData.cards || [],
        connections: canvasData.connections || [],
        viewport: canvasData.viewport || {
            zoomLevel: 1,
            centerX: 0,
            centerY: 0,
        },
        created: canvasData.created || Date.now(),
        lastModified: Date.now(),
    };

    // Add the new canvas to the array
    canvases.value = [...canvases.value, canvas];
    
    // IMPORTANT: Set this as the active canvas
    activeCanvasId.value = canvas.id;
    return canvas.id;
};

  return {
    // Core functionality
    createCanvas,
    removeCanvas,

    exportCanvas,
    importCanvas,
  };
};
