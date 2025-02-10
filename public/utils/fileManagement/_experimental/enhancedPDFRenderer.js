// enhancedPDFRenderer.js

const COMMON_STYLES = {
  document: {
    defaultFont: "Calibri",
    defaultFontSize: 11,
    lineHeight: 1.15,
    margins: {
      top: 1440, // 1 inch in twips
      right: 1440,
      bottom: 1440,
      left: 1440,
    },
  },
  headings: {
    h1: { size: 24, spacing: { before: 240, after: 120 } },
    h2: { size: 20, spacing: { before: 200, after: 100 } },
    h3: { size: 16, spacing: { before: 160, after: 80 } },
    h4: { size: 14, spacing: { before: 140, after: 70 } },
    h5: { size: 12, spacing: { before: 120, after: 60 } },
    h6: { size: 11, spacing: { before: 110, after: 60 } },
  },
  lists: {
    indent: {
      left: 720, // 0.5 inch
      hanging: 360, // 0.25 inch
    },
    bullet: {
      font: "Symbol",
      char: "•",
    },
    number: {
      format: "%1.",
      align: "start",
    },
  },
  tables: DEFAULT_TABLE_STYLES,
  code: {
    font: "Courier New",
    size: 10,
    backgroundColor: "F8F8F8",
    padding: 100,
  },
  links: {
    color: "0563C1",
    underline: true,
  },
  blockquote: {
    indentation: 720, // 0.5 inch
    borderColor: "CCCCCC",
    borderWidth: 3,
    backgroundColor: "F8F8F8",
    padding: 120,
  },
};

const PDF_STYLES = {
  ...COMMON_STYLES,
  document: {
    defaultFont: 'Helvetica',
    defaultFontSize: 11,
    margins: {
      top: 72,    // 1 inch
      right: 72,
      bottom: 72,
      left: 72
    },
    contentWidth: null,  // Will be calculated in constructor
    header: {
      fontSize: 8,
      fontColor: '#666666',
      marginTop: 20
    },
    footer: {
      fontSize: 8,
      fontColor: '#666666',
      marginBottom: 20
    }
  },
  text: {
    lineHeight: 1.4,
    paragraphSpacing: 15
  },
  list: {
    indent: 30,
    bulletSpacing: 10,
    itemSpacing: 8
  },
  code: {
    font: 'Courier',
    fontSize: 10,
    backgroundColor: '#f6f8fa',
    borderColor: '#e1e4e8',
    padding: 15,
    lineHeight: 1.4
  }
};

class EnhancedPDFRenderer {
  constructor(options = {}) {
    this.styles = { ...PDF_STYLES, ...options };
    this.pageNumber = 1;
    this.totalPages = 1;
    this.currentY = this.styles.document.margins.top;
    this.currentX = this.styles.document.margins.left;
    this.listLevel = 0;
    this.references = {};
    
    // Initialize markdown-it
    this.md = markdownit({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true,
      references: this.references
    });
  
    // Calculate content width
    this.styles.document.contentWidth = this.calculateContentWidth();
  
    // Add additional markdown-it configuration
    this.md.configure({
      options: {
        html: true,
        xhtmlOut: false,
        breaks: true,
        langPrefix: 'language-',
        linkify: true,
        typographer: true,
      }
    });
  }
  
  async renderToPDF(markdown, title = '') {
    const doc = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
  
    this.pageWidth = doc.internal.pageSize.width;
    this.pageHeight = doc.internal.pageSize.height;
    this.textWidth = this.pageWidth - this.styles.document.margins.left - this.styles.document.margins.right;
  
    // Set initial font
    doc.setFont('Helvetica');
    doc.setFontSize(this.styles.document.defaultFontSize);
  
    // First pass: collect references
    const env = {};
    this.md.parse(markdown, env);
    this.references = env.references || {};
  
    // Second pass: actual rendering
    const tokens = this.md.parse(markdown, {
      references: this.references
    });
  
    // Process all tokens
    let i = 0;
    while (i < tokens.length) {
      try {
        i = await this.processToken(doc, tokens, i);
      } catch (error) {
        console.error('Error processing token:', error);
        i++;
      }
    }
  
    // Add headers and footers
    this.addHeadersAndFooters(doc, title);
  
    return doc;
  }
  

