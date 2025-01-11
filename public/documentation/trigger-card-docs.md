# TriggerCard Documentation

## Overview
The TriggerCard is a specialized component designed to trigger and orchestrate sequences of actions in Agent and Web cards. It operates in two distinct modes: direct triggering and sequence execution.

## Trigger Mechanisms

### Overview
The TriggerCard can be activated through multiple mechanisms:
1. Button click
2. Input socket value change
3. Sequence progression
Each trigger mechanism sets a timestamp that propagates through the system.

### Button Trigger
```javascript
const handleTriggerClick = () => {
  if (isRunning.value) {
    completeSequence();
    return;
  }

  isRunning.value = true;
  if (hasSequence.value) {
    processSequence();  // Start sequence execution
  } else {
    handleDirectTrigger();  // Trigger connected cards directly
  }
};
```
- Toggles between start and stop states
- Initiates either sequence or direct trigger flow
- Sets isRunning state for visual feedback

### Input Socket Trigger
```javascript
Vue.watch(inputSocketValue, (newValue, oldValue) => {
  if (newValue !== oldValue && newValue !== null) {
    if (hasSequence.value) {
      isRunning.value = true;
      processSequence();  // Start sequence execution
    } else {
      isRunning.value = true;
      handleDirectTrigger();  // Trigger connected cards
    }
  }
});
```
- Watches for changes in input socket value
- Prevents triggering on null values
- Maintains same logic flow as button trigger

### Direct Card Triggering
```javascript
const handleDirectTrigger = () => {
  const connections = activeConnections.value.filter(
    (conn) => conn.sourceCardId === localCardData.value.uuid
  );

  connections.forEach((conn) => {
    const targetCard = activeCards.value.find(
      (card) => card.uuid === conn.targetCardId
    );
    if (targetCard && (targetCard.type === "agent" || targetCard.type === "web")) {
      triggerCard(targetCard.uuid);
    }
  });
};
```
- Used when no sequence is defined
- Finds all connected cards
- Triggers all target cards simultaneously
- Updates output socket value for connected cards

### Sequence-Based Triggering
```javascript
const triggerCard = (cardId) => {
  const card = activeCards.value.find((c) => c.uuid === cardId);
  if (card) {
    emit("update-card", {
      ...Vue.toRaw(card),
      trigger: Date.now(),  // Set trigger timestamp
    });
  }
};
```
- Triggers individual cards in sequence
- Sets trigger timestamp on target card
- Used by both direct and sequence modes

### Socket Value Propagation
- **Input Socket**: 
  - Receives trigger timestamps from other cards
  - Triggers sequence or direct execution
  - Value format: Unix timestamp (milliseconds)

- **Output Socket**:
  - Only present in direct trigger mode
  - Value updated with current timestamp on trigger
  - Used to chain multiple trigger cards together
  - Reset to null when sequence completes

### Trigger Flow
1. **Trigger Initiation**:
   ```javascript
   // Via button or input
   isRunning.value = true;
   ```

2. **Mode Detection**:
   ```javascript
   if (hasSequence.value) {
     processSequence();
   } else {
     handleDirectTrigger();
   }
   ```

3. **Card Execution**:
   ```javascript
   // Set trigger timestamp
   emit("update-card", {
     ...card,
     trigger: Date.now()
   });
   ```

4. **Completion**:
   ```javascript
   // Reset states and clean up
   completeSequence();
   ```

## Core Functionality

### Input/Output Configuration
- **Input Socket**: Always present, accepts trigger signals from other cards
- **Output Socket**: Only present when no sequence is defined
- Socket values are used to propagate trigger timestamps

### Operating Modes

#### 1. Direct Trigger Mode
- Activated when no sequence is defined
- Triggers all connected cards simultaneously via output socket
- Connected cards execute in parallel
- Trigger value is set to current timestamp

