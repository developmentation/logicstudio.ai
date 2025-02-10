// formatMarkdownTables.js

/**
 * Extracts and parses markdown tables from text content
 */

/**
 * Clean and normalize markdown table content
 * @param {string} content Raw table content
 * @returns {string} Normalized content with consistent spacing and pipes
 */
const normalizeTable = (content) => {
    return content
      .split('\n')
      .map(line => {
        line = line.trim();
        // Ensure line starts and ends with pipe if it contains any pipes
        if (line.includes('|')) {
          line = line.startsWith('|') ? line : '| ' + line;
          line = line.endsWith('|') ? line : line + ' |';
        }
        return line;
      })
      .filter(line => line.length > 0)
      .join('\n');
  };
  
  /**
   * Parse a markdown table string into structured data
   * @param {string} tableText Markdown table content
   * @returns {Object|null} Parsed table object or null if invalid
   */
  const parseTable = (tableText) => {
    // Split into lines and clean up
    const lines = normalizeTable(tableText).split('\n');
    if (lines.length < 3) return null;  // Need header, separator, and at least one row
  
    // Validate and get separator line index
    const separatorIndex = lines.findIndex(line => 
      line.replace(/\s/g, '').match(/^\|?[\-:|]+\|?$/)
    );
    if (separatorIndex !== 1) return null;  // Separator must be second line
  
    // Parse header row (first line)
    const headers = lines[0]
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cell => cell.trim());
  
    // Parse alignments from separator
    const alignments = lines[1]
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cell => {
        const clean = cell.trim();
        if (clean.startsWith(':') && clean.endsWith(':')) return 'center';
        if (clean.endsWith(':')) return 'right';
        return 'left';
      });
  
    // Parse data rows
    const rows = lines.slice(2)
      .filter(line => line.includes('|'))
      .map(line => {
        const cells = line
          .replace(/^\||\|$/g, '')
          .split('|')
          .map(cell => cell.trim());
        
        // Ensure each row has same number of cells as header
        while (cells.length < headers.length) cells.push('');
        return cells.slice(0, headers.length);
      });
  
    return {
      headers,
      alignments,
      rows,
      columnCount: headers.length
    };
  };
  
  /**
   * Find all markdown tables in text content
   * @param {string} text Content to search
   * @returns {Array} Array of found table objects with their positions
   */
  const findTables = (text) => {
    const tables = [];
    const lines = text.split('\n');
    let tableStart = -1;
    let tableLines = [];
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isTableLine = line.includes('|');
  
      if (isTableLine) {
        if (tableStart === -1) tableStart = i;
        tableLines.push(line);
      } else if (tableLines.length > 0) {
        if (tableLines.length >= 3) {  // Valid tables need at least 3 lines
          const tableContent = tableLines.join('\n');
          const parsed = parseTable(tableContent);
          if (parsed) {
            tables.push({
              start: tableStart,
              end: i - 1,
              content: tableContent,
              data: parsed
            });
          }
        }
        tableStart = -1;
        tableLines = [];
      }
    }
  
    // Handle table at end of content
    if (tableLines.length >= 3) {
      const tableContent = tableLines.join('\n');
      const parsed = parseTable(tableContent);
      if (parsed) {
        tables.push({
          start: tableStart,
          end: lines.length - 1,
          content: tableContent,
          data: parsed
        });
      }
    }
  
    return tables;
  };
  
  /**
   * Clean cell content for output
   * @param {string} content Cell content to clean
   * @returns {string} Cleaned content
   */
  const cleanContent = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
      .replace(/\*(.*?)\*/g, '$1')      // Remove italic
      .replace(/`(.*?)`/g, '$1')        // Remove code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // Clean links
      .replace(/<[^>]+>/g, '')          // Remove HTML tags
      .trim();
  };
  
  export {
    parseTable,
    findTables,
    cleanContent,
    normalizeTable
  };