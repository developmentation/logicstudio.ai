// utils/cardManagement/cardRegistry.js

export const createCardRegistry = (props) => {
  const {
    // State refs
    activeCards,
    activeConnections,
    zoomLevel,
    canvasRef,
    selectedCardIds,
    Z_INDEX_LAYERS
  } = props;

  // Enhanced card type definitions
  const CARD_TYPES = {
    AGENT: "agent",
    INPUT: "input",
    OUTPUT: "output",
    TEMPLATE: "template",
    DISPLAY: "display",
    TEXT: "text",
    TOOL: "tool",
  };

  // Socket type definitions
  const SOCKET_TYPES = {
    INPUT: "input",
    OUTPUT: "output",
  };

  // Enhanced default configurations with socket schemas
  const CARD_DEFAULTS = {
    [CARD_TYPES.AGENT]: {
      width: 300,
      height: 200,
      model:null,
      systemPrompt: '<socket name = "System Socket"/>',
      userPrompt: '<socket name = "User Socket"/>',
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
          },
        ],
      },
    },
    [CARD_TYPES.INPUT]: {
      width: 300,
      height: 150,
      files: [],
      sockets: {
        inputs: [],
        outputs: [],
      },
    },
    [CARD_TYPES.OUTPUT]: {
      width: 300,
      height: 150,
      outputs: [],
      autoDownload: false,
      sockets: {
        inputs: [],
        outputs: [],
      },
    },
    [CARD_TYPES.TEMPLATE]: {
      width: 300,
      height: 150,
      sockets: {
        inputs: [],
        outputs: [],
      },
    },

    // [CARD_TYPES.DISPLAY]: {
    //   width: 300,
    //   height: 200,
    //   displayType: "markdown",
    //   content: "",
    //   sockets: {
    //     inputs: [ ],
    //     outputs: [],
    //   },
    // },

    // [CARD_TYPES.TEXT]: {
    //   width: 250,
    //   height: 150,
    //   content: "Enter text here...",
    //   sockets: {
    //     inputs: [],
    //     outputs: [
    //       {
    //         id: uuidv4(),
    //         name: "text",
    //         type: SOCKET_TYPES.OUTPUT,
    //         value: null,
    //         momentUpdated: Date.now(),
    //       },
    //     ],
    //   },
    // },

    // [CARD_TYPES.TOOL]: {
    //   width: 250,
    //   height: 150,
    //   toolType: "custom",
    //   config: {},
    //   sockets: {
    //     inputs: [
    //       {
    //         id: uuidv4(),
    //         name: "input",
    //         type: SOCKET_TYPES.INPUT,
    //         value: null,
    //         momentUpdated: Date.now(),
    //       },
    //     ],
    //     outputs: [
    //       {
    //         id: uuidv4(),
    //         name: "output",
    //         type: SOCKET_TYPES.OUTPUT,
    //         value: null,
    //         momentUpdated: Date.now(),
    //       },
    //     ],
    //   },
    // },


  };


  // In cardRegistry.js
  const createCard = (type, position = null) => {
    // console.log({type, position })


    activeCards.value = activeCards.value.map(card => ({
        ...card,
        zIndex: Z_INDEX_LAYERS.DEFAULT
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
        x:
          (scrollLeft + viewportWidth / 2 - 4000) / zoomLevel.value -
          defaultConfig.width / 2,
        y:
          ((scrollTop + viewportHeight / 2 - 4000) / zoomLevel.value -
          defaultConfig.height / 2) -(200),
      };
    }

    const defaultConfigClone = JSON.parse(JSON.stringify(defaultConfig));
    const cardId = uuidv4();

    //By card type, find the first available number in a sequence for that card to occupy
    //Or if you like, find the next highest number, so the sequence keeps going

    const newCard = {
      uuid: cardId,
      type,
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      zIndex: Z_INDEX_LAYERS.SELECTED,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)}`, // Simplified name
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
      ...defaultConfigClone,
      sockets: {
        inputs: defaultConfigClone.sockets.inputs.map((socket) => ({
          ...socket,
          id: uuidv4(),
          momentUpdated: Date.now(),
        })),
        outputs: defaultConfigClone.sockets.outputs.map((socket) => ({
          ...socket,
          id: uuidv4(),
          momentUpdated: Date.now(),
        })),
      },
    };

    // console.log(newCard)
    activeCards.value  = [...activeCards.value,newCard];
    selectedCardIds.value.add(cardId);
    // console.log(activeCards.value)
    return cardId;
  };


  
  // In cardRegistry.js
  const cloneCard = (type, position = null) => {
    // console.log({type, position })
    // console.log("cloneCard", selectedCardIds.value)
    let clonedCards = [];

    selectedCardIds.value.forEach((id) => {
      const card = activeCards.value.find((c) => c.uuid === id);
      if (card) {
        let clonedCard = JSON.parse(JSON.stringify(card))
        clonedCard.uuid = uuidv4(); //New UUID for the clone
        clonedCard.x = clonedCard.x + 50; //Shift right a little
        clonedCard.y = clonedCard.y + 50; //Shift down a little
        clonedCard.zIndex = Z_INDEX_LAYERS.SELECTED,
        clonedCards.push(clonedCard)
      }
    });
  

    //Reset the active cards
    activeCards.value = activeCards.value.map(card => ({
        ...card,
        zIndex: Z_INDEX_LAYERS.DEFAULT
      }));
      selectedCardIds.value.clear();
 
    //Set the cloned cards to be active
    clonedCards.forEach((newCard)=>{
      activeCards.value  = [...activeCards.value,newCard];
      selectedCardIds.value.add(newCard.uuid);
    })

    return selectedCardIds.value;
  };



const removeCard = (cardId) => {
    // console.log("removeCard", cardId)
    // Find the card to remove
    const cardIndex = activeCards.value.findIndex(card => card.uuid === cardId);
    if (cardIndex === -1) {
        // console.warn(`Cannot remove card: Card with ID ${cardId} not found`);
        return false;
    }

    const card = activeCards.value[cardIndex];

    // Get all socket IDs for this card
    const socketIds = [
        ...card.sockets.inputs.map(s => s.id),
        ...card.sockets.outputs.map(s => s.id)
    ];

    // Remove all connections where this card is either source or target
    activeConnections.value = activeConnections.value.filter(conn => {
        const isConnectedToCard = (
            conn.sourceCardId === cardId || 
            conn.targetCardId === cardId ||
            socketIds.includes(conn.sourceSocketId) ||
            socketIds.includes(conn.targetSocketId)
        );
        return !isConnectedToCard;
    });

    // Remove the card from activeCards
    activeCards.value = activeCards.value.filter(card => card.uuid !== cardId);

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
