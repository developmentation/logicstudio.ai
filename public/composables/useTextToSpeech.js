// composables/useSpeechToText.js


let ttsVoices = Vue.ref(null)

export const useTextToSpeech = () => {

    
  const loadVoices = async (templateNames = ['Starter Template']) => {
    try {
            ttsVoices.value = await fetch(new URL(`../assets/voices.json`, import.meta.url)).then(res => res.ok ? res.json() : null)
            console.log("Loaded AI Voices")
    } 
    catch (error) {
      console.warn('Error loading voices:', error);
      canvasTemplates.value = [];
    }
  };

  const generateAudio = async (text, path, userId = null, apiKey = null) => {
    try {
      const response = await axios.post('/api/textToSpeech', {
        text,
        path,
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
    ttsVoices,
    loadVoices,
    generateAudio
  };
};