# ⚠️ CRITICAL: Socket Reindexing and Connection Mapping

## Cardinal Rule
The reindexMap creation and socket index management is CRITICAL for maintaining connection integrity across the entire graph system. This must never be simplified or modified without thorough understanding of the connection system.

## Why This Matters
When sockets are deleted or reordered, the entire graph's connections depend on accurate index mapping to maintain their relationships. Any change to this logic can cause system-wide connection corruption.

## The Correct Pattern
```javascript
const reindexMap = {};
let newIndex = 0;

oldSockets.forEach((socket, oldIndex) => {
  if (deletedSocketIds.includes(socket.id)) {
    reindexMap[oldIndex] = -1;  // Marked as deleted
  } else {
    reindexMap[oldIndex] = newIndex++; // Progressive new indices only for remaining sockets
  }
});
```

## Common Mistakes That Break The System
1. Using the old index as the new index
2. Not tracking deleted sockets properly
3. Not maintaining a separate newIndex counter
4. Simplifying the remapping logic
5. Removing the reindexMap entirely

## Testing For Correctness
- After socket deletion, all connections should maintain correct relationships
- Deleting a socket in the middle of a chain should not break downstream connections
- Multiple deletions should result in correct reindexing
- Connections should never become "orphaned" or misaligned

## Before Making Changes
- Understand the full graph connection system
- Test with complex connection scenarios
- Verify connection integrity after operations
- Document any changes to the reindexing logic