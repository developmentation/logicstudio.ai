// formatDocxFromMarkdown.js 
import { parseTable, findTables, cleanContent } from './formatMarkdownTables.js';

// Default styling configuration remains the same
const DEFAULT_STYLES = {
  font: {
    name: "Calibri",
    size: 24,          // 12pt (in half-points)
    headerSizes: {     // Header sizes in half-points
      h1: 32,          // 16pt
      h2: 28,          // 14pt
      h3: 26,          // 13pt
      h4: 24,          // 12pt
      h5: 22,          // 11pt
      h6: 20,          // 10pt
    }
  },
  colors: {
    header: "000000",
    text: "333333",
    muted: "666666",
    link: "0563C1",
    tableHeader: "666666",
    tableBorder: "CCCCCC",
    codeBackground: "F5F5F5"
  },
  table: {
    borders: {
      color: "CCCCCC",
      size: 1,
      style: "single"
    },
    header: {
      fill: "F2F2F2",
      bold: true
    },
    cell: {
      margins: {
        top: 100,    // 1/20th of a point
        bottom: 100,
        left: 150,
        right: 150
      },
      padding: 100
    }
  },
  spacing: {
    paragraph: {
      before: 120,   // 6pt in twentieths of a point
      after: 120,
      line: 360     // 1.5 line spacing in twentieths of a point
    },
    header: {
      before: 240,   // 12pt
      after: 120     // 6pt
    }
  },
  margins: {
    page: {
      top: 1440,     // 1 inch in twentieths of a point
      right: 1440,
      bottom: 1440,
      left: 1440
    }
  }
};

// Helper functions for creating paragraphs and alignments remain the same
const getAlignment = (alignment) => {
  const alignments = {
    'left': docx.AlignmentType.LEFT,
    'center': docx.AlignmentType.CENTER,
    'right': docx.AlignmentType.RIGHT,
    'justify': docx.AlignmentType.JUSTIFIED
  };
  return alignments[alignment] || alignments.left;
};

const createStyledParagraph = (text, options = {}) => {
  const {
    size = DEFAULT_STYLES.font.size,
    bold = false,
    italic = false,
    color = DEFAULT_STYLES.colors.text,
    spacing = DEFAULT_STYLES.spacing.paragraph,
    alignment = 'left',
    font = DEFAULT_STYLES.font.name,
    bullet = false
  } = options;

  const paragraph = new docx.Paragraph({
    alignment: getAlignment(alignment),
    spacing: spacing,
    bullet: bullet,
    children: [
      new docx.TextRun({
        text: cleanContent(text),
        size: size,
        bold: bold,
        italic: italic,
        color: color,
        font: font
      })
    ]
  });

  return paragraph;
};

const createHeading = (text, level, styles = DEFAULT_STYLES) => {
  const headerSize = styles.font.headerSizes[`h${level}`];
  const spacing = {
    before: styles.spacing.header.before,
    after: styles.spacing.header.after,
    line: styles.spacing.paragraph.line
  };

  return createStyledParagraph(text, {
    size: headerSize,
    bold: true,
    color: styles.colors.header,
    spacing: spacing
  });
};

/**
 * Create a code block with proper formatting
 */
const createCodeBlock = (code, styles = DEFAULT_STYLES) => {
  // Split the code into lines to preserve formatting
  const lines = code.split('\n');
  
  return new docx.Paragraph({
    spacing: {
      before: styles.spacing.paragraph.before,
      after: styles.spacing.paragraph.after,
      line: 300 // Slightly tighter line spacing for code
    },
    shading: {
      type: docx.ShadingType.SOLID,
      color: styles.colors.codeBackground
    },
    children: [
      new docx.TextRun({
        text: lines.join('\n'),
        font: "Courier New",
        size: styles.font.size - 2,
        color: styles.colors.text
      })
    ]
  });
};

/**
 * Create a table with proper formatting
 */
