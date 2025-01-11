// LabelCard.js
import BaseCardTransparent from "./BaseCardTransparent.js";

export default {
  name: "LabelCard",
  components: { BaseCardTransparent },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
  },
  template: `
    <div>
      <BaseCardTransparent
        :card-data="localCardData"
        :zoom-level="zoomLevel"
        :z-index="zIndex"
        :is-selected="isSelected"
        @update-position="$emit('update-position', $event)"
        @update-card="handleCardUpdate"
        @close-card="$emit('close-card', $event)"
        @clone-card="uuid => $emit('clone-card', uuid)"
        @select-card="$emit('select-card', $event)"
        style="width:450px"
      >
        <!-- Content -->
        <div 
          class="p-4"
          v-show="localCardData.display == 'default'"
        >
          <div
            ref="titleContent"
            contenteditable="true"
            class="text-xl font-bold mb-2 break-words text-white hover:cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            @input="updateTitle"
            @mousedown.stop
            v-text="localCardData.title"
          ></div>
          <div
            ref="subtitleContent"
            contenteditable="true"
            class="text-sm text-gray-400 break-words hover:cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            @input="updateSubtitle"
            @mousedown.stop
            v-text="localCardData.subtitle"
          ></div>
        </div>
      </BaseCardTransparent>
    </div>
  `,

  setup(props, { emit }) {
    const isProcessing = Vue.ref(false);
    const titleContent = Vue.ref(null);
    const subtitleContent = Vue.ref(null);

    // Initialize card data
    const initializeCardData = (data) => {
      return {
        uuid: data.uuid,
        name: data.name || "Label",
        description: data.description || "Label Node",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        title: data.title || "Title",
        subtitle: data.subtitle || "Subtitle",
        sockets: {
          inputs: [],
          outputs: []
        }
      };
    };

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    const updateTitle = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;
      try {
        localCardData.value.title = titleContent.value.textContent;
        emit("update-card", Vue.toRaw(localCardData.value));
      } finally {
        isProcessing.value = false;
      }
    };

    const updateSubtitle = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;
      try {
        localCardData.value.subtitle = subtitleContent.value.textContent;
        emit("update-card", Vue.toRaw(localCardData.value));
      } finally {
        isProcessing.value = false;
      }
    };

    const handleCardUpdate = (data) => {
      if (isProcessing.value) return;
      if (data) {
        isProcessing.value = true;
        try {
          localCardData.value = data;
          emit("update-card", Vue.toRaw(localCardData.value));
        } finally {
          isProcessing.value = false;
        }
      }
    };

    // Watch for card data changes
    Vue.watch(
      () => props.cardData,
      (newData, oldData) => {
        if (!newData || isProcessing.value) return;
        isProcessing.value = true;

        try {
          // Update position
          if (newData.x !== oldData?.x) localCardData.value.x = newData.x;
          if (newData.y !== oldData?.y) localCardData.value.y = newData.y;
          
          // Update content if changed externally
          if (newData.title !== oldData?.title) localCardData.value.title = newData.title;
          if (newData.subtitle !== oldData?.subtitle) localCardData.value.subtitle = newData.subtitle;
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    return {
      localCardData,
      titleContent,
      subtitleContent,
      updateTitle,
      updateSubtitle,
      handleCardUpdate,
    };
  },
};