// OutputCard.js
import BaseCard from "./BaseCard.js";
import BaseSocket from "./BaseSocket.js";

import {
  updateSocketArray,
  createSocketUpdateEvent,
  createSocket,
  generateSocketId,
} from "../utils/socketManagement/socketRemapping.js";

export default {
  name: "OutputCard",
  components: { BaseCard, BaseSocket },
  props: {
    cardData: { type: Object, required: true },
    zoomLevel: { type: Number, default: 1 },
    zIndex: { type: Number, default: 1 },
    isSelected: { type: Boolean, default: false },
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
      @clone-card="uuid => $emit('clone-card', uuid )"
      @select-card="$emit('select-card', $event)"
    >
      <!-- Input Sockets -->
      <div class="absolute -left-[12px] flex flex-col gap-1" style="top: 16px;">
        <div 
          v-for="(socket, index) in localCardData.sockets.inputs"
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

      <!-- Output Socket -->
      <div 
        v-if="localCardData.sockets.outputs?.[0]"
        class="absolute -right-[12px]" 
        style="top: 16px;"
      >
        <BaseSocket
          type="output"
          :socket-id="localCardData.sockets.outputs[0].id"
          :card-id="localCardData.uuid"
          :name="localCardData.sockets.outputs[0].name"
          :value="localCardData.sockets.outputs[0].value"
          :is-connected="getSocketConnections(localCardData.sockets.outputs[0].id)"
          :has-error="hasSocketError(localCardData.sockets.outputs[0])"
          :zoom-level="zoomLevel"
          @connection-drag-start="emitWithCardId('connection-drag-start', $event)"
          @connection-drag="$emit('connection-drag', $event)"
          @connection-drag-end="$emit('connection-drag-end', $event)"
          @socket-mounted="handleSocketMount($event)"
        />
      </div>

      <!-- Content -->
      <div class="space-y-2 text-gray-300" v-show = "localCardData.display == 'default'">
        <div class="mt-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-xs font-medium text-gray-400">Save Input as:</label>
            <button 
              class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
              @click="addInput"
            >+ Add</button>
          </div>
          
          <div class="space-y-2">
            <div 
              v-for="(output, index) in localCardData.outputs" 
              :key="output.id || index"
              class="flex items-center gap-2 bg-gray-900 p-2 rounded"
            >
              <span class="text-xs text-gray-400 w-6">{{ index + 1 }}.</span>
              <select
                v-model="output.type"
                class="flex-1 bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded cursor-pointer"
                @mousedown.stop
                @change="updateOutputType(index, $event)"
              >
                <option v-for="type in outputTypes" :key="type" :value="type">
                  {{ type.toUpperCase() }}
                </option>
              </select>

              <button 
                class="text-gray-400 hover:text-gray-200"
                @click.stop="processFileDownload(index)"
                @mousedown.stop
                @touchstart.stop
              > <i class="pi pi-download text-xs"></i></button>

              <button 
                class="text-gray-400 hover:text-gray-200"
                @click.stop="removeInput(index)"
                @mousedown.stop
                @touchstart.stop
              >×</button>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-right">
          <!--
            <label class="flex items-center gap-2">
              <input 
                type="checkbox"
                v-model="localCardData.autoDownload"
                @change="handleCardUpdate"
                class="form-checkbox"
              />
              <span class="text-xs text-gray-400">Auto Download</span>
            </label>
            -->
            <button v-if = "localCardData?.outputs?.length > 1"
              class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
              @click.stop="processFileDownload(null)"
            >Download All</button>
          </div>
        </div>
      </div>
    </BaseCard>
    </div>
  `,

  setup(props, { emit }) {
    // Constants
    const outputTypes = ["markdown", "docx", "pdf", "json", "txt", "js", "html"];
    const socketRegistry = new Map();
    const connections = Vue.ref(new Set());
    const isProcessing = Vue.ref(false);

    // Initialize card data with proper socket structure
    const initializeCardData = (data) => {
      const baseData = {
        uuid: data.uuid,
        name: data.name || "Output",
        description: data.description || "Output Node",
        display: data.display || "default",
        x: data.x || 0,
        y: data.y || 0,
        outputs: data.outputs || [{ type: "markdown", id: generateSocketId() }],
        autoDownload: data.autoDownload || false,
        sockets: {
          inputs: [],
          outputs: [
            createSocket({
              type: "output",
              index: 0,
              existingId: data.sockets?.outputs?.[0]?.id,
            }),
          ],
        },
      };

      // Initialize input sockets
      if (data.sockets?.inputs?.length) {
        baseData.sockets.inputs = data.sockets.inputs.map((socket, index) =>
          createSocket({
            type: "input",
            index,
            existingId: socket.id,
            value: socket.value,
          })
        );
      } else {
        baseData.sockets.inputs = baseData.outputs.map((_, index) =>
          createSocket({
            type: "input",
            index,
          })
        );
      }

      return baseData;
    };

    // Initialize local state
    const localCardData = Vue.ref(initializeCardData(props.cardData));

    // Socket connection tracking
    const getSocketConnections = (socketId) => connections.value.has(socketId);

    const hasSocketError = (socket) => false;

    const handleSocketMount = (event) => {
      if (!event) return;
      socketRegistry.set(event.socketId, {
        element: event.element,
        cleanup: [],
      });
    };

    // Helper to emit events with card ID
    const emitWithCardId = (eventName, event) => {
      emit(eventName, { ...event, cardId: localCardData.value.uuid });
    };

    // Add new input
    const addInput = () => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.inputs];
        const newSocket = createSocket({
          type: "input",
          index: localCardData.value.outputs.length,
        });

        localCardData.value.outputs.push({
          type: "markdown",
          id: generateSocketId(),
        });

        const newSockets = [...oldSockets, newSocket];

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          socketRegistry,
          connections: connections.value,
        });

        localCardData.value.sockets.inputs = reindexedSockets;

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

    // Remove input
    const removeInput = (index) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        const oldSockets = [...localCardData.value.sockets.inputs];
        const deletedSocket = oldSockets[index];
        const deletedSocketIds = deletedSocket ? [deletedSocket.id] : [];

        localCardData.value.outputs.splice(index, 1);
        const newSockets = oldSockets.filter((_, i) => i !== index);

        const { reindexMap, reindexedSockets } = updateSocketArray({
          oldSockets,
          newSockets,
          type: "input",
          deletedSocketIds,
          socketRegistry,
          connections: connections.value,
        });

        localCardData.value.sockets.inputs = reindexedSockets;

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

    // Update output type
    const updateOutputType = (index, event) => {
      if (isProcessing.value) return;
      isProcessing.value = true;

      try {
        localCardData.value.outputs[index].type = event.target.value;
        if (localCardData.value.sockets.inputs[index]) {
          localCardData.value.sockets.inputs[index].momentUpdated = Date.now();
        }
        handleCardUpdate();
      } finally {
        isProcessing.value = false;
      }
    };

    // Handle card updates
    const handleCardUpdate = (data) => {
      if(data) localCardData.value = data; 
      if (!isProcessing.value) {
        emit("update-card", Vue.toRaw(localCardData.value));
      }
    };

 


// Helper function to convert HTML elements to docx elements with improved formatting
const convertHtmlToDocxElements = (html, filename) => {
  const elements = [];
  const lines = html.split("\n");

  lines.forEach((line) => {
    const cleanText = line.replace(/<[^>]*>/g, "").trim();
    if (!cleanText) return;

    if (line.startsWith("<h1>")) {
      elements.push(
        new docx.Paragraph({
          text: cleanText,
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          run: {
            font: "Calibri",
            size: 32,
          },
        })
      );
    } else if (line.startsWith("<h2>")) {
      elements.push(
        new docx.Paragraph({
          text: cleanText,
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          run: {
            font: "Calibri",
            size: 28,
          },
        })
      );
    } else {
      elements.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: cleanText,
              font: "Calibri",
              size: 24,
            }),
          ],
          spacing: { before: 120, after: 120, line: 360 },
        })
      );
    }
  });

  return elements;
};

// Function to create styled PDF content
const createStyledPdf = (pdf, content, filename) => {
  // Set default font and colors
  const colors = {
    header: '#1a1a1a',
    subheader: '#2d2d2d',
    text: '#333333',
    muted: '#808080'
  };

  const headerStyles = {
    h1: {
      fontSize: 24,
      spacing: 6,  // Significantly reduced from 12
      style: "bold"
    },
    h2: {
      fontSize: 20,
      spacing: 5,  // Significantly reduced from 10
      style: "bold"
    },
    h3: {
      fontSize: 16,
      spacing: 4,  // Significantly reduced from 8
      style: "bold"
    }
  };

  // Initialize PDF
  pdf.setFont("helvetica");
  
  // Add header
  pdf.setFontSize(12);
  pdf.setTextColor(128, 128, 128);
  pdf.text(filename, 15, 10);
  pdf.text("Generated by LogicStudio.ai", pdf.internal.pageSize.width - 65, 10);
  
  // Add horizontal line under header
  pdf.setDrawColor(200, 200, 200);
  pdf.line(15, 12, pdf.internal.pageSize.width - 15, 12);

  // Set up content styling
  let y = 25;
  const margins = {
    left: 15,
    right: 15,
    bottom: 20
  };
  const pageWidth = pdf.internal.pageSize.width;
  const contentWidth = pageWidth - margins.left - margins.right;
  const pageHeight = pdf.internal.pageSize.height;
  let lastLineWasHeader = false;

  // Function to handle header styling
  const renderHeader = (text, level) => {
    const style = headerStyles[level];
    // Add less space before header if previous line wasn't a header
    if (!lastLineWasHeader) {
      y += 3; // Minimal spacing before header
    }
    pdf.setFont("helvetica", style.style);
    pdf.setFontSize(style.fontSize);
    pdf.setTextColor(colors.header);
    const wrappedText = pdf.splitTextToSize(text, contentWidth);
    pdf.text(wrappedText, margins.left, y);
    lastLineWasHeader = true;
    return (wrappedText.length * (style.fontSize / 3)) + style.spacing; // Reduced multiplier
  };

  // Process each line with proper styling
  const lines = content.split('\n').filter(line => line.trim());
  
  lines.forEach((line) => {
    // Check if we need a new page
    if (y + 20 > pageHeight - margins.bottom) {
      pdf.addPage();
      y = 25;
      lastLineWasHeader = false;
      
      // Add header to new page
      pdf.setFontSize(12);
      pdf.setTextColor(colors.muted);
      pdf.text(filename, margins.left, 10);
      pdf.text("Generated by LogicStudio.ai", pageWidth - 65, 10);
      pdf.line(margins.left, 12, pageWidth - margins.right, 12);
    }

    // Style based on markdown syntax
    if (line.startsWith('# ')) {
      const text = line.replace('# ', '');
      y += renderHeader(text, 'h1');
    } 
    else if (line.startsWith('## ')) {
      const text = line.replace('## ', '');
      y += renderHeader(text, 'h2');
    }
    else if (line.startsWith('### ')) {
      const text = line.replace('### ', '');
      y += renderHeader(text, 'h3');
    }
    else if (line.startsWith('```')) {
      lastLineWasHeader = false;
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margins.left, y - 5, contentWidth, 2, 'F');
      pdf.setFont("courier", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(colors.text);
      y += 4;
    }
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      lastLineWasHeader = false;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(colors.text);
      const text = line.replace(/^[-*]\s/, '• ');
      const wrappedText = pdf.splitTextToSize(text, contentWidth - 10);
      pdf.text(wrappedText, margins.left + 5, y);
      y += (wrappedText.length * 5) + 2;
    }
    else {
      lastLineWasHeader = false;
      // Add minimal spacing after header if this is text following a header
      if (!lastLineWasHeader) {
        y += 2; // Minimal spacing before regular text
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(colors.text);
      const wrappedText = pdf.splitTextToSize(line, contentWidth);
      pdf.text(wrappedText, margins.left, y);
      y += (wrappedText.length * 5) + 2; // Reduced from 3
    }
  });

  // Add page numbers
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(colors.muted);
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }
};

