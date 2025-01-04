// composables/useTranscripts.js
let files = Vue.ref([]);
let transcripts = Vue.ref([]);

export const useTranscripts = () => {
  const transcribe = async () => {
    try {
      // if (!files.value || files.value.length === 0) {
      //   console.log('No files selected!');
      //   return;
      // }

      const formData = new FormData();
      files.value.forEach(file => {
        formData.append('files', file);
      });

      console.log("form data", formData)

      const response = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      transcripts.value = response.data.transcripts;
       console.log("Transcripts", transcripts.value);
    }
    catch (error) {
      console.log('Error', error);
    }
  }

  return {
    transcribe,
    files,
    transcripts
  }
}
