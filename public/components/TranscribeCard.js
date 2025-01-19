// TranscribeCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";
import { useTranscripts } from "../composables/useTranscripts.js";
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
    <div>
      <BaseCard
        :card-data="localCardData"
        :zoom-level="zoomLevel"
        :z-index="zIndex"
        :is-selected="isSelected"
        @update-position="$emit('update-position', $event)"
        @update-card="handleCardUpdate"
        @close-card="$emit('close-card', $event)"
        @clone-card="uuid => $emit('clone-card', uuid)"
        @select-card="$emit('select-card', $event)"
      >
        <!-- Input Socket for Trigger -->
        <div class="absolute -left-[12px]" style="top: 16px;">
          <BaseSocket
            type="input"
            :socket-id="localCardData.sockets.inputs[0].id"
            :card-id="localCardData.uuid"
            name="Trigger"
            :value="localCardData.sockets.inputs[0].value"
            :is-connected="getSocketConnections(localCardData.sockets.inputs[0].id)"
            :has-error="false"
            :zoom-level="zoomLevel"
            @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
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
            v-for="(socket, index) in localCardData.sockets.outputs"
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
              @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
              @connection-drag="$emit('connection-drag', $event)"
              @connection-drag-end="$emit('connection-drag-end', $event)"
              @socket-mounted="handleSocketMount($event)"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="space-y-4 text-gray-300 p-4" v-show="localCardData.display == 'default'">
          <!-- File Upload Area (when no file is selected) -->
          <div v-if="!localCardData.currentFile">
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
                <span class="text-xs text-gray-400">{{ localCardData.currentFile.name }}</span>
                <span 
                  v-if="localCardData.status === 'error'" 
                  class="text-xs text-red-500"
                >{{ localCardData.error }}</span>
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
                <span>{{ localCardData.status === 'uploading' ? 'Uploading' : 'Transcribing' }}...</span>
                <span>{{ localCardData.progress }}%</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div 
                  class="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                  :style="{ width: localCardData.progress + '%' }"
                ></div>
              </div>
            </div>

            <!-- Transcription Results -->
            <div v-if="localCardData.transcription" class="space-y-4">
              <!-- Statistics -->
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="bg-gray-800 p-2 rounded">
                  <span class="text-gray-400">Duration:</span>
                  <span class="ml-1">{{ formatDuration(localCardData.transcription.metadata.totalDuration) }}</span>
                </div>
                <div class="bg-gray-800 p-2 rounded">
                  <span class="text-gray-400">Words:</span>
                  <span class="ml-1">{{ localCardData.transcription.metadata.totalWords }}</span>
                </div>
                <div class="bg-gray-800 p-2 rounded">
                  <span class="text-gray-400">Speakers:</span>
                  <span class="ml-1">{{ localCardData.transcription.metadata.speakerCount }}</span>
                </div>
              </div>

              <!-- Speakers List -->
              <div class="space-y-2">
                <div class="text-xs text-gray-400 font-medium">Speakers</div>
                <div 
                  v-for="speaker in localCardData.transcription.speakers" 
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
                :disabled="isProcessing || !localCardData.currentFile"
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
    const { validateFile, transcribeFile } = useTranscripts();
    
    const fileInput = Vue.ref(null);
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.computed(() => 
      ['uploading', 'transcribing'].includes(localCardData.value.status)
    );

    // Initialize card data
    const initializeCardData = (data) => ({
      uuid: data.uuid,
      name: data.name || "Transcribe Card",
      description: data.description || "Audio/Video Transcription",
      display: data.display || "default",
      x: data.x || 0,
      y: data.y || 0,
      currentFile: data.currentFile || null,
      status: data.status || 'idle', // idle, uploading, transcribing, complete, error
      progress: data.progress || 0,
      error: data.error || null,
      transcription: data.transcription || null,
      sockets: {
        inputs: [
          createSocket({
            type: 'input',
            index: 0,
            existingId: data.sockets?.inputs?.[0]?.id,
            value: data.sockets?.inputs?.[0]?.value
          })
        ],
        outputs: data.transcription ? createTranscriptionSockets(data.transcription) : []
      }
    });

    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Socket management
    const getSocketConnections = (socketId) => connections.value.has(socketId);

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, { element: event.element, cleanup: [] });
    };

    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Create or update sockets for transcription results
    const createTranscriptionSockets = (transcription, existingSockets = []) => {
      const sockets = [];
      
      // Full transcript socket
      const existingTranscriptSocket = existingSockets[0];
      sockets.push({
        ...createSocket({
          type: 'output',
          index: 0,
          existingId: existingTranscriptSocket?.id,
          value: JSON.stringify({
            metadata: transcription.metadata,
            segments: transcription.segments
          })
        }),
        name: 'Entire Transcript'
      });

      // Speaker sockets
      transcription.speakers.forEach((speaker, index) => {
        const speakerSegments = transcription.segments.filter(
          seg => seg.speaker === speaker.id
        );
        
        // Find existing socket for this speaker
        const existingSpeakerSocket = existingSockets.find(s => 
          s.value?.speaker?.id === speaker.id
        );

        sockets.push({
          ...createSocket({
            type: 'output',
            index: index + 1,
            existingId: existingSpeakerSocket?.id,
            value: JSON.stringify({
              speaker: speaker,
              segments: speakerSegments
            })
          }),
          name: speaker.displayName || `Speaker ${speaker.id}`
        });
      });

      return sockets;
    };

    // File handling
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
        localCardData.value.error = errors.join('. ');
        localCardData.value.status = 'error';
        return;
      }

      localCardData.value.currentFile = file;
      localCardData.value.status = 'idle';
      localCardData.value.error = null;
      localCardData.value.progress = 0;
      handleCardUpdate();

      // Automatically start transcription
      await startTranscription();
    };

    const resetFile = () => {
      if (isProcessing.value) return;

      // Reset all state
      localCardData.value.currentFile = null;
      localCardData.value.status = 'idle';
      localCardData.value.error = null;
      localCardData.value.progress = 0;
      localCardData.value.transcription = null;

      // Reset sockets to initial state
      const oldSockets = [...localCardData.value.sockets.outputs];
      localCardData.value.sockets.outputs = [];

      // Emit socket removal event
      emit('sockets-updated', createSocketUpdateEvent({
        cardId: localCardData.value.uuid,
        oldSockets,
        newSockets: [],
        reindexMap: new Map(),
        deletedSocketIds: oldSockets.map(s => s.id),
        type: 'output'
      }));

      handleCardUpdate();
      
      // Trigger file input to select new file
      Vue.nextTick(() => {
        triggerFileInput({ stopPropagation: () => {} });
      });
    };

    // Transcription
    const startTranscription = async () => {
      if (!localCardData.value.currentFile || isProcessing.value) return;

      localCardData.value.status = 'uploading';
      localCardData.value.progress = 0;
      localCardData.value.error = null;

      try {
        const result = await transcribeFile(
          localCardData.value.currentFile,
          (progress) => {
            localCardData.value.progress = progress;
          }
        );

        if (result.success) {
          localCardData.value.transcription = result.data;
          localCardData.value.status = 'complete';

          // Update sockets
          const oldSockets = [...localCardData.value.sockets.outputs];
          const newSockets = createTranscriptionSockets(result.data, oldSockets);

          const { reindexMap, reindexedSockets } = updateSocketArray({
            oldSockets,
            newSockets,
            type: 'output',
            deletedSocketIds: [],
            socketRegistry,
            connections: connections.value
          });

          localCardData.value.sockets.outputs = reindexedSockets;

          emit('sockets-updated', createSocketUpdateEvent({
            cardId: localCardData.value.uuid,
            oldSockets,
            newSockets: reindexedSockets,
            reindexMap,
            deletedSocketIds: oldSockets.map(s => s.id),
            type: 'output'
          }));
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        localCardData.value.error = error.message;
        localCardData.value.status = 'error';
      }

      handleCardUpdate();
    };

    // Speaker management
    const handleSpeakerNameUpdate = (speaker) => {
      // Update speaker name in transcription data
      const oldSockets = [...localCardData.value.sockets.outputs];
      const socketIndex = oldSockets.findIndex(
        s => s.value && JSON.parse(s.value).speaker?.id === speaker.id
      );
      
      if (socketIndex !== -1) {
        // Create new sockets array with updated name
        const newSockets = [...oldSockets];
        const socketData = JSON.parse(newSockets[socketIndex].value);
        socketData.speaker.displayName = speaker.displayName;
        
        newSockets[socketIndex] = {
          ...oldSockets[socketIndex],
          name: speaker.displayName,
          value: JSON.stringify(socketData)
        };
        
        // Update socket array with proper remapping
        const { reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: 'output',
          deletedSocketIds: [],
          socketRegistry,
          connections: connections.value
        });

        // Update the sockets
        localCardData.value.sockets.outputs = reindexedSockets;

        // Emit socket update event
        emit('sockets-updated', createSocketUpdateEvent({
          cardId: localCardData.value.uuid,
          oldSockets,
          newSockets: reindexedSockets,
          reindexMap: new Map(),
          deletedSocketIds: [],
          type: 'output'
        }));

        // Update transcription data
        const speakerInTranscript = localCardData.value.transcription.speakers.find(
          s => s.id === speaker.id
        );
        if (speakerInTranscript) {
          speakerInTranscript.displayName = speaker.displayName;
        }
      }
      handleCardUpdate();
    };

    // UI helpers
    const formatDuration = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const buttonClass = Vue.computed(() => {
      if (isProcessing.value) {
        return 'bg-orange-500 hover:bg-orange-600';
      }
      return localCardData.value.status === 'complete' 
        ? 'bg-green-500 hover:bg-green-600'
        : 'bg-blue-500 hover:bg-blue-600';
    });

    const buttonText = Vue.computed(() => {
      switch (localCardData.value.status) {
        case 'uploading': return 'Uploading...';
        case 'transcribing': return 'Transcribing...';
        case 'complete': return 'Transcribe Again';
        case 'error': return 'Retry Transcription';
        default: return 'Start Transcription';
      }
    });

    const triggerFileInput = () => {
      fileInput.value?.click();
    };

    // Watch for input trigger changes
    Vue.watch(
      () => localCardData.value.sockets.inputs[0].value,
      async (newValue) => {
        if (newValue && localCardData.value.currentFile) {
          await startTranscription();
        }
      }
    );

    // Watch for card data changes
    Vue.watch(() => props.cardData, (newData) => {
      if (!newData || isProcessing.value) return;

      // Only update specific properties to avoid loops
      if (newData.x !== undefined) localCardData.value.x = newData.x;
      if (newData.y !== undefined) localCardData.value.y = newData.y;
      
      // Deep compare transcription data if needed
      if (newData.transcription && 
          JSON.stringify(newData.transcription) !== JSON.stringify(localCardData.value.transcription)) {
        localCardData.value.transcription = newData.transcription;
      }
    }, { deep: true });

    // Cleanup
    Vue.onUnmounted(() => {
      socketRegistry.forEach(socket => socket.cleanup.forEach(cleanup => cleanup()));
      socketRegistry.clear();
      connections.value.clear();
    });

    const handleCardUpdate = () => {
      emit('update-card', Vue.toRaw(localCardData.value));
    };

    return {
      // Refs
      fileInput,
      localCardData,
      isProcessing,

      // Methods
      getSocketConnections,
      handleSocketMount,
      emitWithCardId,
      handleFileSelect,
      handleFileDrop,
      handleSpeakerNameUpdate,
      triggerFileInput,
      startTranscription,
      resetFile,
      handleCardUpdate,
      formatDuration,

      // Computed
      buttonClass,
      buttonText
    };
  }
};