const createTable = (tableData, styles = DEFAULT_STYLES) => {
  const { headers, alignments, rows } = tableData;

  return new docx.Table({
    width: {
      size: 100,
      type: docx.WidthType.PERCENTAGE
    },
    borders: {
      top: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color },
      bottom: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color },
      left: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color },
      right: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color }
    },
    rows: [
      new docx.TableRow({
        tableHeader: true,
        children: headers.map((header, i) => 
          createTableCell(header, { 
            alignment: alignments[i], 
            isHeader: true,
            styles 
          })
        )
      }),
      ...rows.map(row => 
        new docx.TableRow({
          children: row.map((cell, i) => 
            createTableCell(cell, { 
              alignment: alignments[i],
              styles
            })
          )
        })
      )
    ]
  });
};

const createTableCell = (content, options = {}) => {
  const {
    alignment = 'left',
    isHeader = false,
    styles = DEFAULT_STYLES
  } = options;

  return new docx.TableCell({
    borders: {
      top: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color },
      bottom: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color },
      left: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color },
      right: { style: docx.BorderStyle.SINGLE, size: styles.table.borders.size, color: styles.table.borders.color }
    },
    shading: isHeader ? { fill: styles.table.header.fill } : undefined,
    margins: styles.table.cell.margins,
    children: [
      createStyledParagraph(content, {
        bold: isHeader,
        alignment: alignment,
        color: isHeader ? styles.colors.tableHeader : styles.colors.text
      })
    ]
  });
};

/**
 * Process markdown content into DOCX elements
 */
const processMarkdownContent = (content, styles = DEFAULT_STYLES) => {
  const elements = [];
  const lines = content.split('\n');
  let i = 0;
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLanguage = '';

  while (i < lines.length) {
    const line = lines[i].trim();

    // Handle code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
        codeBlockContent = '';
      } else {
        // Ending a code block
        elements.push(createCodeBlock(codeBlockContent, styles));
        inCodeBlock = false;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      i++;
      continue;
    }

    // Handle regular markdown elements
    if (line.startsWith('|')) {
      let tableContent = '';
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableContent += lines[i] + '\n';
        i++;
      }

      const table = parseTable(tableContent);
      if (table) {
        elements.push(createTable(table, styles));
        elements.push(createStyledParagraph('', { spacing: { before: 120, after: 120 } }));
      }
      continue;
    }

    // Process headers and other elements
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#+\s*/, '');
      elements.push(createHeading(text, level, styles));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(createStyledParagraph(line.substring(2), { bullet: true }));
    } else if (line.length > 0) {
      elements.push(createStyledParagraph(line));
    } else if (i > 0 && i < lines.length - 1) {
      // Add spacing between paragraphs, but not at start/end
      elements.push(createStyledParagraph(''));
    }

    i++;
  }

  return elements;
};

/**
 * Convert markdown to DOCX document
 */
const convertToDocx = (content, options = {}) => {
  const styles = { ...DEFAULT_STYLES, ...options };
  
  const doc = new docx.Document({
    sections: [{
      properties: {
        page: {
          margin: styles.margins.page
        }
      },
      headers: {
        default: new docx.Header({
          children: [
            createStyledParagraph('Generated by LogicStudio.ai', {
              alignment: 'right',
              color: styles.colors.muted,
              size: 20
            })
          ]
        })
      },
      footers: {
        default: new docx.Footer({
          children: [
            new docx.Paragraph({
              alignment: docx.AlignmentType.CENTER,
              children: [
                new docx.TextRun({
                  children: ['Page ', docx.PageNumber.CURRENT, ' of ', docx.PageNumber.TOTAL_PAGES],
                  size: 20,
                  color: styles.colors.muted
                })
              ]
            })
          ]
        })
      },
      children: processMarkdownContent(content, styles)
    }]
  });

  return doc;
};

export {
  convertToDocx,
  DEFAULT_STYLES
};