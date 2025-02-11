// composables/useSpeechToText.js

export const useTextToSpeech = () => {
  const generateAudio = async (text, userId = null, apiKey = null) => {
    try {
      const response = await axios.post('/api/textToSpeech', {
        text,
        userId,
        apiKey
      }, {
        responseType: 'arraybuffer'  // Important for receiving binary data
      });

      return {
        success: true,
        data: response.data
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Audio generation failed'
      };
    }
  };

  return {
    generateAudio
  };
};