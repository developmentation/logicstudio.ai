// utils/cardManagement/cardRegistry.js

export const createCardRegistry = (props) => {
  const {
    // State refs
    activeCards,
    activeConnections,
    zoomLevel,
    canvasRef,
    selectedCardIds,
    Z_INDEX_LAYERS,
  } = props;

  // Enhanced card type definitions
  const CARD_TYPES = {
    TRIGGER: "trigger",
    MODEL: "model",
    AGENT: "agent",
    INPUT: "input",
    OUTPUT: "output",
    JOIN: "join",
    TEMPLATE: "template",
    VIEW: "view",
    LABEL: "label",
    TEXT: "text",
    WEB: "web",
    GITHUB: "github",
    API: "api",
    CHAT: "chat",
    TRANSCRIBE: "transcribe",
    PDF: "pdf",
    TOOL: "tool",
  };

  // Socket type definitions
  const SOCKET_TYPES = {
    INPUT: "input",
    OUTPUT: "output",
  };

  // Enhanced default configurations with socket schemas
  const CARD_DEFAULTS = {
    [CARD_TYPES.MODEL]: {
      uuid: null,
      type: CARD_TYPES.MODEL,
      ui: {
        name: "Model",
        description: "Model Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: [],
        }
      }
    },
  
    [CARD_TYPES.AGENT]: {
      uuid: null,
      type: CARD_TYPES.AGENT,
      ui: {
        name: "Agent",
        description: "Agent Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        model: null,
        systemPrompt: '<socket name="System Socket"/>',
        userPrompt: '<socket name="User Socket"/>',
        messageHistory: [],
        pendingMessage: "",
        completedMessage: "",
        output: "",
        triggers: {
          andEnabled: false,
          orEnabled: false,
          autoTrigger: false,
        },
        sockets: {
          inputs: [],
          outputs: [
            {
              id: uuidv4(),
              name: "Output",
              type: SOCKET_TYPES.OUTPUT,
              value: null,
              momentUpdated: Date.now(),
            }
          ]
        }
      }
    },
  
    [CARD_TYPES.INPUT]: {
      uuid: null,
      type: CARD_TYPES.INPUT,
      ui: {
        name: "Input",
        description: "File Input Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        files: [],
        filesData: [],
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.OUTPUT]: {
      uuid: null,
      type: CARD_TYPES.OUTPUT,
      ui: {
        name: "Output",
        description: "Output Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        outputs: [],
        autoDownload: false,
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.JOIN]: {
      uuid: null,
      type: CARD_TYPES.JOIN,
      ui: {
        name: "Join",
        description: "Join Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: [
            {
              id: uuidv4(),
              name: "Output",
              type: SOCKET_TYPES.OUTPUT,
              value: null,
              momentUpdated: Date.now(),
            }
          ]
        }
      }
    },
  
    [CARD_TYPES.TEXT]: {
      uuid: null,
      type: CARD_TYPES.TEXT,
      ui: {
        name: "Text",
        description: "Text Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        content: "Enter text here...",
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.VIEW]: {
      uuid: null,
      type: CARD_TYPES.VIEW,
      ui: {
        name: "View",
        description: "View Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 250,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.LABEL]: {
      uuid: null,
      type: CARD_TYPES.LABEL,
      ui: {
        name: "Label",
        description: "Label Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 250,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.TRIGGER]: {
      uuid: null,
      type: CARD_TYPES.TRIGGER,
      ui: {
        name: "Trigger",
        description: "Trigger Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.WEB]: {
      uuid: null,
      type: CARD_TYPES.WEB,
      ui: {
        name: "Web",
        description: "Web Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.CHAT]: {
      uuid: null,
      type: CARD_TYPES.CHAT,
      ui: {
        name: "Chat",
        description: "Chat Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 250,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        messages: [],
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.GITHUB]: {
      uuid: null,
      type: CARD_TYPES.GITHUB,
      ui: {
        name: "GitHub",
        description: "GitHub Node",
        display: "default",
        x: 0,
        y: 0,
        width: 500,
        height: 250,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.API]: {
      uuid: null,
      type: CARD_TYPES.API,
      ui: {
        name: "API",
        description: "API Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 250,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.TRANSCRIBE]: {
      uuid: null,
      type: CARD_TYPES.TRANSCRIBE,
      ui: {
        name: "Transcribe",
        description: "Transcribe Node",
        display: "default",
        x: 0,
        y: 0,
        width: 450,
        height: 250,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.PDF]: {
      uuid: null,
      type: CARD_TYPES.PDF,
      ui: {
        name: "PDF",
        description: "PDF Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 250,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    },
  
    [CARD_TYPES.TEMPLATE]: {
      uuid: null,
      type: CARD_TYPES.TEMPLATE,
      ui: {
        name: "Template",
        description: "Template Node",
        display: "default",
        x: 0,
        y: 0,
        width: 300,
        height: 150,
        zIndex: Z_INDEX_LAYERS.DEFAULT,
      },
      data: {
        sockets: {
          inputs: [],
          outputs: []
        }
      }
    }
  };
  // In cardRegistry.js
 
  
  const createCard = (type, position = null) => {
    // Reset z-index for all cards
    activeCards.value = activeCards.value.map((card) => ({
      ...card,
      ui: {
        ...card.ui,
        zIndex: Z_INDEX_LAYERS.DEFAULT
      }
    }));
    
    selectedCardIds.value.clear();

    const defaultConfig = CARD_DEFAULTS[type];
    if (!defaultConfig) {
      console.error(`Unknown card type: ${type}`);
      return null;
    }

    // Calculate center position if not provided
    if (!position && canvasRef.value) {
      const container = canvasRef.value;
      const viewportWidth = container.clientWidth;
      const viewportHeight = container.clientHeight;
      const scrollLeft = container.scrollLeft;
      const scrollTop = container.scrollTop;

      position = {
        x: (scrollLeft + viewportWidth / 2 - 4000) / zoomLevel.value - defaultConfig.ui.width / 2,
        y: (scrollTop + viewportHeight / 2 - 4000) / zoomLevel.value - defaultConfig.ui.height / 2 - 200,
      };
    }

    // Create a deep clone of the default config
    const defaultConfigClone = JSON.parse(JSON.stringify(defaultConfig));
    const cardId = uuidv4();

    // Create the new card as a plain object (since it will be inside the activeCards ref)
    const newCard = {
      uuid: cardId,
      type,
      ui: {
        ...defaultConfigClone.ui,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        zIndex: Z_INDEX_LAYERS.SELECTED,
      },
      data: {
        ...defaultConfigClone.data,
        sockets: {
          inputs: defaultConfigClone.data.sockets.inputs.map(socket => ({
            ...socket,
            id: uuidv4(),
            momentUpdated: Date.now(),
          })),
          outputs: defaultConfigClone.data.sockets.outputs.map(socket => ({
            ...socket,
            id: uuidv4(),
            momentUpdated: Date.now(),
          })),
        }
      }
    };

    // Update the ref array with the new card
    activeCards.value = [...activeCards.value, newCard];
    selectedCardIds.value.add(cardId);
    
    return cardId;
  };


  const cloneCard = (uuid) => {
    let clonedCards = [];
  
    console.log("CloneCard:", uuid)
    console.log("SelectedCards:", selectedCardIds.value)
    
    if(selectedCardIds?.value?.size == 1) {
      selectedCardIds.value.clear()
      selectedCardIds.value.add(uuid);
    }
  
    selectedCardIds.value.forEach((id) => {
      const card = activeCards.value.find((c) => c.uuid === id);
      if (card) {
        let clonedCard = JSON.parse(JSON.stringify(card));
        clonedCard.uuid = uuidv4();
        clonedCard.ui.x += 50;
        clonedCard.ui.y += 50;
        clonedCard.ui.zIndex = Z_INDEX_LAYERS.SELECTED;
  
        // Socket handling code remains the same...
        
        clonedCards.push(clonedCard);
      }
    });
  
    // Fix: Properly spread all properties when resetting z-index
    activeCards.value = activeCards.value.map((card) => ({
      ...card,
      ui: {
        ...card.ui,
        zIndex: Z_INDEX_LAYERS.DEFAULT
      }
    }));
    
    selectedCardIds.value.clear();
  
    // Add cloned cards
    activeCards.value = [...activeCards.value, ...clonedCards];
    clonedCards.forEach(card => selectedCardIds.value.add(card.uuid));
  
    return selectedCardIds.value;
  };

  const removeCard = (cardId) => {
    // console.log("removeCard", cardId)
    // Find the card to remove
    const cardIndex = activeCards.value.findIndex(
      (card) => card.uuid === cardId
    );
    if (cardIndex === -1) {
      // console.warn(`Cannot remove card: Card with ID ${cardId} not found`);
      return false;
    }

    const card = activeCards.value[cardIndex];

    // Get all socket IDs for this card
    const socketIds = [
      ...card.data.sockets.inputs.map((s) => s.id),
      ...card.data.sockets.outputs.map((s) => s.id),
    ];

    // Remove all connections where this card is either source or target
    activeConnections.value = activeConnections.value.filter((conn) => {
      const isConnectedToCard =
        conn.sourceCardId === cardId ||
        conn.targetCardId === cardId ||
        socketIds.includes(conn.sourceSocketId) ||
        socketIds.includes(conn.targetSocketId);
      return !isConnectedToCard;
    });

    // Remove the card from activeCards
    activeCards.value = activeCards.value.filter(
      (card) => card.uuid !== cardId
    );

    // Force a reactivity update for both arrays
    activeCards.value = [...activeCards.value];
    activeConnections.value = [...activeConnections.value];

    return true;
  };

  return {
    // Constants
    CARD_TYPES,
    SOCKET_TYPES,
    CARD_DEFAULTS,

    // Card operations
    createCard,
    cloneCard,
    removeCard,

    // State persistence
    serializeCards: () =>
      cards.value.map((card) => ({
        ...Vue.toRaw(card),
        zIndex: undefined,
      })),
    deserializeCards: (serializedCards) => {
      cards.value = serializedCards.map((card) => ({
        ...card,
        zIndex: 1,
      }));
    },
  };
};
