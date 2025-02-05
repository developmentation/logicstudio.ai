// Enhanced formatDocxFromMarkdown.js
// Using marked v15.0.6

const DEFAULT_STYLES = {
  font: {
    name: "Calibri",
    size: 24,          // 12pt (in half-points)
    headerSizes: {
      h1: 32,          // 16pt
      h2: 28,          // 14pt
      h3: 26,          // 13pt
      h4: 24,          // 12pt
      h5: 22,          // 11pt
      h6: 20           // 10pt
    }
  },
  colors: {
    header: "000000",
    text: "333333",
    muted: "666666",
    link: "0563C1",
    tableHeader: "666666",
    tableBorder: "CCCCCC",
    codeBackground: "F5F5F5",
    quoteBar: "CCCCCC"
  },
  table: {
    borders: {
      color: "CCCCCC",
      size: 1,
      style: docx.BorderStyle.SINGLE
    },
    header: {
      fill: "F2F2F2",
      bold: true
    },
    cell: {
      margins: {
        top: 100,
        bottom: 100,
        left: 150,
        right: 150
      },
      padding: 100
    }
  },
  spacing: {
    paragraph: {
      before: 120,
      after: 120,
      line: 360
    },
    header: {
      before: 240,
      after: 120
    },
    list: {
      indent: {
        left: 720,    // 0.5 inch
        hanging: 360  // 0.25 inch
      }
    }
  }
};

class MarkdownConverter {
  constructor(styles = DEFAULT_STYLES) {
    this.styles = styles;
    this.listLevel = 0;
    this.currentListInstance = 0;
  }

  parseMarkdownToTokens(markdown) {
    // Configure marked
    marked.setOptions({
      gfm: true,
      breaks: true,
      mangle: false,
      headerIds: false
    });

    try {
      // Handle potential outer code block wrapping
      let processedMarkdown = markdown;
      if (markdown.trim().startsWith('```') && markdown.trim().endsWith('```')) {
        processedMarkdown = markdown.replace(/^```.*\n/, '').replace(/```$/, '');
      }

      return marked.lexer(processedMarkdown);
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return [{ type: 'paragraph', text: markdown }];
    }
  }

  convertTokenToDocx(token) {
    switch (token.type) {
      case 'heading':
        // Clean up heading text and split into separate paragraph
        const headingText = token.text.replace(/^#+\s+/, '').trim();
        return this.createHeading(headingText, Math.min(token.depth, 6));

      
      case 'paragraph':
        // Handle potential task list items
        if (token.text.startsWith('[ ] ') || token.text.startsWith('[x] ')) {
          const isChecked = token.text.startsWith('[x]');
          const text = token.text.replace(/^\[[x ]\]\s*/, '');
          return this.createParagraph(`${isChecked ? '☒' : '☐'} ${text}`);
        }
        return this.createParagraph(this.processSpecialCharacters(token.text));
      
      case 'list':
        return this.createList(token.items, token.ordered, token.start);
      
      case 'code':
        return this.createCodeBlock(token.text, token.lang);
      
      case 'table':
        return this.createTable(token.header, token.rows, token.align);
      
      case 'blockquote':
        return this.createBlockquote(this.processSpecialCharacters(token.text));
      
      case 'hr':
        return this.createHorizontalRule();
      
      case 'space':
        return this.createParagraph('');
      
      default:
        console.warn('Unhandled token type:', token.type);
        return this.createParagraph(token.raw || '');
    }
  }

  processSpecialCharacters(text) {
    return text
      .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, '$1')  // Un-escape markdown characters
      .replace(/\u00A0/g, ' ')  // Replace non-breaking spaces
      .replace(/\u2013/g, '–')  // En dash
      .replace(/\u2014/g, '—')  // Em dash
      .replace(/\u2026/g, '...')  // Ellipsis
      .replace(/\u00AE/g, '®')  // Registered trademark
      .replace(/\u2122/g, '™');  // Trademark
  }

  createHeading(text, level) {
    const size = this.styles.font.headerSizes[`h${level}`];
    return new docx.Paragraph({
      text: text,  // No need to manually clean here as we do it in convertTokenToDocx
      heading: docx.HeadingLevel[`HEADING_${level}`],
      spacing: {
        before: this.styles.spacing.header.before,
        after: this.styles.spacing.header.after,
        line: this.styles.spacing.paragraph.line
      },
      style: {
        size: size,
        bold: true,
        color: this.styles.colors.header
      },
      keepNext: true  // Keeps heading with following paragraph
    });
  }

