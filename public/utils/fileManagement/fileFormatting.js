// utils/fileManagement/fileFormatting.js

/**
 * Default styling configuration for PDF documents
 */
export const DEFAULT_PDF_STYLES = {
    colors: {
      header: '#1a1a1a',
      subheader: '#2d2d2d',
      text: '#333333',
      muted: '#808080'
    },
    headerStyles: {
      h1: { fontSize: 24, spacing: 6, style: "bold" },
      h2: { fontSize: 20, spacing: 5, style: "bold" },
      h3: { fontSize: 16, spacing: 4, style: "bold" }
    },
    margins: {
      left: 15,
      right: 15,
      bottom: 20
    }
  };
  
/**
 * Convert Markdown to PDF Tables 
 */


// Add alignment parsing to table processing
const parseMarkdownTable = (tableText) => {
    const lines = tableText.split('\n').filter(line => line.trim());
    if (lines.length < 3) return null;
  
    // Parse header - trim outer pipes and split
    const headerRow = lines[0]
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cell => cell.trim());
  
    // Parse alignment from separator row
    const alignments = lines[1]
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cell => {
        const trimmed = cell.trim();
        if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
        if (trimmed.endsWith(':')) return 'right';
        return 'left';
      });
  
    // Parse data rows - handle HTML content
    const rows = lines.slice(2).map(line => 
      line.trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(cell => ({
          text: cell.trim(),
          hasHtml: /<[^>]+>/.test(cell.trim())
        }))
    );
  
    return {
      headers: headerRow,
      alignments,
      rows: rows
    };
  };


  const createDocxTable = (table) => {
    return new docx.Table({
      width: {
        size: 100,
        type: docx.WidthType.PERCENTAGE,
      },
      rows: [
        // Header row
        new docx.TableRow({
          tableHeader: true,
          children: table.headers.map((header, i) => 
            new docx.TableCell({
              borders: {
                top: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                left: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                right: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
              },
              shading: { fill: "EEEEEE" },
              width: {
                size: Math.floor(100 / table.headers.length),
                type: docx.WidthType.PERCENTAGE,
              },
              children: [new docx.Paragraph({
                alignment: getDocxAlignment(table.alignments[i]),
                children: [new docx.TextRun({
                  text: header,
                  bold: true,
                  font: "Calibri",
                  size: 24,
                })],
              })],
              margins: { top: 100, bottom: 100, left: 150, right: 150 },
            })
          ),
        }),
        // Data rows
        ...table.rows.map(row =>
          new docx.TableRow({
            children: row.map((cell, i) => {
              let content;
              if (cell.hasHtml) {
                // Parse HTML and create appropriate DOCX elements
                const md = markdownit();
                content = parseHtmlToDocxElements(cell.text);
              } else {
                content = [new docx.Paragraph({
                  alignment: getDocxAlignment(table.alignments[i]),
                  children: [new docx.TextRun({
                    text: cell.text,
                    font: "Calibri",
                    size: 24,
                  })],
                })];
              }
  
              return new docx.TableCell({
                borders: {
                  top: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                  bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                  left: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                  right: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                },
                width: {
                  size: Math.floor(100 / table.headers.length),
                  type: docx.WidthType.PERCENTAGE,
                },
                children: content,
                margins: { top: 100, bottom: 100, left: 150, right: 150 },
              });
            }),
          })
        ),
      ],
    });
  };

  // Helper to convert markdown alignment to DOCX alignment
const getDocxAlignment = (alignment) => {
    switch (alignment) {
      case 'center': return docx.AlignmentType.CENTER;
      case 'right': return docx.AlignmentType.RIGHT;
      default: return docx.AlignmentType.LEFT;
    }
  };
  
  // Helper to convert markdown alignment to PDF alignment
  const getPdfAlignment = (alignment, x, width) => {
    switch (alignment) {
      case 'center': return x + (width / 2);
      case 'right': return x + width - 3; // Adjust for padding
      default: return x + 3; // Adjust for padding
    }
  };

  // Helper to parse HTML content for DOCX
const parseHtmlToDocxElements = (html) => {
    const elements = [];
    
    if (html.includes('<ul>')) {
      const listItems = html.match(/<li>(.*?)<\/li>/g)
        .map(item => item.replace(/<\/?li>/g, '').trim());
        
      listItems.forEach(item => {
        elements.push(new docx.Paragraph({
          bullet: { level: 0 },
          children: [new docx.TextRun({
            text: item,
            font: "Calibri",
            size: 24,
          })],
        }));
      });
    } else {
      elements.push(new docx.Paragraph({
        children: [new docx.TextRun({
          text: html.replace(/<[^>]+>/g, ''),
          font: "Calibri",
          size: 24,
        })],
      }));
    }
    
    return elements;
  };

