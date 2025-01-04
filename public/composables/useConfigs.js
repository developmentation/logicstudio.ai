// composables/useConfigs.js

const env = Vue.ref({});

export const useConfigs = () => {
    // Key Messages grouped by category
    const getConfigs = async () =>{
      try
      {
        env.value = await axios.get('/api/configs')
        console.log("Configs", env.value)
      }
      catch(error)
      {
        console.log('Error', error)
        env.value = null}
    }
  
    return {
      env,
      getConfigs
    }
  }