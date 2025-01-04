# TemplateCard Component Documentation

## Overview
The TemplateCard component serves as a foundational template for creating card components within a node-based graph system. It provides base functionality for managing dynamic inputs and outputs through a socket-based connection system.

## Key Features
- Dynamic input/output socket management
- Connection preservation across updates
- Real-time socket name editing
- Automatic cleanup of disconnected sockets
- Extendable content area for specific card implementations

## Usage
```javascript
<TemplateCard
  :cardData="cardData"
  :zoomLevel="1"
  :zIndex="1"
  :isSelected="false"
  @update-position="handlePositionUpdate"
  @update-card="handleCardUpdate"
  @sockets-updated="handleSocketsUpdated"
  // ... other event handlers
>
  <template #content>
    <!-- Card-specific content goes here -->
  </template>
</TemplateCard>
```

## Props
- `cardData` (Object, required): Complete card state including:
  ```javascript
  {
    uuid: String,           // Unique card identifier
    name: String,           // Card display name
    description: String,    // Card description
    x: Number,             // X position
    y: Number,             // Y position
    sockets: {
      inputs: [],          // Input socket array
      outputs: []          // Output socket array
    }
  }
  ```
- `zoomLevel` (Number, default: 1): Canvas zoom level
- `zIndex` (Number, default: 1): Card stacking order
- `isSelected` (Boolean, default: false): Card selection state

## Events
- `update-position`: Card position changes
- `update-card`: Card data changes
- `update-socket-value`: Socket value updates
- `connection-drag-start`: Connection drag initiated
- `connection-drag`: Connection being dragged
- `connection-drag-end`: Connection drag completed
- `close-card`: Card closure requested
- `manual-trigger`: Manual execution triggered
- `sockets-updated`: Socket configuration changed
- `select-card`: Card selection changed

## ⚠️ CRITICAL: Socket Management
The socket management system is crucial for maintaining graph integrity. The following aspects must be preserved in any modifications:

### Socket Indexing and Remapping
```javascript
const reindexMap = {};
let newIndex = 0;
oldSockets.forEach((socket, oldIndex) => {
  if (deletedSocketIds.includes(socket.id)) {
    reindexMap[oldIndex] = -1;
  } else {
    reindexMap[oldIndex] = newIndex++;
  }
});
```

This mapping is CRITICAL for:
1. Maintaining connection integrity during socket deletion
2. Preserving connection order during reindexing
3. Preventing connection corruption in the graph system

### Socket Creation
- IDs must be unique and preserved
- Names should maintain type prefix unless customized
- All socket properties must be initialized

### Socket Cleanup
- Must handle socket registry cleanup
- Must clear connections
- Must handle cleanup arrays

## Internal State Management

### Processing Guard
```javascript
const isProcessing = Vue.ref(false);
```
Prevents recursive updates during socket operations. Must be properly set and cleared in try/finally blocks.

### Socket Registry
```javascript
const socketRegistry = new Map();
```
Tracks mounted sockets and their cleanup functions. Critical for memory management.

### Connections Set
```javascript
const connections = Vue.ref(new Set());
```
Tracks active connections for socket state management.

## Extension Points

### Content Slot
```html
<slot name="content"></slot>
```
Used by implementing cards to add specific functionality while inheriting base socket management.

### Watch Handlers
Card data changes are watched with specific optimizations:
- Position updates only when changed
- Socket updates only when structure changes
- Deep watching with processing guards

## Common Pitfalls

### Socket Reindexing
- Never simplify the reindexMap creation
- Maintain the newIndex counter pattern
- Always track deleted socket IDs
- Preserve existing socket IDs during updates

### Update Cycles
- Use isProcessing guard for all updates
- Wrap operations in try/finally blocks
- Handle cleanup properly
- Use Vue.nextTick appropriately

### Event Handling
- Maintain .stop modifiers on mouse events
- Handle event bubbling correctly
- Ensure proper event order

## Testing Considerations

### Critical Test Scenarios
1. Socket Addition
   - Verify new socket creation
   - Check index assignments
   - Validate connection possibilities

2. Socket Deletion
   - Verify connection preservation
   - Check reindexing accuracy
   - Validate cleanup

3. Socket Updates
   - Test name updates
   - Verify value propagation
   - Check connection stability

4. Multiple Operations
   - Test rapid additions/deletions
   - Verify order preservation
   - Check connection integrity

## Performance Considerations
- Avoid deep cloning of socket arrays
- Use Vue.nextTick strategically
- Maintain processing guards
- Optimize socket updates

## Maintenance Guidelines
1. Never modify reindexing logic without thorough testing
2. Maintain all event modifiers
3. Keep socket cleanup comprehensive
4. Test with complex graph scenarios
5. Document any structural changes

## State Flow Diagram
```
User Action → Processing Guard → State Update → Reindex Map → 
Socket Updates → Parent Notification → Cleanup → Guard Release
```

## Version History
- No direct modifications to reindexing since implementation
- Socket cleanup enhanced
- Processing guard added
- Event handling optimized

Remember: This component is foundational to the graph system. Changes must be made with extreme caution and thorough testing.