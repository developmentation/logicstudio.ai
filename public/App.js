import { useConfigs } from "./composables/useConfigs.js";
import { useModels } from "./composables/useModels.js";
import { useRealTime } from "./composables/useRealTime.js";
import { useTextToSpeech } from "./composables/useTextToSpeech.js";
import router from "../router/index.js";

export default {
    template: `
    <div :class="{'landing': isLandingPage}" class="min-h-screen bg-gray-900">
      <input type="file" ref="fileInput" style="display: none;" @change="handleFileUpload" accept=".json"/>
 
      <div class="min-h-screen">
          <nav class="bg-gray-800 shadow-lg border-b border-gray-700">
              <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div class="flex justify-between h-12 items-center">
                      <div class="flex items-center">
                          <!-- Home Link -->
                          <router-link to="/" class="flex-shrink-0 flex items-center text-emerald-500 font-semibold">
                              LogicStudio.ai
                          </router-link>

                          <!-- Desktop menu -->
                          <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                              <router-link
                                v-for="item in menuItems"
                                :key="item.label"
                                :to="item.to"
                                class="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium"
                              >
                                {{ item.label }}
                              </router-link>
                          </div>
                      </div>
                      
                      <!-- Mobile menu button -->
                      <div class="sm:hidden flex items-center">
                          <button @click="toggleMenu" type="button" class="text-gray-300 hover:text-white">
                              <span class="sr-only">Open main menu</span>
                              <svg v-if="!menuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                              </svg>
                              <svg v-else class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                          </button>
                      </div>

                      <!-- Right-aligned buttons -->
                      <!--
                      <div class="hidden sm:flex space-x-4">
                          <Button @click="triggerFileInput" class="text-gray-300 hover:text-white text-sm font-medium">
                              Upload Profile
                          </Button>
                          <Button @click="download" class="text-gray-300 hover:text-white text-sm font-medium">
                              Download Profile
                          </Button>
                      </div>
                      -->
                  </div>
              </div>

              <!-- Mobile menu -->
              <div class="sm:hidden" v-show="menuOpen" id="mobile-menu">
                  <div class="px-2 pt-2 pb-3 space-y-1 bg-gray-800 border-t border-gray-700">
                      <router-link
                        v-for="item in menuItems"
                        :key="item.label"
                        :to="item.to"
                        class="block px-3 py-2 text-base font-medium text-gray-300 hover:text-white"
                      >
                        {{ item.label }}
                      </router-link>
                  </div>
                  
                  <!-- Right-aligned buttons on mobile -->
                  <!--
                  <div class="px-2 pt-2 pb-3 space-y-1 bg-gray-800 border-t border-gray-700">
                      <Button @click="triggerFileInput" class="block w-full text-left text-gray-300 hover:text-white px-3 py-2 text-base font-medium">
                          Upload 
                      </Button>
                      <Button @click="download" class="block w-full text-left text-gray-300 hover:text-white px-3 py-2 text-base font-medium">
                          Download 
                      </Button>
                  </div>
                  -->
              </div>
          </nav> 
          <main class="mx-auto py-4 px-4 sm:px-6 lg:px-8">
              <router-view></router-view>
          </main>
      </div>
    </div>
    `,
    setup() {
        const { fetchServerModels } = useModels();
        const { getConfigs } = useConfigs();
        const { socketIoConnection } = useRealTime();
        const { loadVoices } = useTextToSpeech();

        const fileInput = Vue.ref(null);
        const menuOpen = Vue.ref(false);
        const projects = Vue.ref([]);

        // Using router path directly
        const isLandingPage = Vue.computed(() => router.currentRoute.value.path === '/');

        // Define your menu items once here
        const menuItems = [
            { label: "Studio", to: "/studio" },
        ];

        function triggerFileInput() {
            fileInput.value.click();
        }

        // Add Ollama model detection
        const detectOllamaModels = async () => {
            try {
                const response = await fetch('http://localhost:11434/api/tags');
                const data = await response.json();
                return data.models || [];
            } catch (error) {
                console.warn('Ollama not detected locally:', error);
                return [];
            }
        };

        Vue.onMounted(async () => {
            await getConfigs();
            await fetchServerModels();
            await detectOllamaModels(); // Keep Ollama detection
            await socketIoConnection();
        });

        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (file && file.type === "application/json") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        /*
                        const newProjects = JSON.parse(e.target.result);
                        projects.value = [...projects.value, ...newProjects];
                        console.log("Projects data has been updated.");
                        */
                    } catch (error) {
                        console.error("Failed to parse JSON file", error);
                    }
                };
                reader.readAsText(file);
            } else {
                alert("Please upload a valid JSON file.");
            }
        }

        function download() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects.value));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "Logic Studio Profile.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }

        function toggleMenu() {
            menuOpen.value = !menuOpen.value;
        }

        return { isLandingPage, download, triggerFileInput, handleFileUpload, fileInput, menuOpen, toggleMenu, projects, menuItems }
    }
};