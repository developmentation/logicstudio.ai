// composables/useConfigs.js

const env = Vue.ref({});

//If you don't want to change the backend code, you can add models here too
const models = Vue.ref([
  {
    name: { en: "Claude Sonnet 3.5", fr: "Claude Sonnet 3.5" },
    model: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
  },
]);

export const useConfigs = () => {
  // Key Messages grouped by category
  const getConfigs = async () => {
    try {
      env.value = await axios.get("/api/configs");

      if (env.value.data?.payload?.models)
        models.value = env.value.data.payload.models;

      console.log("Configs", env.value);
    } catch (error) {
      console.log("Error", error);
      env.value = null;
    }
  };

  return {
    env,
    getConfigs,
    models,
  };
};
