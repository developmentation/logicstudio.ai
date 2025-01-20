// composables/useTranscripts.js

export const useTranscripts = () => {
  // Supported formats for validation
  const SUPPORTED_EXTENSIONS = [
    // Audio extensions
    '.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac', 
    '.aiff', '.flac', '.caf', '.mka', '.wma',
    // Video extensions
    '.mp4', '.ogv', '.mov', '.mkv', '.avi', 
    '.wmv', '.3gp', '.flv'
  ];

  // Validation helper
  const validateFile = (file) => {
    const errors = [];
    
    if (!file) {
      errors.push('No file selected');
      return errors;
    }

    const maxSize = 1000 * 1024 * 1024; // 1GB
    if (file.size > maxSize) {
      errors.push('File size exceeds 1GB limit');
    }

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      errors.push('Unsupported file format. Please upload a valid audio or video file');
    }

    return errors;
  };

  // Core transcription function
  const transcribeFile = async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        }
      });

      return {
        success: true,
        data: response.data.transcript
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Transcription failed'
      };
    }
  };

  return {
    validateFile,
    transcribeFile,
    SUPPORTED_EXTENSIONS
  };
};