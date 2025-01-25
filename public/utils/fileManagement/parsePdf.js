// parsePdf.js

const MAX_IMAGE_SIZE = 1024 * 1024;
const CMAP_PACKED = true;

// Utility functions
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getPdfResourcePath = () => {
  const scripts = document.getElementsByTagName("script");
  let pdfJsPath = "";

  for (const script of scripts) {
    if (script.src.includes("pdf.min.js")) {
      pdfJsPath = new URL(script.src);
      break;
    }
  }

  if (!pdfJsPath) {
    pdfJsPath = new URL(window.location.origin);
  }

  return new URL("./plugins/", pdfJsPath).href;
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
    disableCombineTextItems: false,
  });
  return textContent.items.some((item) => (item.str || "").trim().length > 0);
};

async function getPageImages(page, pageNumber) {
    const images = [];
    try {
      const opList = await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1.0 });
      const fns = opList.fnArray;
      const args = opList.argsArray;
      let imgsFound = 0;
  
      // Track all image and form references to avoid duplicates
      const processedRefs = new Set();
  
      // Process each operator
      for (let i = 0; i < fns.length; i++) {
        const fn = fns[i];
        const arg = args[i];
  
        if ([
          pdfjsLib.OPS.paintJpegXObject,
          pdfjsLib.OPS.paintImageXObject,
          pdfjsLib.OPS.paintImageMaskXObject,
          pdfjsLib.OPS.paintInlineImageXObject,
          pdfjsLib.OPS.paintFormXObject,  // Added Form XObject support
          pdfjsLib.OPS.beginInlineImage   // Added Inline Image support
        ].includes(fn)) {
          let imgKey = arg[0];
          
          // Handle inline images differently as they don't have a reference key
          if (fn === pdfjsLib.OPS.beginInlineImage) {
            imgKey = `inline_${pageNumber}_${imgsFound}`;
          }
  
          // Skip if we've already processed this reference
          if (processedRefs.has(imgKey)) continue;
          processedRefs.add(imgKey);
          
          imgsFound++;
  
          try {
            let imageData;
            
            if (fn === pdfjsLib.OPS.beginInlineImage) {
              // Handle inline image data
              const imageDict = arg[0];  // Image dictionary
              const imageBytes = arg[1];  // Raw image data
              imageData = {
                width: imageDict.width,
                height: imageDict.height,
                data: imageBytes,
                kind: imageDict.colorSpace ? 'RGB' : 'RGBA'
              };
            } else {
              // Get image data from object store
              imageData = await new Promise((resolve) => {
                page.objs.get(imgKey, (img) => {
                  resolve(img);
                });
              });
            }
  
            if (!imageData) {
              console.warn(`No image data for ${imgKey}`);
              continue;
            }
  
            const canvas = document.createElement('canvas');
  
            if (fn === pdfjsLib.OPS.paintFormXObject) {
              // Handle Form XObjects by rendering them to canvas
              const formViewport = page.getViewport({ scale: 1.0 });
              canvas.width = formViewport.width;
              canvas.height = formViewport.height;
              
              const ctx = canvas.getContext('2d');
              const renderContext = {
                canvasContext: ctx,
                viewport: formViewport,
                enableWebGL: true
              };
  
              // Render the form XObject
              await page.render(renderContext).promise;
            } else if (imageData.bitmap) {
              canvas.width = imageData.bitmap.width;
              canvas.height = imageData.bitmap.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(imageData.bitmap, 0, 0);
            } else if (imageData instanceof ImageBitmap) {
              canvas.width = imageData.width;
              canvas.height = imageData.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(imageData, 0, 0);
            } else if (imageData.data) {
              canvas.width = imageData.width;
              canvas.height = imageData.height;
              const ctx = canvas.getContext('2d');
              
              let imgData;
              if (imageData.kind === 'RGB') {
                const rgba = new Uint8ClampedArray(imageData.width * imageData.height * 4);
                for (let i = 0; i < imageData.data.length; i += 3) {
                  const j = (i / 3) * 4;
                  rgba[j] = imageData.data[i];
                  rgba[j + 1] = imageData.data[i + 1];
                  rgba[j + 2] = imageData.data[i + 2];
                  rgba[j + 3] = 255;
                }
                imgData = new ImageData(rgba, imageData.width, imageData.height);
              } else {
                imgData = new ImageData(
                  new Uint8ClampedArray(imageData.data),
                  imageData.width,
                  imageData.height
                );
              }
              ctx.putImageData(imgData, 0, 0);
            }
  
            // Get data URL
            const dataUrl = canvas.toDataURL('image/png', 0.95);
            
            // Get blob for size information
            const blob = await new Promise(resolve => {
              canvas.toBlob(blob => resolve(blob), 'image/png', 0.95);
            });
  
            if (dataUrl) {
              images.push({
                dataUrl,
                width: canvas.width,
                height: canvas.height,
                pageNumber,
                id: imgKey,
                size: blob ? blob.size : dataUrl.length,
                isFormXObject: fn === pdfjsLib.OPS.paintFormXObject,
                isInlineImage: fn === pdfjsLib.OPS.beginInlineImage,
                viewport: {
                  width: viewport.width,
                  height: viewport.height
                }
              });
            }
          } catch (error) {
            console.warn(`Error processing image ${imgKey}:`, error);
          }
        }
      }
  
      // Handle page as image if no other images found
      if (images.length === 0) {
        const hasText = await hasTextContent(page);
        if (!hasText) {
          const scale = 2.0;
          const scaledViewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          
          const ctx = canvas.getContext('2d');
          const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport,
            enableWebGL: true
          };
  
          await page.render(renderContext).promise;
          const dataUrl = canvas.toDataURL('image/png', 0.95);
          const blob = await new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png', 0.95);
          });
  
          if (dataUrl) {
            images.push({
              dataUrl,
              width: scaledViewport.width,
              height: scaledViewport.height,
              pageNumber,
              id: `page-${pageNumber}`,
              size: blob ? blob.size : dataUrl.length,
              isFullPage: true,
              viewport: {
                width: viewport.width,
                height: viewport.height
              }
            });
          }
        }
      }
  
      console.log(`Page ${pageNumber}: Successfully processed ${images.length} images`);
  
    } catch (error) {
      console.warn(`Failed to process page ${pageNumber}:`, error);
    }
  
    return images;
  }

