const PlayHT = require('playht');

const generateAudio = async (req, res) => {
  try {
    // Extract text and optional credentials from request body
    const { text, path, userId, apiKey } = req.body;
    console.log({ text, path, userId, apiKey })
    if (!text) {
      return res.status(400).json({
        message: "Text is required for audio generation"
      });
    }

    // Check for valid credentials either from request or environment
    const userProvidedCreds = userId && apiKey;
    const envCreds = process.env.PLAYHT_USER_ID && process.env.PLAYHT_API_KEY;

    if (!userProvidedCreds && !envCreds) {
      return res.status(401).json({
        message: "No valid credentials provided. Please provide both userId and apiKey in the request or set them in environment variables."
      });
    }

    // Initialize PlayHT with appropriate credentials
    PlayHT.init({
      userId: userProvidedCreds ? userId : process.env.PLAYHT_USER_ID,
      apiKey: userProvidedCreds ? apiKey : process.env.PLAYHT_API_KEY,
      defaultVoiceId: path || 's3://peregrine-voices/oliver_narrative2_parrot_saad/manifest.json',
    });

    // Create and collect audio stream
    const chunks = [];
    const stream = await PlayHT.stream(text, { 
      voiceEngine: 'PlayDialog'
    });

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        const fullFile = Buffer.concat(chunks);
        
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': fullFile.length,
          'Content-Disposition': 'attachment; filename="audio.mp3"'
        });

        res.status(200).send(fullFile);
        resolve();
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });

  } catch (error) {
    console.error('Text-to-Speech Error:', error);
    return res.status(500).json({
      message: "Error generating audio",
      error: error.message
    });
  }
};

module.exports = {
  generateAudio
};