  async processToken(doc, tokens, index) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    try {
      // Handle markdown code blocks specially
      if (token.type === 'fence' && token.info?.toLowerCase() === 'markdown') {
        await this.renderMarkdownBlock(doc, token);
        return this.findBlockEnd(tokens, index, 'fence') + 1;
      }

      switch (token.type) {
        case 'heading_open': {
          this.currentY += 25; // Space before heading
          const level = parseInt(token.tag.slice(1));
          if (nextToken && nextToken.type === 'inline') {
            await this.renderHeading(doc, nextToken.content, level);
            return index + 3; // Skip heading_open, inline, and heading_close
          }
          break;
        }

        case 'paragraph_open': {
          if (nextToken && nextToken.type === 'inline') {
            await this.renderParagraph(doc, nextToken.content);
            return index + 3; // Skip paragraph_open, inline, and paragraph_close
          }
          break;
        }

        case 'fence':
        case 'code_block': {
          await this.renderCodeBlock(doc, token);
          return this.findBlockEnd(tokens, index, token.type) + 1;
        }

        case 'bullet_list_open':
        case 'ordered_list_open': {
          this.listLevel++;
          const endIndex = await this.renderList(doc, tokens, index, token.type === 'ordered_list_open');
          this.listLevel--;
          return endIndex + 1;
        }

        case 'table_open': {
          const endIndex = await this.renderTable(doc, tokens, index);
          return endIndex + 1;
        }

        case 'hr': {
          await this.renderHorizontalRule(doc);
          return index + 1;
        }
      }

      return index + 1;
    } catch (error) {
      console.error(`Error processing token ${token.type}:`, error);
      return index + 1;
    }
  }



  async renderHeading(doc, text, level) {
    const fontSize = this.getHeadingFontSize(level);
    doc.setFontSize(fontSize);
    doc.setFont('Helvetica', 'bold');
    
    const lines = doc.splitTextToSize(text, this.textWidth);
    const lineHeight = fontSize * 1.2;
    
    lines.forEach(line => {
      if (this.currentY + lineHeight > this.pageHeight - this.styles.document.margins.bottom) {
        this.addNewPage(doc);
      }
      
      doc.text(line, this.styles.document.margins.left, this.currentY);
      this.currentY += lineHeight;
    });
    
    // Add space after heading
    this.currentY += fontSize * 0.5;
    
    // Reset font
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(this.styles.document.defaultFontSize);
  }

