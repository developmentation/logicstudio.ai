// parsePdf.js

// Configuration constants
const MAX_IMAGE_SIZE = 1024 * 1024;
const CMAP_PACKED = true;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const getPdfResourcePath = () => {
  const scripts = document.getElementsByTagName('script');
  let pdfJsPath = '';
  
  for (const script of scripts) {
    if (script.src.includes('pdf.min.js')) {
      pdfJsPath = new URL(script.src);
      break;
    }
  }

  if (!pdfJsPath) {
    pdfJsPath = new URL(window.location.origin);
  }

  return new URL('./plugins/', pdfJsPath).href;
};

const configurePdfWorker = () => {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const basePath = getPdfResourcePath();
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${basePath}pdf.worker.min.mjs`;
    }
  } catch (error) {
    throw new Error(`Failed to configure PDF.js worker: ${error.message}`);
  }
};

const hasTextContent = async (page) => {
  const textContent = await page.getTextContent({
    includeMarkedContent: true,
    disableCombineTextItems: false
  });
  return textContent.items.some(item => (item.str || '').trim().length > 0);
};

async function getPageImages(page, pageNumber) {
  const images = [];
  try {
    const opList = await page.getOperatorList();
    const validObjectTypes = [
      pdfjsLib.OPS.paintImageXObject,
      pdfjsLib.OPS.paintImageXObjectRepeat,
      pdfjsLib.OPS.paintJpegXObject
    ];

    const processedImages = new Set();

    for (let i = 0; i < opList.fnArray.length; i++) {
      if (validObjectTypes.includes(opList.fnArray[i])) {
        const imageName = opList.argsArray[i][0];
        
        if (!processedImages.has(imageName)) {
          processedImages.add(imageName);
          
          try {
            const imageObj = await new Promise((resolve) => {
              page.objs.get(imageName, (obj) => {
                resolve(obj);
              });
            });

            if (!imageObj?.data) {
              console.warn(`No valid image data for ${imageName}`);
              continue;
            }

            // Check image size
            const imageSize = imageObj.width * imageObj.height;
            if (imageSize > MAX_IMAGE_SIZE) {
              console.warn(`Image ${imageName} exceeds maximum size`);
              continue;
            }

            const canvas = document.createElement('canvas');
            canvas.width = imageObj.width;
            canvas.height = imageObj.height;
            
            const ctx = canvas.getContext('2d');
            const imageData = new ImageData(
              new Uint8ClampedArray(imageObj.data.buffer),
              imageObj.width,
              imageObj.height
            );
            
            ctx.putImageData(imageData, 0, 0);

            // Convert to blob
            const blob = await new Promise(resolve => {
              canvas.toBlob(blob => resolve(blob), 'image/png', 0.95);
            });

            if (blob) {
              images.push({
                blob,
                width: imageObj.width,
                height: imageObj.height,
                pageNumber,
                id: imageName
              });
            }
          } catch (error) {
            console.warn(`Error processing image ${imageName}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to extract images from page ${pageNumber}:`, error);
  }
  return images;
}

export class PdfParser {
  constructor(options = {}) {
    this.options = {
      imageScale: options.imageScale || 2.0,
      imageFormat: options.imageFormat || 'image/png',
      imageQuality: options.imageQuality || 0.95,
      maxPageSize: options.maxPageSize || 5000,
      maxImageSize: options.maxImageSize || MAX_IMAGE_SIZE,
      imageLoadDelay: options.imageLoadDelay || 100,
      imageRetries: options.imageRetries || 3,
      imageRetryDelay: options.imageRetryDelay || 200,
      includePlaceholders: options.includePlaceholders ?? false,
      timeout: options.timeout || 30000,
      workerPath: options.workerPath,
      cMapPath: options.cMapPath,
      standardFontPath: options.standardFontPath,
      useSystemFonts: options.useSystemFonts ?? true,
      enableXfa: options.enableXfa ?? true,
      disableRange: options.disableRange ?? false,
      disableStream: options.disableStream ?? false,
      disableAutoFetch: options.disableAutoFetch ?? false,
      ...options
    };
    
    if (this.options.workerPath) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = this.options.workerPath;
    } else {
      configurePdfWorker();
    }

    this._loadingTask = null;
  }

  async parse(fileOrBuffer) {
    if (!fileOrBuffer) {
      throw new Error('PDF parsing failed: No file or buffer provided');
    }

    try {
      let data;
      if (fileOrBuffer instanceof ArrayBuffer) {
        data = fileOrBuffer;
      } else if (fileOrBuffer instanceof Blob) {
        data = await fileOrBuffer.arrayBuffer();
      } else if (typeof fileOrBuffer.arrayBuffer === 'function') {
        data = await fileOrBuffer.arrayBuffer();
      } else {
        throw new Error('Invalid input: Expected File, Blob, or ArrayBuffer');
      }

      if (!data || data.byteLength === 0) {
        throw new Error('Invalid PDF data: Empty buffer');
      }

      const parsePromise = this._doParse(data);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PDF parsing timed out')), this.options.timeout);
      });

      return await Promise.race([parsePromise, timeoutPromise]);
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error(`PDF parsing failed: ${error.message || 'Unknown error'}`);
    }
  }

  async _doParse(data) {
    const basePath = getPdfResourcePath();
    
    this._loadingTask = pdfjsLib.getDocument({
      data,
      maxImageSize: this.options.maxImageSize,
      cMapUrl: this.options.cMapPath || `${basePath}pdfjs-dist/cmaps/`,
      cMapPacked: CMAP_PACKED,
      standardFontDataUrl: this.options.standardFontPath || `${basePath}pdfjs-dist/standard_fonts/`,
      useSystemFonts: this.options.useSystemFonts,
      enableXfa: this.options.enableXfa,
      disableRange: this.options.disableRange,
      disableStream: this.options.disableStream,
      disableAutoFetch: this.options.disableAutoFetch
    });

    if (this.options.onProgress) {
      this._loadingTask.onProgress = ({ loaded, total }) => {
        this.options.onProgress({ loaded, total });
      };
    }

    const pdf = await this._loadingTask.promise;

    const result = {
      metadata: await pdf.getMetadata().catch(() => ({})),
      pageCount: pdf.numPages,
      text: [],
      images: [],
      pages: [],
      isScanned: false
    };
    
    if (pdf.getAttachments) {
      result.attachments = await pdf.getAttachments().catch(() => ({}));
    }
    if (pdf.getOutline) {
      result.outlineItems = await pdf.getOutline().catch(() => []);
    }
    if (pdf.getPermissions) {
      result.permissions = await pdf.getPermissions().catch(() => null);
    }

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const images = await getPageImages(page, i);
      
      const textContent = await page.getTextContent({
        includeMarkedContent: true,
        disableCombineTextItems: false
      });

      const text = textContent.items.map(item => ({
        text: item.str || '',
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        fontSize: item.transform ? Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]) : 0,
        fontFamily: item.fontName || 'unknown'
      }));

      result.text.push(text);
      result.images.push(...images);
      result.isScanned = result.isScanned || !text.length;

      if (this.options.onProgress) {
        this.options.onProgress({
          currentPage: i,
          totalPages: pdf.numPages
        });
      }
    }

    return result;
  }

  destroy() {
    if (this._loadingTask) {
      this._loadingTask.destroy();
      this._loadingTask = null;
    }
  }
}

export function usePdfParser(options = {}) {
  const parser = ref(null);
  const parsing = ref(false);
  const error = ref(null);
  const result = ref(null);
  const progress = ref({ loaded: 0, total: 0 });

  const createParser = () => {
    parser.value = new PdfParser({
      ...options,
      onProgress: ({ loaded, total, currentPage, totalPages }) => {
        progress.value = { 
          loaded, 
          total,
          currentPage,
          totalPages
        };
      }
    });
  };

  const parse = async (file) => {
    if (!parser.value) {
      createParser();
    }

    parsing.value = true;
    error.value = null;
    result.value = null;
    progress.value = { loaded: 0, total: 0 };

    try {
      result.value = await parser.value.parse(file);
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      parsing.value = false;
    }

    return result.value;
  };

  const cleanup = () => {
    if (parser.value) {
      parser.value.destroy();
      parser.value = null;
    }
  };

  return {
    cleanup,
    parse,
    parsing: readonly(parsing),
    error: readonly(error),
    result: readonly(result),
    progress: readonly(progress)
  };
}