export class PdfParser {
  constructor(options = {}) {
    this.options = {
      imageScale: options.imageScale || 2.0,
      imageFormat: options.imageFormat || "image/png",
      imageQuality: options.imageQuality || 0.92,
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
      ...options,
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
      throw new Error("PDF parsing failed: No file or buffer provided");
    }

    try {
      let data;
      if (fileOrBuffer instanceof ArrayBuffer) {
        data = fileOrBuffer;
      } else if (fileOrBuffer instanceof Blob) {
        data = await fileOrBuffer.arrayBuffer();
      } else if (typeof fileOrBuffer.arrayBuffer === "function") {
        data = await fileOrBuffer.arrayBuffer();
      } else {
        throw new Error("Invalid input: Expected File, Blob, or ArrayBuffer");
      }

      if (!data || data.byteLength === 0) {
        throw new Error("Invalid PDF data: Empty buffer");
      }

      const parsePromise = this._doParse(data);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("PDF parsing timed out")),
          this.options.timeout
        );
      });

      return await Promise.race([parsePromise, timeoutPromise]);
    } catch (error) {
      console.error("PDF parsing error:", error);
      throw new Error(
        `PDF parsing failed: ${error.message || "Unknown error"}`
      );
    }
  }

  async _doParse(data) {
    const basePath = getPdfResourcePath();

    this._loadingTask = pdfjsLib.getDocument({
      data,
      maxImageSize: this.options.maxImageSize,
      cMapUrl: this.options.cMapPath || `${basePath}pdfjs-dist/cmaps/`,
      cMapPacked: CMAP_PACKED,
      standardFontDataUrl:
        this.options.standardFontPath ||
        `${basePath}pdfjs-dist/standard_fonts/`,
      useSystemFonts: this.options.useSystemFonts,
      enableXfa: this.options.enableXfa,
      disableRange: this.options.disableRange,
      disableStream: this.options.disableStream,
      disableAutoFetch: this.options.disableAutoFetch,
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
      isScanned: false,
    };

    // Get document-level metadata
    if (pdf.getAttachments) {
      result.attachments = await pdf.getAttachments().catch(() => ({}));
    }
    if (pdf.getOutline) {
      result.outlineItems = await pdf.getOutline().catch(() => []);
    }
    if (pdf.getPermissions) {
      result.permissions = await pdf.getPermissions().catch(() => null);
    }

    // Process each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // Extract text content
      const textContent = await page.getTextContent({
        includeMarkedContent: true,
        disableCombineTextItems: false,
      });

      const text = textContent.items.map((item) => ({
        text: item.str || "",
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        fontSize: item.transform
          ? Math.sqrt(
              item.transform[0] * item.transform[0] +
                item.transform[1] * item.transform[1]
            )
          : 0,
        fontFamily: item.fontName || "unknown",
      }));

      // Extract images
      const images = await getPageImages(page, i);

      result.text.push(text);
      result.images.push(...images);

      // Update scanned status
      result.isScanned =
        result.isScanned || (!text.length && images.length > 0);

      // Update progress if callback provided
      if (this.options.onProgress) {
        this.options.onProgress({
          currentPage: i,
          totalPages: pdf.numPages,
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

// Helper hook for Vue applications
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
          totalPages,
        };
      },
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
    progress: readonly(progress),
  };
}
