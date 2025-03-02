// components/WaterfallSlider.js
import SkeuomorphicCard from './SkeuomorphicCard.js';

export default {
  name: "WaterfallSlider",
  components: {
    SkeuomorphicCard
  },

  props: {
    slider: {
      type: Object,
      required: true
    },
    cards: {
      type: Array,
      required: true
    }
  },

  template: `
    <div class="relative">
      <!-- Slider Container -->
      <div class="relative h-48 bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
        <!-- Scroll Shadow Overlays -->
        <div 
          v-show="canScrollLeft"
          class="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-gray-900 to-transparent z-10"
          @click="scroll('left')"
        >
          <button 
            class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300"
          >
            <i class="pi pi-chevron-left"></i>
          </button>
        </div>
        
        <div 
          v-show="canScrollRight"
          class="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-gray-900 to-transparent z-10"
          @click="scroll('right')"
        >
          <button 
            class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300"
          >
            <i class="pi pi-chevron-right"></i>
          </button>
        </div>

        <!-- Scrollable Content -->
        <div 
          ref="scrollContainer"
          class="absolute inset-0 flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
          @scroll="handleScroll"
          @wheel.prevent="handleWheel"
        >
          <!-- Cards Container -->
          <div class="flex gap-4 px-6 min-w-min items-center">
            <!-- Cards -->
            <SkeuomorphicCard
              v-for="card in cards"
              :key="card.uuid"
              :card="card"
              @click="$emit('card-click', card)"
            />

            <!-- Add Card Button -->
            <button
              @click="$emit('add-card', slider.id)"
              class="flex flex-col items-center justify-center w-24 h-32 rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-600 text-gray-500 hover:text-gray-400 transition-colors"
            >
              <i class="pi pi-plus text-xl mb-2"></i>
              <span class="text-xs">Add Card</span>
            </button>
          </div>
        </div>

        <!-- Scroll Progress Indicator -->
        <div 
          class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 bg-gray-800/50 rounded-full"
        >
          <div 
            v-for="segment in scrollSegments"
            :key="segment"
            class="w-1.5 h-1.5 rounded-full transition-colors duration-200"
            :class="[
              currentScrollSegment === segment 
                ? 'bg-gray-200' 
                : 'bg-gray-600'
            ]"
          />
        </div>
      </div>
    </div>
  `,

  setup(props) {
    // Refs
    const scrollContainer = Vue.ref(null);
    const scrollPosition = Vue.ref(0);
    const maxScroll = Vue.ref(0);

    // Computed
    const canScrollLeft = Vue.computed(() => scrollPosition.value > 0);
    const canScrollRight = Vue.computed(() => {
      if (!scrollContainer.value) return false;
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
      return Math.ceil(scrollLeft + clientWidth) < scrollWidth;
    });

    const scrollSegments = Vue.computed(() => {
      if (!scrollContainer.value) return 1;
      const { scrollWidth, clientWidth } = scrollContainer.value;
      return Math.max(1, Math.ceil(scrollWidth / clientWidth));
    });

    const currentScrollSegment = Vue.computed(() => {
      if (!scrollContainer.value) return 1;
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
      const progress = scrollLeft / (scrollWidth - clientWidth);
      return Math.ceil(progress * scrollSegments.value);
    });

    // Methods
    const updateScrollMetrics = () => {
      if (!scrollContainer.value) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
      scrollPosition.value = scrollLeft;
      maxScroll.value = scrollWidth - clientWidth;
    };

    const scroll = (direction) => {
      if (!scrollContainer.value) return;
      
      const scrollAmount = scrollContainer.value.clientWidth * 0.8;
      const targetScroll = scrollPosition.value + (
        direction === 'left' ? -scrollAmount : scrollAmount
      );

      scrollContainer.value.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    };

    const handleScroll = () => {
      requestAnimationFrame(updateScrollMetrics);
    };

    const handleWheel = (event) => {
      if (!scrollContainer.value) return;
      
      // Horizontal scroll with mouse wheel
      scrollContainer.value.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    // Lifecycle
    Vue.onMounted(() => {
      updateScrollMetrics();
    });

    // Watch for changes that might affect scroll
    Vue.watch(() => props.cards.length, () => {
      Vue.nextTick(updateScrollMetrics);
    });

    return {
      scrollContainer,
      canScrollLeft,
      canScrollRight,
      scrollSegments,
      currentScrollSegment,
      scroll,
      handleScroll,
      handleWheel
    };
  }
};