// const measureTableColumns = (pdf, table, contentWidth) => {
//   const minColWidth = 30; // Minimum column width in points
//   const margins = 3; // Cell margins in points
  
//   // Measure content width for each column - using let instead of const
//   let colWidths = new Array(table.headers.length).fill(0);
  
//   // Check header widths
//   table.headers.forEach((header, i) => {
//     const width = pdf.getTextWidth(header) + (margins * 2);
//     colWidths[i] = Math.max(colWidths[i], width, minColWidth);
//   });

//   // Check data widths
//   table.rows.forEach(row => {
//     row.forEach((cell, i) => {
//       const width = pdf.getTextWidth(cell) + (margins * 2);
//       colWidths[i] = Math.max(colWidths[i], width, minColWidth);
//     });
//   });

//   // If total width exceeds content width, scale down proportionally
//   const totalWidth = colWidths.reduce((a, b) => a + b, 0);
//   if (totalWidth > contentWidth) {
//     const scale = contentWidth / totalWidth;
//     colWidths = colWidths.map(w => w * scale);
//   }

//   return colWidths;
// };
  
const drawPdfTable = (pdf, table, x, y, contentWidth) => {
    const lineHeight = 12; // Increased for better readability
    const padding = 3;
    let colWidths = table.headers.map(() => contentWidth / table.headers.length);
    let currentY = y;
    let maxRowHeight = lineHeight;
  
    // Helper to draw cell with word wrap and HTML support
    const drawCell = (content, x, width, alignment, isHeader = false) => {
      if (isHeader) {
        pdf.setFont("helvetica", "bold");
      } else {
        pdf.setFont("helvetica", "normal");
      }
  
      let cellContent = content;
      if (content.includes('<ul>')) {
        // Handle HTML lists
        const listItems = content.match(/<li>(.*?)<\/li>/g)
          .map(item => '• ' + item.replace(/<\/?li>/g, '').trim());
        cellContent = listItems.join('\n  ');
      }
  
      const wrappedText = pdf.splitTextToSize(cellContent, width - (padding * 2));
      const cellHeight = wrappedText.length * lineHeight;
      maxRowHeight = Math.max(maxRowHeight, cellHeight);
  
      const alignX = getPdfAlignment(alignment, x, width);
      const alignOpts = { align: alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : 'left' };
      
      pdf.text(wrappedText, alignX, currentY + lineHeight - (padding / 2), alignOpts);
      
      return cellHeight;
    };
  
    // Draw header row with background
    pdf.setFillColor(245, 245, 245);
    pdf.rect(x, currentY, contentWidth, lineHeight, 'F');
  
    table.headers.forEach((header, i) => {
      drawCell(
        header,
        x + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0),
        colWidths[i],
        table.alignments[i],
        true
      );
    });
    currentY += maxRowHeight;
    maxRowHeight = lineHeight;
  
    // Draw data rows
    table.rows.forEach(row => {
      row.forEach((cell, i) => {
        drawCell(
          cell.text,
          x + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0),
          colWidths[i],
          table.alignments[i]
        );
      });
      currentY += maxRowHeight;
      maxRowHeight = lineHeight;
    });
  
    // Draw grid
    pdf.setDrawColor(200, 200, 200);
    let gridX = x;
    colWidths.forEach(width => {
      pdf.line(gridX, y, gridX, currentY);
      gridX += width;
    });
    pdf.line(gridX, y, gridX, currentY);
  
    let gridY = y;
    while (gridY <= currentY) {
      pdf.line(x, gridY, x + contentWidth, gridY);
      gridY += lineHeight;
    }
  
    return currentY - y;
  };
  

/**
 * Convert HTML table to markdown format
 */
  const convertTableToMarkdown = (tableHtml) => {
    const rows = tableHtml.match(/<tr[^>]*>.*?<\/tr>/gs) || [];
    if (rows.length === 0) return '';
  
    // Process header row
    const headerCells = rows[0].match(/<th[^>]*>(.*?)<\/th>/gs) || 
                       rows[0].match(/<td[^>]*>(.*?)<\/td>/gs) || [];
    if (headerCells.length === 0) return '';
  
    let markdown = '\n';
    
    // Header row
    markdown += '| ' + headerCells.map(cell => {
      const content = cell.replace(/<\/?[^>]+(>|$)/g, '').trim();
      return content || ' ';
    }).join(' | ') + ' |\n';
  
    // Separator row
    markdown += '| ' + headerCells.map(() => '---').join(' | ') + ' |\n';
  
    // Data rows
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].match(/<td[^>]*>(.*?)<\/td>/gs) || [];
      if (cells.length > 0) {
        markdown += '| ' + cells.map(cell => {
          const content = cell.replace(/<\/?[^>]+(>|$)/g, '').trim();
          return content || ' ';
        }).join(' | ') + ' |\n';
      }
    }
  
    return markdown + '\n';
  };
  

  /**
   * Converts HTML elements to DOCX elements with improved formatting
   */
