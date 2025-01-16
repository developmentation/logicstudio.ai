// TextEditor.js
export default {
    name: "TextEditor",
  
    props: {
      modelValue: {
        type: String,
        default: "",
      },
      placeholder: {
        type: String,
        default: "Enter text...",
      },
      existingBreaks: {
        type: Array,
        default: () => [],
      },
    },
  
    template: `
    <div class="relative flex flex-col">
      <div
        ref="editor"
        class="text-editor"
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
      <div class="text-editor-input-container">
      <button 
          @click.stop="addBreakAtCursor"
        >
          Add
        </button>
        <input 
          ref="inputRef"  
          type="text"
          v-model="newBreakName"
          placeholder="Enter break name"
          @keyup.enter="addBreakAtCursor"
          @blur="handleInputBlur"
          @mousedown.stop.prevent="handleInputMouseDown"  
          class="text-editor-input"   
        />
        
      </div>
    </div>
    `,
  
    emits: ["update:modelValue", "break-update", "blur", "html-update", "segments-update"],
  
    setup(props, { emit }) {
      const editor = Vue.ref(null);
      const newBreakName = Vue.ref(null);
      const lastCursorPosition = Vue.ref(null);
      const lastText = Vue.ref(props.modelValue || "");
      const nextBreakNumber = Vue.ref(1);
      const breakIdMap = Vue.reactive(new Map());
      let isProcessing = false;
  
      const generateBreakId = () => {
        return `break-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      };
  
      const getOrCreateBreakId = (breakName, forceNew = false) => {
        if (!forceNew && breakIdMap.has(breakName)) {
          return breakIdMap.get(breakName);
        }
  
        if (!forceNew) {
          const existing = props.existingBreaks.find(b => b.name === breakName);
          if (existing) {
            breakIdMap.set(breakName, existing.id);
            return existing.id;
          }
        }
  
        const newId = generateBreakId();
        breakIdMap.set(breakName, newId);
        return newId;
      };
  
      const updateLastCursorPosition = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (!editor.value?.contains(range.commonAncestorContainer)) return;
    
        lastCursorPosition.value = range.cloneRange();
      };
  
      const insertCursorIndicator = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (!editor.value?.contains(range.commonAncestorContainer)) return;
        
        removeCursorIndicator();
        
        const indicator = document.createElement('span');
        indicator.className = 'cursor-indicator';
        indicator.setAttribute('data-cursor-placeholder', 'true');
        
        range.insertNode(indicator);
        
        lastCursorPosition.value = {
          range: range.cloneRange(),
          indicator: indicator,
          editorId: editor.value.id || Date.now()
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
  
      const addBreakAtCursor = () => {
        // Generate break name or use incremental number
        let breakName = newBreakName?.value?.trim() || "";
        if (!breakName.length) breakName = 'Break ' + nextBreakNumber.value++;
      
        // Create break tag HTML
        const breakTag = `<break name="${breakName}"/>`;
        const breakHtml = textToHtml(breakTag);
      
        let range;
        const indicator = editor.value?.querySelector('.cursor-indicator');
        
        if (indicator) {
          range = document.createRange();
          range.setStartBefore(indicator);
          range.setEndBefore(indicator);
          indicator.remove();
        } else {
          range = document.createRange();
          range.selectNodeContents(editor.value);
          range.collapse(false);
        }
      
        // Insert break tag
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = breakHtml;
        
        editor.value.focus();
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      
        // Insert the break tag
        const breakNode = tempDiv.firstChild;
        range.insertNode(breakNode);
      
        // Create a text node for cursor positioning
        const spaceNode = document.createTextNode('\u200B');
        
        // Create a new range after the break tag
        const newRange = document.createRange();
        newRange.setStartAfter(breakNode);
        newRange.setEndAfter(breakNode);
        
        // Insert the space node
        newRange.insertNode(spaceNode);
        
        // Position cursor after the space node
        newRange.setStartAfter(spaceNode);
        newRange.setEndAfter(spaceNode);
        
        // Update selection
        selection.removeAllRanges();
        selection.addRange(newRange);
      
        // Clear input
        newBreakName.value = "";
        
        // Ensure no tags are selected
        editor.value.querySelectorAll(".text-editor-tag.selected").forEach((tag) => {
          tag.classList.remove("selected");
        });
      
        // Update editor content
        handleInput({ target: editor.value });
        
        // Ensure focus and cursor visibility after content update
        Vue.nextTick(() => {
          editor.value.focus();
          const finalSelection = window.getSelection();
          if (finalSelection.rangeCount > 0) {
            const finalRange = finalSelection.getRangeAt(0);
            finalRange.collapse(true);
            finalSelection.removeAllRanges();
            finalSelection.addRange(finalRange);
          }
        });
      };
  
      const updateBreakSelection = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
      
        const range = selection.getRangeAt(0);
        
        editor.value.querySelectorAll(".text-editor-tag.selected").forEach((tag) => {
          tag.classList.remove("selected");
        });
      
        if (!selection.isCollapsed) {
          const tags = Array.from(editor.value.querySelectorAll(".text-editor-tag"));
      
          tags.forEach((tag) => {
            const tagRange = document.createRange();
            tagRange.selectNode(tag);
            
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
  
      const handleEditorBlur = (event) => {
        insertCursorIndicator();
        emit("blur");
      };
  
      const handleInputBlur = (event) => {
        const relatedTarget = event.relatedTarget;
        if (!relatedTarget || !relatedTarget.classList.contains("p-button")) {
          lastCursorPosition.value = null;
        }
      };
  
      const handleInputMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.target.focus();
        setTimeout(() => {
          event.target.focus();
        }, 0);
      };
  
      const cleanHtml = (html) => {
        return html
          .replace(/<div><br><\/div>/g, '<br>')
          .replace(/<div>/g, '<br>')
          .replace(/<\/div>/g, '')
          .replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>')
          .replace(/^\s*<br\s*\/?>\s*/g, '')
          .trim();
      };
  
      const textToHtml = (text) => {
        if (!text) return "";
      
        // First handle any existing break tags
        const unescaped = text
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&");
      
        // Convert newlines to div tags (which is how contenteditable handles them)
        const withNewlines = unescaped
          .split('\n')
          .map(line => `<div>${line}</div>`)
          .join('');
      
        // Handle break tags
        return withNewlines.replace(
          /<break\s+name\s*=\s*"([^"]+)"\s*\/>/g,
          (match, breakName) => {
            const breakId = getOrCreateBreakId(breakName, false);
            return `<span 
              class="text-editor-tag"
              contenteditable="false"
              data-socket-id="${breakId}"
              data-break-name="${breakName}"
            >[${breakName}]</span>`;
          }
        );
      };
      
      const htmlToText = (html) => {
        const temp = document.createElement("div");
        temp.innerHTML = html;
      
        // Replace break tags first
        temp.querySelectorAll(".text-editor-tag").forEach((span) => {
          const breakName = span.getAttribute("data-break-name");
          const breakTag = document.createTextNode(
            `<break name="${breakName}"/>`
          );
          span.replaceWith(breakTag);
        });
      
        // Extract text content, preserving newlines between divs
        const textContent = [];
        temp.childNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'DIV') {
            textContent.push(node.textContent);
          } else if (node.nodeType === Node.TEXT_NODE) {
            textContent.push(node.textContent);
          }
        });
      
        // Join with newlines and clean up any HTML entities
        return textContent
          .join('\n')
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .trim();
      };
  
  
      
    const parseTextSegments = (html) => {
        const temp = document.createElement("div");
        temp.innerHTML = cleanHtml(html);
        
        const segments = [];
        let currentText = "";
        let currentPosition = 0;
        
        const nodes = Array.from(temp.childNodes);
        
        for (const node of nodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            currentText += node.textContent;
          } else if (node.classList?.contains("text-editor-tag")) {
            // Push current segment if there's text before the break
            if (currentText.trim()) {
              segments.push({
                text: currentText.trim(),
                startPosition: currentPosition,
                endPosition: currentPosition + currentText.length,
                precedingBreak: null
              });
            }
            
            // Store break information for the next segment
            const breakInfo = {
              id: node.dataset.breakId,
              name: node.dataset.breakName
            };
            
            // Start new segment
            currentPosition += currentText.length + node.textContent.length;
            currentText = "";
            
            // Update preceding break for next segment
            if (segments.length > 0) {
              segments[segments.length - 1].followingBreak = breakInfo;
            }
            
            // Set this break as preceding break for next segment
            if (segments.length === 0) {
              // If this is the first break and there's no text before it,
              // create an empty first segment
              segments.push({
                text: "",
                startPosition: 0,
                endPosition: 0,
                precedingBreak: null,
                followingBreak: breakInfo
              });
            }
          }
        }
        
        // Push final segment if there's remaining text
        if (currentText.trim()) {
          segments.push({
            text: currentText.trim(),
            startPosition: currentPosition,
            endPosition: currentPosition + currentText.length,
            precedingBreak: segments.length > 0 ? segments[segments.length - 1].followingBreak : null,
            followingBreak: null
          });
        }
        
        return segments;
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
  
          if (currentContent.includes("<break") && currentContent.includes("/>")) {
            // ... Keep existing break tag processing ...
          }
  
          const updatedText = htmlToText(editor.value.innerHTML);
  
          if (updatedText !== lastText.value) {
            lastText.value = updatedText;
            emit("update:modelValue", updatedText);
            emit("html-update", editor.value.innerHTML);
  
            // Parse segments and emit them
            const segments = parseTextSegments(editor.value.innerHTML);
            emit("segments-update", segments);
  
            const breaks = Array.from(
              editor.value.querySelectorAll(".text-editor-tag")
            ).map((tag) => ({
              id: tag.dataset.breakId,
              name: tag.dataset.breakName
            }));
  
            emit("break-update", {
              breaks: breaks
            });
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
          const breakTag =
            range.startContainer.parentElement?.closest(".text-editor-tag") ||
            range.endContainer.parentElement?.closest(".text-editor-tag");
  
          if (breakTag) {
            event.preventDefault();
            breakTag.remove();
            handleInput({ target: editor.value });
          }
        }
      };
  
      const handleCopy = (event) => {
        event.stopPropagation();
      };
  
      const handleCut = (event) => {
        event.stopPropagation();
      };
  
      const handlePaste = (event) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      };
  
      const handleDragStart = (event) => {
        const breakTag = event.target.closest(".text-editor-tag");
        if (breakTag) {
          event.preventDefault();
          event.stopPropagation();
        }
      };
  
      const handleDragOver = (event) => {
        event.preventDefault();
      };
  
      const handleDrop = (event) => {
        const breakTag = event.target.closest(".text-editor-tag");
        if (breakTag) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
  
        const text = event.dataTransfer.getData("text/plain");
        if (text) {
          event.preventDefault();
          const range = document.caretRangeFromPoint(event.clientX, event.clientY);
          if (range) {
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            handleInput({ target: editor.value });
          }
        }
      };
  
      const handleDragEnd = (event) => {
        const breakTag = event.target.closest(".text-editor-tag");
        if (breakTag) {
          event.preventDefault();
          event.stopPropagation();
        }
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
        updateBreakSelection();
      };
  
      const handleKeyUp = (event) => {
        event.stopPropagation();
        updateBreakSelection();
        ensureCursorVisible();
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
        event.stopPropagation();
        
        if (editor.value.scrollHeight > editor.value.clientHeight) {
          const scrollSpeed = 10;
          editor.value.scrollTop += Math.sign(event.deltaY) * scrollSpeed;
          event.preventDefault();
        }
      };
  
      Vue.onMounted(() => {
        editor.value.innerHTML = textToHtml(props.modelValue);
        lastText.value = props.modelValue;
  
        props.existingBreaks.forEach((b) => {
          breakIdMap.set(b.name, b.id);
        });
  
        document.addEventListener("selectionchange", updateBreakSelection);
        handleInput();
      });
  
      Vue.onUnmounted(() => {
        document.removeEventListener("selectionchange", updateBreakSelection);
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
        newBreakName,
        handleInput,
        handleKeyDown,
        handleKeyUp,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handlePaste,
        handleCopy,
        handleCut,
        handleEditorFocus,
        handleEditorBlur,
        handleInputBlur,
        handleInputMouseDown,
        addBreakAtCursor,
        updateLastCursorPosition,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        handleWheel
      };
    }
}