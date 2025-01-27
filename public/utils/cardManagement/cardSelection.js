// utils/cardManagement/cardSelection.js

export const createCardSelection = (props) => {
  const {
    cards,
    selectedCardIds,
    dragState,
    lastSelectionTime,
    canvasRef,
    Z_INDEX_LAYERS 
  } = props;

  const selectionBox = Vue.ref(null);
  const hoveredCardId = Vue.ref(null);
  const selectionHistory = Vue.ref([]);
  const maxHistoryLength = 20;
  const selectionGroups = Vue.ref(new Map());
  const lastInteractionType = Vue.ref(null);
  const currentZIndex = Vue.ref(Z_INDEX_LAYERS.DEFAULT);

  const SELECTION_MODES = {
    SINGLE: "single",
    ADDITIVE: "additive",
    SUBTRACTIVE: "subtractive",
    TOGGLE: "toggle",
  };

  const beginDragOperation = (cardId) => {
    const newStartPositions = new Map();
    
    selectedCardIds.value.forEach((id) => {
      const card = cards.value.find((c) => c.uuid === id);
      if (card) {
        newStartPositions.set(id, {
          x: card.ui.x,
          y: card.ui.y
        });
      }
    });

    dragState.value = {
      isDragging: true,
      dragOrigin: { x: 0, y: 0 },
      startPositions: newStartPositions
    };
  };

  const clearDragOperation = (preserveSelection = true) => {
    if (!preserveSelection) {
      selectedCardIds.value.clear();
    }
    
    dragState.value = {
      isDragging: false,
      dragOrigin: { x: 0, y: 0 },
      startPositions: new Map()
    };
  };

  const handleCardSelection = ({ uuid, shiftKey }) => {
    const now = Date.now();
    if (lastSelectionTime.value && now - lastSelectionTime.value < 100) {
      return;
    }
    lastSelectionTime.value = now;
  
    dragState.value = {
      isDragging: false,
      dragOrigin: { x: 0, y: 0 },
      startPositions: new Map()
    };
  
    window.getSelection().removeAllRanges();
  
    if (shiftKey) {
      const newSelection = new Set(selectedCardIds.value);
      if (newSelection.has(uuid)) {
        newSelection.delete(uuid);
      } else {
        newSelection.add(uuid);
      }
      selectedCardIds.value = newSelection;
    } else {
      if (selectedCardIds.value.size > 1 && selectedCardIds.value.has(uuid)) {
        return;
      }
      selectedCardIds.value = new Set([uuid]);
    }
  
    reorderCards(selectedCardIds.value);
  };

  const updateSelection = (cardId, mode = SELECTION_MODES.SINGLE) => {
    dragState.value = {
      isDragging: false,
      dragOrigin: { x: 0, y: 0 },
      startPositions: new Map()
    };

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
      default:
        if (newSelection.size > 1 && newSelection.has(cardId)) {
          return;
        }
        newSelection.clear();
        newSelection.add(cardId);
    }

    setCardSelection(newSelection);
  };

  const setCardSelection = (newSelection, recordHistory = true, preserveSelection = false) => {
    if (recordHistory) {
      recordSelectionHistory();
    }

    if (!preserveSelection) {
      dragState.value = {
        isDragging: false,
        dragOrigin: { x: 0, y: 0 },
        startPositions: new Map()
      };
    }
  
    if (preserveSelection) {
      selectedCardIds.value = new Set([...selectedCardIds.value, ...newSelection]);
    } else {
      selectedCardIds.value = new Set(newSelection);
    }
  
    reorderCards(selectedCardIds.value);
    updateSelectionGroups();
  };

  const reorderCards = (selectedIds) => {
    if (selectedIds.size === 0) {
      cards.value.forEach(card => {
        card.ui.zIndex = Z_INDEX_LAYERS.DEFAULT;
      });
      return;
    }
  
    const newSelectedZIndex = Math.max(
      ...cards.value.map((card) => card.ui.zIndex || 0),
      Z_INDEX_LAYERS.SELECTED
    );
  
    cards.value.forEach((card) => {
      if (selectedIds.has(card.uuid)) {
        card.ui.zIndex = newSelectedZIndex;
      } else if (card.ui.zIndex >= Z_INDEX_LAYERS.SELECTED) {
        card.ui.zIndex = Z_INDEX_LAYERS.DEFAULT;
      }
    });
  
    cards.value = [...cards.value];
  };

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

    selectionBox.value.currentX =
      point.clientX + (currentScrollOffsetX - selectionBox.value.scrollOffsetX);
    selectionBox.value.currentY =
      point.clientY + (currentScrollOffsetY - selectionBox.value.scrollOffsetY);

    const box = getNormalizedSelectionBox();
    const selectedCards = findCardsInBox(box);

    const newSelection = new Set(
      event.shiftKey
        ? [...selectedCardIds.value, ...selectedCards.map(card => card.uuid)]
        : selectedCards.map(card => card.uuid)
    );

    setCardSelection(newSelection, false);
  };

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

  const findCardsInBox = (box) => {
    if (!box) return [];

    return cards.value.filter((card) => {
      const cardElement = document.querySelector(
        `[data-card-id="${card.uuid}"]`
      );
      if (!cardElement) return false;

      const rect = cardElement.getBoundingClientRect();
      return (
        rect.left < box.right &&
        rect.right > box.left &&
        rect.top < box.bottom &&
        rect.bottom > box.top
      );
    });
  };

  const createSelectionGroup = (groupName = "") => {
    const groupId = crypto.randomUUID();
    selectionGroups.value.set(groupId, {
      name: groupName,
      cards: new Set(selectedCardIds.value),
    });
    return groupId;
  };

  const updateSelectionGroups = () => {
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
          left: Math.min(bounds.left, card.ui.x),
          right: Math.max(bounds.right, card.ui.x + (card.ui.width || 300)),
          top: Math.min(bounds.top, card.ui.y),
          bottom: Math.max(bounds.bottom, card.ui.y + (card.ui.height || 200)),
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

  const getSelectionCenter = (groupId = null) => {
    const bounds = getSelectionBounds(groupId);
    if (!bounds) return null;
    return {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
    };
  };

  const cleanup = () => {
    selectedCardIds.value.clear();
    selectionBox.value = null;
    hoveredCardId.value = null;
    selectionHistory.value = [];
    selectionGroups.value.clear();
    dragState.value = {
      isDragging: false,
      dragOrigin: { x: 0, y: 0 },
      startPositions: new Map()
    };
  };

  return {
    handleCardSelection,
    beginDragOperation,
    clearDragOperation,
    updateSelection,
    setCardSelection,
    clearSelection: () => setCardSelection(new Set()),
    reorderCards,
    handleCardHover,
    clearHover,
    startAreaSelection,
    updateAreaSelection,
    endAreaSelection: () => {
      selectionBox.value = null;
      recordSelectionHistory();
    },
    createSelectionGroup,
    updateSelectionGroups,
    getSelectionGroups,
    findCardGroup,
    isCardSelected: (cardId) => selectedCardIds.value.has(cardId),
    getSelectedCards: () => cards.value.filter(card => selectedCardIds.value.has(card.uuid)),
    getSelectionBounds,
    getSelectionCenter,
    getNormalizedSelectionBox,
    findCardsInBox,
    hoveredCardId,
    selectionBox,
    selectionHistory,
    selectionGroups,
    lastInteractionType,
    currentZIndex,
    SELECTION_MODES,
    cleanup,
  };
};