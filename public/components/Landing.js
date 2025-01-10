// LandingPage.js

export default {
  name: "LandingPage",
  template: `
     <div class="bg-gradient-to-b from-gray-900 to-gray-800 overflow-auto landing ">
      <!-- Hero Section with Video -->
      <header class="relative h-screen">
        <video 
          class="absolute inset-0 w-full h-full object-cover opacity-50" 
          autoplay 
          loop 
          muted 
          playsinline
          ref="videoEl"
        >
          <source :src="videoUrl" type="video/mp4">
        </video>
        <div class="absolute inset-0 bg-gradient-to-b from-gray-900/10 via-gray-900/50"></div>
        
        <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20">
          <div class="lg:grid lg:grid-cols-12 lg:gap-8">
            <div class="sm:text-center md:mx-auto lg:col-span-8 lg:text-left">
              <h1 class="text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
                LogicStudio.ai
                <span class="block text-emerald-500 mt-2">Visual AI Agent Orchestration</span>
              </h1>
              <p class="mt-6 text-xl text-gray-300 leading-relaxed max-w-3xl">
                Build complex AI agent systems visually. Connect, orchestrate, and deploy intelligent workflows through an intuitive canvas interface. Open source and free forever.
              </p>
              <div class="mt-10 flex gap-6 sm:justify-center lg:justify-start">
                
              
                    <router-link to="/studio" class="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-all">
                              Launch Studio
                          </router-link>

                <a href="#features"
                   class="px-8 py-3 border-2 border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white rounded-lg font-semibold transition-all">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>
          
      <!-- Preview 1-->
      <section class="py-24 bg-gray-900">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 class="text-3xl font-bold text-center text-white mb-4">Visual Agent Composition</h2>
          <p class="text-gray-400 text-center mb-16 text-lg max-w-3xl mx-auto">
            Intuitive node-based compositor for building agentic workflows which are clear, consistent, and auditable. Connect agents, manage data flow, and create powerful automation through an intuitive drag-and-drop interface.
          </p>
          
          <!-- Preview Image -->
          <div class="mb-16 rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
            <img 
              :src="preview1" 
              alt="LogicStudio Node Compositor Interface" 
              class="w-full h-auto object-cover"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div v-for="feature in compositorFeatures" :key="feature.title" 
                class="bg-gray-900/50 rounded-xl p-6 backdrop-blur border border-gray-800 hover:border-emerald-500/30 transition-all">
              <div class="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                <i :class="feature.icon" class="text-emerald-500 text-2xl"></i>
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">{{ feature.title }}</h3>
              <p class="text-gray-400 leading-relaxed">{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </section>

       <section class="py-24 bg-gray-800">
          <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div class="flex flex-col items-center gap-6 p-6 bg-gray-900 rounded-xl border border-gray-700 hover:border-emerald-500/30 transition-all">
              <img 
                :src="albertaLogoRef" 
                alt="Alberta Logo" 
                class="h-12 w-auto opacity-90"
              />
              <h2 class="text-3xl font-bold text-white">Built in Alberta</h2>
              <span class="text-gray-400 text-lg">Let's get building.</span>
            </div>
          </div>
        </section>


        <section class="py-24 bg-gray-900">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-3xl font-bold text-white mb-4">Supported AI Models</h2>
      <p class="text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
        Connect with leading AI providers through our native integrations. Build workflows with the most advanced language models available.
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <div class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-emerald-500/30 transition-all">
          <i class="pi pi-star text-3xl text-emerald-500 mb-4"></i>
          <h3 class="text-white font-semibold">Anthropic Claude</h3>
          <p class="text-gray-400 text-sm mt-2">Claude 3.5 Sonnet & Haiku</p>
        </div>
        
        <div class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-emerald-500/30 transition-all">
          <i class="pi pi-globe text-3xl text-emerald-500 mb-4"></i>
          <h3 class="text-white font-semibold">OpenAI</h3>
          <p class="text-gray-400 text-sm mt-2">GPT-4o, o1</p>
        </div>

        <div class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-emerald-500/30 transition-all">
          <i class="pi pi-cloud text-3xl text-emerald-500 mb-4"></i>
          <h3 class="text-white font-semibold">Azure OpenAI</h3>
          <p class="text-gray-400 text-sm mt-2">A range of models, including Llama</p>
        </div>

        <div class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-emerald-500/30 transition-all">
          <i class="pi pi-bolt text-3xl text-emerald-500 mb-4"></i>
          <h3 class="text-white font-semibold">Groq</h3>
          <p class="text-gray-400 text-sm mt-2">Ultra-fast inference</p>
        </div>

          <div class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-emerald-500/30 transition-all">
          <i class="pi pi-map text-3xl text-emerald-500 mb-4"></i>
          <h3 class="text-white font-semibold">Mistral</h3>
          <p class="text-gray-400 text-sm mt-2">Leading EU AI Models</p>
        </div>

        <div class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-emerald-500/30 transition-all">
        <i class="pi pi-twitter text-3xl text-emerald-500 mb-4"></i>
        <h3 class="text-white font-semibold">X</h3>
        <p class="text-gray-400 text-sm mt-2">Grok 2 Leading Model</p>
      </div>

    </div>
  </div>
</section>
  


        <!-- Technical Highlights -->
        <section class="py-24 bg-gray-900">
          <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
              <div>
                <h2 class="text-3xl font-bold text-white mb-6">Built for Performance</h2>
                <div class="space-y-4">
                  <div v-for="tech in techFeatures" :key="tech.title" class="flex items-start gap-4">
                    <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <i :class="tech.icon" class="text-emerald-500"></i>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-white">{{ tech.title }}</h3>
                      <p class="text-gray-400">{{ tech.description }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-12 lg:mt-0">
                <div class="bg-gray-800 rounded-xl p-8 border border-gray-700">
                  <h3 class="text-xl font-semibold text-white mb-6">Technology Stack</h3>
                  <div class="grid grid-cols-2 gap-4">
                    <div v-for="item in stack" :key="item" class="flex items-center gap-3">
                      <div class="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span class="text-gray-300">{{ item }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
  
        <!-- Community Section -->
        <section class="py-24 bg-gray-800">
          <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 class="text-3xl font-bold text-white mb-4">Join Our Community</h2>
            <p class="text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
              Connect with developers and AI enthusiasts building the next generation of intelligent systems.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <!--    <a href="https://discord.gg/your-server" target="_blank" 
                 class="flex flex-col items-center p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-emerald-500/30 transition-all">
                <i class="pi pi-discord text-3xl text-emerald-500 mb-4"></i>
                <h3 class="text-white font-semibold">Discord</h3>
                <p class="text-gray-400 text-sm mt-2">Join the discussion</p>
              </a>
          -->
              <a href="https://github.com/" target="_blank" 
                 class="flex flex-col items-center p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-emerald-500/30 transition-all">
                <i class="pi pi-github text-3xl text-emerald-500 mb-4"></i>
                <h3 class="text-white font-semibold">GitHub</h3>
                <p class="text-gray-400 text-sm mt-2">Contribute & collaborate</p>
              </a>
              <a href="https://x.com/janakalford" target="_blank" 
                 class="flex flex-col items-center p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-emerald-500/30 transition-all">
                <i class="pi pi-twitter text-3xl text-emerald-500 mb-4"></i>
                <h3 class="text-white font-semibold">X</h3>
                <p class="text-gray-400 text-sm mt-2">Stay updated</p>
              </a>
            </div>
          </div>
        </section>
      </div>
    `,
  setup() {
    const videoEl = Vue.ref(null);
    const videoUrl = Vue.computed(
      () => `../assets/video${Math.floor(Math.random() * 5) + 1}.mp4`
    );
    const albertaLogoRef = Vue.computed(() => `../assets/albertaLogo.svg`);
    const preview1 = Vue.computed(() => `../assets/preview1.png`);
    
    
    Vue.onMounted(() => {
      // Add landing-page class to both body and app
      document.documentElement.classList.add("landing-page"); // Add to html element
      document.body.classList.add("landing-page");
      document.getElementById("app").classList.add("landing-page");

      // Handle video autoplay
      if (videoEl.value) {
        videoEl.value.play().catch((e) => {
          console.warn("Autoplay failed:", e);
        });
      }
    });

    Vue.onUnmounted(() => {
      // Remove landing-page class from both body and app
      document.documentElement.classList.remove("landing-page");
      document.body.classList.remove("landing-page");
      document.getElementById("app").classList.remove("landing-page");
    });


    const compositorFeatures = Vue.ref([
      {
        title: "Visual Workflow Design",
        icon: "pi pi-sitemap",
        description: "Integrate the power of AI with the structure of reusable drag and drop architectures. Create complex agent interactions through intuitive visual connections."
      },
      {
        title: "Collaborative Agent Building",
        icon: "pi pi-share-alt",
        description: "Create and share your own agents with colleagues. Build a library of reusable components that can be easily integrated into any workflow."
      },
      {
        title: "Auditable Decision Paths",
        icon: "pi pi-check-circle",
        description: "Track every step of your AI workflow with clear visual pathways. Ensure transparency and accountability in your agent interactions."
      },
      {
        title: "Flexible Integration",
        icon: "pi pi-cog",
        description: "Connect multiple AI services and data sources seamlessly. Build complex workflows that leverage the full power of your AI infrastructure."
      },
      {
        title: "Real-time Monitoring",
        icon: "pi pi-sync",
        description: "Observe your AI workflows in action with real-time visualization of data flow and agent interactions. Debug and optimize with ease."
      },
      {
        title: "Open Source",
        icon: "pi pi-github", // This one exists, no change needed
        description:
          "Built with transparency and collaboration in mind. MIT licensed and free forever. Fork, modify, and deploy without restrictions.",
      },

    ]);

    const features = Vue.ref([
      {
        title: "Visual Agent Canvas",
        icon: "pi pi-pencil", // Changed from pi-compass (wasn't in library)
        description:
          "Build complex AI systems visually through an interactive canvas. Connect components and orchestrate multiple agents with simple drag-and-drop operations.",
      },
      {
        title: "Real-time Connections",
        icon: "pi pi-sync", // Changed from pi-bolt (wasn't in library)
        description:
          "Create dynamic connections between components that automatically update as data flows through your system. Watch your AI agents interact in real-time.",
      },
      {
        title: "Component Library",
        icon: "pi pi-clone", // Changed from pi-box (wasn't in library)
        description:
          "Access pre-built components including AI agents, data transformers, input/output nodes, and logic controllers. Extend and customize to fit your needs.",
      },
      {
        title: "Smart Workflows",
        icon: "pi pi-sitemap", // This one exists, no change needed
        description:
          "Design complex logic flows with conditional branching, loops, and parallel processing. Build sophisticated AI pipelines visually.",
      },
      {
        title: "Data Visualization",
        icon: "pi pi-chart-bar", // This one exists, no change needed
        description:
          "Inspect and analyze data flow in real-time with built-in visualizers for text, JSON, arrays, and matrices.",
      },
    ]);

    const techFeatures = Vue.ref([
      {
        icon: "pi pi-refresh", // Changed from pi-bolt (wasn't in library)
        title: "Reactive Architecture",
        description:
          "Real-time data flow with instant updates and smooth interactions",
      },
      {
        icon: "pi pi-sync", // Changed from pi-refresh as we used it above
        title: "Live Preview",
        description: "Test and validate your AI workflows in real-time",
      },
      {
        icon: "pi pi-cog", // Changed from pi-code (wasn't in library)
        title: "Extensible System",
        description: "Create custom components and extend functionality",
      },
    ]);

    const stack = Vue.ref([
      "Vue.js",
      "SVG Graphics",
      "WebSocket",
      "JSON Schema",
      "Tailwind CSS",
      "Modern JavaScript",
    ]);

    return {
      albertaLogoRef,
      features,
      techFeatures,
      stack,
      videoEl,
      videoUrl,
      preview1,
      compositorFeatures,
    };
  },
};
