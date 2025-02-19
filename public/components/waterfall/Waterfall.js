// components/Waterfall.js
import { useCanvases } from "../../composables/useCanvases.js";
import WaterfallSlider from "./WaterfallSlider.js";
import CardModal from "./CardModal.js";
import ConnectionTrace from "./ConnectionTrace.js";
import SkeuomorphicCard from "./SkeuomorphicCard.js";

export default {
  name: "Waterfall",
  components: {
    WaterfallSlider,
    CardModal,
    ConnectionTrace,
    SkeuomorphicCard
  },

  template: `
    <div class="absolute inset-0 flex flex-col overflow-hidden bg-gray-900">
      <!-- Top Toolbar - Similar to Studio but simplified -->
      <div class="flex items-center space-x-2 p-2 bg-gray-800 select-none z-40">
        <div class="flex items-center gap-2">
          <input 
            type="text" 
            v-if="activeCanvas" 
            v-model="activeCanvas.name" 
            placeholder="Canvas Name"
            class="w-[32rem] px-3 py-2 bg-gray-800 text-gray-100 border-gray-700 rounded-md"
          />
          <button
            class="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded"
            @click="switchToStudio"
          >
            Switch to Canvas View
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="relative flex-1 overflow-y-auto">
        <!-- Waterfall Sliders Container -->
        <div class="p-4 space-y-4">
          <!-- Add Slider Button -->
          <button 
            @click="addSlider"
            class="w-full py-3 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-gray-600 hover:text-gray-300"
          >
            Add New Slider
          </button>

          <!-- Sliders -->
          <template v-for="(slider, index) in sliders" :key="slider.id">
            <div class="relative">
              <!-- Slider Title -->
              <div class="flex items-center justify-between mb-2">
                <input 
                  v-model="slider.name"
                  class="bg-transparent text-white text-lg font-medium focus:outline-none"
                  placeholder="Slider Name"
                />
                <button 
                  @click="removeSlider(index)"
                  class="text-gray-500 hover:text-gray-300"
                >
                  Remove
                </button>
              </div>

              <!-- Connection Trace (shows when expanded) -->
              <ConnectionTrace 
                v-if="expandedTraceIndex === index"
                :sourceSlider="sliders[index - 1]"
                :targetSlider="slider"
                :connections="getConnectionsBetweenSliders(index - 1, index)"
              />

              <!-- Waterfall Slider Component -->
              <WaterfallSlider
                :slider="slider"
                :cards="getCardsForSlider(slider.id)"
                @card-click="openCardModal"
                @add-card="openCardSelector"
              />
            </div>
          </template>
        </div>
      </div>

      <!-- Card Modal -->
      <CardModal
        v-if="selectedCard"
        :card="selectedCard"
        @close="selectedCard = null"
        @update="handleCardUpdate"
      />

      <!-- Card Selector Modal -->
      <div v-if="showCardSelector" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-4 rounded-lg w-96">
          <h3 class="text-lg text-white mb-4">Add Card</h3>
          <div class="grid grid-cols-3 gap-4">
            <button
              v-for="type in cardTypes"
              :key="type"
              @click="addCardToSlider(type)"
              class="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 text-white"
            >
              {{ type }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,

  setup() {
    const {
      canvases,
      activeCanvas,
      activeCards,
      activeConnections,
      createCard,
      updateCard,
      removeCard
    } = useCanvases();

    // Local state
    const sliders = Vue.ref([]);
    const selectedCard = Vue.ref(null);
    const showCardSelector = Vue.ref(false);
    const selectedSliderId = Vue.ref(null);
    const expandedTraceIndex = Vue.ref(null);

    // Card types from CanvasToolbar
    const cardTypes = [
      'model', 'trigger', 'agent', 'text', 'chat', 'input', 
      'output', 'join', 'view', 'label', 'web', 'github', 
      'api', 'pdf', 'transcribe', 'textToSpeech', 'template'
    ];

    // Slider Management
    const addSlider = () => {
      sliders.value.push({
        id: `slider-${Date.now()}`,
        name: `Slider ${sliders.value.length + 1}`,
        cards: [],
        cardIds: new Set() // Add this to track card IDs
      });
    };

    const removeSlider = (index) => {
      sliders.value.splice(index, 1);
    };

    // Card Management
    const getCardsForSlider = (sliderId) => {
      const slider = sliders.value.find(s => s.id === sliderId);
      if (!slider || !slider.cardIds) return [];
      
      return activeCards.value.filter(card => slider.cardIds.has(card.uuid));
    };

    const openCardModal = (card) => {
      selectedCard.value = card;
    };

    const openCardSelector = (sliderId) => {
      showCardSelector.value = true;
      selectedSliderId.value = sliderId;
    };

    const addCardToSlider = (cardType) => {
      try {
        // Create the card first
        const cardId = createCard(cardType);
        
        // Find the target slider
        const slider = sliders.value.find(s => s.id === selectedSliderId.value);
        if (!slider) {
          console.error('No slider found with ID:', selectedSliderId.value);
          return;
        }

        // Initialize cards array if it doesn't exist
        if (!slider.cardIds) {
          slider.cardIds = new Set();
        }

        // Add the card ID to the slider
        slider.cardIds.add(cardId);
        
        // Force reactivity update
        sliders.value = [...sliders.value];
        
        // Close the selector
        showCardSelector.value = false;
        selectedSliderId.value = null;
      } catch (error) {
        console.error('Error adding card to slider:', error);
      }
    };

    const handleCardUpdate = (updatedCard) => {
      updateCard(updatedCard);
      selectedCard.value = null;
    };

    // Connection Management
    const getConnectionsBetweenSliders = (sourceIndex, targetIndex) => {
      if (sourceIndex < 0) return [];
      
      const sourceSlider = sliders.value[sourceIndex];
      const targetSlider = sliders.value[targetIndex];
      
      return activeConnections.value.filter(conn => {
        const sourceCard = sourceSlider.cards.includes(conn.sourceCardId);
        const targetCard = targetSlider.cards.includes(conn.targetCardId);
        return sourceCard && targetCard;
      });
    };

    // Navigation
    const switchToStudio = () => {
      // Implementation depends on your routing setup
    };

    // Lifecycle
    Vue.onMounted(() => {
      // Ensure we have an active canvas first
      requestAnimationFrame(() => {
        if (!activeCanvas.value) {
          createCanvas();
        }
        
        // Then initialize with one empty slider
        Vue.nextTick(() => {
          if (sliders.value.length === 0) {
            addSlider();
          }
        });
      });
    });

    return {
      activeCanvas,
      sliders,
      selectedCard,
      showCardSelector,
      expandedTraceIndex,
      cardTypes,
      addSlider,
      removeSlider,
      getCardsForSlider,
      openCardModal,
      openCardSelector,
      addCardToSlider,
      handleCardUpdate,
      getConnectionsBetweenSliders,
      switchToStudio
    };
  }
};