#### 2. Sequence Mode
- Activated when sequence items are added
- Output socket is removed
- Cards execute in defined order
- Each card must complete before next card starts
- Supports error handling and retries

### Sequence Execution Logic

#### State Management
- `isRunning`: Tracks overall sequence execution state
- `currentSequenceIndex`: Tracks current card in sequence
- `isTransitioning`: Prevents race conditions during card transitions
- `retryTimeout`: Manages retry timing for failed cards

#### Card Status Tracking
- **idle**: Default state, ready for execution
- **inProgress**: Currently executing
- **complete**: Successfully finished
- **error**: Failed execution

#### Error Handling
- Maximum 3 retries per card
- 5-second delay between retry attempts
- Error counts tracked per sequence item
- Visual feedback for error states
- Advances to next card after 3 failed attempts

### Visual Feedback
- Button toggles between green (ready) and orange (running)
- Sequence items show processing status:
  - Dark gray: Idle/default state
  - Pulsing yellow: Currently processing
  - Green: Successfully completed
  - Red border: Error state with retry count

## Implementation Details

### Key Components

1. **State Variables**
```javascript
const isRunning = Vue.ref(false);
const currentSequenceIndex = Vue.ref(-1);
const isTransitioning = Vue.ref(false);
const retryTimeout = Vue.ref(null);
```

2. **Sequence Item Structure**
```javascript
{
  id: string,
  cardId: string,
  errorCount: number
}
```

### Critical Functions

#### `processSequence()`
- Initializes sequence execution
- Resets error counts and card states
- Triggers first card in sequence
- Manages transition states

#### `retryCard(cardId, sequenceIndex)`
- Handles card failure scenarios
- Manages retry attempts
- Tracks error counts
- Implements retry delay

#### `completeSequence()`
- Cleans up sequence execution
- Resets all states
- Clears timeouts
- Resets error counts

### State Watchers

1. **Card Status Watcher**
- Monitors status changes of active cards
- Manages sequence progression
- Handles error states
- Controls card transitions

2. **Input Socket Watcher**
- Detects incoming trigger signals
- Initiates sequence or direct trigger
- Prevents duplicate triggers

### Error Handling Strategy

1. **Per-Card Error Management**
```javascript
if (sequenceItem.errorCount < 3) {
  sequenceItem.errorCount++;
  // Retry after 5 seconds
} else {
  // Move to next card
}
```

2. **Sequence Error Recovery**
- Preserves error counts across updates
- Cleans up error states on completion
- Provides visual feedback
- Maintains sequence integrity

## Event Handling

### Input Events
- Card selection changes
- Trigger button clicks
- Socket value changes
- Sequence modifications

### Output Events
- Card updates
- Position updates
- Socket connections
- Status changes

## Best Practices

1. **State Management**
- Always use `isTransitioning` for state changes
- Clean up timeouts on unmount
- Reset states when stopping sequence
- Preserve error counts during updates

2. **Error Handling**
- Implement gradual retry backoff
- Provide clear visual feedback
- Maintain error state history
- Clean up on sequence completion

3. **Performance**
- Use computed properties for derived state
- Implement proper cleanup
- Manage transition timing
- Prevent race conditions

## Common Issues and Solutions

1. **Race Conditions**
- Use `isTransitioning` flag
- Implement transition delays
- Clean state management
- Proper timeout handling

2. **State Preservation**
- Track error counts per item
- Preserve states during updates
- Clean reset procedures
- Proper initialization

3. **Visual Feedback**
- Clear status indicators
- Consistent error states
- Processing animations
- State transitions

## Usage Example

```javascript
// Add a sequence of cards
triggerCard.sequence = [
  { id: 'card1', errorCount: 0 },
  { id: 'card2', errorCount: 0 }
];

// Start sequence
triggerCard.handleTriggerClick();

// Handle completion
watch(() => triggerCard.isRunning, (running) => {
  if (!running) {
    // Sequence complete
  }
});
```