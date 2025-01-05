// SocketEditor.js
export default {
  name: "SocketEditor",

  props: {
    modelValue: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      required: true,
      validator: (value) => ["system", "user"].includes(value),
    },
    placeholder: {
      type: String,
      default: "Enter prompt...",
    },
    existingSockets: {
      type: Array,
      default: () => [],
    },
  },

   template: `
  <div class="relative flex flex-col">
    <div
      ref="editor"
      class="socket-editor"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="handleInput"
      @keydown.stop="handleKeyDown"
      @keyup.stop="handleKeyUp"
      @mousedown.stop="handleMouseDown"
      @mousemove.stop="handleMouseMove"
      @mouseup.stop="handleMouseUp"
      @paste.stop="handlePaste"
      @copy.stop="handleCopy"
      @cut.stop="handleCut"
      @focus="handleEditorFocus"
      @blur="handleEditorBlur"
      @dragstart="handleDragStart"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @dragend="handleDragEnd"
      
      @click.stop="updateLastCursorPosition"
      @wheel.stop="handleWheel"
      spellcheck="false"
    ></div>
   <div class="socket-input-container">
<input 
  ref="inputRef"  
  type="text"
  v-model="newSocketName"
  placeholder="Enter socket name"
  @keyup.enter="addSocketAtCursor"
  @blur="handleInputBlur"
  @mousedown.stop.prevent="handleInputMouseDown"  
  class="socket-editor-input"   
/>
  <button 
    @click.stop="addSocketAtCursor"
  >
    Add
  </button>
</div>

  </div>
`,

  emits: ["update:modelValue", "socket-update", "blur", "html-update"],

  setup(props, { emit }) {
    const editor = Vue.ref(null);
    const newSocketName = Vue.ref(null);
    const lastCursorPosition = Vue.ref(null);
    const lastText = Vue.ref(props.modelValue || "");
    const socketIdMap = Vue.reactive(new Map());
    let isProcessing = false;

    const generateSocketId = () => {
      return `socket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    };

    const getOrCreateSocketId = (socketName, forceNew = false) => {
      const key = `${props.type}:${socketName}`;

      if (!forceNew && socketIdMap.has(key)) {
        return socketIdMap.get(key);
      }

      if (!forceNew) {
        const existing = props.existingSockets.find(
          (s) => s.name === socketName && s.source === props.type
        );
        if (existing) {
          socketIdMap.set(key, existing.id);
          return existing.id;
        }
      }

      const newId = generateSocketId();
      socketIdMap.set(key, newId);
      return newId;
    };

    // Save cursor position
    const updateLastCursorPosition = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        // Only proceed if the selection is within this editor
        const range = selection.getRangeAt(0);
        if (!editor.value?.contains(range.commonAncestorContainer)) return;
    
        // Always store just the range
        lastCursorPosition.value = range.cloneRange();
    };


    const insertCursorIndicator = () => {
        // Check if we have a valid selection in this specific editor
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        // Verify the selection is within this editor instance
        if (!editor.value?.contains(range.commonAncestorContainer)) return;
        
        // Remove any existing indicators in this editor
        removeCursorIndicator();
        
        const indicator = document.createElement('span');
        indicator.className = 'cursor-indicator';
        indicator.setAttribute('data-cursor-placeholder', 'true');
        
        // Insert the indicator at the cursor position
        range.insertNode(indicator);
        
        // Save both the position and the indicator reference
        lastCursorPosition.value = {
            range: range.cloneRange(),
            indicator: indicator,
            editorId: editor.value.id || Date.now() // Track which editor this belongs to
        };
    };

      
      const removeCursorIndicator = () => {
        const existingIndicator = editor.value?.querySelector('.cursor-indicator');
        if (existingIndicator) {
          existingIndicator.remove();
        }
      };
      
      
      const handleEditorFocus = () => {
        removeCursorIndicator();
      };

    // Add socket at cursor
    
// Modify addSocketAtCursor
const addSocketAtCursor = () => {
    const socketName = newSocketName?.value?.trim();
    if (!socketName) return;

    // Create socket tag and convert to HTML
    const socketTag = `<socket name="${socketName}"/>`;
    const socketHtml = textToHtml(socketTag);

    let range;
    const indicator = editor.value?.querySelector('.cursor-indicator');
    
    if (indicator) {
        // When we have an indicator, insert at that position
        range = document.createRange();
        range.setStartBefore(indicator);
        range.setEndBefore(indicator);
        indicator.remove();
    } else {
        // If no indicator, try to get stored range or default to end
        range = document.createRange();
        range.selectNodeContents(editor.value);
        range.collapse(false);
    }

    // Insert the socket tag
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = socketHtml;
    
    editor.value.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    while (tempDiv.firstChild) {
        range.insertNode(tempDiv.firstChild);
    }

    // Clear input and update state
    newSocketName.value = "";
    handleInput({ target: editor.value });
};

      
      const updateSocketSelection = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
      
        const range = selection.getRangeAt(0);
        
        // Clear existing selections first
        editor.value.querySelectorAll(".socket-tag.selected").forEach((tag) => {
          tag.classList.remove("selected");
        });
      
        // Only process selection if there's actually a selection (not just a cursor)
        if (!selection.isCollapsed) {
          // Find all tags in editor
          const tags = Array.from(editor.value.querySelectorAll(".socket-tag"));
      
          // Check each tag against selection
          tags.forEach((tag) => {
            const tagRange = document.createRange();
            tagRange.selectNode(tag);
            
            // Only select if the selection actually contains or intersects the tag
            const isSelected = 
              range.compareBoundaryPoints(Range.START_TO_END, tagRange) > 0 &&
              range.compareBoundaryPoints(Range.END_TO_START, tagRange) < 0;
      
            if (isSelected) {
              tag.classList.add("selected");
            }
          });
        }
      
        updateLastCursorPosition();
      };

    // Handle editor blur

    const handleEditorBlur = (event) => {
        // Always insert cursor indicator on blur, regardless of where focus is going
        insertCursorIndicator();
        emit("blur");
    };

    // const handleEditorBlur = (event) => {
    //     const relatedTarget = event.relatedTarget;
    //     if (
    //       !relatedTarget ||
    //       (!relatedTarget.classList.contains("p-inputtext") &&
    //         !relatedTarget.classList.contains("p-button"))
    //     ) {
    //       insertCursorIndicator();
    //     }
    //     emit("blur");
    //   };

    // Handle input blur
    const handleInputBlur = (event) => {
      // Don't clear cursor position if we're clicking the button
      const relatedTarget = event.relatedTarget;
      if (!relatedTarget || !relatedTarget.classList.contains("p-button")) {
        lastCursorPosition.value = null;
      }
    };

    const handleInputFocus = (event) => {
        event.preventDefault();
        event.stopPropagation();
       
    };

    const handleInputMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.target.focus();  // Explicitly focus
        // Double ensure focus in case of race conditions
        setTimeout(() => {
            event.target.focus();
        }, 0);
    };


    // Add mouseup and keyup handlers for selection changes
    const handleSelectionChange = (event) => {
      updateSocketSelection();
    };


// Helper function to ensure HTML is cleaned properly
const cleanHtml = (html) => {
    return html
      .replace(/<div><br><\/div>/g, '<br>') // Replace div breaks with br
      .replace(/<div>/g, '<br>') // Replace divs with br
      .replace(/<\/div>/g, '') // Remove closing divs
      .replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>') // Normalize multiple breaks
      .replace(/^\s*<br\s*\/?>\s*/g, '') // Remove leading breaks
      .trim();
  };
  const textToHtml = (text) => {
    if (!text) return "";
  
    const unescaped = text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  
    return cleanHtml(unescaped.replace(
      /<socket\s+name\s*=\s*"([^"]+)"\s*\/>/g,
      (match, socketName) => {
        const socketId = getOrCreateSocketId(socketName, false);
        // Add a space wrapper that preserves whitespace
        return `<span 
          class="socket-tag"
          contenteditable="false"
          data-socket-id="${socketId}"
          data-socket-name="${socketName}"
        >[${socketName}]</span>`;
      }
    )).replace(/\s+/g, ' '); // Normalize spaces but preserve them
  };


    // Updated htmlToText to clean up the content
    const htmlToText = (html) => {
      const temp = document.createElement("div");
      temp.innerHTML = cleanHtml(html);

      temp.querySelectorAll(".socket-tag").forEach((span) => {
        const socketName = span.getAttribute("data-socket-name");
        const socketTag = document.createTextNode(
          `<socket name="${socketName}"/>`
        );
        span.replaceWith(socketTag);
      });

      return temp.innerHTML
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/<br\s*\/?>/g, "\\n")
        .replace(/\\n/g, "\n"); // Normalize line breaks
    };

    const handleInput = async (event) => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        const currentContent = editor.value.innerHTML
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&nbsp;/g, " ");

        if (
          currentContent.includes("<socket") &&
          currentContent.includes("/>")
        ) {
          const socketTagPattern = /<socket\s+name\s*=\s*"([^"]+)"\s*\/>/g;
          let newContent = currentContent;
          let lastCreatedId = null;
          let hasChanges = false;

          // Log initial state
          console.log("Processing new socket tags. Current content:", {
            raw: currentContent,
            length: currentContent.length,
          });

          const selection = window.getSelection();
          const range =
            selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
          const cursorOffset = range ? range.startOffset : 0;
          const cursorNode = range ? range.startContainer : null;

          let match;
          let tagCount = 0;
          while ((match = socketTagPattern.exec(currentContent)) !== null) {
            tagCount++;
            const [fullMatch, socketName] = match;
            const socketId = getOrCreateSocketId(socketName, false);
            lastCreatedId = socketId;

            const replacement = `<span 
                  class="socket-tag"
                  contenteditable="false"
                  draggable="true"
                  data-socket-id="${socketId}"
                  data-socket-name="${socketName}"
                >[${socketName}]</span>`;

            newContent = newContent.replace(fullMatch, replacement);
            hasChanges = true;

            // Log each tag creation
            console.log(`Created socket tag #${tagCount}:`, {
              match: fullMatch,
              name: socketName,
              id: socketId,
              replacement: replacement,
            });
          }

          if (hasChanges && lastCreatedId) {
            editor.value.innerHTML = newContent;

            // Log the updated content
            console.log("Editor content after updates:", {
              html: editor.value.innerHTML,
              socketCount: tagCount,
              lastCreatedId,
            });

            await Vue.nextTick();
            const newTag = editor.value.querySelector(
              `[data-socket-id="${lastCreatedId}"]`
            );

            if (newTag) {
              const selection = window.getSelection();
              const range = document.createRange();
              let nextNode = newTag.nextSibling;

              if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
                range.setStart(nextNode, 0);
              } else {
                nextNode = document.createTextNode("");
                newTag.parentNode.insertBefore(nextNode, newTag.nextSibling);
                range.setStart(nextNode, 0);
              }

              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);

              // Log cursor position
              console.log("Cursor position updated:", {
                nextNode: nextNode?.nodeType,
                rangeStart: range.startOffset,
              });
            }
          }
        }

        const updatedText = htmlToText(editor.value.innerHTML);

        if (updatedText !== lastText.value) {
          lastText.value = updatedText;
          emit("update:modelValue", updatedText);
          emit("html-update", editor.value.innerHTML);

          const sockets = Array.from(
            editor.value.querySelectorAll(".socket-tag")
          ).map((tag) => ({
            id: tag.dataset.socketId,
            name: tag.dataset.socketName,
            type: props.type,
            source: props.type,
          }));

          emit("socket-update", {
            type: props.type,
            sockets: sockets,
          });

        // Debugging: Log final state
        //   console.log("Final editor state:", {
        //     text: updatedText,
        //     socketCount: sockets.length,
        //     sockets: sockets,
        //   });
        }

        await Vue.nextTick();
        ensureCursorVisible();
      } finally {
        isProcessing = false;
      }
    };

    const handleKeyDown = (event) => {
      event.stopPropagation();

      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "z" || event.key === "y")
      ) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        document.execCommand("insertLineBreak");
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const socketTag =
          range.startContainer.parentElement?.closest(".socket-tag") ||
          range.endContainer.parentElement?.closest(".socket-tag");

        if (socketTag) {
          event.preventDefault();
          socketTag.remove();
          handleInput({ target: editor.value });
        }
      }
    };

    // Update copy handler to remove selection after copy
    const handleCopy = (event) => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const container = document.createElement("div");
      container.appendChild(range.cloneContents());

      // Convert the content to a format that preserves structure
      const socketTags = Array.from(container.querySelectorAll(".socket-tag"));
      const content = htmlToText(container.innerHTML);

      event.preventDefault();

      // Store both the content and metadata
      event.clipboardData.setData("text/plain", content);
      event.clipboardData.setData(
        "application/x-socket",
        JSON.stringify({
          operation: "copy",
          content: content,
          tags: socketTags.map((tag) => ({
            name: tag.dataset.socketName,
            id: tag.dataset.socketId,
          })),
        })
      );

      // Remove selection styling after a brief delay
      setTimeout(() => {
        editor.value.querySelectorAll(".socket-tag.selected").forEach((tag) => {
          tag.classList.remove("selected");
        });
      }, 200);
    };

    const handleCut = (event) => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const container = document.createElement("div");
      container.appendChild(range.cloneContents());

      // Convert the content to a format that preserves structure
      const socketTags = Array.from(container.querySelectorAll(".socket-tag"));
      const content = htmlToText(container.innerHTML);

      event.preventDefault();

      // Store both the content and metadata
      event.clipboardData.setData("text/plain", content);
      event.clipboardData.setData(
        "application/x-socket",
        JSON.stringify({
          operation: "cut",
          content: content,
          tags: socketTags.map((tag) => ({
            name: tag.dataset.socketName,
            id: tag.dataset.socketId,
          })),
        })
      );

      // Remove the original selection
      range.deleteContents();
      handleInput({ target: editor.value });
    };

    const handlePaste = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const text = event.clipboardData.getData("text/plain");
      const socketData = event.clipboardData.getData("application/x-socket");

      try {
        const data = JSON.parse(socketData);
        const isFromCut = data.operation === "cut";
        const content = data.content || text;

        // Process socket tags while maintaining structure
        const processedContent = content.replace(
          /<socket\s+name\s*=\s*"([^"]+)"\s*\/>/g,
          (match, socketName) => {
            const originalTag = data.tags?.find(
              (tag) => tag.name === socketName
            );
            const socketId =
              isFromCut && originalTag
                ? getOrCreateSocketId(socketName, false)
                : getOrCreateSocketId(socketName, true);
            return `<socket name="${socketName}"/>`;
          }
        );

        // Insert at cursor position
        const selection = window.getSelection();
        if (selection.rangeCount) {
          const range = selection.getRangeAt(0);
          range.deleteContents();

          // Use textToHtml to properly render the content
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = textToHtml(processedContent);

          // Convert nodes to array and reverse to maintain correct order when inserting
          const nodes = Array.from(tempDiv.childNodes);
          nodes.reverse().forEach((node) => {
            range.insertNode(node);
          });

          // Move cursor to end of inserted content
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (e) {
        // Fallback for regular paste
        const selection = window.getSelection();
        if (selection.rangeCount) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      handleInput({ target: editor.value });
    };

    // Only prevent drag if it's a socket tag
    const handleDragStart = (event) => {
      const socketTag = event.target.closest(".socket-tag");
      if (socketTag) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Keep these handlers minimal to allow normal text selection
    const handleDragOver = (event) => {
      // Only prevent default to allow dropping
      event.preventDefault();
    };

    const handleDrop = (event) => {
      // Only handle drops if they're text content
      const socketTag = event.target.closest(".socket-tag");
      if (socketTag) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Allow normal text drops
      const text = event.dataTransfer.getData("text/plain");
      if (text) {
        event.preventDefault();
        const range = document.caretRangeFromPoint(
          event.clientX,
          event.clientY
        );
        if (range) {
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
          handleInput({ target: editor.value });
        }
      }
    };

    const handleDragEnd = (event) => {
      const socketTag = event.target.closest(".socket-tag");
      if (socketTag) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleKeyUp = (event) => {
      event.stopPropagation();
      updateSocketSelection();
      ensureCursorVisible();
    };

    const handleMouseDown = (event) => {
      event.stopPropagation();
      editor.value?.focus();
    };

    const handleMouseMove = (event) => {
      event.stopPropagation();
    };

    const handleMouseUp = (event) => {
      event.stopPropagation();
      updateSocketSelection();
    };

    const handleBlur = () => {
      emit("blur");
    };

    const ensureCursorVisible = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editor.value.getBoundingClientRect();

      if (rect.bottom > editorRect.bottom) {
        editor.value.scrollTop += rect.bottom - editorRect.bottom + 20;
      } else if (rect.top < editorRect.top) {
        editor.value.scrollTop -= editorRect.top - rect.top + 20;
      }
    };

    const handleWheel = (event) => {
        // Always stop propagation to prevent zoom
        event.stopPropagation();
        
        // Only do the scroll if we're actually over the scrollable area
        if (editor.value.scrollHeight > editor.value.clientHeight) {
            // Use a consistent, fast scroll speed
            const scrollSpeed = 10;
            editor.value.scrollTop += Math.sign(event.deltaY) * scrollSpeed;
            
            // Prevent the default behavior which could trigger the zoom
            event.preventDefault();
        }
    };

    Vue.onMounted(() => {
      editor.value.innerHTML = textToHtml(props.modelValue);
      lastText.value = props.modelValue;

      props.existingSockets.forEach((s) => {
        if (s.source === props.type) {
          const key = `${props.type}:${s.name}`;
          socketIdMap.set(key, s.id);
        }
      });

      // Add document-level selection change listener
      document.addEventListener("selectionchange", handleSelectionChange);

      //
      handleInput()
    });

    Vue.onUnmounted(() => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    });

    Vue.watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue === lastText.value) return;

        const selection = window.getSelection();
        const range = selection?.rangeCount
          ? selection.getRangeAt(0).cloneRange()
          : null;

        editor.value.innerHTML = textToHtml(newValue);
        lastText.value = newValue;

        if (range) {
          Vue.nextTick(() => {
            selection.removeAllRanges();
            selection.addRange(range);
            ensureCursorVisible();
          });
        }
      }
    );

    return {
      editor,

      handleInput,
      handleKeyDown,
      handleKeyUp,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handlePaste,
      handleCopy,
      handleCut,
      handleBlur,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      newSocketName,
      handleEditorFocus,
      handleEditorBlur,
      handleInputBlur,
      handleInputFocus,
      handleInputMouseDown,
      addSocketAtCursor,
      updateLastCursorPosition,

      handleWheel
        
    };
  },
};