async renderParagraph(doc, content) {
  // Calculate the effective width for text (inside margins)
  const effectiveWidth =
    this.pageWidth -
    this.styles.document.margins.left -
    this.styles.document.margins.right;
  const lineHeight = doc.getFontSize() * this.styles.text.lineHeight;
  const startX = this.styles.document.margins.left;

  try {
    // Parse the inline markdown tokens (with reference resolution)
    const tokens = this.md.parseInline(content, {
      references: this.references
    });

    // Build an array of “segments” from the tokens.
    // Each segment has a text string and an associated style.
    // (We also add a marker for forced line breaks.)
    const segments = [];
    const defaultStyle = { font: 'Helvetica', weight: 'normal', color: [0, 0, 0] };

    for (let i = 0; i < tokens[0].children.length; i++) {
      const token = tokens[0].children[i];

      if (token.type === 'link_open') {
        // For a link, grab its href and then all children until link_close
        const href =
          token.attrs?.find((attr) => attr[0] === 'href')?.[1] || '';
        let linkText = '';
        let j = i + 1;
        while (j < tokens[0].children.length && tokens[0].children[j].type !== 'link_close') {
          linkText += tokens[0].children[j].content || '';
          j++;
        }
        // Push a segment for the link with blue color.
        segments.push({
          text: linkText,
          style: { font: 'Helvetica', weight: 'normal', color: [0, 0, 238], isLink: true, href }
        });
        i = j; // Skip to token after link_close
      } else if (token.type === 'strong') {
        segments.push({
          text: token.content,
          style: { font: 'Helvetica', weight: 'bold', color: [0, 0, 0] }
        });
      } else if (token.type === 'em') {
        segments.push({
          text: token.content,
          style: { font: 'Helvetica', weight: 'italic', color: [0, 0, 0] }
        });
      } else if (token.type === 'code_inline') {
        segments.push({
          text: token.content,
          style: { font: 'Courier', weight: 'normal', color: [0, 0, 0], isCode: true }
        });
      } else if (token.type === 'text') {
        segments.push({
          text: token.content,
          style: defaultStyle
        });
      } else if (token.type === 'softbreak' || token.type === 'hardbreak') {
        // Use an empty segment marker to force a line break
        segments.push({ isBreak: true });
      }
    }

    // Next, split each segment’s text into “words” or chunks. We use a regex that
    // matches either sequences of non‐whitespace (\S+) or sequences of whitespace (\s+)
    // so that we preserve spacing.
    const words = [];
    segments.forEach((seg) => {
      if (seg.isBreak) {
        words.push({ isBreak: true });
      } else {
        // Split text into parts (words and whitespace)
        const parts = seg.text.match(/(\S+|\s+)/g);
        if (parts) {
          parts.forEach((part) => {
            // If the part is only whitespace, we standardize it to a single space.
            // (You can change this behavior if you need multiple spaces preserved.)
            if (part.trim() === '') {
              words.push({ text: ' ', style: seg.style });
            } else {
              words.push({ text: part, style: seg.style });
            }
          });
        }
      }
    });

    // Now build lines with word-wrapping.
    // (We measure each word using jspdf’s getStringUnitWidth.)
    let lineWords = [];
    let lineWidth = 0;

    // Loop over all word parts.
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.isBreak) {
        // Render the current line and force a break.
        await this.renderLine(doc, lineWords, startX);
        lineWords = [];
        lineWidth = 0;
        this.currentY += lineHeight;
        continue;
      }

      // Set the font (for measurement) using this word’s style.
      doc.setFont(word.style.font, word.style.weight);
      const wordWidth = doc.getStringUnitWidth(word.text) * doc.getFontSize();

      // If the word is pure whitespace and it would appear at the start of a line,
      // skip it.
      if (lineWords.length === 0 && word.text.trim() === '') {
        continue;
      }

      // If adding this word would exceed the effective width (and there’s already some content on the line)
      if (lineWords.length > 0 && lineWidth + wordWidth > effectiveWidth) {
        // Render the current line...
        await this.renderLine(doc, lineWords, startX);
        // ...and then start a new line.
        this.currentY += lineHeight;
        lineWords = [];
        lineWidth = 0;
        // If the word is whitespace, skip adding it at the beginning of a line.
        if (word.text.trim() === '') continue;
      }
      // Otherwise, add the word to the current line.
      lineWords.push(word);
      lineWidth += wordWidth;
    }

    // Render any remaining words on the last line.
    if (lineWords.length > 0) {
      await this.renderLine(doc, lineWords, startX);
      this.currentY += lineHeight;
    }

    // Add any extra spacing after the paragraph.
    this.currentY += this.styles.text.paragraphSpacing;
  } catch (error) {
    console.error('Error rendering paragraph:', error);
    // Fallback: Use jspdf’s built‐in split (which does wrapping but loses inline styles)
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(content, effectiveWidth);
    lines.forEach((line) => {
      doc.text(line, this.styles.document.margins.left, this.currentY);
      this.currentY += lineHeight;
    });
    this.currentY += this.styles.text.paragraphSpacing;
  }
}