// Unified download handling function
const processFileDownload = async (index = null) => {
  if (isProcessing.value) {
    console.warn('Download already in progress');
    return;
  }
  
  isProcessing.value = true;
  const timestamp = Date.now();

  // Validate inputs before processing
  const outputs = localCardData.value.outputs;
  if (!outputs || !outputs.length) {
    console.warn('No outputs configured');
    isProcessing.value = false;
    return;
  }

  try {
    const indices = index !== null ? [index] : [...Array(localCardData.value.outputs.length).keys()];
    
     
    // If only downloading one file, process it directly without zip
    if (indices.length === 1) {
      const idx = indices[0];
      const inputSocket = localCardData.value.sockets.inputs[idx];
      const outputType = localCardData.value.outputs[idx].type;
      const socketValue = inputSocket?.value;

      if (!socketValue) {
        console.warn("No content to download");
        return;
      }

      await createAndDownloadFile(socketValue, outputType, `File${idx + 1}_${timestamp}`);
      return;
    }

    // Multiple files - create zip
    const zip = new JSZip();
    const promises = [];

    for (const idx of indices) {
      const inputSocket = localCardData.value.sockets.inputs[idx];
      const outputType = localCardData.value.outputs[idx].type;
      const socketValue = inputSocket?.value;

      if (!socketValue) continue;

      const baseFilename = `File${idx + 1}_${timestamp}`;
      const filePromise = createFile(socketValue, outputType, baseFilename)
        .then(({ content, extension }) => {
          zip.file(`${baseFilename}.${extension}`, content);
        });
      
      promises.push(filePromise);
    }

    await Promise.all(promises);

    // Generate and download zip
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 9 }
    });

    downloadBlob(zipBlob, `AllFiles_${timestamp}.zip`);

  } catch (error) {
    console.error("Error processing download:", error);
  } finally {
    isProcessing.value = false;
  }
};

