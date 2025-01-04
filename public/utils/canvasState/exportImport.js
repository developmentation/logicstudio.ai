// utils/canvasState/exportImport.js

export const createExportImport = (props) => {
    const {
        // Core canvas operations
        canvases,
        setActiveCanvas,
        exportCanvas,
        importCanvas,
        
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
            if (!card.uuid || !card.type || !card.sockets) return false;
            if (!card.sockets.inputs || !card.sockets.outputs) return false;
        }

        return true;
    };

    // PNG Export
    const exportToPNG = async (options = {}) => {
        if (!canvasRef.value) return null;

        try {
            const defaultOptions = {
                backgroundColor: '#1a1a1a',
                scale: window.devicePixelRatio,
                logging: false,
                removeContainer: true,
                foreignObjectRendering: true
            };

            const canvas = await html2canvas(canvasRef.value, {
                ...defaultOptions,
                ...options
            });

            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `canvas-${activeCanvasId.value || 'export'}.png`;
            link.href = dataURL;
            link.click();
            return dataURL;
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
                        count + card.sockets.inputs.length + card.sockets.outputs.length, 0
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

const importFromJSON = () => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.multiple = true;  // Enable multiple file selection
        
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) {
                reject(new Error('No files selected'));
                return;
            }

            try {
                const importedCanvasIds = [];
                
                // Process each file sequentially
                for (const file of files) {
                    const text = await file.text();
                    const data = JSON.parse(text);

                    if (!validateImportData(data)) {
                        console.error(`Invalid canvas data structure in file: ${file.name}`);
                        continue; // Skip invalid files but continue processing others
                    }

                    const canvasId = importCanvas(data);
                    importedCanvasIds.push(canvasId);
                }

                if (importedCanvasIds.length === 0) {
                    reject(new Error('No valid canvas files were imported'));
                    return;
                }

                // Select the last imported canvas
                const lastCanvasId = importedCanvasIds[importedCanvasIds.length - 1];
                const lastCanvas = canvases.value.find(c => c.id === lastCanvasId);
                if (lastCanvas) {
                    setActiveCanvas(lastCanvas);
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