const { transcribeFile } = require("../tools/deepgram.js");
const { upload } = require('../tools/upload');
const fs = require("fs");
const path = require("path");

// Supported file extensions (lowercase)
const SUPPORTED_EXTENSIONS = [
  // Audio extensions
  '.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac', 
  '.aiff', '.flac', '.caf', '.mka', '.wma',
  // Video extensions
  '.mp4', '.ogv', '.mov', '.mkv', '.avi', 
  '.wmv', '.3gp', '.flv'
];

// Helper function to check file extension
const hasValidExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
};

// Supported media formats
const SUPPORTED_FORMATS = [
  // Audio formats
  'audio/mpeg',        // .mp3
  'audio/wav',         // .wav
  'audio/ogg',         // .ogg
  'audio/webm',        // .webm
  'audio/mp4',         // .mp4 audio
  'audio/x-m4a',       // .m4a
  'audio/aac',         // .aac
  'audio/x-aiff',      // .aiff
  'audio/flac',        // .flac
  'audio/x-caf',       // .caf
  'audio/x-matroska',  // .mka
  'audio/x-ms-wma',    // .wma
  // Video formats
  'video/mp4',         // .mp4
  'video/webm',        // .webm
  'video/ogg',         // .ogv
  'video/quicktime',   // .mov
  'video/x-matroska',  // .mkv
  'video/x-msvideo',   // .avi
  'video/x-ms-wmv',    // .wmv
  'video/3gpp',        // .3gp
  'video/x-flv'        // .flv
];

// File filter for multer
const fileFilter = (req, file, cb) => {
  const isValidMime = SUPPORTED_FORMATS.includes(file.mimetype);
  const isValidExtension = hasValidExtension(file.originalname);
  
  if (isValidMime || isValidExtension) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Please upload a valid audio or video file.'), false);
  }
};

// Enhanced multer configuration
const uploadConfig = upload.single('file');

exports.transcribe = [
  // Enhanced file upload middleware
  (req, res, next) => {
    uploadConfig(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File size too large. Maximum size is 1GB.'
          });
        }
        return res.status(400).json({
          error: err.message
        });
      }
      next();
    });
  },
  
  // Main transcription handler
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    try {
      console.log("Transcribing File:", req.file.filename);
      
      const { result, error } = await transcribeFile(req.file.filename);
      
      if (error) {
        console.error('Error during transcription:', error);
        return res.status(500).json({
          error: 'Transcription failed',
          details: error
        });
      }

      // Enhanced transcript formatting
      const formattedTranscript = formatTranscript(result);

      res.status(200).json({
        message: "Transcription completed successfully",
        transcript: formattedTranscript
      });

    } catch (error) {
      console.error('Error processing transcription:', error);
      res.status(500).json({
        error: 'Internal server error while transcribing',
        details: error.message
      });
    }
  }
];

function formatTranscript(transcriptionResult) {
  try {
    const paragraphs = transcriptionResult?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
    
    // Process segments with enhanced speaker info
    const segments = paragraphs.map((p, idx) => {
      const paragraphText = p.sentences.map(s => s.text).join(' ');
      const speakerNumber = (typeof p.speaker !== 'undefined') ? p.speaker : 0;
      
      return {
        id: idx,
        start: p.start,
        end: p.end,
        text: paragraphText,
        speaker: speakerNumber,
        words: paragraphText.split(' ').length // Add word count per segment
      };
    });

    // Get unique speakers with more metadata
    const speakerNumbers = new Set(segments.map(p => p.speaker));
    const speakers = Array.from(speakerNumbers).map(speaker => {
      // Calculate statistics for each speaker
      const speakerSegments = segments.filter(s => s.speaker === speaker);
      const totalWords = speakerSegments.reduce((sum, seg) => sum + seg.words, 0);
      const totalTime = speakerSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);

      return {
        id: speaker,
        label: `Speaker ${speaker}`,
        displayName: `Speaker ${speaker}`, // Editable display name
        segments: speakerSegments.length,
        totalWords,
        totalTime: Math.round(totalTime * 100) / 100, // Round to 2 decimal places
        percentageOfWords: 0 // Will be calculated after all speakers are processed
      };
    });

    // Calculate percentage of words for each speaker
    const totalWords = speakers.reduce((sum, speaker) => sum + speaker.totalWords, 0);
    speakers.forEach(speaker => {
      speaker.percentageOfWords = Math.round((speaker.totalWords / totalWords) * 100);
    });

    return {
      metadata: {
        totalDuration: segments.length ? segments[segments.length - 1].end : 0,
        totalWords,
        speakerCount: speakers.length,
        dateProcessed: new Date().toISOString(),
      },
      speakers,
      segments,
      raw: transcriptionResult // Include raw result for additional processing if needed
    };
  } catch (error) {
    console.error('Error formatting transcript:', error);
    throw error;
  }
}