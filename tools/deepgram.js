// Deepgram file processing

const { createClient } = require("@deepgram/sdk");
const fs = require("fs");

const transcribeFile = async (filename) => {
  try {
    // STEP 1: Create a Deepgram client using the API key
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // STEP 2: Call the transcribeFile method with the audio payload and options
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      // path to the audio file
      fs.readFileSync('./uploads/' + filename),
      // STEP 3: Configure Deepgram options for audio analysis
      {
        model: "nova-2",
        smart_format: true,
        diarize :true, //detect speakers
      }
    );

    if (error) {
      // throw error;
      console.log("Error transcribing", error)
      return { result: null, error: error };
    }
    // STEP 4: Print the results
    if (!error) {
      // fs.writeFileSync(`./uploads/${filename}.deepgram.json`, JSON.stringify(result, null, 2), 'utf8');
      fs.unlink(`./uploads/${filename}`, (err) => {
        if (err) {
          console.error(`Error deleting file: ${filename}`, err);
        } else {
          console.log(`File deleted: ${filename}`);
        }
      });

      return { result: result, error: null };
    }
  } catch (error) { }
};

module.exports = {
  transcribeFile
};

