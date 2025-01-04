const { transcribeFile } = require("../tools/deepgram.js")
const { upload } = require('../tools/upload');
const fs = require("fs");

exports.transcribe = [upload.array('files'), async function (req, res, next) {
  try {
    let transcripts = [];
    console.log("req.files", req.files)

    // Transcribe each file
    await Promise.all(req.files.map(async (file) => {
      console.log("Transcribing File: ", file.filename);
      const { result, error } = await transcribeFile(file.filename);
      if (error) {
        console.error('Error during transcription:', error);
        // You may choose to handle the error differently (e.g. partial failures)
      }
      transcripts.push({ filename: file.filename, result, error });
    }));

    // console.log(JSON.stringify(transcripts));
    transcripts = formatTranscripts(transcripts);
    console.log(JSON.stringify(transcripts));

    //For DEV
    // let transcripts = JSON.parse(fs.readFileSync("./sampleTranscript.json", 'utf-8'))

    // Return transcripts
    res.status(200).json({
      message: "Transcription completed successfully",
      transcripts: transcripts
    });
  } catch (error) {
    console.log('Error transcribing file', error);
    res.status(500).json({ error: 'Internal server error while transcribing' });
  }
}];


// function formatTranscripts(transcripts) {
//   let newTranscripts = [];

//   transcripts.forEach((t) => {
//     const paragraphs = t?.result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];

//     const cleanParagraphs = paragraphs.map((p, idx) => {
//       const paragraphText = p.sentences.map(s => s.text).join(' ');
//       // Default speaker to 0 if not provided
//       const speakerNumber = (typeof p.speaker !== 'undefined') ? p.speaker : 0;
//       return {
//         id: idx,
//         start: p.start,
//         end: p.end,
//         text: paragraphText,
//         speaker: speakerNumber
//       };
//     });

//     if (cleanParagraphs) {
//       const uniqueSpeakers = [...Array.from(new Set(cleanParagraphs.map(p => { return { value: p.speaker, label: 'Speaker ' + p.speaker } })))];
//       const selectedSpeakers = [...Array.from(new Set(cleanParagraphs.map(p => p.speaker  )))];
//       newTranscripts.push({
//         speechData: {
//           //GPT analysis or user completed
//           title: "Speech Title",
//           synopsis: null,
//           venue: null,
//           dateGiven: null,
//           score: 0,

//           //Best fit metadata, or create new metadata
//           topics:[],
//           keyMessages: [],
//           structures:[],
//           audiences:[],
//           outcomes:[],

//           //Calculated 
//           lengthInWords: null,

//           //Administrative
//           dateUploaded: new Date(),
//           fullScreenMode: false,
//         },
//         uniqueSpeakers,
//         selectedSpeakers,
//         segments: cleanParagraphs,
//       });
//     }


    
//   });

//   return newTranscripts;
// }

//Fixing deduplication
function formatTranscripts(transcripts) {
  let newTranscripts = [];

  transcripts.forEach((t) => {
    const paragraphs = t?.result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];

    const cleanParagraphs = paragraphs.map((p, idx) => {
      const paragraphText = p.sentences.map(s => s.text).join(' ');
      const speakerNumber = (typeof p.speaker !== 'undefined') ? p.speaker : 0;
      return {
        id: idx,
        start: p.start,
        end: p.end,
        text: paragraphText,
        speaker: speakerNumber
      };
    });

    if (cleanParagraphs) {
      // Deduplicate speakers based on speaker number
      const speakerNumbers = new Set(cleanParagraphs.map(p => p.speaker));
      const uniqueSpeakers = Array.from(speakerNumbers).map(speaker => {
        return { value: speaker, label: 'Speaker ' + speaker };
      });

      newTranscripts.push({
        speechData: {
          title: "Speech Title",
          synopsis: null,
          venue: null,
          dateGiven: null,
          score: 0,
          topics: [],
          keyMessages: [],
          structures: [],
          audiences: [],
          outcomes: [],
          lengthInWords: null,
          dateUploaded: new Date(),
          fullScreenMode: false,
        },
        uniqueSpeakers,
        selectedSpeakers: Array.from(speakerNumbers),
        segments: cleanParagraphs,
      });
    }
  });

  return newTranscripts;
}