  parseInlineFormatting(text) {
    const textRuns = [];
    let currentPosition = 0;
    
    // Regular expressions for inline elements
    const patterns = [
      { regex: /\*\*\*(.*?)\*\*\*/g, handler: match => ({ text: match[1], bold: true, italic: true }) },
      { regex: /\*\*(.*?)\*\*/g, handler: match => ({ text: match[1], bold: true }) },
      { regex: /\*(.*?)\*/g, handler: match => ({ text: match[1], italic: true }) },
      { regex: /`([^`]+)`/g, handler: match => ({ text: match[1], font: { name: "Courier New" }, size: this.styles.font.size - 2 }) },
      { regex: /~~(.*?)~~/g, handler: match => ({ text: match[1], strike: true }) },
      { regex: /<mark>(.*?)<\/mark>/g, handler: match => ({ text: match[1], highlight: "yellow" }) },
      { 
        regex: /\[(.*?)\]\((.*?)\)/g, 
        handler: match => ({
          text: match[1],
          color: this.styles.colors.link,
          underline: { type: docx.UnderlineType.SINGLE },
          hyperlink: { url: match[2] }
        })
      },
      { 
        regex: /!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)/g, 
        handler: match => ({
          text: `[Image: ${match[1]}]`,
          italic: true
        })
      }
    ];
  
    // Find all matches and their positions
    let matches = [];
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          match: match,
          handler: pattern.handler
        });
      }
    });
  
    // Sort matches by position
    matches.sort((a, b) => a.index - b.index);
  
    // Process matches in order
    matches.forEach(match => {
      // Add any text before the match
      if (match.index > currentPosition) {
        textRuns.push(new docx.TextRun({
          text: text.slice(currentPosition, match.index),
          size: this.styles.font.size,
          font: { name: this.styles.font.name }
        }));
      }
  
      // Add the formatted text
      const formatting = match.handler(match.match);
      textRuns.push(new docx.TextRun(formatting));
  
      currentPosition = match.index + match.length;
    });
  
    // Add any remaining text
    if (currentPosition < text.length) {
      textRuns.push(new docx.TextRun({
        text: text.slice(currentPosition),
        size: this.styles.font.size,
        font: { name: this.styles.font.name }
      }));
    }
  
    return textRuns;
  }

  createParagraph(text) {
    if (!text) {
      return new docx.Paragraph({
        children: [],
        spacing: this.styles.spacing.paragraph
      });
    }
  
    // Process special characters first
    const processedText = this.processSpecialCharacters(text);
    
    // Parse inline formatting and create text runs
    const textRuns = this.parseInlineFormatting(processedText);
  
    // Look for hyperlinks in the text runs
    const children = textRuns.map(run => {
      if (run.hyperlink) {
        return new docx.ExternalHyperlink({
          children: [new docx.TextRun({
            ...run,
            hyperlink: undefined  // Remove hyperlink from TextRun as it's handled by ExternalHyperlink
          })],
          link: run.hyperlink.url
        });
      }
      return run;
    });
  
    return new docx.Paragraph({
      children,
      spacing: this.styles.spacing.paragraph
    });
  }

  createList(items, ordered, start = 1) {
    this.listLevel++;
    this.currentListInstance++;  // Increment for unique list numbering
    const paragraphs = [];
    
    items.forEach((item, index) => {
      const itemText = item.text || item;
      const lines = String(itemText).split('\n').map(line => line.trim()).filter(Boolean);
      
      lines.forEach((line, lineIndex) => {
        const paragraph = new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: this.processSpecialCharacters(line),
              size: this.styles.font.size,
              font: { name: this.styles.font.name }
            })
          ],
          bullet: ordered ? undefined : {
            level: 0
          },
          numbering: ordered ? {
            reference: "default-numbering",
            level: 0,
            instance: this.currentListInstance,
            start: start + index
          } : undefined,
          spacing: {
            before: lineIndex === 0 ? 120 : 0,
            after: lineIndex === lines.length - 1 ? 120 : 0
          },
          indent: {
            left: this.styles.spacing.list.indent.left,
            hanging: this.styles.spacing.list.indent.hanging
          }
        });
        paragraphs.push(paragraph);
      });
    });

    this.listLevel--;
    return paragraphs;
  }

  createCodeBlock(code, language) {
    try {
        // If language is markdown, parse the content as markdown
        if (language?.toLowerCase() === 'markdown') {
            // Parse the code content as markdown tokens
            const tokens = this.parseMarkdownToTokens(code);
            
            // Convert each token and flatten the results
            return tokens.flatMap(token => {
                const element = this.convertTokenToDocx(token);
                return Array.isArray(element) ? element : [element];
            });
        }

        // For other languages, render as code block
        return new docx.Paragraph({
            children: [
                new docx.TextRun({
                    text: code,
                    font: {
                        name: "Courier New"
                    },
                    size: this.styles.font.size - 2
                })
            ],
            spacing: {
                before: this.styles.spacing.paragraph.before,
                after: this.styles.spacing.paragraph.after,
                line: 300
            },
            shading: {
                type: docx.ShadingType.SOLID,
                color: this.styles.colors.codeBackground
            }
        });
    } catch (error) {
        console.error('Error creating code block:', error);
        return this.createParagraph(code);
    }
}

  processSpecialCharacters(text) {
    if (typeof text !== 'string') {
      return String(text || '');
    }
    return text
      .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, '$1')  // Un-escape markdown characters
      .replace(/\u00A0/g, ' ')  // Replace non-breaking spaces
      .replace(/\u2013/g, '–')  // En dash
      .replace(/\u2014/g, '—')  // Em dash
      .replace(/\u2026/g, '...')  // Ellipsis
      .replace(/\u00AE/g, '®')  // Registered trademark
      .replace(/\u2122/g, '™');  // Trademark
  }

  createTable(header, rows, aligns = []) {
    try {
      const headerRow = new docx.TableRow({
        tableHeader: true,
        children: header.map((cell, index) => this.createTableCell(this.extractCellContent(cell), true,  aligns[index]))
      });

      const bodyRows = rows.map(row => 
        new docx.TableRow({
          children: row.map((cell, index) => this.createTableCell(this.extractCellContent(cell), false,  aligns[index]))
        })
      );

      return new docx.Table({
        width: {
          size: 100,
          type: docx.WidthType.PERCENTAGE
        },
        borders: {
          top: { style: this.styles.table.borders.style, size: this.styles.table.borders.size },
          bottom: { style: this.styles.table.borders.style, size: this.styles.table.borders.size },
          left: { style: this.styles.table.borders.style, size: this.styles.table.borders.size },
          right: { style: this.styles.table.borders.style, size: this.styles.table.borders.size }
        },
        rows: [headerRow, ...bodyRows]
      });
    } catch (error) {
      console.error('Error creating table:', error);
      return this.createParagraph('Error creating table: ' + error.message);
    }
  }

  extractCellContent(cell) {
    if (!cell) return '';
    
    // If cell is an object with text property
    if (typeof cell === 'object' && cell.text) {
      return cell.text;
    }
    
    // If cell is an object with content property
    if (typeof cell === 'object' && cell.content) {
      return cell.content;
    }

    // If cell has a toString method that's not the default Object.toString
    if (typeof cell === 'object' && cell.toString !== Object.prototype.toString) {
      return cell.toString();
    }

    // For primitive values
    if (typeof cell !== 'object') {
      return String(cell);
    }

    // Default case
    try {
      return JSON.stringify(cell);
    } catch {
      return '';
    }
  }

  createTableCell(content, isHeader, align = 'left') {
    try {
        const cellContent = this.processSpecialCharacters(content);
        return new docx.TableCell({
            children: [new docx.Paragraph({
                children: [new docx.TextRun({
                    text: cellContent,
                    size: this.styles.font.size,
                    font: { name: this.styles.font.name },
                    bold: isHeader
                })],
                alignment: this.getAlignment(align),
                spacing: this.styles.spacing.paragraph
            })],
            shading: isHeader ? {
                fill: this.styles.table.header.fill
            } : undefined,
            margins: this.styles.table.cell.margins
        });
    } catch (error) {
        console.error('Error creating table cell:', error);
        return new docx.TableCell({
            children: [this.createParagraph('Error: ' + error.message)]
        });
    }
}

  getAlignment(align) {
    switch (align?.toLowerCase()) {
        case 'center':
            return docx.AlignmentType.CENTER;
        case 'right':
            return docx.AlignmentType.RIGHT;
        case 'left':
        default:
            return docx.AlignmentType.LEFT;
    }
}

  createBlockquote(text) {
    return new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: String(text),
          size: this.styles.font.size
        })
      ],
      indent: {
        left: this.styles.spacing.list.indent.left
      },
      spacing: this.styles.spacing.paragraph,
      border: {
        left: {
          color: this.styles.colors.quoteBar,
          space: 120,
          style: docx.BorderStyle.SINGLE,
          size: 3
        }
      }
    });
  }

  createHorizontalRule() {
    return new docx.Paragraph({
      children: [],
      border: {
        bottom: {
          color: this.styles.colors.muted,
          space: 1,
          style: docx.BorderStyle.SINGLE,
          size: 1
        }
      },
      spacing: {
        before: this.styles.spacing.paragraph.before * 2,
        after: this.styles.spacing.paragraph.after * 2
      }
    });
  }

  convertMarkdown(markdown) {
    try {
      const normalizedMarkdown = markdown.replace(/\r\n/g, '\n');
      const tokens = this.parseMarkdownToTokens(normalizedMarkdown);
      
      // Reset list instance counter for each new document
      this.currentListInstance = 0;

      const doc = new docx.Document({
        numbering: {
          config: [{
            reference: "default-numbering",
            levels: [{
              level: 0,
              format: "decimal",
              text: "%1.",
              start: 1,
              alignment: docx.AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 }
                }
              }
            }]
          }]
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440
              }
            }
          },
          children: tokens.flatMap(token => {
            try {
              const element = this.convertTokenToDocx(token);
              return Array.isArray(element) ? element : [element];
            } catch (error) {
              console.error('Error converting token:', token, error);
              return [this.createParagraph(`Error converting ${token.type}: ${error.message}`)];
            }
          })
        }]
      });

      return doc;
    } catch (error) {
      console.error('Error converting markdown to DocX:', error);
      throw error;
    }
  }
}

export {
  MarkdownConverter,
  DEFAULT_STYLES
};