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
        scrollLeft: 4000, // Center of 8000x8000
        scrollTop: 4000,  // Center of 8000x8000
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
    const canvas = activeCanvas.value;
    if (!canvas) return null;
  
    return {
      id: canvas.id,
      name: canvas.name,
      cards: canvas.cards,
      connections: canvas.connections,
      viewport: {
        zoomLevel: canvas.viewport.zoomLevel,
        scrollLeft: canvas.viewport.scrollLeft,
        scrollTop: canvas.viewport.scrollTop
      },
      created: canvas.created,
      lastModified: canvas.lastModified,
      version: "1.0"
    };
  };
  

  //Clone and append the current active canvas.
  const cloneCanvas = ()=>{
    let newCanvas = JSON.parse(JSON.stringify(activeCanvas.value))
    newCanvas.id = uuidv4()

    const newCanvasesArray = [...canvases.value, newCanvas];
    canvases.value = newCanvasesArray;
    activeCanvasId.value = newCanvas.id;
  }

  const importCanvas = (canvasData) => {
    const canvas = {
      id: uuidv4(),
      name: canvasData.name || "Imported Canvas",
      cards: canvasData.cards || [],
      connections: canvasData.connections || [],
      viewport: {
        zoomLevel: canvasData.viewport?.zoomLevel || 1,
        scrollLeft: canvasData.viewport?.scrollLeft || 4000,
        scrollTop: canvasData.viewport?.scrollTop || 4000
      },
      created: canvasData.created || Date.now(),
      lastModified: Date.now(),
    };
  
    canvases.value = [...canvases.value, canvas];
    activeCanvasId.value = canvas.id;
    return canvas.id;
  };

  

  return {
    // Core functionality
    createCanvas,
    removeCanvas,
    cloneCanvas,
    exportCanvas,
    importCanvas,
  };
};