// Updated DOCX table conversion
export const convertHtmlToDocxElements = (html, filename) => {
  const elements = [];
  const lines = html.split("\n");
  let inTable = false;
  let tableData = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|')) {
      if (!inTable) {
        // Start collecting table data
        inTable = true;
        let tableText = '';
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableText += lines[i] + '\n';
          i++;
        }
        i--; // Adjust for the loop increment
        
        // Parse table and create DOCX table
        const parsedTable = parseMarkdownTable(tableText);
        if (parsedTable) {
          const rows = [
            parsedTable.headers,
            ...parsedTable.rows
          ];

          const table = new docx.Table({
            rows: rows.map((rowData, rowIndex) => {
              return new docx.TableRow({
                tableHeader: rowIndex === 0, // First row is header
                children: rowData.map(cellText => {
                  return new docx.TableCell({
                    borders: {
                      top: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                      bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                      left: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                      right: { style: docx.BorderStyle.SINGLE, size: 1, color: "999999" },
                    },
                    shading: rowIndex === 0 ? {
                      fill: "EEEEEE",
                    } : undefined,
                    children: [new docx.Paragraph({
                      children: [new docx.TextRun({
                        text: cellText,
                        bold: rowIndex === 0,
                        font: "Calibri",
                        size: 24,
                      })],
                    })],
                    margins: {
                      top: 100,
                      bottom: 100,
                      left: 100,
                      right: 100,
                    },
                  });
                }),
              });
            }),
            width: {
              size: 100,
              type: docx.WidthType.PERCENTAGE,
            },
          });
          
          elements.push(table);
          elements.push(new docx.Paragraph({})); // Add spacing after table
          continue;
        }
      }
    } else {
      inTable = false;
      
      // Handle non-table content as before
      const cleanText = line.replace(/<[^>]*>/g, "").trim();
      if (!cleanText) continue;

      if (line.startsWith("<h1>")) {
        elements.push(
          new docx.Paragraph({
            text: cleanText,
            heading: docx.HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
            run: { font: "Calibri", size: 32 },
          })
        );
      } else if (line.startsWith("<h2>")) {
        elements.push(
          new docx.Paragraph({
            text: cleanText,
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            run: { font: "Calibri", size: 28 },
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
    }
  }

  return elements;
};
  
  /**
   * Creates styled PDF content with consistent formatting
   */
  export const createStyledPdf = (pdf, content, filename, customStyles = {}) => {
    const styles = {
      ...DEFAULT_PDF_STYLES,
      ...customStyles
    };
  
    const { colors, headerStyles, margins } = styles;
    
    // Initialize PDF
    pdf.setFont("helvetica");
    
    // Add header
    pdf.setFontSize(12);
    pdf.setTextColor(128, 128, 128);
    pdf.text(filename, margins.left, 10);
    pdf.text("Generated by LogicStudio.ai", pdf.internal.pageSize.width - 65, 10);
    
    // Add horizontal line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margins.left, 12, pdf.internal.pageSize.width - margins.right, 12);
  
    // Setup content parameters
    let y = 25;
    const pageWidth = pdf.internal.pageSize.width;
    const contentWidth = pageWidth - margins.left - margins.right;
    const pageHeight = pdf.internal.pageSize.height;
    let lastLineWasHeader = false;
  
    const renderHeader = (text, level) => {
      const style = headerStyles[level];
      if (!lastLineWasHeader) y += 3;
      
      pdf.setFont("helvetica", style.style);
      pdf.setFontSize(style.fontSize);
      pdf.setTextColor(colors.header);
      const wrappedText = pdf.splitTextToSize(text, contentWidth);
      pdf.text(wrappedText, margins.left, y);
      lastLineWasHeader = true;
      return (wrappedText.length * (style.fontSize / 3)) + style.spacing;
    };
  
    const lines = content.split('\n');
    let i = 0;
    while (i < lines.length) {
      // Check page boundaries
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
  
      const line = lines[i].trim();
  
      // Check for table start
      if (line.startsWith('|')) {
        let tableText = '';
        // Collect all table lines
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableText += lines[i] + '\n';
          i++;
        }
        
        const table = parseMarkdownTable(tableText);
        if (table) {
          pdf.setTextColor(colors.text);
          const tableHeight = drawPdfTable(pdf, table, margins.left, y, contentWidth);
          y += tableHeight + 10; // Add padding after table
        }
        continue;
      }
      
      // Process different content types
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
      else if (line.length > 0) {
        lastLineWasHeader = false;
        if (!lastLineWasHeader) y += 2;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.setTextColor(colors.text);
        const wrappedText = pdf.splitTextToSize(line, contentWidth);
        pdf.text(wrappedText, margins.left, y);
        y += (wrappedText.length * 5) + 2;
      }
      else {
        // Empty line
        y += 4;
      }
  
      i++;
    }
  
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
  /**
   * Creates a DOCX document with standard formatting
   */
  export const createDocxDocument = async (content, baseFilename) => {
    const md = markdownit({
      html: true,        // Enable HTML parsing
      tables: true,      // Enable table support
      breaks: true,      // Convert newlines to breaks
    });
    
    let htmlContent = md.render(content)
      .replace(/&quot;/g, '"')
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&lsquo;|&rsquo;/g, "'");
  
  
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
  
    return await docx.Packer.toBlob(doc);
  };
  
  /**
   * Clean HTML content for PDF conversion
   */
  export const cleanHtmlForPdf = (htmlContent) => {
    // First handle tables specially
    let cleanContent = htmlContent;
    const tables = htmlContent.match(/<table[^>]*>.*?<\/table>/gs) || [];
    
    // Replace each table with its markdown equivalent
    tables.forEach((table, index) => {
      const markdownTable = convertTableToMarkdown(table);
      // Use a placeholder that won't be affected by other replacements
      const placeholder = `__TABLE_${index}__`;
      cleanContent = cleanContent.replace(table, placeholder);
    });
  
    // Perform normal HTML cleaning
    cleanContent = cleanContent
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1')
      .replace(/<pre><code>(.*?)<\/code><\/pre>/gs, '```\n$1\n```')
      .replace(/<li[^>]*>(.*?)<\/li>/g, '• $1')
      .replace(/<p[^>]*>(.*?)<\/p>/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&lsquo;|&rsquo;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/\n\s*\n/g, '\n\n');
  
    // Restore tables
    tables.forEach((_, index) => {
      const placeholder = `__TABLE_${index}__`;
      const markdownTable = convertTableToMarkdown(tables[index]);
      cleanContent = cleanContent.replace(placeholder, markdownTable);
    });
  
    return cleanContent;
  };
  
  /**
   * Process content for various file formats
   */
  export const createFormattedFile = async (content, outputType, baseFilename) => {
    const processedContent = extractContent(content);
    
    switch (outputType) {
      case "markdown": 
      case "txt":
      case "js":
      case "html": {
        const textContent = typeof processedContent === "object" ? 
          JSON.stringify(processedContent, null, 2) : processedContent;
        return {
          content: textContent,
          extension: outputType === "markdown" ? "md" : outputType
        };
      }
  
      case "json": {
        const jsonContent = typeof processedContent === "object" ? 
          processedContent : { content: processedContent };
        return {
          content: JSON.stringify(jsonContent, null, 2),
          extension: 'json'
        };
      }
  
      case "docx": {
        const markdownContent = typeof processedContent === "object" ? 
          JSON.stringify(processedContent, null, 2) : processedContent;
        const blob = await createDocxDocument(markdownContent, baseFilename);
        return {
          content: blob,
          extension: 'docx'
        };
      }
  
      case "pdf": {
        const markdownContent = typeof processedContent === "object" ? 
          JSON.stringify(processedContent, null, 2) : processedContent;
        const md = markdownit();
        const htmlContent = md.render(markdownContent);
        const cleanContent = cleanHtmlForPdf(htmlContent);
        
        const pdf = new jspdf.jsPDF();
        createStyledPdf(pdf, cleanContent, baseFilename);
        
        return {
          content: pdf.output('blob'),
          extension: 'pdf'
        };
      }
  
      default:
        throw new Error(`Unsupported file type: ${outputType}`);
    }
  };
  
  /**
   * Extract content from various input formats
   */
  export const extractContent = (value) => {
    let content = typeof value === "string" ? value : 
                  value.content !== undefined ? value.content : value;
  
    if (typeof content === "string" && 
        (content.trim().startsWith("{") || content.trim().startsWith("["))) {
      try {
        content = JSON.parse(content);
      } catch (e) {
        console.log("Not valid JSON, keeping as string");
      }
    }
  
    return content;
  };
  
  /**
   * Get MIME type for file download
   */
  export const getContentType = (outputType) => {
    const contentTypes = {
      markdown: 'text/markdown',
      txt: 'text/plain',
      json: 'application/json',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      js: 'text/javascript',
      html: 'text/html'
    };
    return contentTypes[outputType] || 'application/octet-stream';
  };
  
  /**
   * Download helpers
   */
  export const downloadBlob = async (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      a.click();
    } finally {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };
  
  export const createAndDownloadFile = async (content, outputType, baseFilename) => {
    const { content: processedContent, extension } = await createFormattedFile(content, outputType, baseFilename);
    const blob = processedContent instanceof Blob ? processedContent : 
      new Blob([processedContent], { type: getContentType(outputType) });
    await downloadBlob(blob, `${baseFilename}.${extension}`);
  };