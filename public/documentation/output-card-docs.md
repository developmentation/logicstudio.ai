# OutputCard Component Documentation

## Overview
The OutputCard component is a Vue.js component that manages output configurations in a node-based interface. It allows users to define multiple output formats for input data and manages socket-based connections for data flow.

## Key Features
- Multiple output format configuration
- Dynamic input/output socket management
- Drag-and-drop connection support
- Automatic socket indexing and cleanup
- Download capabilities

## Component Architecture

### Props
```javascript
props: {
    cardData: { type: Object, required: true },     // Card state and configuration
    zoomLevel: { type: Number, default: 1 },        // Canvas zoom level
    zIndex: { type: Number, default: 1 },           // Card stacking order
    isSelected: { type: Boolean, default: false }    // Card selection state
}
```

### Emitted Events
```javascript
// Parent must handle these events
'update-position'       // When card position changes
'update-card'          // When card data changes
'update-socket-value'  // When a socket value changes
'connection-drag-start' // Start of connection drag
'connection-drag'      // During connection drag
'connection-drag-end'  // End of connection drag
'close-card'          // Card closure request
'manual-trigger'      // Manual execution trigger
'sockets-updated'     // Socket configuration changes
'select-card'         // Card selection changes
```

### State Management

#### Local Card Data Structure
```javascript
{
    uuid: String,                // Unique card identifier
    name: String,                // Card display name
    description: String,         // Card description
    x: Number,                   // X position
    y: Number,                   // Y position
    outputs: [{                  // Output configurations
        type: String,            // Output format (markdown, docx, etc.)
        id: String              // Unique output identifier
    }],
    autoDownload: Boolean,       // Auto-download setting
    sockets: {
        inputs: [{              // Input socket configurations
            id: String,         // Socket identifier
            type: String,       // Socket type
            name: String,       // Display name
            source: String,     // Source type
            sourceIndex: Number, // Index in source
            value: any,         // Current value
            momentUpdated: Number // Last update timestamp
        }],
        outputs: [/* Similar structure */]
    }
}
```

### Socket Management

#### Socket Registry
The component maintains a socket registry to track mounted sockets and their cleanup functions:
```javascript
socketRegistry: Map<String, {
    element: HTMLElement,    // DOM reference
    cleanup: Function[]      // Cleanup handlers
}>
```

#### Socket Lifecycle
1. **Creation**: Through `createSocket(type, index, existingId)`
2. **Mounting**: Handled by `handleSocketMount(event)`
3. **Updates**: Through prop updates and user interactions
4. **Cleanup**: Automatic on component unmount

### Critical Functions

#### Initialize Card Data
```javascript
const initializeCardData = (data) => {
    // Creates initial card structure
    // Preserves existing socket IDs
    // Sets up default values
}
```

#### Socket Reindexing
```javascript
const reindexSockets = (sockets, type) => {
    // Maintains socket order
    // Updates socket names
    // Preserves socket IDs
}
```

#### Update Sockets
```javascript
const updateSockets = (oldSockets, newSockets, deletedSocketIds) => {
    // Creates reindex mapping
    // Notifies parent of changes
    // Manages socket deletions
}
```

## Integration Requirements

### Parent Component
- Must handle all emitted events
- Must provide valid cardData structure
- Must manage connections separately
- Must handle socket value updates

### BaseCard Component
- Must provide proper layout structure
- Must handle position updates
- Must emit selection events

### BaseSocket Component
- Must handle connection drag events
- Must provide proper socket mounting events
- Must handle value updates

## Performance Considerations

### Watch Handlers
The component uses a deep watch on cardData. Consider impact with large data structures:
```javascript
Vue.watch(() => props.cardData, (newData) => {
    // Updates local state
    // Manages socket synchronization
}, { deep: true })
```

### Memory Management
- Socket registry cleanup on unmount
- Event listener cleanup
- Connection tracking cleanup

## Error Handling
The component implements defensive programming:
- Null checks on socket operations
- Safe socket registry operations
- Protected socket value access

## Common Pitfalls

### Socket ID Preservation
When modifying sockets, always preserve existing IDs to maintain connections:
```javascript
// Good
const existingSocket = localCardData.value.sockets.inputs[index];
const newSocket = createSocket('input', index, existingSocket?.id);

// Bad
const newSocket = createSocket('input', index); // Breaks existing connections
```

### Event Bubbling
Certain events need `.stop` modifier to prevent unwanted propagation:
```html
<select
    @mousedown.stop
    @change="updateOutputType(index, $event)"
>
```

### Socket Updates
Avoid unnecessary socket value updates during mount:
```javascript
// Only register the socket
const handleSocketMount = (event) => {
    if (!event) return;
    socketRegistry.set(event.socketId, {
        element: event.element,
        cleanup: []
    });
}
```

## Testing Considerations

### Key Test Cases
1. Socket initialization with existing data
2. Socket reindexing during add/remove
3. Cleanup on component unmount
4. Event emission ordering
5. Connection preservation during updates

### Mock Requirements
```javascript
// Example test setup
const mockCardData = {
    uuid: 'test-card',
    outputs: [{type: 'markdown'}],
    sockets: {
        inputs: [],
        outputs: []
    }
}
```

## Future Improvements

### Potential Enhancements
1. Performance optimization for rapid updates
2. Enhanced error recovery mechanisms
3. Detailed logging for debugging
4. Socket operation queuing

### Code Health
1. Unit test coverage
2. Performance monitoring
3. Type safety improvements
