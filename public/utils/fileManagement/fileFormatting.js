// fileFormatting.js
import { MarkdownConverter, DEFAULT_STYLES as DOCX_STYLES } from './formatDocxFromMarkdown.js';
import { convertToPdf, DEFAULT_STYLES as PDF_STYLES } from './formatPdfFromMarkdown.js';

const FORMATS = {
  markdown: { extension: 'md', mime: 'text/markdown' },
  txt: { extension: 'txt', mime: 'text/plain' },
  json: { extension: 'json', mime: 'application/json' },
  docx: { 
    extension: 'docx', 
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  },
  pdf: { extension: 'pdf', mime: 'application/pdf' },
  js: { extension: 'js', mime: 'text/javascript' },
  html: { extension: 'html', mime: 'text/html' }
};

/**
 * Process input content to ensure consistent format
 */
const processContent = (content) => {
  // Handle null/undefined
  if (content == null) return '';

  // Handle objects and arrays
  if (typeof content === 'object') {
      // If it has a content property, use that
      if (content.content !== undefined) {
          return processContent(content.content);
      }
      // Otherwise stringify the object nicely
      return JSON.stringify(content, null, 2);
  }

  // Sanitize content
  let processed = String(content);
  
  // Fix unclosed code blocks
  const unclosedBlocks = (processed.match(/```/g) || []).length;
  if (unclosedBlocks % 2 !== 0) {
      processed += '\n```';
  }
  
  // Normalize table structures
  processed = processed.replace(/\|[^\n|]+\|[^\n]*\n(?!\s*\|)/g, match => match + '\n');
  
  return processed;
};

/**
 * Create formatted file from content
 */
const createFormattedFile = async (content, outputType, baseFilename, options = {}) => {
  try {
    if (!FORMATS[outputType]) {
      throw new Error(`Unsupported output format: ${outputType}`);
    }

    const processedContent = processContent(content);

    switch (outputType) {
      case 'markdown':
      case 'txt':
      case 'js':
      case 'html': {
        return {
          content: processedContent,
          extension: FORMATS[outputType].extension,
          mimeType: FORMATS[outputType].mime
        };
      }

      case 'json': {
        let jsonContent;
        try {
          jsonContent = JSON.parse(processedContent);
        } catch {
          jsonContent = { content: processedContent };
        }
        return {
          content: JSON.stringify(jsonContent, null, 2),
          extension: 'json',
          mimeType: FORMATS.json.mime
        };
      }

      case 'docx': {
        try {
            // Create new converter instance with merged styles
            const converter = new MarkdownConverter({
                ...DOCX_STYLES,
                ...options
            });
            
            // Convert markdown to docx document
            const doc = converter.convertMarkdown(processedContent);
            
            // Convert to blob using docx.Packer
            const blob = await docx.Packer.toBlob(doc);
            
            return {
                content: blob,
                extension: 'docx',
                mimeType: FORMATS.docx.mime
            };
        } catch (error) {
            console.error('DOCX conversion error:', error);
            // Fallback to plain text if conversion fails
            return {
                content: processedContent,
                extension: 'txt',
                mimeType: FORMATS.txt.mime
            };
        }
      }

      case 'pdf': {
        const pdf = new jspdf.jsPDF();
        convertToPdf(pdf, processedContent, {
          ...PDF_STYLES,
          ...options
        });
        const buffer = pdf.output('arraybuffer');
        return {
          content: buffer,
          extension: 'pdf',
          mimeType: FORMATS.pdf.mime
        };
      }
    }
  } catch (error) {
    console.error('Error creating formatted file:', error);
    throw error;
  }
};

/**
 * Download blob as file
 */
const downloadBlob = async (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  
  try {
    link.click();
    await new Promise(resolve => setTimeout(resolve, 100));
  } finally {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }
};

/**
 * Create and download formatted file
 */
const createAndDownloadFile = async (content, outputType, baseFilename, options = {}) => {
  try {
    const { content: formattedContent, extension, mimeType } = 
      await createFormattedFile(content, outputType, baseFilename, options);
    
    const blob = formattedContent instanceof Blob ? formattedContent :
                formattedContent instanceof ArrayBuffer ? new Blob([formattedContent], { type: mimeType }) :
                new Blob([formattedContent], { type: mimeType });

    await downloadBlob(blob, `${baseFilename}.${extension}`);
  } catch (error) {
    console.error('Error processing file download:', error);
    throw error;
  }
};

export {
  createFormattedFile,
  createAndDownloadFile,
  downloadBlob,
  FORMATS
};