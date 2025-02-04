// TranscribeCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useTranscripts } from "../composables/useTranscripts.js";
import {
  initializeCardData,
  useCardSetup,
  setupCardDataWatchers,
  setupSocketWatcher,
} from "../utils/cardManagement/cardUtils.js";
import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
} from '../utils/socketManagement/socketRemapping.js';

export default {
  name: "TranscribeCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false }
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
        <!-- Input Socket for Trigger -->
        <div class="absolute -left-[12px]" style="top: 16px;">
          <BaseSocket
            type="input"
            :socket-id="localCardData.data.sockets.inputs[0].id"
            :card-id="localCardData.uuid"
            name="Trigger"
            :value="localCardData.data.sockets.inputs[0].value"
            :is-connected="getSocketConnections(localCardData.data.sockets.inputs[0].id)"
            :has-error="false"
            :zoom-level="zoomLevel"
            @connection-drag-start="$emit('connection-drag-start', $event)"
            @connection-drag="$emit('connection-drag', $event)"
            @connection-drag-end="$emit('connection-drag-end', $event)"
            @socket-mounted="handleSocketMount($event)"
          />
        </div>

        <!-- Output Sockets -->
        <div 
          class="absolute -right-[12px] flex flex-col gap-4" 
          style="top: 16px;"
        >
          <div 
            v-for="(socket, index) in localCardData.data.sockets.outputs"
            :key="socket.id"
            class="flex items-center justify-end"
          >
            <BaseSocket
              type="output"
              :socket-id="socket.id"
              :card-id="localCardData.uuid"
              :name="socket.name"
              :value="socket.value"
              :is-connected="getSocketConnections(socket.id)"
              :has-error="false"
              :zoom-level="zoomLevel"
              @connection-drag-start="$emit('connection-drag-start', $event)"
              @connection-drag="$emit('connection-drag', $event)"
              @connection-drag-end="$emit('connection-drag-end', $event)"
              @socket-mounted="handleSocketMount($event)"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="space-y-4 text-gray-300 p-4" v-show="localCardData.ui.display === 'default'">
          <!-- File Upload Area (when no file is selected) -->
          <div v-if="!localCardData.data.currentFile">
            <div 
              class="flex justify-center items-center border-2 border-dashed border-gray-600 rounded-lg p-4 cursor-pointer"
              @click.stop="triggerFileInput"
              @dragover.prevent
              @dragenter.prevent
              @drop.stop.prevent="handleFileDrop"
              @dragleave.prevent
            >
              <div class="text-center">
                <p class="text-xs text-gray-400">Click or drag audio/video file to transcribe</p>
                <p class="text-xs text-gray-500 mt-1">Supported formats: MP3, WAV, MP4, etc.</p>
              </div>
              <input
                type="file"
                ref="fileInput"
                class="hidden"
                accept="audio/*,video/*"
                @change="handleFileSelect"
              />
            </div>
          </div>

          <!-- Current File & Status -->
          <div v-else class="space-y-4">
            <!-- File Info -->
            <div class="flex items-center justify-between bg-gray-800 p-2 rounded">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">{{ localCardData.data.currentFile.name }}</span>
                <span 
                  v-if="localCardData.data.status === 'error'" 
                  class="text-xs text-red-500"
                >{{ localCardData.data.error }}</span>
              </div>
              <button 
                class="text-xs text-gray-400 hover:text-white"
                @click="resetFile"
                :disabled="isProcessing"
              >
                Change File
              </button>
            </div>

            <!-- Progress Bar (during processing) -->
            <div v-if="isProcessing" class="space-y-2">
              <div class="flex justify-between text-xs text-gray-400">
                <span>{{ localCardData.data.status === 'uploading' ? 'Uploading' : 'Transcribing' }}...</span>
                <span>{{ localCardData.data.progress }}%</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div 
                  class="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                  :style="{ width: localCardData.data.progress + '%' }"
                ></div>
              </div>
            </div>

            <!-- Transcription Results -->
            <div v-if="localCardData.data.transcription" class="space-y-4">
              <!-- Statistics -->
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="bg-gray-800 p-2 rounded">
                  <span class="text-gray-400">Duration:</span>
                  <span class="ml-1">{{ formatDuration(localCardData.data.transcription.metadata.totalDuration) }}</span>
                </div>
                <div class="bg-gray-800 p-2 rounded">
                  <span class="text-gray-400">Words:</span>
                  <span class="ml-1">{{ localCardData.data.transcription.metadata.totalWords }}</span>
                </div>
                <div class="bg-gray-800 p-2 rounded">
                  <span class="text-gray-400">Speakers:</span>
                  <span class="ml-1">{{ localCardData.data.transcription.metadata.speakerCount }}</span>
                </div>
              </div>

              <!-- Speakers List -->
              <div class="space-y-2">
                <div class="text-xs text-gray-400 font-medium">Speakers</div>
                <div 
                  v-for="speaker in localCardData.data.transcription.speakers" 
                  :key="speaker.id"
                  class="flex items-center gap-2 bg-gray-800 p-2 rounded group"
                >
                  <div class="flex-1">
                    <input
                      v-model="speaker.displayName"
                      type="text"
                      class="w-full bg-gray-700 text-xs text-gray-200 px-2 py-1 rounded"
                      @change="handleSpeakerNameUpdate(speaker)"
                      @mousedown.stop
                    />
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ speaker.totalWords }} words ({{ speaker.percentageOfWords }}%)
                  </div>
                </div>
              </div>
            </div>

            <!-- Transcribe Button -->
            <div class="flex justify-center">
              <button 
                class="px-6 py-2 text-sm font-medium rounded"
                :class="buttonClass"
                @click="startTranscription"
                :disabled="isProcessing || !localCardData.data.currentFile"
              >
                {{ buttonText }}
              </button>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    // Initialize transcripts utility
    const { validateFile, transcribeFile } = useTranscripts();
    
    // Initialize file input ref
    const fileInput = Vue.ref(null);

    // Initialize card setup utilities
    const {
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      cleanup
    } = useCardSetup(props, emit);

    // Initialize local card data with default configuration
    const localCardData = Vue.ref(
      initializeCardData(props.cardData, {
        name: "Transcribe Card",
        description: "Audio/Video Transcription",
        defaultSockets: {
          inputs: [{ name: "Trigger" }],
          outputs: []
        },
        defaultData: {
          currentFile: null,
          status: 'idle', // idle, uploading, transcribing, complete, error
          progress: 0,
          error: null,
          transcription: null
        }
      })
    );

    // Setup socket watcher
    setupSocketWatcher({
      props,
      localCardData,
      isProcessing,
      emit,
      onInputChange: ({ type, content }) => {
        if (type === "modified" && content.old.value !== content.new.value) {
          // Handle input trigger
          if (content.new.value && localCardData.value.data.currentFile) {
            startTranscription();
          }
        }
      },
      onOutputChange: ({ type, content }) => {
        if (type === "modified") {
          handleCardUpdate();
        }
      }
    });

    // Set up watchers
    const watchers = setupCardDataWatchers({
      props,
      localCardData,
      isProcessing,
      emit
    });

    // Watch position changes
    Vue.watch(
      () => ({ x: props.cardData.ui?.x, y: props.cardData.ui?.y }),
      watchers.position
    );

    // Watch display changes
    Vue.watch(() => props.cardData.ui?.display, watchers.display);

    // Watch width changes
    Vue.watch(() => props.cardData.ui?.width, watchers.width);

    // Card-specific computed properties
    const buttonClass = Vue.computed(() => {
      if (isProcessing.value) {
        return 'bg-orange-500 hover:bg-orange-600';
      }
      return localCardData.value.data.status === 'complete' 
        ? 'bg-green-500 hover:bg-green-600'
        : 'bg-blue-500 hover:bg-blue-600';
    });

    const buttonText = Vue.computed(() => {
      switch (localCardData.value.data.status) {
        case 'uploading': return `Uploading... ${localCardData.value.data.progress}%`;
        case 'transcribing': return 'Transcribing...';
        case 'complete': return 'Transcribe Again';
        case 'error': return 'Retry Transcription';
        default: return 'Start Transcription';
      }
    });

    // Lifecycle hooks
    Vue.onMounted(() => {
      handleCardUpdate();
    });

    Vue.onUnmounted(cleanup);

    // Card-specific methods
    const handleCardUpdate = () => {
      if (!isProcessing.value) {
        emit('update-card', Vue.toRaw(localCardData.value));
      }
    };

    const formatDuration = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const triggerFileInput = () => {
      fileInput.value?.click();
    };

    const handleFileSelect = (event) => {
      const file = event.target.files?.[0];
      if (file) setFile(file);
    };

    const handleFileDrop = (event) => {
      const file = event.dataTransfer.files?.[0];
      if (file) setFile(file);
    };

    const setFile = async (file) => {
      const errors = validateFile(file);
      if (errors.length > 0) {
        localCardData.value.data.error = errors.join('. ');
        localCardData.value.data.status = 'error';
        return;
      }

      localCardData.value.data.currentFile = file;
      localCardData.value.data.status = 'idle';
      localCardData.value.data.error = null;
      localCardData.value.data.progress = 0;
      handleCardUpdate();

      await startTranscription();
    };

    const resetFile = () => {
      if (isProcessing.value) return;

      localCardData.value.data.currentFile = null;
      localCardData.value.data.status = 'idle';
      localCardData.value.data.error = null;
      localCardData.value.data.progress = 0;
      localCardData.value.data.transcription = null;

      // Reset sockets with proper cleanup
      const oldSockets = [...localCardData.value.data.sockets.outputs];
      const { reindexedSockets, deletedSocketIds } = updateSocketArray({
        oldSockets,
        newSockets: [],
        type: 'output'
      });

      localCardData.value.data.sockets.outputs = reindexedSockets;

      // Emit socket removal event
      emit('sockets-updated', createSocketUpdateEvent({
        cardId: localCardData.value.uuid,
        oldSockets,
        newSockets: reindexedSockets,
        reindexMap: new Map(),
        deletedSocketIds,
        type: 'output'
      }));

      handleCardUpdate();
      
      Vue.nextTick(() => {
        triggerFileInput();
      });
    };

    const handleSpeakerNameUpdate = (speaker) => {
      if (isProcessing.value) return;

      const speakerInTranscript = localCardData.value.data.transcription.speakers.find(
        s => s.id === speaker.id
      );
      
      if (speakerInTranscript) {
        speakerInTranscript.displayName = speaker.displayName;

        // Update corresponding output socket
        const speakerSocket = localCardData.value.data.sockets.outputs.find(socket => {
          const data = JSON.parse(socket.value);
          return data.speaker?.id === speaker.id;
        });

        if (speakerSocket) {
          const socketData = JSON.parse(speakerSocket.value);
          socketData.speaker.displayName = speaker.displayName;
          speakerSocket.name = speaker.displayName;
          speakerSocket.value = JSON.stringify(socketData);
        }

        handleCardUpdate();
      }
    };

    const startTranscription = async () => {
      if (!localCardData.value.data.currentFile || isProcessing.value) return;

      localCardData.value.data.status = 'uploading';
      localCardData.value.data.progress = 0;
      localCardData.value.data.error = null;

      try {
        const result = await transcribeFile(
          localCardData.value.data.currentFile,
          (progress) => {
            if (progress === 100) {
              localCardData.value.data.status = 'transcribing';
            }
            localCardData.value.data.progress = progress;
          }
        );

        if (result.success) {
          localCardData.value.data.transcription = result.data;
          localCardData.value.data.status = 'complete';

          const existingOutputs = localCardData.value.data.sockets.outputs;
          const currentSpeakerCount = result.data.speakers.length;
          const existingSpeakerCount = existingOutputs.length > 0 ? existingOutputs.length - 1 : 0; // -1 for the "Entire Transcript" socket

          // If we have the same number of speakers, preserve socket IDs
          if (currentSpeakerCount === existingSpeakerCount && existingOutputs.length > 0) {
            // Update main transcript socket
            existingOutputs[0].value = JSON.stringify({
              metadata: result.data.metadata,
              segments: result.data.segments
            });
            existingOutputs[0].momentUpdated = Date.now();

            // Update speaker sockets
            result.data.speakers.forEach((speaker, index) => {
              const socketIndex = index + 1; // +1 because index 0 is the main transcript
              existingOutputs[socketIndex].name = speaker.displayName || `Speaker ${speaker.id}`;
              existingOutputs[socketIndex].value = JSON.stringify({
                speaker: speaker,
                segments: result.data.segments.filter(seg => seg.speaker === speaker.id)
              });
              existingOutputs[socketIndex].momentUpdated = Date.now();
            });

            // Emit update for existing sockets
            emit('sockets-updated', createSocketUpdateEvent({
              cardId: localCardData.value.uuid,
              oldSockets: existingOutputs,
              newSockets: existingOutputs,
              reindexMap: new Map(existingOutputs.map((s, i) => [s.id, i])),
              deletedSocketIds: [],
              type: 'output'
            }));
          } else {
            // Different number of speakers, create new sockets
            const newSockets = [
              createSocket({
                type: 'output',
                index: 0,
                name: 'Entire Transcript',
                value: JSON.stringify({
                  metadata: result.data.metadata,
                  segments: result.data.segments
                })
              }),
              ...result.data.speakers.map((speaker, index) => 
                createSocket({
                  type: 'output',
                  index: index + 1,
                  name: speaker.displayName || `Speaker ${speaker.id}`,
                  value: JSON.stringify({
                    speaker: speaker,
                    segments: result.data.segments.filter(seg => seg.speaker === speaker.id)
                  })
                })
              )
            ];

            // Update socket array with proper remapping
            const { reindexMap, reindexedSockets, deletedSocketIds } = updateSocketArray({
              oldSockets: existingOutputs,
              newSockets,
              type: 'output'
            });

            // Update the sockets
            localCardData.value.data.sockets.outputs = reindexedSockets;

            // Emit socket update event
            emit('sockets-updated', createSocketUpdateEvent({
              cardId: localCardData.value.uuid,
              oldSockets: existingOutputs,
              newSockets: reindexedSockets,
              reindexMap,
              deletedSocketIds,
              type: 'output'
            }));
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        localCardData.value.data.error = error.message;
        localCardData.value.data.status = 'error';
      }

      handleCardUpdate();
    };

    return {
      fileInput,
      localCardData,
      isProcessing,
      getSocketConnections,
      handleSocketMount,
      handleCardUpdate,
      handleFileSelect,
      handleFileDrop,
      handleSpeakerNameUpdate,
      triggerFileInput,
      startTranscription,
      resetFile,
      formatDuration,
      buttonClass,
      buttonText
    };
  }
};