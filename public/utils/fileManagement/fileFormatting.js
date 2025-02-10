// fileFormatting.js
import { UnifiedMarkdownRenderer, COMMON_STYLES } from './docx/unifiedMarkdownRenderer.js';
// import { EnhancedPDFRenderer, PDF_STYLES } from './_exploratory/enhancedPDFRenderer.js';
import { convertToPdf, DEFAULT_STYLES as PDF_STYLES } from './pdf/formatPdfFromMarkdown.js';

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
  if (content == null) return '';
  
  if (typeof content === 'object') {
    if (content.content !== undefined) {
      return processContent(content.content);
    }
    return JSON.stringify(content, null, 2);
  }
  
  let processed = String(content);
  const unclosedBlocks = (processed.match(/```/g) || []).length;
  if (unclosedBlocks % 2 !== 0) {
    processed += '\n```';
  }
  
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
          const renderer = new UnifiedMarkdownRenderer({
            ...COMMON_STYLES,
            ...options
          });
          
          const doc = await renderer.toDocx(processedContent);
          const blob = await docx.Packer.toBlob(doc);
          
          return {
            content: blob,
            extension: 'docx',
            mimeType: FORMATS.docx.mime
          };
        } catch (error) {
          console.error('DOCX conversion error:', error);
          return {
            content: processedContent,
            extension: 'txt',
            mimeType: FORMATS.txt.mime
          };
        }
      }

      //For the Experimental version
      // case 'pdf': {
      //   try {
      //     const pdfRenderer = new EnhancedPDFRenderer({
      //       ...PDF_STYLES,
      //       ...options
      //     });
          
      //     const doc = await pdfRenderer.renderToPDF(processedContent, baseFilename);
      //     const buffer = doc.output('arraybuffer');
          
      //     return {
      //       content: buffer,
      //       extension: 'pdf',
      //       mimeType: FORMATS.pdf.mime
      //     };
      //   } catch (error) {
      //     console.error('PDF conversion error:', error);
      //     return {
      //       content: `Conversion Error: ${error.message}\n\nOriginal Content:\n${processedContent}`,
      //       extension: 'txt',
      //       mimeType: FORMATS.txt.mime
      //     };
      //   }
      // }

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