// Helper function to create file content
const createFile = async (socketValue, outputType, baseFilename) => {
  let content = extractContent(socketValue);
  
  switch (outputType) {
    case "markdown": {
      const markdownContent = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
      return {
        content: markdownContent,
        extension: 'md'
      };
    }

    case "txt": {
      const textContent = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
      return {
        content: textContent,
        extension: 'txt'
      };
    }

    case "js": {
      const textContent = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
      return {
        content: textContent,
        extension: 'js'
      };
    }

    case "html": {
      const textContent = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
      return {
        content: textContent,
        extension: 'html'
      };
    }


    case "json": {
      const jsonContent = typeof content === "object" ? content : { content };
      return {
        content: JSON.stringify(jsonContent, null, 2),
        extension: 'json'
      };
    }

    case "docx": {
      const markdownContent = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
      const md = markdownit();
      const htmlContent = md.render(markdownContent);

      const doc = new docx.Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
            type: docx.SectionType.CONTINUOUS,
          },
          headers: {
            default: new docx.Header({
              children: [
                new docx.Paragraph({
                  children: [
                    new docx.TextRun({
                      text: baseFilename,
                      font: "Calibri",
                      size: 20,
                    }),
                    new docx.TextRun({
                      text: "\t\tGenerated by LogicStudio.ai",
                      font: "Calibri",
                      size: 20,
                      color: "808080",
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new docx.Footer({
              children: [
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  children: [
                    new docx.TextRun({
                      children: ["Page ", docx.PageNumber.CURRENT, " of ", docx.PageNumber.TOTAL_PAGES],
                      font: "Calibri",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          },
          children: convertHtmlToDocxElements(htmlContent, baseFilename),
        }],
      });

      const blob = await docx.Packer.toBlob(doc);
      return {
        content: blob,
        extension: 'docx'
      };
    }

    case "pdf": {
      const markdownContent = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
      const md = markdownit();
      const htmlContent = md.render(markdownContent);
      
      const processedContent = htmlContent
        .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1')
        .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1')
        .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1')
        .replace(/<pre><code>(.*?)<\/code><\/pre>/gs, '```\n$1\n```')
        .replace(/<li[^>]*>(.*?)<\/li>/g, '• $1')
        .replace(/<p[^>]*>(.*?)<\/p>/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\n\s*\n/g, '\n\n');
      
      const pdf = new jspdf.jsPDF();
      createStyledPdf(pdf, processedContent, baseFilename);
      
      return {
        content: pdf.output('blob'),
        extension: 'pdf'
      };
    }

    default:
      throw new Error(`Unsupported file type: ${outputType}`);
  }
};

// Helper function to extract content from socket value
const extractContent = (socketValue) => {
  let content = typeof socketValue === "string" ? socketValue : 
                socketValue.content !== undefined ? socketValue.content : socketValue;

  // Try to parse JSON if it looks like JSON
  if (typeof content === "string" && (content.trim().startsWith("{") || content.trim().startsWith("["))) {
    try {
      content = JSON.parse(content);
    } catch (e) {
      console.log("Not valid JSON, keeping as string");
    }
  }

  return content;
};

// Helper function to download a blob
const downloadBlob = async (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  
  try {
    await new Promise(resolve => setTimeout(resolve, 100)); // Ensure browser has time to register the blob
    a.click();
  } finally {
    // Ensure cleanup happens even if download fails
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};

// Helper function to create and download a single file
const createAndDownloadFile = async (socketValue, outputType, baseFilename) => {
  const { content, extension } = await createFile(socketValue, outputType, baseFilename);
  const blob = content instanceof Blob ? content : new Blob([content], { 
    type: getContentType(outputType) 
  });
  downloadBlob(blob, `${baseFilename}.${extension}`);
};

// Helper function to get content type
const getContentType = (outputType) => {
  const contentTypes = {
    markdown: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf'
  };
  return contentTypes[outputType] || 'application/octet-stream';
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

          // Add this block to update socket values
          if (newData.sockets?.inputs) {
            newData.sockets.inputs.forEach((socket, index) => {
              if (localCardData.value.sockets.inputs[index]) {
                localCardData.value.sockets.inputs[index].value = socket.value;
              }
            });
          }

          // Update outputs and sockets
          if (
            newData.outputs !== undefined &&
            newData.outputs.length !== oldData?.outputs?.length
          ) {
            const oldSockets = [...localCardData.value.sockets.inputs];
            localCardData.value.outputs = [...newData.outputs];

            const newSockets = newData.outputs.map((_, index) =>
              createSocket({
                type: "input",
                index,
                existingId: oldSockets[index]?.id,
                value: oldSockets[index]?.value,
              })
            );

            const { reindexMap, reindexedSockets } = updateSocketArray({
              oldSockets,
              newSockets,
              type: "input",
              socketRegistry,
              connections: connections.value,
            });

            localCardData.value.sockets.inputs = reindexedSockets;

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
          }
        } finally {
          isProcessing.value = false;
        }
      },
      { deep: true }
    );

    // Cleanup on unmount
    Vue.onUnmounted(() => {
      socketRegistry.forEach((socket) =>
        socket.cleanup.forEach((cleanup) => cleanup())
      );
      socketRegistry.clear();
      connections.value.clear();
    });

    return {
      localCardData,
      outputTypes,
      getSocketConnections,
      hasSocketError,
      emitWithCardId,
      addInput,
      removeInput,
      handleCardUpdate,
      updateOutputType,
      handleSocketMount,
      processFileDownload

    };
  },
};
