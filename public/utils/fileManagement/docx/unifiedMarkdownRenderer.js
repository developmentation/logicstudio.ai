// unifiedMarkdownRenderer.js
import {
  EnhancedTableHandler,
  DEFAULT_TABLE_STYLES,
} from "./enhancedTableHandler.js";

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

/**
 * A unified markdown renderer that converts markdown to various formats
 */

class UnifiedMarkdownRenderer {
    constructor(options = {}) {
      this.styles = { ...COMMON_STYLES, ...options };
      this.md = markdownit({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true,
        references: {}
      });
      this.tableHandler = new EnhancedTableHandler(this.styles, this.md);
      this.listLevel = 0;
      this.markdownDepth = 0;  // Track nesting depth of markdown processing
    }

    
  /**
   * Converts markdown to DOCX format
   * @param {string} markdown - The markdown content to convert
   * @returns {Promise<Document>} - The DOCX document
   */
  async toDocx(markdown) {
    try {
      // Parse markdown to DOCX elements
      const elements = this.parseMarkdownToDocxElements(markdown);

      // Create and return the document
      return new docx.Document({
        numbering: {
          config: [
            {
              reference: "mainNumbering",
              levels: Array.from({ length: 9 }, (_, i) => ({
                level: i,
                format: "decimal",
                text: `%${i + 1}.`,
                alignment: docx.AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: (i + 1) * 720, hanging: 360 },
                  },
                },
              })),
            },
          ],
        },
        sections: [
          {
            properties: {
              page: {
                margin: this.styles.document.margins,
              },
            },
            children: elements,
          },
        ],
      });
    } catch (error) {
      console.error("Error converting markdown to DOCX:", error);
      throw error;
    }
  }

  /**
   * Parses markdown content into DOCX elements
   * @private
   */
  parseMarkdownToDocxElements(markdown) {
    try {
      const tokens = this.md.parse(markdown, {});
      return this.processTokens(tokens);
    } catch (error) {
      console.error("Error parsing markdown:", error);
      return [this.createErrorParagraph(error.message)];
    }
  }

  /**
   * Creates an error paragraph for error cases
   * @private
   */
  createErrorParagraph(message) {
    return new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: `Error: ${message}`,
          color: "FF0000",
          size: this.styles.document.defaultFontSize * 2,
        }),
      ],
    });
  }

  /**
   * Creates a simple paragraph with text content
   * @private
   */
  createParagraph(text, options = {}) {
    return new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: text,
          ...options,
          size: (options.size || this.styles.document.defaultFontSize) * 2,
        }),
      ],
      spacing: options.spacing,
    });
  }

  /**
   * Processes markdown tokens into DOCX elements
   * @private
   */
  processTokens(tokens) {
    const elements = [];
    let currentList = null;
  
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
  
      try {
        switch (token.type) {
          case 'heading_open': {
            const level = parseInt(token.tag.slice(1));
            const style = this.styles.headings[`h${level}`];
            const nextToken = tokens[i + 1];
            
            if (nextToken && nextToken.type === 'inline') {
              elements.push(new docx.Paragraph({
                children: this.processInlineContent(nextToken.content),
                heading: docx.HeadingLevel[`HEADING_${level}`],
                spacing: {
                  before: style.spacing.before,
                  after: style.spacing.after
                }
              }));
              i++; // Skip the inline token
            }
            break;
          }
  
          case 'paragraph_open': {
            const nextToken = tokens[i + 1];
            if (nextToken && nextToken.type === 'inline') {
              elements.push(new docx.Paragraph({
                children: this.processInlineContent(nextToken.content),
                spacing: { before: 120, after: 120 }
              }));
              i++; // Skip the inline token
            }
            break;
          }
  
          case 'blockquote_open': {
            // Process until blockquote_close
            let content = '';
            i++;
            while (i < tokens.length && tokens[i].type !== 'blockquote_close') {
              if (tokens[i].type === 'inline') {
                content += tokens[i].content + '\n';
              }
              i++;
            }
  
            elements.push(new docx.Paragraph({
              children: this.processInlineContent(content),
              indent: { left: this.styles.blockquote.indentation },
              spacing: { before: 120, after: 120 },
              border: {
                left: {
                  color: this.styles.blockquote.borderColor,
                  size: this.styles.blockquote.borderWidth,
                  style: docx.BorderStyle.SINGLE,
                  space: 120
                }
              }
            }));
            break;
          }
  
          case 'bullet_list_open': {
            this.listLevel++;
            currentList = {
              type: 'bullet',
              items: []
            };
            break;
          }
  
          case 'ordered_list_open': {
            this.listLevel++;
            currentList = {
              type: 'ordered',
              items: [],
              start: token.attrs && token.attrs.find(attr => attr[0] === 'start') ? 
                    parseInt(token.attrs.find(attr => attr[0] === 'start')[1]) : 1
            };
            break;
          }
  
          case 'list_item_open': {
            if (currentList) {
              const contentTokens = [];
              let j = i + 1;
              
              while (j < tokens.length && tokens[j].type !== 'list_item_close') {
                if (tokens[j].type === 'inline') {
                  contentTokens.push(tokens[j]);
                }
                j++;
              }
              
              const content = contentTokens.map(t => t.content).join('\n');
              currentList.items.push(content);
            }
            break;
          }
  
          case 'bullet_list_close':
          case 'ordered_list_close': {
            if (currentList) {
              currentList.items.forEach((item, index) => {
                elements.push(new docx.Paragraph({
                  children: this.processInlineContent(item),
                  bullet: currentList.type === 'bullet' ? { level: this.listLevel - 1 } : undefined,
                  numbering: currentList.type === 'ordered' ? {
                    reference: "mainNumbering",
                    level: this.listLevel - 1,
                    instance: elements.length
                  } : undefined,
                  spacing: { before: 60, after: 60 },
                  indent: {
                    left: this.styles.lists.indent.left * this.listLevel,
                    hanging: this.styles.lists.indent.hanging
                  }
                }));
              });
              currentList = null;
            }
            this.listLevel--;
            break;
          }
  
          case 'code_block':
          case 'fence': {
            // Check if this is a markdown code block
            if (token.type === 'fence' && token.info && token.info.toLowerCase() === 'markdown') {
              try {
                // Parse the content as markdown
                const innerTokens = this.md.parse(token.content, {});
                const innerElements = this.processTokens(innerTokens);
                elements.push(...innerElements);
              } catch (error) {
                console.error('Error processing markdown code block:', error);
                // Fallback to regular code block if parsing fails
                elements.push(new docx.Paragraph({
                  children: [new docx.TextRun({
                    text: token.content || '',
                    font: {
                      name: this.styles.code.font
                    },
                    size: this.styles.code.size * 2
                  })],
                  spacing: { before: 120, after: 120 },
                  shading: {
                    type: docx.ShadingType.SOLID,
                    color: this.styles.code.backgroundColor
                  }
                }));
              }
            }  else {
                // Split by newlines and create separate runs
                const lines = (token.content || '').split('\n');
                elements.push(new docx.Paragraph({
                  children: lines.map((line, index) => [
                    new docx.TextRun({
                      text: line,
                      font: {
                        name: this.styles.code.font
                      },
                      size: this.styles.code.size * 2
                    }),
                    // Add line break for all but last line
                    ...(index < lines.length - 1 ? [new docx.TextRun({ break: 1 })] : [])
                  ]).flat(),
                  spacing: { before: 120, after: 120 },
                  shading: {
                    type: docx.ShadingType.SOLID,
                    color: this.styles.code.backgroundColor
                  }
                }));
              }
              break;
            }
  
          case 'hr': {
            elements.push(new docx.Paragraph({
              children: [],
              border: {
                bottom: {
                  color: "CCCCCC",
                  size: 1,
                  style: docx.BorderStyle.SINGLE
                }
              },
              spacing: { before: 240, after: 240 }
            }));
            break;
          }
  
          case 'table_open': {
            const table = this.tableHandler.processTable(token, tokens, i);
            if (table) {
              elements.push(table);
            }
            // Skip to table_close
            while (i < tokens.length && tokens[i].type !== 'table_close') i++;
            break;
          }
        }
      } catch (error) {
        console.error(`Error processing token ${token.type}:`, error);
        elements.push(this.createErrorParagraph(`Error in ${token.type}: ${error.message}`));
      }
    }
  
    return elements;
  }
  /**
   * Processes inline content within paragraphs and other elements
   * @private
   */
  processInlineContent(text) {
    try {
      if (!text) return [new docx.TextRun({ text: "" })];
  
      const tokens = this.md.parseInline(text, {});
      console.log('Tokens from parseInline:', JSON.stringify(tokens, null, 2));
  
      // Get the inline children tokens
      const children = tokens[0].children || [];
      let result = [];
  
      // Iterate by index so we can skip tokens when needed
      for (let i = 0; i < children.length; i++) {
        const token = children[i];
        console.log('Processing token:', token.type, token);
  
        switch (token.type) {
          case 'link_open': {
            // Get the URL from the link_open token's attributes.
            // For example, token.attrs: [ [ "href", "README.md" ] ]
            const url = (token.attrs && token.attrs[0] && token.attrs[0][1]) || "";
  
            // Collect all text between link_open and link_close
            let hyperlinkText = "";
            // Advance to the next token(s) until we hit link_close
            while (i + 1 < children.length && children[i + 1].type !== "link_close") {
              hyperlinkText += children[i + 1].content;
              i++;
            }
            // Skip the link_close token if it exists.
            if (i + 1 < children.length && children[i + 1].type === "link_close") {
              i++;
            }
  
            result.push(
              new docx.ExternalHyperlink({
                children: [
                  new docx.TextRun({
                    text: hyperlinkText,
                    style: "Hyperlink", // Ensure this style is defined in your document styles.
                    color: "0563C1",
                    underline: true,
                    size: this.styles.document.defaultFontSize * 2,
                  }),
                ],
                link: url,
              })
            );
            break;
          }
  
          case 'text':
            result.push(
              new docx.TextRun({
                text: token.content,
                size: this.styles.document.defaultFontSize * 2,
              })
            );
            break;
  
          case 'strong':
            result.push(
              new docx.TextRun({
                text: token.content,
                bold: true,
                size: this.styles.document.defaultFontSize * 2,
              })
            );
            break;
  
          case 'em':
            result.push(
              new docx.TextRun({
                text: token.content,
                italics: true,
                size: this.styles.document.defaultFontSize * 2,
              })
            );
            break;
  
          case 'code_inline':
            result.push(
              new docx.TextRun({
                text: token.content,
                font: { name: this.styles.code.font },
                size: this.styles.code.size * 2,
              })
            );
            break;
  
          case 'softbreak':
            result.push(
              new docx.TextRun({
                text: '\n',
                size: this.styles.document.defaultFontSize * 2,
              })
            );
            break;
  
          case 'hardbreak':
            result.push(
              new docx.TextRun({
                break: 1,
                size: this.styles.document.defaultFontSize * 2,
              })
            );
            break;
  
          // Any other token types fallback to rendering their content as plain text.
          default:
            result.push(
              new docx.TextRun({
                text: token.content || '',
                size: this.styles.document.defaultFontSize * 2,
              })
            );
        }
      }
  
      return result;
    } catch (error) {
      console.error("Error processing inline content:", error);
      return [
        new docx.TextRun({
          text: text || "",
          size: this.styles.document.defaultFontSize * 2,
        }),
      ];
    }
  }
  

  async toPdf(markdown) {
    try {
      const tokens = this.md.parse(markdown, {});
      const doc = new jsPDF();

      let y = 20; // Starting y position
      const margin = 20;
      const pageWidth = doc.internal.pageSize.width;
      const textWidth = pageWidth - margin * 2;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        try {
          switch (token.type) {
            case "heading_open": {
              const level = parseInt(token.tag.slice(1));
              const nextToken = tokens[i + 1];
              if (nextToken && nextToken.type === "inline") {
                const fontSize = this.getPdfHeadingSize(level);
                doc.setFontSize(fontSize);
                doc.setFont(undefined, "bold");

                const text = nextToken.content;
                const textHeight = doc.getTextDimensions(text).h;

                // Check if we need a new page
                if (y + textHeight > doc.internal.pageSize.height - margin) {
                  doc.addPage();
                  y = margin;
                }

                doc.text(text, margin, y);
                y += textHeight + 10;
                i++; // Skip the inline token
              }
              break;
            }

            case "paragraph_open": {
              const nextToken = tokens[i + 1];
              if (nextToken && nextToken.type === "inline") {
                doc.setFontSize(12);
                doc.setFont(undefined, "normal");

                const text = nextToken.content;
                const textHeight = doc.getTextDimensions(text, {
                  maxWidth: textWidth,
                }).h;

                // Check if we need a new page
                if (y + textHeight > doc.internal.pageSize.height - margin) {
                  doc.addPage();
                  y = margin;
                }

                doc.text(text, margin, y, {
                  maxWidth: textWidth,
                  align: "left",
                });
                y += textHeight + 10;
                i++; // Skip the inline token
              }
              break;
            }

            case "code_block":
            case "fence": {
              // Check if this is a markdown code block
              if (
                token.type === "fence" &&
                token.info &&
                token.info.toLowerCase() === "markdown"
              ) {
                // Parse the content as markdown
                const innerTokens = this.md.parse(token.content, {});
                const currentY = y; // Save current Y position
                // Process the inner tokens
                for (let j = 0; j < innerTokens.length; j++) {
                  try {
                    const innerToken = innerTokens[j];
                    // Recursively process the token (will hit other cases in the switch)
                    switch (innerToken.type) {
                      // ... handle each case
                      default:
                        // Use existing token processing
                        const savedY = y;
                        y = currentY;
                        this.processTokens([innerToken]);
                        y = savedY;
                    }
                  } catch (error) {
                    console.error("Error processing inner markdown:", error);
                  }
                }
              } else {
                // Handle as regular code block
                doc.setFont("Courier", "normal");
                doc.setFontSize(10);

                const lines = token.content.split("\n");
                const lineHeight = 5;
                const totalHeight = lines.length * lineHeight;

                // Check if we need a new page
                if (y + totalHeight > doc.internal.pageSize.height - margin) {
                  doc.addPage();
                  y = margin;
                }

                // Draw background
                doc.setFillColor(248, 248, 248);
                doc.rect(
                  margin - 2,
                  y - 2,
                  textWidth + 4,
                  totalHeight + 4,
                  "F"
                );

                // Draw text
                lines.forEach((line, index) => {
                  doc.text(line, margin, y + index * lineHeight);
                });

                y += totalHeight + 10;
              }
              break;
            }

            case "bullet_list_open":
            case "ordered_list_open": {
              const listItems = [];
              let j = i + 1;
              let itemNumber = 1;

              while (
                j < tokens.length &&
                tokens[j].type !== "bullet_list_close" &&
                tokens[j].type !== "ordered_list_close"
              ) {
                if (tokens[j].type === "list_item_open") {
                  let itemContent = "";
                  j++;
                  while (
                    j < tokens.length &&
                    tokens[j].type !== "list_item_close"
                  ) {
                    if (tokens[j].type === "inline") {
                      itemContent = tokens[j].content;
                    }
                    j++;
                  }
                  const prefix =
                    token.type === "bullet_list_open"
                      ? "• "
                      : `${itemNumber}. `;
                  listItems.push(prefix + itemContent);
                  itemNumber++;
                }
                j++;
              }

              doc.setFontSize(12);
              doc.setFont(undefined, "normal");

              listItems.forEach((item) => {
                const textHeight = doc.getTextDimensions(item, {
                  maxWidth: textWidth - 10,
                }).h;

                // Check if we need a new page
                if (y + textHeight > doc.internal.pageSize.height - margin) {
                  doc.addPage();
                  y = margin;
                }

                doc.text(item, margin + 10, y, {
                  maxWidth: textWidth - 10,
                  align: "left",
                });
                y += textHeight + 5;
              });

              i = j; // Skip processed tokens
              break;
            }

            case "table_open": {
              // Use the tableHandler to process the table
              const tableData = this.tableHandler.parseTableStructure(
                tokens,
                i
              );
              doc = this.tableHandler.toPdf(tableData, doc);

              // Skip to end of table
              while (i < tokens.length && tokens[i].type !== "table_close") i++;

              // Update y position
              y = doc.lastAutoTable.finalY + 10;
              break;
            }

            case "hr": {
              // Check if we need a new page
              if (y + 10 > doc.internal.pageSize.height - margin) {
                doc.addPage();
                y = margin;
              }

              doc.setDrawColor(200, 200, 200);
              doc.line(margin, y, pageWidth - margin, y);
              y += 10;
              break;
            }
          }
        } catch (error) {
          console.error(`Error processing token ${token.type}:`, error);
          doc.setTextColor(255, 0, 0);
          doc.text(
            `Error processing ${token.type}: ${error.message}`,
            margin,
            y
          );
          doc.setTextColor(0, 0, 0);
          y += 10;
        }
      }

      return doc;
    } catch (error) {
      console.error("Error converting to PDF:", error);
      const doc = new jsPDF();
      doc.setTextColor(255, 0, 0);
      doc.text(`Error creating PDF: ${error.message}`, 20, 20);
      return doc;
    }
  }

  getPdfHeadingSize(level) {
    const sizes = {
      1: 24,
      2: 20,
      3: 16,
      4: 14,
      5: 12,
      6: 11,
    };
    return sizes[level] || 12;
  }
}

export { UnifiedMarkdownRenderer, COMMON_STYLES };