// A helper function to render one line (i.e. a series of word/chunk objects).
async renderLine(doc, words, startX) {
  let currentX = startX;
  // Loop through each word/chunk in this line.
  for (const word of words) {
    // Set the style for this word.
    doc.setFont(word.style.font, word.style.weight);
    doc.setTextColor(...word.style.color);

    const wordWidth = doc.getStringUnitWidth(word.text) * doc.getFontSize();

    // If this word is code, draw a light-gray background rectangle.
    if (word.style.isCode) {
      const padding = 2;
      doc.setFillColor(246, 248, 250);
      doc.rect(
        currentX - padding,
        this.currentY - doc.getFontSize() + padding,
        wordWidth + padding * 2,
        doc.getFontSize() + padding * 2,
        'F'
      );
    }

    // Draw the text
    doc.text(word.text, currentX, this.currentY);

    // If the word is a link, add an underline and a clickable link annotation.
    if (word.style.isLink) {
      doc.setDrawColor(...word.style.color);
      doc.line(
        currentX,
        this.currentY + 2,
        currentX + wordWidth,
        this.currentY + 2
      );
      doc.link(
        currentX,
        this.currentY - doc.getFontSize(),
        wordWidth,
        doc.getFontSize() + 4,
        { url: word.style.href }
      );
    }

    // Advance the X position by the width of this word.
    currentX += wordWidth;
  }
}

  async renderInlineToken(doc, token, x) {
    let width = 0;
    
    switch (token.type) {
      case 'text':
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(token.content, x, this.currentY);
        width = doc.getStringUnitWidth(token.content) * doc.getFontSize();
        break;
        
      case 'strong':
        doc.setFont('Helvetica', 'bold');
        doc.text(token.content, x, this.currentY);
        width = doc.getStringUnitWidth(token.content) * doc.getFontSize();
        doc.setFont('Helvetica', 'normal');
        break;
        
      case 'em':
        doc.setFont('Helvetica', 'italic');
        doc.text(token.content, x, this.currentY);
        width = doc.getStringUnitWidth(token.content) * doc.getFontSize();
        doc.setFont('Helvetica', 'normal');
        break;
        
      case 'code_inline':
        doc.setFont('Courier', 'normal');
        doc.setFillColor(...this.hexToRGB(this.styles.code.backgroundColor));
        const padding = 2;
        const codeText = token.content;
        width = doc.getStringUnitWidth(codeText) * doc.getFontSize();
        
        // Draw background
        doc.rect(
          x - padding,
          this.currentY - doc.getFontSize() + padding,
          width + (padding * 2),
          doc.getFontSize() + (padding * 2),
          'F'
        );
        
        // Draw text
        doc.setTextColor(0, 0, 0);
        doc.text(codeText, x, this.currentY);
        doc.setFont('Helvetica', 'normal');
        width += padding * 2;
        break;
        
      case 'link':
        doc.setTextColor(0, 0, 238); // Link blue
        doc.text(token.content, x, this.currentY);
        width = doc.getStringUnitWidth(token.content) * doc.getFontSize();
        
        // Add underline
        doc.line(x, this.currentY + 2, x + width, this.currentY + 2);
        
        // Add link
        doc.link(x, this.currentY - doc.getFontSize(), width, doc.getFontSize() + 4, { url: token.attrs[0][1] });
        doc.setTextColor(0, 0, 0);
        break;
    }
    
    return { width };
  }



  async renderList(doc, tokens, startIndex, isOrdered = false) {
    const indent = this.styles.list.indent * this.listLevel;
    let currentIndex = startIndex + 1;
    let itemNumber = 1;
    
    while (currentIndex < tokens.length) {
      const token = tokens[currentIndex];
      
      if (token.type === 'list_item_open') {
        // Find the content token
        let contentIndex = currentIndex + 1;
        while (contentIndex < tokens.length && 
               tokens[contentIndex].type !== 'inline' && 
               tokens[contentIndex].type !== 'list_item_close') {
          contentIndex++;
        }
        
        if (contentIndex < tokens.length && tokens[contentIndex].type === 'inline') {
          const bullet = isOrdered ? `${itemNumber}.` : '•';
          const bulletWidth = doc.getStringUnitWidth(bullet) * doc.internal.getFontSize();
          
          // Draw bullet/number
          doc.text(
            bullet,
            this.styles.document.margins.left + indent - bulletWidth - this.styles.list.bulletSpacing,
            this.currentY
          );
          
          // Draw content
          const text = tokens[contentIndex].content;
          const lines = doc.splitTextToSize(text, this.textWidth - indent - this.styles.list.bulletSpacing);
          const lineHeight = this.styles.document.defaultFontSize * this.styles.text.lineHeight;
          
          lines.forEach(line => {
            if (this.currentY + lineHeight > this.pageHeight - this.styles.document.margins.bottom) {
              this.addNewPage(doc);
            }
            
            doc.text(
              line,
              this.styles.document.margins.left + indent,
              this.currentY
            );
            this.currentY += lineHeight;
          });
          
          this.currentY += this.styles.list.itemSpacing;
          itemNumber++;
        }
      } else if (token.type === (isOrdered ? 'ordered_list_close' : 'bullet_list_close')) {
        break;
      }
      
      currentIndex++;
    }
    
    return currentIndex;
  }


  async renderTable(doc, tokens, startIndex) {
    const tableData = this.parseTableData(tokens, startIndex);
    if (!tableData.headers.length) return startIndex;
  
    const fontSize = 10;
    const padding = 5;
    const lineHeight = fontSize * 1.4;
    const columnWidth = this.textWidth / tableData.headers.length;
  
    // Track table start position
    const tableStartY = this.currentY;
    
    // Draw headers
    doc.setFontSize(fontSize);
    doc.setFont('Helvetica', 'bold');
    
    // Header background
    doc.setFillColor(246, 248, 250);
    doc.rect(
      this.styles.document.margins.left,
      this.currentY,
      this.textWidth,
      lineHeight + (padding * 2),
      'F'
    );
  
    // Header text with alignment
    tableData.headers.forEach((header, index) => {
      const align = tableData.alignments[index] || 'left';
      let x = this.styles.document.margins.left + (columnWidth * index) + padding;
      
      if (align === 'center') {
        x = x + (columnWidth - padding * 2) / 2;
      } else if (align === 'right') {
        x = x + columnWidth - padding * 2;
      }
      
      doc.text(header, x, this.currentY + lineHeight, { align });
    });
  
    this.currentY += lineHeight + (padding * 2);
    
    // Draw rows
    doc.setFont('Helvetica', 'normal');
    let isAlternateRow = false;
    
    for (const row of tableData.rows) {
      const rowStart = this.currentY;
      let maxHeight = lineHeight;
      
      // Calculate row height
      row.forEach((cell, index) => {
        const availableWidth = columnWidth - (padding * 2);
        const lines = doc.splitTextToSize(cell, availableWidth);
        const cellHeight = lines.length * lineHeight + (padding * 2);
        maxHeight = Math.max(maxHeight, cellHeight);
      });
      
      // Check for page break
      if (this.currentY + maxHeight > this.pageHeight - this.styles.document.margins.bottom) {
        this.addNewPage(doc);
        
        // Redraw header on new page
        doc.setFillColor(246, 248, 250);
        doc.rect(
          this.styles.document.margins.left,
          this.currentY,
          this.textWidth,
          lineHeight + (padding * 2),
          'F'
        );
        
        tableData.headers.forEach((header, index) => {
          const align = tableData.alignments[index] || 'left';
          let x = this.styles.document.margins.left + (columnWidth * index) + padding;
          if (align === 'center') {
            x = x + (columnWidth - padding * 2) / 2;
          } else if (align === 'right') {
            x = x + columnWidth - padding * 2;
          }
          doc.text(header, x, this.currentY + lineHeight, { align });
        });
        
        this.currentY += lineHeight + (padding * 2);
      }
  
      // Draw row background (alternate colors)
      if (isAlternateRow) {
        doc.setFillColor(250, 250, 250);
        doc.rect(
          this.styles.document.margins.left,
          this.currentY,
          this.textWidth,
          maxHeight,
          'F'
        );
      }
      
      // Draw cells
      row.forEach((cell, index) => {
        const align = tableData.alignments[index] || 'left';
        const availableWidth = columnWidth - (padding * 2);
        const lines = doc.splitTextToSize(cell, availableWidth);
        
        let x = this.styles.document.margins.left + (columnWidth * index) + padding;
        if (align === 'center') {
          x = x + (columnWidth - padding * 2) / 2;
        } else if (align === 'right') {
          x = x + columnWidth - padding * 2;
        }
        
        lines.forEach((line, lineIndex) => {
          doc.text(
            line,
            x,
            this.currentY + lineHeight + (lineIndex * lineHeight),
            { align }
          );
        });
      });
      
      // Draw cell borders
      doc.setDrawColor(225, 225, 225);
      doc.setLineWidth(0.1);
      
      // Vertical lines
      for (let i = 0; i <= row.length; i++) {
        doc.line(
          this.styles.document.margins.left + (columnWidth * i),
          rowStart,
          this.styles.document.margins.left + (columnWidth * i),
          this.currentY + maxHeight
        );
      }
      
      // Horizontal lines
      doc.line(
        this.styles.document.margins.left,
        this.currentY + maxHeight,
        this.styles.document.margins.left + this.textWidth,
        this.currentY + maxHeight
      );
      
      this.currentY += maxHeight;
      isAlternateRow = !isAlternateRow;
    }
    
    // Add spacing after table
    this.currentY += 10;
    
    return startIndex;
  }

  parseTableData(tokens, startIndex) {
    const headers = [];
    const rows = [];
    const alignments = [];
    let isHeader = true;
    let currentRow = [];
    
    // First pass: get alignments from separator row
    let index = startIndex + 1;
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === 'tr_open' && tokens[index + 1]?.content?.includes('-')) {
        const alignRow = tokens[index + 1].content.split('|').filter(Boolean);
        alignments.push(...alignRow.map(cell => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        }));
        break;
      }
      index++;
    }
    
    // Second pass: process content
    index = startIndex + 1;
    while (index < tokens.length) {
      const token = tokens[index];
      
      if (token.type === 'table_close') break;
      
      if (token.type === 'tr_open') {
        currentRow = [];
      } else if (token.type === 'tr_close') {
        if (isHeader) {
          headers.push(...currentRow);
          isHeader = false;
        } else if (currentRow.length > 0) {  // Skip alignment row
          rows.push([...currentRow]);
        }
      } else if (token.type === 'th_open' || token.type === 'td_open') {
        const contentToken = tokens[index + 1];
        if (contentToken && contentToken.type === 'inline') {
          currentRow.push(this.cleanText(contentToken.content));
        }
      }
      
      index++;
    }
    
    return { headers, rows, alignments };
  }

  async renderHorizontalRule(doc) {
    // Add spacing before rule
    this.currentY += 10;
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(
      this.styles.document.margins.left,
      this.currentY,
      this.pageWidth - this.styles.document.margins.right,
      this.currentY
    );
    
    // Add spacing after rule
    this.currentY += 10;
  }

  addNewPage(doc) {
    doc.addPage();
    this.pageNumber++;
    this.currentY = this.styles.document.margins.top;
  }

  addHeadersAndFooters(doc, title = '') {
    const pages = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      
      // Header
      if (title) {
        doc.setFontSize(this.styles.document.header.fontSize);
        doc.setTextColor(this.styles.document.header.fontColor);
        doc.text(
          title,
          this.pageWidth / 2,
          this.styles.document.header.marginTop,
          { align: 'center' }
        );
      }
      
      // Footer
      doc.setFontSize(this.styles.document.footer.fontSize);
      doc.setTextColor(this.styles.document.footer.fontColor);
      doc.text(
        `Page ${i} of ${pages}`,
        this.pageWidth / 2,
        this.pageHeight - this.styles.document.footer.marginBottom,
        { align: 'center' }
      );
    }
  }

  getHeadingFontSize(level) {
    const sizes = {
      1: 24,
      2: 20,
      3: 16,
      4: 14,
      5: 12,
      6: 11
    };
    return sizes[level] || 12;
  }

  hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  findBlockEnd(tokens, startIndex, blockType) {
    let index = startIndex;
    let depth = 0;
    
    while (index < tokens.length) {
      if (tokens[index].type === blockType) {
        if (tokens[index].nesting === 1) depth++;
        else if (tokens[index].nesting === -1) depth--;
        
        if (depth === 0) return index;
      }
      index++;
    }
    
    return startIndex;
  }


  
  async renderMarkdownBlock(doc, token) {
    // Parse the markdown content as markdown instead of code
    const innerTokens = this.md.parse(token.content, {});
    
    // Save current position
    const currentPosition = {
      x: this.currentX,
      y: this.currentY
    };
    
    // Process the inner tokens directly
    for (let i = 0; i < innerTokens.length; i++) {
      await this.processToken(doc, innerTokens, i);
    }
    
    // Add some spacing after the block
    this.currentY += this.styles.text.paragraphSpacing;
  }
  
  async renderCodeBlock(doc, token) {
    const effectiveWidth = this.pageWidth - this.styles.document.margins.left - this.styles.document.margins.right - 40; // 40pt padding
    
    doc.setFont('Courier', 'normal');
    doc.setFontSize(this.styles.code.fontSize);
    
    // Draw background
    const startY = this.currentY;
    this.currentY += 20; // Top padding
    
    // Process content
    const lines = token.content.split('\n');
    const lineHeight = this.styles.code.fontSize * 1.2;
    
    // Calculate wrapped lines first
    const wrappedLines = [];
    lines.forEach(line => {
      const wrapped = doc.splitTextToSize(line, effectiveWidth);
      wrappedLines.push(...wrapped);
    });
    
    // Calculate total height
    const totalHeight = (wrappedLines.length * lineHeight) + 40; // Include padding
    
    // Draw background
    doc.setFillColor(246, 248, 250);
    doc.rect(
      this.styles.document.margins.left,
      startY,
      this.pageWidth - (this.styles.document.margins.left + this.styles.document.margins.right),
      totalHeight,
      'F'
    );
    
    // Draw text
    wrappedLines.forEach(line => {
      if (this.currentY + lineHeight > this.pageHeight - this.styles.document.margins.bottom) {
        this.addNewPage(doc);
        this.currentY += 20; // Top padding on new page
      }
      
      doc.text(line, this.styles.document.margins.left + 20, this.currentY);
      this.currentY += lineHeight;
    });
    
    this.currentY += 20; // Bottom padding
    
    // Reset font
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(this.styles.document.defaultFontSize);
  }
  
  // Add a helper function to calculate content width
  calculateContentWidth() {
    return this.pageWidth - this.styles.document.margins.left - this.styles.document.margins.right;
  }
  
  
  async renderLink(doc, token, tokens, index) {
    // Find the link URL and text
    const hrefToken = token.attrs.find(attr => attr[0] === 'href');
    const href = hrefToken ? hrefToken[1] : '';
    
    // Get the link text from the next inline token
    let text = '';
    let i = index + 1;
    while (i < tokens.length && tokens[i].type !== 'link_close') {
      if (tokens[i].type === 'text') {
        text += tokens[i].content;
      }
      i++;
    }
    
    // Style the link
    doc.setTextColor(0, 0, 238); // Link blue
    doc.setDrawColor(0, 0, 238);
    
    // Draw the text
    doc.text(text, this.currentX, this.currentY);
    
    // Calculate text width
    const textWidth = doc.getStringUnitWidth(text) * doc.getFontSize();
    
    // Draw underline
    doc.line(
      this.currentX,
      this.currentY + 2,
      this.currentX + textWidth,
      this.currentY + 2
    );
    
    // Add the link
    doc.link(
      this.currentX,
      this.currentY - doc.getFontSize(),
      textWidth,
      doc.getFontSize() + 4,
      { url: href }
    );
    
    // Reset colors
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    
    // Update position
    this.currentX += textWidth;
  }
  
  cleanText(text) {
    // Convert HTML entities
    const htmlEntities = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#39;': "'",
      '&euro;': '€',
      '&pound;': '£',
      '&copy;': '©',
      '&reg;': '®'
    };
    
    // Convert common emoji codes
    const emojiMap = {
      ':smile:': '😊',
      ':rocket:': '🚀',
      ':tada:': '🎉',
      ':heart:': '❤️',
      ':thumbsup:': '👍',
      ':star:': '⭐',
      'Ø=Þ': '😊',
      'Ø=Þ€': '🚀',
      'Ø<ß‰': '🎉'
    };
    
    let processedText = text;
    
    // Replace HTML entities
    Object.entries(htmlEntities).forEach(([entity, char]) => {
      processedText = processedText.replace(new RegExp(entity, 'g'), char);
    });
    
    // Replace emoji codes
    Object.entries(emojiMap).forEach(([code, emoji]) => {
      processedText = processedText.replace(new RegExp(code, 'g'), emoji);
    });
    
    // Handle sub/superscript
    processedText = processedText
      .replace(/\^([^\^]+)\^/g, '$1') // Superscript
      .replace(/~([^~]+)~/g, '$1')    // Subscript
      .replace(/\\([*_`\[\]])/g, '$1') // Escaped characters
      .replace(/\s+/g, ' ')
      .trim();
    
    return processedText;
  }

}

export { EnhancedPDFRenderer, PDF_STYLES };