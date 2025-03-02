// TextToSpeechCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";
import { createSocket, updateSocketArray, createSocketUpdateEvent } from "../utils/socketManagement/socketRemapping.js";
import { useTextToSpeech } from "../composables/useTextToSpeech.js";

export default {
  name: "TextToSpeechCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
  },

  template: `
    <div class="card">
      <BaseCard
        :card-data="localCardData"
        :zoom-level="zoomLevel"
        :z-index="zIndex"
        :is-selected="isSelected"
        @drag-start="$emit('drag-start', $event)"   
        @drag="$emit('drag', $event)"
        @drag-end="$emit('drag-end', $event)"
        @update-card="handleCardUpdate"
        @close-card="$emit('close-card', $event)"
        @clone-card="uuid => $emit('clone-card', uuid)"
        @select-card="$emit('select-card', $event)"
      >
        <!-- Input Sockets -->
        <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 16px;">
          <div 
            v-for="(socket, index) in localCardData.data.sockets.inputs"
            :key="socket.id"
            class="flex items-center"
            :style="{ transform: 'translateY(' + (index * 4) + 'px)' }"
          >
            <BaseSocket
              v-if="socket"
              type="input"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
              :value="socket.value"
              :is-connected="getSocketConnections(socket.id)"
              :has-error="hasSocketError(socket)"
              :zoom-level="zoomLevel"
              @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
              @connection-drag="$emit('connection-drag', $event)"
              @connection-drag-end="$emit('connection-drag-end', $event)"
              @socket-mounted="handleSocketMount($event)"
            />
          </div>
        </div>



        <!-- Credentials -->
            <div class="p-4 border-b border-gray-700" v-show="localCardData.ui.display === 'default'">
            <div class="space-y-2">
                <div class="flex flex-col gap-2">
                <label class="text-xs font-medium text-gray-400">PlayHT User ID:</label>
                <input 
                    type="text"
                    v-model="localCardData.data.credentials.userId"
                    placeholder="Enter User ID"
                    class="w-full bg-gray-800 text-white px-2 py-1 text-xs rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                   
            autocomplete="new-password"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              data-form-type="other"
              data-lpignore="true"
              data-private="true"
              aria-autocomplete="none"
              aria-hidden="true"
              readonly
              onfocus="this.removeAttribute('readonly')"

                />
                </div>
                <div class="flex flex-col gap-2">
                <label class="text-xs font-medium text-gray-400">PlayHT API Key:</label>
                <input 
                    type="password"
                    v-model="localCardData.data.credentials.apiKey"
                    placeholder="Enter API Key"
                    class="w-full bg-gray-800 text-white px-2 py-1 text-xs rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    
            autocomplete="new-password"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              data-form-type="other"
              data-lpignore="true"
              data-private="true"
              aria-autocomplete="none"
              aria-hidden="true"
              readonly
              onfocus="this.removeAttribute('readonly')"

                />
                </div>
            </div>
            </div>

        <!-- Content -->
        <div class="space-y-2 text-gray-300" v-show="localCardData.ui.display === 'default'">
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-medium text-gray-400">Text to Speech:</label>
              <button 
                class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                @click="addInput"
              >+ Add Input</button>
            </div>
      
<div class="space-y-2">
  <div 
    v-for="(audio, index) in localCardData.data.audio" 
    :key="index"
    class="flex flex-col gap-2 bg-gray-900 p-2 rounded"
  >
    <!-- First Row: Number, Status, and Controls -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">{{ index + 1 }}.</span>
        
        <!-- Status -->
        <div class="flex items-center gap-2">
          <div 
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-yellow-500': audio.status === 'processing',
              'bg-green-500': audio.status === 'complete',
              'bg-gray-500': !audio.status
            }"
          ></div>
          <span class="text-xs">{{ audio.status || 'Waiting' }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-2">
        <button 
          v-if="audio.data"
          class="text-gray-400 hover:text-gray-200"
          @click.stop="playAudio(index)"
          @mousedown.stop
          @touchstart.stop
        >
          <i class="pi" :class="isPlaying(index) ? 'pi-pause' : 'pi-play'"></i>
        </button>

        <button 
          v-if="audio.data"
          class="text-gray-400 hover:text-gray-200"
          @click.stop="downloadAudio(index)"
          @mousedown.stop
          @touchstart.stop
        >
          <i class="pi pi-download"></i>
        </button>

        <button 
          class="text-gray-400 hover:text-gray-200"
          @click.stop="removeInput(index)"
          @mousedown.stop
          @touchstart.stop
        >×</button>
      </div>
    </div>

    <!-- Second Row: Voice Selection -->
    <select
      v-model="audio.voicePath"
      class="w-full bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
      @change="handleVoiceChange(index)"
      @mousedown.stop
      @touchstart.stop
    >
      <option value="">Select Voice</option>
      <option 
        v-for="voice in ttsVoices" 
        :key="voice.id" 
        :value="voice.path"
      >
        {{ voice.name }} ({{ voice.language }})
      </option>
    </select>
  </div>
</div>

</div>
          <div class="mt-4">
            <div class="flex items-center justify-end">
              <button 
                v-if="hasCompletedAudio"
                class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
                @click.stop="downloadAllAudio"
              >Download All</button>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    const { ttsVoices, generateAudio } = useTextToSpeech();
    
    // Initialize card setup utilities
    const {
      socketRegistry,
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup,
    } = useCardSetup(props, emit);

    // Basic error handling for sockets
    const hasSocketError = (socket) => false;

    // Initialize local card data
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Text to Speech",
        description: "Text to Speech Node",
        defaultData: {
          audio: [],
          credentials: {
            userId: '',
            apiKey: ''
          }          
        },
        defaultSockets: {
          inputs: [],
          outputs: [],
        },
      })
    );

    // Audio player state
    const audioElements = Vue.ref({});
    const currentlyPlaying = Vue.ref(null);

    // Computed
    const hasCompletedAudio = Vue.computed(() => {
      return localCardData.value.data.audio.some(
        audio => audio.status === 'complete' && audio.data
      );
    });

    // Methods
    const handleCardUpdate = (data) => {
      if (data) localCardData.value = data;
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    const addInput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.data.sockets.inputs];
        const newSocket = createSocket({
          type: "input",
          index: localCardData.value.data.audio.length
        });

        localCardData.value.data.audio.push({
          status: null,
          data: null
        });

        const newSockets = [...oldSockets, newSocket];
        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          socketRegistry,
        });

        localCardData.value.data.sockets.inputs = reindexedSockets;

        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: [],
            type: "input",
          })
        );

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const removeInput = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.data.sockets.inputs];
        const deletedSocket = oldSockets[index];
        const deletedSocketIds = deletedSocket ? [deletedSocket.id] : [];

        localCardData.value.data.audio.splice(index, 1);
        const newSockets = oldSockets.filter((_, i) => i !== index);

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          deletedSocketIds,
          socketRegistry,
        });

        localCardData.value.data.sockets.inputs = reindexedSockets;

        emit(
          "sockets-updated",
          createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds,
            type: "input",
          })
        );

        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    const generateAudioForInput = async (index) => {
        const socket = localCardData.value.data.sockets.inputs[index];
        if (!socket?.value) return;
      
        localCardData.value.data.audio[index].status = 'processing';
        handleCardUpdate();
      
        try {
          const result = await generateAudio(
            socket.value, 
            localCardData.value.data.audio[index].voicePath,
            localCardData.value.data.credentials.userId,
            localCardData.value.data.credentials.apiKey
          );
          if (result.success) {
            // Clean up old audio element if it exists
            if (audioElements.value[index]) {
              audioElements.value[index].pause();
              URL.revokeObjectURL(audioElements.value[index].src);
              delete audioElements.value[index];
            }
    
            localCardData.value.data.audio[index] = {
              ...localCardData.value.data.audio[index],
              status: 'complete',
              data: result.data
            };
          } else {
            localCardData.value.data.audio[index] = {
              ...localCardData.value.data.audio[index],
              status: 'error',
              error: result.error
            };
          }
        } catch (error) {
          localCardData.value.data.audio[index] = {
            ...localCardData.value.data.audio[index],
            status: 'error',
            error: error.message
          };
        }
      
        handleCardUpdate();
      };

    const handleVoiceChange = (index) => {
        handleCardUpdate();
        generateAudioForInput(index);
      };

      const playAudio = (index) => {
        // If this index is currently playing, stop it
        if (currentlyPlaying.value === index && audioElements.value[index]) {
          try {
            audioElements.value[index].pause();
          } catch (error) {
            console.error('Error pausing audio:', error);
          }
          currentlyPlaying.value = null;
          return;
        }
      
        // If something else is playing, stop it first
        if (currentlyPlaying.value !== null && audioElements.value[currentlyPlaying.value]) {
          try {
            audioElements.value[currentlyPlaying.value].pause();
          } catch (error) {
            console.error('Error pausing previous audio:', error);
          }
        }
      
        // Create new audio element if needed
        if (!audioElements.value[index] || !audioElements.value[index].src) {
          try {
            const blob = new Blob([localCardData.value.data.audio[index].data], { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
              currentlyPlaying.value = null;
            };
            audioElements.value[index] = audio;
          } catch (error) {
            console.error('Error creating audio element:', error);
            return;
          }
        }
      
        // Play the audio
        try {
          audioElements.value[index].play();
          currentlyPlaying.value = index;
        } catch (error) {
          console.error('Error playing audio:', error);
          currentlyPlaying.value = null;
        }
      };
    const isPlaying = (index) => currentlyPlaying.value === index;

    const downloadAudio = (index) => {
      const blob = new Blob([localCardData.value.data.audio[index].data], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_${index + 1}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const downloadAllAudio = async () => {
      const zip = new JSZip();
      
      localCardData.value.data.audio.forEach((audio, index) => {
        if (audio.status === 'complete' && audio.data) {
          zip.file(`audio_${index + 1}.mp3`, audio.data);
        }
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all_audio.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: ({ type, content, socketId }) => {
        if (type === 'modified' && content.old.value !== content.new.value) {
          const index = localCardData.value.data.sockets.inputs.findIndex(
            socket => socket.id === socketId
          );
          if (index !== -1) {
            generateAudioForInput(index);
          }
        }
      },
      onOutputChange: () => {}
    });

    // Set up watchers
    const watchers = setupCardDataWatchers({
      props,
      localCardData,
      isProcessing,
      emit,
    });

    // Watch core property changes
    Vue.watch(
      () => ({ x: props.cardData.ui?.x, y: props.cardData.ui?.y }),
      watchers.position
    );

    Vue.watch(() => props.cardData.ui?.display, watchers.display);
    Vue.watch(() => props.cardData.ui?.width, watchers.width);
    Vue.watch(() => props.cardData.ui?.height, watchers.height);

    // Lifecycle hooks
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    Vue.onUnmounted(() => {
      cleanup();
      // Cleanup audio elements
      Object.values(audioElements.value).forEach(audio => {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      });
    });

    return {
        ttsVoices,
        localCardData,
        getSocketConnections,
        hasSocketError,
        handleSocketMount,
        handleCardUpdate,
        emitWithCardId,
        addInput,
        removeInput,
        playAudio,
        isPlaying,
        downloadAudio,
        downloadAllAudio,
        hasCompletedAudio,
        // Audio states
        audioElements,
        currentlyPlaying,
        // Status helpers
        generateAudioForInput,
        handleVoiceChange
      };
    },
  };