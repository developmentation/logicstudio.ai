// utils/cardManagement/cardSelection.js

export const createCardSelection = (props) => {
  const {
    // State refs
    cards,
    selectedCardIds,
    dragStartPositions,
    lastSelectionTime,
    canvasRef,

    // Constants
    Z_INDEX_LAYERS 
  } = props;

  // Enhanced selection state
  const selectionBox = Vue.ref(null);
  const hoveredCardId = Vue.ref(null);
  const selectionHistory = Vue.ref([]);
  const maxHistoryLength = 20;
  const selectionGroups = Vue.ref(new Map()); // For managing grouped selections
  const lastInteractionType = Vue.ref(null); // 'mouse', 'touch', or 'keyboard'

  const currentZIndex = Vue.ref(Z_INDEX_LAYERS.DEFAULT);

  // Selection modes
  const SELECTION_MODES = {
    SINGLE: "single",
    ADDITIVE: "additive",
    SUBTRACTIVE: "subtractive",
    TOGGLE: "toggle",
  };



  const beginDragOperation = (cardId) => {
    selectedCardIds.value.forEach((id) => {
      const card = cards.value.find((c) => c.uuid === id);
      if (card) {
        dragStartPositions.value.set(id, { x: card.x, y: card.y });
      }
    });
  };

  const clearDragOperation = (preserveSelection = true) => {
    if (!preserveSelection) {
      selectedCardIds.value.clear();
    }
    dragStartPositions.value.clear();
  };
// In cardSelection.js
const handleCardSelection = ({ uuid, shiftKey }) => {
    const now = Date.now();
    if (lastSelectionTime.value && now - lastSelectionTime.value < 100) {
      return;
    }
    lastSelectionTime.value = now;
  
    // Clear drag start positions when selection changes
    dragStartPositions.value.clear();
  
    // Prevent text selection
    window.getSelection().removeAllRanges();
  
    if (shiftKey) {
      // Toggle selection with shift key
      const newSelection = new Set(selectedCardIds.value);
      if (newSelection.has(uuid)) {
        newSelection.delete(uuid);
      } else {
        newSelection.add(uuid);
      }
      selectedCardIds.value = newSelection;
    } else {
      // Single selection
      if (selectedCardIds.value.size > 1 && selectedCardIds.value.has(uuid)) {
        return;
      }
      selectedCardIds.value = new Set([uuid]);
    }
  
    // Reorder z-indices based on new selection
    reorderCards(selectedCardIds.value);
  };
  

  const updateSelection = (cardId, mode = SELECTION_MODES.SINGLE) => {
    const newSelection = new Set(selectedCardIds.value);

    switch (mode) {
      case SELECTION_MODES.ADDITIVE:
        newSelection.add(cardId);
        break;
      case SELECTION_MODES.SUBTRACTIVE:
        newSelection.delete(cardId);
        break;
      case SELECTION_MODES.TOGGLE:
        if (newSelection.has(cardId)) {
          newSelection.delete(cardId);
        } else {
          newSelection.add(cardId);
        }
        break;
      default: // SINGLE
        if (newSelection.size > 1 && newSelection.has(cardId)) {
          return; // Prevent deselection of group-selected cards
        }
        newSelection.clear();
        newSelection.add(cardId);
    }

    setCardSelection(newSelection);
  };

  // Enhanced selection management
// Update setCardSelection to handle preservation
const setCardSelection = (newSelection, recordHistory = true, preserveSelection = false) => {
    if (recordHistory) {
      recordSelectionHistory();
    }
  
    if (preserveSelection) {
      // Merge with existing selection
      selectedCardIds.value = new Set([...selectedCardIds.value, ...newSelection]);
    } else {
      selectedCardIds.value = new Set(newSelection);
    }
  
    reorderCards(selectedCardIds.value);
    updateSelectionGroups();
  };
  const reorderCards = (selectedIds) => {
    if (selectedIds.size === 0) {
      // If no cards are selected, reset all to default
      cards.value.forEach(card => {
        card.zIndex = Z_INDEX_LAYERS.DEFAULT;
      });
      return;
    }
  
    // Calculate new z-index for selected cards
    const newSelectedZIndex = Math.max(
      ...cards.value.map((card) => card.zIndex || 0),
      Z_INDEX_LAYERS.SELECTED
    );
  
    // Update cards
    cards.value.forEach((card) => {
      if (selectedIds.has(card.uuid)) {
        // Keep selected cards at the top level
        card.zIndex = newSelectedZIndex;
      } else if (card.zIndex >= Z_INDEX_LAYERS.SELECTED) {
        // Only lower cards that were previously selected
        card.zIndex = Z_INDEX_LAYERS.DEFAULT;
      }
      // Leave other cards at their current z-index
    });
  
    // Force reactivity update
    cards.value = [...cards.value];
  };

  // Enhanced selection history
  const recordSelectionHistory = () => {
    selectionHistory.value.push({
      selection: new Set(selectedCardIds.value),
      groups: new Map(selectionGroups.value),
      timestamp: Date.now(),
    });

    while (selectionHistory.value.length > maxHistoryLength) {
      selectionHistory.value.shift();
    }
  };

  // Enhanced hover management with touch support
  const handleCardHover = (cardId, source = "mouse") => {
    if (source === lastInteractionType.value) {
      hoveredCardId.value = cardId;
      reorderCards(selectedCardIds.value);
    }
  };

  const clearHover = (source = "mouse") => {
    if (source === lastInteractionType.value) {
      hoveredCardId.value = null;
      reorderCards(selectedCardIds.value);
    }
  };

  // Enhanced area selection with touch support
  const startAreaSelection = (event) => {
    const point = event.touches ? event.touches[0] : event;
    selectionBox.value = {
      startX: point.clientX,
      startY: point.clientY,
      currentX: point.clientX,
      currentY: point.clientY,
      scrollOffsetX: canvasRef.value?.scrollLeft || 0,
      scrollOffsetY: canvasRef.value?.scrollTop || 0,
    };
  };

  const updateAreaSelection = (event) => {
    if (!selectionBox.value) return;

    const point = event.touches ? event.touches[0] : event;
    const currentScrollOffsetX = canvasRef.value?.scrollLeft || 0;
    const currentScrollOffsetY = canvasRef.value?.scrollTop || 0;

    // Adjust for scroll changes
    selectionBox.value.currentX =
      point.clientX + (currentScrollOffsetX - selectionBox.value.scrollOffsetX);
    selectionBox.value.currentY =
      point.clientY + (currentScrollOffsetY - selectionBox.value.scrollOffsetY);

    const box = getNormalizedSelectionBox();
    const selectedCards = findCardsInBox(box);

    // Update selection based on modifier keys
    const newSelection = new Set(
      event.shiftKey
        ? [...selectedCardIds.value, ...selectedCards.map((card) => card.uuid)]
        : selectedCards.map((card) => card.uuid)
    );

    setCardSelection(newSelection, false); // Don't record history during drag
  };

  // Enhanced helper functions
  const getNormalizedSelectionBox = () => {
    if (!selectionBox.value) return null;

    const { startX, startY, currentX, currentY } = selectionBox.value;
    return {
      left: Math.min(startX, currentX),
      right: Math.max(startX, currentX),
      top: Math.min(startY, currentY),
      bottom: Math.max(startY, currentY),
    };
  };

  // Enhanced card finding with scaling
  const findCardsInBox = (box) => {
    if (!box) return [];

    return cards.value.filter((card) => {
      const cardElement = document.querySelector(
        `[data-card-id="${card.uuid}"]`
      );
      if (!cardElement) return false;

      const rect = cardElement.getBoundingClientRect();
      const isInBox =
        rect.left < box.right &&
        rect.right > box.left &&
        rect.top < box.bottom &&
        rect.bottom > box.top;

      return isInBox;
    });
  };

  // Group selection management
  const createSelectionGroup = (groupName = "") => {
    const groupId = uuidv4();
    selectionGroups.value.set(groupId, {
      name: groupName,
      cards: new Set(selectedCardIds.value),
    });
    return groupId;
  };

  const updateSelectionGroups = () => {
    // Update existing groups
    for (const [groupId, group] of selectionGroups.value.entries()) {
      const intersection = new Set(
        [...group.cards].filter((cardId) => selectedCardIds.value.has(cardId))
      );
      if (intersection.size === 0) {
        selectionGroups.value.delete(groupId);
      } else {
        group.cards = intersection;
      }
    }
  };

  const findCardGroup = (cardId) => {
    for (const [groupId, group] of selectionGroups.value.entries()) {
      if (group.cards.has(cardId)) {
        return groupId;
      }
    }
    return null;
  };

  const getSelectionGroups = () => {
    return Array.from(selectionGroups.value.entries()).map(([id, group]) => ({
      id,
      name: group.name,
      cardIds: Array.from(group.cards),
    }));
  };

  // Selection bounds with group awareness
  const getSelectionBounds = (groupId = null) => {
    const cardsToCheck = groupId
      ? Array.from(selectionGroups.value.get(groupId)?.cards || [])
      : Array.from(selectedCardIds.value);

    if (cardsToCheck.length === 0) return null;

    return cardsToCheck.reduce(
      (bounds, cardId) => {
        const card = cards.value.find((c) => c.uuid === cardId);
        if (!card) return bounds;

        return {
          left: Math.min(bounds.left, card.x),
          right: Math.max(bounds.right, card.x + (card.width || 300)),
          top: Math.min(bounds.top, card.y),
          bottom: Math.max(bounds.bottom, card.y + (card.height || 200)),
        };
      },
      {
        left: Infinity,
        right: -Infinity,
        top: Infinity,
        bottom: -Infinity,
      }
    );
  };

  return {
    // Core selection
    handleCardSelection,
    beginDragOperation,
    clearDragOperation,
    updateSelection,
    setCardSelection,
    clearSelection: () => setCardSelection(new Set()),
    reorderCards,

    // Hover management
    handleCardHover,
    clearHover,

    // Area selection
    startAreaSelection,
    updateAreaSelection,
    endAreaSelection: () => {
      selectionBox.value = null;
      recordSelectionHistory();
    },

    // Group management
    createSelectionGroup,
    updateSelectionGroups,
    getSelectionGroups,
    findCardGroup,

    // Queries
    isCardSelected: (cardId) => selectedCardIds.value.has(cardId),
    getSelectedCards: () =>
      cards.value.filter((card) => selectedCardIds.value.has(card.uuid)),
    getSelectionBounds,
    getSelectionCenter: (groupId = null) => {
      const bounds = getSelectionBounds(groupId);
      if (!bounds) return null;
      return {
        x: (bounds.left + bounds.right) / 2,
        y: (bounds.top + bounds.bottom) / 2,
      };
    },

    // State
    hoveredCardId,
    selectionBox,
    selectionHistory,
    selectionGroups,
    lastInteractionType,

    // Constants
    SELECTION_MODES,
  };
};
