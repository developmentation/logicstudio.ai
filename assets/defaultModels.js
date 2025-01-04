let defaultModels = [
//    {
    //   name: { en: "GPT-4", fr: "GPT-4" },
    //   model: "gpt-4-1106-preview",
    //   provider: "openAi",
    //   contextLimit: 128000,
    //   maxOutput: 4096,
    //   concurrentInstances: 20,
    //   costPer1mOutput: 10,
    //   costPer1mInput: 30,
    //   image: { input: true, output: false },
    // },
    // {
    //   name: { en: "GPT-4o", fr: "GPT-4o" },
    //   model: "gpt-4o",
    //   provider: "openAi",
    //   contextLimit: 128000,
    //   maxOutput: 4096,
    //   concurrentInstances: 20,
    //   costPer1mOutput: 5,
    //   costPer1mInput: 15,
    //   image: { input: true, output: false },
    // },
    // {
    //   name: { en: "GPT-4o mini", fr: "GPT-4o mini" },
    //   model: "gpt-4o-mini",
    //   provider: "openAi",
    //   contextLimit: 128000,
    //   maxOutput: 4096,
    //   concurrentInstances: 20,
    //   costPer1mOutput: 0.15,
    //   costPer1mInput: 0.6,
    //   image: { input: true, output: false },
    // },
  
    {
      name: { en: "Claude Sonnet 3.5", fr: "Claude Sonnet 3.5" },
      model: "claude-3-5-sonnet-20241022",
      provider: "anthropic",
      contextLimit: 200000,
      maxOutput: 8192,
      concurrentInstances: 5,
      costPer1mOutput: 3,
      costPer1mInput: 15,
      image: { input: true, output: false },
    },
    
  ];
  
  module.exports = { defaultModels };