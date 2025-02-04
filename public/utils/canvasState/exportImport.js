// utils/canvasState/exportImport.js
// Import the migration utilities - This ensures backward compatibility with the old flat card format
import { migrateCanvasData} from './migrate.js';

export const createExportImport = (props) => {
    const {
        // Core canvas operations
        canvases,
        activeCards,
        exportCanvas,
        importCanvas,
        zoomLevel,
        
        // Canvas refs
        canvasRef,
        activeCanvasId,
        cards,
        connections
    } = props;

    // Data validation
    const validateImportData = (data) => {
        if (!data || typeof data !== 'object') return false;
        
        // Basic structure validation
        const requiredFields = ['cards', 'connections', 'viewport'];
        if (!requiredFields.every(field => field in data)) return false;

        // Validate cards and their sockets
        if (!Array.isArray(data.cards)) return false;
        for (const card of data.cards) {
            if (!card.uuid || !card.type || !card.data.sockets) return false;
            if (!card.data.sockets.inputs || !card.data.sockets.outputs) return false;
        }

        return true;
    };
    
    
    
    const calculateBoundingBox = (cards) => {
        if (!cards || cards.length === 0) {
            return {
                minX: 0,
                minY: 0,
                maxX: 0,
                maxY: 0,
                width: 0,
                height: 0
            };
        }
    
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
    
        // Calculate the bounds including all cards
        cards.forEach(card => {
            const cardLeft = card.x;
            const cardTop = card.y;
            const cardWidth = 320; // Default card width
            const cardHeight = 200; // Default card height
            
            const cardRight = cardLeft + cardWidth;
            const cardBottom = cardTop + cardHeight;
    
            minX = Math.min(minX, cardLeft);
            minY = Math.min(minY, cardTop);
            maxX = Math.max(maxX, cardRight);
            maxY = Math.max(maxY, cardBottom);
        });
    
        // Add padding around the bounds
        const padding = 100;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
    
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    };
    
    const exportToPNG = async (options = {}) => {
        if (!canvasRef.value) return null;
    
        try {
            await Vue.nextTick();
    
            // Get the main canvas container
            const contentContainer = canvasRef.value;
            
            // Calculate viewport size based on zoom
            const viewportWidth = 8000 * zoomLevel.value;
            const viewportHeight = 8000 * zoomLevel.value;
    
            console.log('Starting export with:', {
                container: contentContainer,
                viewport: {
                    width: viewportWidth,
                    height: viewportHeight
                },
                zoomLevel: zoomLevel.value,

                width: viewportWidth,
                height: viewportHeight,
                windowWidth: viewportWidth,
                windowHeight: viewportHeight,

            });
    
            const defaultOptions = {
                backgroundColor: '#1a1a1a',
                scale: 1, // Set scale to 1 since we're handling zoom separately
                useCORS: true,
                allowTaint: true,
                logging: true,
                foreignObjectRendering: true,
                width: viewportWidth,
                height: viewportHeight,
                windowWidth: viewportWidth,
                windowHeight: viewportHeight,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const clonedContent = clonedDoc.querySelector('.canvas-container');
                    if (clonedContent) {
                        // Force size on cloned element
                        clonedContent.style.width = `${viewportWidth}px`;
                        clonedContent.style.height = `${viewportHeight}px`;
                        clonedContent.style.position = 'relative';
                        clonedContent.style.transform = 'none';
                        
                        // Force size on pan background
                        const panBackground = clonedContent.querySelector('.pan-background');
                        if (panBackground) {
                            panBackground.style.width = `${viewportWidth}px`;
                            panBackground.style.height = `${viewportHeight}px`;
                            panBackground.style.transform = 'none';
                        }
                    }
                    console.log('Cloned document prepared');
                }
            };
    
            return html2canvas(contentContainer, defaultOptions).then(canvas => {
                // Create the data URL
                const dataURL = canvas.toDataURL('image/png');
    
                // Create download link
                const link = document.createElement('a');
                link.download = `canvas-${activeCanvasId.value || 'export'}.png`;
                link.href = dataURL;
                link.click();
    
                return dataURL;
            });
    
        } catch (error) {
            console.error('Error exporting to PNG:', error);
            return null;
        }
    };

    // SVG Export
    const exportToSVG = () => {
        const svgElements = canvasRef.value?.querySelectorAll('svg');
        if (!svgElements || svgElements.length === 0) {
            console.warn('No SVG elements found to export.');
            return null;
        }

        try {
            // Clone the SVG to modify it without affecting the display
            const svgElement = svgElements[0].cloneNode(true);
            
            // Add necessary attributes for standalone SVG
            svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgElement.setAttribute('version', '1.1');
            
            const svgContent = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgContent], {
                type: 'image/svg+xml;charset=utf-8'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `canvas-${activeCanvasId.value || 'export'}.svg`;
            link.click();
            URL.revokeObjectURL(url);
            return svgContent;
        } catch (error) {
            console.error('Error exporting to SVG:', error);
            return null;
        }
    };

    // JSON Export
    const exportToJSON = () => {
        try {
            const data = exportCanvas();
            console.log("Export to JSON", data)
            if (!data) return null;

            // Add export metadata
            const exportData = {
                ...data,
                exportVersion: '2.0',
                exportDate: new Date().toISOString(),
                metadata: {
                    cardCount: data.cards.length,
                    connectionCount: data.connections.length,
                    socketCount: data.cards.reduce((count, card) => 
                        count + (card?.sockets?.inputs?.length ? card?.sockets?.inputs?.length: 0) + (card?.sockets?.outputs?.length ? card?.sockets?.outputs?.length : 0), 0
                    )
                }
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${data.name || 'canvas'}.json`;
            link.click();
            URL.revokeObjectURL(url);
            return exportData;
        } catch (error) {
            console.error('Error exporting to JSON:', error);
            return null;
        }
    };
// In exportImport.js, update the importFromJSON function
/**
 * Imports a canvas from a template object
 * @param {Object} template - Template object to import
 * @returns {Promise} Resolution with import results
 */
const importFromTemplate = (template) => {
    return new Promise((resolve, reject) => {
      if (!template || typeof template !== 'object') {
        reject(new Error('Template must be a valid object'));
        return;
      }
  
      try {
        // Validate basic structure
        if (!Array.isArray(template.cards)) {
          reject(new Error('Invalid canvas structure in template'));
          return;
        }
  
        // Migrate the template data to new format
        const migratedData = migrateCanvasData(template);
  
        // Log migration results for debugging
        console.log('Template migration complete:', {
          originalCards: template.cards.length,
          migratedCards: migratedData.cards.length,
          originalConnections: template.connections?.length || 0,
          migratedConnections: migratedData.connections?.length || 0
        });
  
        // Import the canvas
        const canvasId = importCanvas(migratedData);
        if (!canvasId) {
          reject(new Error('Failed to import template'));
          return;
        }
  
        // Set as active canvas
        activeCanvasId.value = canvasId;
  
        resolve({
          totalImported: 1,
          canvasIds: [canvasId],
          activeCanvasId: canvasId
        });
      } catch (error) {
        console.error('Error importing template:', error);
        reject(error);
      }
    });
  };

const importFromJSON = () => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.multiple = true;
  
      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) {
          reject(new Error('No files selected'));
          return;
        }
  
        try {
          const importedCanvasIds = [];
  
          for (const file of files) {
            console.log("importFromJSON file", file)
            const text = await file.text();
            const rawData = JSON.parse(text);
  
            // Validate basic structure before migration
            if (!rawData || !Array.isArray(rawData.cards)) {
              console.error(`Invalid canvas structure in file: ${file.name}`);
              continue;
            }
  
            // Migrate the canvas data to new format
            console.log("import rawData", rawData)
            const migratedData = migrateCanvasData(rawData);
            console.log("import migratedData", migratedData)
  
            // Log migration results for debugging
            console.log('Migration complete:', {
              originalCards: rawData.cards.length,
              migratedCards: migratedData.cards.length,
              originalConnections: rawData.connections?.length || 0,
              migratedConnections: migratedData.connections?.length || 0
            });
  
            const canvasId = importCanvas(migratedData);
            importedCanvasIds.push(canvasId);
          }
  
          if (importedCanvasIds.length === 0) {
            reject(new Error('No valid canvas files were imported'));
            return;
          }
  
          // Select the last imported canvas
          const lastCanvasId = importedCanvasIds[importedCanvasIds.length - 1];
          if (lastCanvasId) {
            activeCanvasId.value = lastCanvasId;
          }
  
          resolve({
            totalImported: importedCanvasIds.length,
            canvasIds: importedCanvasIds,
            activeCanvasId: lastCanvasId
          });
        } catch (error) {
          console.error('Error importing JSON:', error);
          reject(error);
        }
      };
  
      input.click();
    });
  };


    // API Import/Export with enhanced error handling
    const exportToAPI = async (endpoint, options = {}) => {
        try {
            const data = exportCanvas();
            if (!data) throw new Error('No canvas data to export');

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data),
                ...options
            });

            if (!response.ok) {
                throw new Error(`API export failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error exporting to API:', error);
            throw error;
        }
    };

    const importFromAPI = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                throw new Error(`API import failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (!validateImportData(data)) {
                throw new Error('Invalid canvas data structure from API');
            }

            return importCanvas(data);
        } catch (error) {
            console.error('Error importing from API:', error);
            throw error;
        }
    };

    // Template Export/Import with socket handling
    const saveAsTemplate = (name, description = '') => {
        try {
            const data = exportCanvas();
            if (!data) throw new Error('No canvas data to save as template');

            const template = {
                ...data,
                id: uuidv4(),
                name,
                description,
                isTemplate: true,
                created: Date.now(),
                socketSchema: data.cards.map(card => ({
                    cardId: card.uuid,
                    inputs: card.sockets.inputs.map(s => ({
                        id: s.id,
                        name: s.name,
                        type: s.type
                    })),
                    outputs: card.sockets.outputs.map(s => ({
                        id: s.id,
                        name: s.name,
                        type: s.type
                    }))
                }))
            };

            const templates = JSON.parse(localStorage.getItem('canvasTemplates') || '[]');
            templates.push(template);
            localStorage.setItem('canvasTemplates', JSON.stringify(templates));

            return template.id;
        } catch (error) {
            console.error('Error saving template:', error);
            throw error;
        }
    };

    const loadTemplate = (templateId) => {
        try {
            const templates = JSON.parse(localStorage.getItem('canvasTemplates') || '[]');
            const template = templates.find(t => t.id === templateId);
            
            if (!template) {
                throw new Error('Template not found');
            }

            return importCanvas({
                ...template,
                id: uuidv4(),
                isTemplate: false,
                created: Date.now()
            });
        } catch (error) {
            console.error('Error loading template:', error);
            throw error;
        }
    };

    // Enhanced clipboard operations with socket handling
    const copyToClipboard = (selectedCardIds) => {
        try {
            const selectedCards = cards.value.filter(card => selectedCardIds.has(card.uuid));
            const selectedConnections = connections.value.filter(conn => 
                selectedCardIds.has(conn.sourceCardId) && selectedCardIds.has(conn.targetCardId)
            );

            const clipboardData = {
                cards: selectedCards,
                connections: selectedConnections,
                timestamp: Date.now(),
                version: '2.0'
            };

            localStorage.setItem('canvasClipboard', JSON.stringify(clipboardData));
            return true;
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            return false;
        }
    };

    const pasteFromClipboard = (position) => {
        try {
            const clipboardData = JSON.parse(localStorage.getItem('canvasClipboard'));
            if (!clipboardData || !validateImportData(clipboardData)) {
                throw new Error('Invalid clipboard data');
            }

            // Create ID mapping for new cards and sockets
            const idMap = new Map();
            
            // Clone and position cards with their sockets
            const newCards = clipboardData.cards.map(card => {
                const newId = uuidv4();
                idMap.set(card.uuid, newId);
                
                // Create new socket IDs while preserving structure
                const newSockets = {
                    inputs: card.sockets.inputs.map(socket => ({
                        ...socket,
                        id: uuidv4()
                    })),
                    outputs: card.sockets.outputs.map(socket => ({
                        ...socket,
                        id: uuidv4()
                    }))
                };
                
                return {
                    ...card,
                    uuid: newId,
                    sockets: newSockets,
                    x: card.x + (position?.x || 50),
                    y: card.y + (position?.y || 50)
                };
            });

            // Clone connections with new IDs
            const newConnections = clipboardData.connections.map(conn => ({
                ...conn,
                id: uuidv4(),
                sourceCardId: idMap.get(conn.sourceCardId),
                targetCardId: idMap.get(conn.targetCardId)
            }));

            // Add new elements to canvas
            cards.value.push(...newCards);
            connections.value.push(...newConnections);

            return newCards.map(card => card.uuid);
        } catch (error) {
            console.error('Error pasting from clipboard:', error);
            return [];
        }
    };

    return {
        // File exports
        exportToPNG,
        exportToSVG,
        exportToJSON,
        importFromJSON,
        importFromTemplate,

        // API operations
        exportToAPI,
        importFromAPI,

        // Template operations
        saveAsTemplate,
        loadTemplate,

        // Clipboard operations
        copyToClipboard,
        pasteFromClipboard,

        // Utilities
        validateImportData
    };
};