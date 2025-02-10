// enhancedTableHandler.js

const DEFAULT_TABLE_STYLES = {
    cellPadding: 100,
    borders: {
      color: 'CCCCCC',
      size: 1,
      style: 'single'
    },
    header: {
      backgroundColor: 'F5F5F5',
      bold: true,
      fontSize: 11
    },
    cell: {
      fontSize: 11,
      minWidth: 10
    }
  };
  
  class EnhancedTableHandler {
    constructor(styles, md) {
      this.styles = {
        ...DEFAULT_TABLE_STYLES,
        ...(styles?.tables || {})
      };
      this.md = md;
      this.documentStyles = styles || {};
    }
  
    processTable(tableToken, tokens, startIndex) {
      try {
        // Debug logging
        console.log('Table tokens:', tokens.slice(startIndex, startIndex + 10));
        
        // Validate tokens
        if (!tokens || !Array.isArray(tokens)) {
          throw new Error('Invalid tokens provided');
        }
  
        if (startIndex < 0 || startIndex >= tokens.length) {
          throw new Error('Invalid start index');
        }
  
        // Parse and validate table structure
        const tableData = this.parseTableStructure(tokens, startIndex);
        if (!this.validateTableData(tableData)) {
          throw new Error('Invalid table structure after parsing');
        }
  
        return this.createDocxTable(tableData);
      } catch (error) {
        console.error('Error processing table:', error);
        return this.createErrorTable(`Table processing error: ${error.message}`);
      }
    }
  
    validateTableData(tableData) {
      if (!tableData || !Array.isArray(tableData.rows)) {
        return false;
      }
  
      // Ensure we have at least one row
      if (tableData.rows.length === 0) {
        return false;
      }
  
      // Validate each row
      return tableData.rows.every(row => {
        return row && row.cells && Array.isArray(row.cells) && row.cells.length > 0;
      });
    }
 
    parseTableStructure(tokens, startIndex) {
        let tableData = {
          rows: [],
          alignments: [],
          hasHeader: false,
          columnWidths: []
        };
      
        try {
          let i = startIndex;
          let currentRow = [];
          let isHeader = false;
          let maxCols = 0;
          let currentCellContent = '';
      
          // Initialize alignments on first th_open tokens
          if (!tableData.alignments.length) {
            let j = startIndex;
            while (j < tokens.length && tokens[j].type !== 'tr_close') {
              const token = tokens[j];
              if (token.type === 'th_open' && token.attrs) {
                const styleAttr = token.attrs.find(attr => attr[0] === 'style');
                if (styleAttr) {
                  const alignment = styleAttr[1].includes('center') ? docx.AlignmentType.CENTER :
                                  styleAttr[1].includes('right') ? docx.AlignmentType.RIGHT :
                                  docx.AlignmentType.LEFT;
                  tableData.alignments.push(alignment);
                }
              }
              j++;
            }
          }
      
          while (i < tokens.length && tokens[i].type !== 'table_close') {
            const token = tokens[i];
      
            switch (token.type) {
              case 'thead_open':
                isHeader = true;
                tableData.hasHeader = true;
                break;
      
              case 'tbody_open':
                isHeader = false;
                break;
      
              case 'tr_open':
                currentRow = [];
                break;
      
              case 'tr_close':
                if (currentRow.length > 0) {
                  tableData.rows.push({
                    cells: currentRow.map(cell => ({
                      content: cell,
                      type: isHeader ? 'th' : 'td',
                      html: this.containsHtml(cell)
                    })),
                    isHeader: isHeader
                  });
                  maxCols = Math.max(maxCols, currentRow.length);
                }
                currentRow = [];
                break;
      
              case 'th_open':
              case 'td_open':
                currentCellContent = '';
                break;
      
              case 'inline':
                if (token.content) {
                  currentCellContent = token.content;
                }
                break;
      
              case 'th_close':
              case 'td_close':
                currentRow.push(currentCellContent);
                currentCellContent = '';
                break;
            }
      
            i++;
          }
      
          // Ensure alignments array matches column count
          if (tableData.alignments.length === 0) {
            tableData.alignments = Array(maxCols).fill(docx.AlignmentType.LEFT);
          }
      
          // Calculate column widths
          tableData.columnWidths = this.calculateColumnWidths(tableData.rows, maxCols);
      
          console.log('Final table alignments:', tableData.alignments);
          return tableData;
      
        } catch (error) {
          console.error('Error parsing table structure:', error);
          return this.createMinimalTableData(error.message);
        }
      }


    extractCells(rowToken) {
      if (!rowToken.children) {
        return [];
      }
  
      return rowToken.children
        .filter(child => child.type === 'td' || child.type === 'th')
        .map(cell => ({
          content: cell.content || '',
          type: cell.type,
          html: this.containsHtml(cell.content || '')
        }));
    }
  
    isAlignmentRow(row) {
        return row.every(cell => {
          const content = String(cell.content || cell || '').trim();
          return content.match(/^:?-+:?$/);
        });
      }
      
      parseAlignments(row) {
        return row.map(cellContent => {
          const content = String(cellContent?.content || cellContent || '').trim();
          if (content.startsWith(':') && content.endsWith(':')) {
            return docx.AlignmentType.CENTER;
          } else if (content.endsWith(':')) {
            return docx.AlignmentType.RIGHT;
          }
          return docx.AlignmentType.LEFT;
        });
      }

    containsHtml(content) {
      return /<[a-z][\s\S]*>/i.test(content);
    }
  
    parseHtmlContent(content) {
      return content
        .replace(/<ul>\s*/g, '\n')
        .replace(/<\/ul>\s*/g, '')
        .replace(/<ol>\s*/g, '\n')
        .replace(/<\/ol>\s*/g, '')
        .replace(/<li>\s*/g, '• ')
        .replace(/<\/li>\s*/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>\s*/g, '')
        .replace(/<\/p>\s*/g, '\n')
        .replace(/<[^>]+>/g, '');
    }
  
    calculateColumnWidths(rows, columnCount) {
      const widths = new Array(columnCount).fill(0);
      
      rows.forEach(row => {
        row.cells.forEach((cell, index) => {
          const contentLength = (cell.content || '').length;
          widths[index] = Math.max(widths[index], contentLength);
        });
      });
  
      const totalWidth = widths.reduce((sum, width) => sum + width, 0) || columnCount;
      return widths.map(width => 
        Math.max((width / totalWidth) * 100, this.styles.cell.minWidth)
      );
    }
  
    processInlineContent(content) {
      if (!content) return [new docx.TextRun({ text: '' })];
  
      try {
        if (this.containsHtml(content)) {
          content = this.parseHtmlContent(content);
        }
  
        const tokens = this.md.parseInline(content);
        if (!tokens[0] || !tokens[0].children) {
          return [new docx.TextRun({ text: content })];
        }
  
        return tokens[0].children.map(token => this.createTextRun(token));
      } catch (error) {
        console.error('Error processing inline content:', error);
        return [new docx.TextRun({
          text: content,
          size: this.styles.cell.fontSize * 2
        })];
      }
    }
  
    createTextRun(token) {
      const baseStyle = {
        size: this.styles.cell.fontSize * 2
      };
  
      if (!token || !token.type) {
        return new docx.TextRun({
          text: '',
          ...baseStyle
        });
      }
  
      switch (token.type) {
        case 'text':
          return new docx.TextRun({
            text: token.content || '',
            ...baseStyle
          });
  
        case 'strong':
          return new docx.TextRun({
            text: token.content || '',
            bold: true,
            ...baseStyle
          });
  
        case 'em':
          return new docx.TextRun({
            text: token.content || '',
            italics: true,
            ...baseStyle
          });
  
        case 'code_inline':
          return new docx.TextRun({
            text: token.content || '',
            font: {
              name: this.documentStyles.code?.font || 'Courier New'
            },
            size: (this.documentStyles.code?.size || 10) * 2
          });
  
          case 'link':
            return new docx.ExternalHyperlink({
              children: [
                new docx.TextRun({
                  text: token.content,
                  style: "Hyperlink",
                  color: "0563C1",
                  underline: true
                })
              ],
              link: token.url || token.href
            });

  
        default:
          return new docx.TextRun({
            text: token.content || '',
            ...baseStyle
          });
      }
    }
  
 
createDocxTable(tableData) {
    try {
      // Debug log
      console.log('Creating table with alignments:', tableData.alignments);
  
      return new docx.Table({
        width: {
          size: 100,
          type: docx.WidthType.PERCENTAGE
        },
        rows: tableData.rows.map((row, rowIndex) => {
          return new docx.TableRow({
            tableHeader: row.isHeader,
            children: row.cells.map((cell, colIndex) => {
              // Get alignment for this column
              const cellAlignment = tableData.alignments[colIndex];
              
              return new docx.TableCell({
                children: [
                  new docx.Paragraph({
                    children: this.processInlineContent(cell.content),
                    alignment: cellAlignment // Set the alignment here
                  })
                ],
                margins: {
                  top: this.styles.cellPadding,
                  bottom: this.styles.cellPadding,
                  left: this.styles.cellPadding,
                  right: this.styles.cellPadding
                },
                width: {
                  size: tableData.columnWidths[colIndex],
                  type: docx.WidthType.PERCENTAGE
                },
                shading: row.isHeader ? {
                  fill: this.styles.header.backgroundColor,
                  color: this.styles.header.backgroundColor
                } : undefined
              });
            })
          });
        }),
        borders: {
          top: { style: docx.BorderStyle.SINGLE, size: this.styles.borders.size, color: this.styles.borders.color },
          bottom: { style: docx.BorderStyle.SINGLE, size: this.styles.borders.size, color: this.styles.borders.color },
          left: { style: docx.BorderStyle.SINGLE, size: this.styles.borders.size, color: this.styles.borders.color },
          right: { style: docx.BorderStyle.SINGLE, size: this.styles.borders.size, color: this.styles.borders.color },
          insideHorizontal: { style: docx.BorderStyle.SINGLE, size: this.styles.borders.size, color: this.styles.borders.color },
          insideVertical: { style: docx.BorderStyle.SINGLE, size: this.styles.borders.size, color: this.styles.borders.color }
        }
      });
    } catch (error) {
      console.error('Error creating DOCX table:', error);
      return this.createErrorTable(error.message);
    }
  }
  
    createErrorTable(errorMessage) {
      return new docx.Table({
        width: {
          size: 100,
          type: docx.WidthType.PERCENTAGE
        },
        rows: [
          new docx.TableRow({
            children: [
              new docx.TableCell({
                children: [
                  new docx.Paragraph({
                    children: [
                      new docx.TextRun({
                        text: `Table Error: ${errorMessage}`,
                        color: "FF0000",
                        size: this.styles.cell.fontSize * 2
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      });
    }
  }
  
  export { EnhancedTableHandler, DEFAULT_TABLE_STYLES };