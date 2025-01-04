// ContentManagement.js
import router from "../router/index.js";
import { useSpeeches } from "../composables/useSpeeches.js";


export default {
  name: 'ContentManagement',
  template: `
    <div class="container mx-auto px-4 py-8">
      <!-- Main Section Container -->
      <div class="grid grid-cols-1">
        <!-- Content Management Section -->
        <Card>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-800">Speech Content Management</h2>
              <div class="flex gap-2 items-center">
                <Button 
                  icon="pi pi-refresh"
                  class="p-button-text"
                  @click="handleRefresh"
                  :disabled="isLoading"
                />
                <Button
                  label="Generate Speech"
                  icon="pi pi-plus"
                  class="p-button-primary p-button-sm"
                  @click="goToGenerateSpeech"
                />
                <span v-if="isLoading" class="text-sm text-gray-500">Loading...</span>
              </div>
            </div>
          </template>

          <template #content>
            <!-- Filters Section -->
            <div class="mb-4 space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Category Filter -->
                <div class="flex flex-col">
                  <label class="text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
                  <Select 
                    v-model="selectedCategoryFilter" 
                    :options="categoryOptions" 
                    optionLabel="label" 
                    optionValue="value" 
                    placeholder="All Categories"
                    class="w-full"
                    @change="applyFilters"
                  />
                </div>

                <!-- Status Filter -->
                <div class="flex flex-col">
                  <label class="text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                  <Select 
                    v-model="selectedStatusFilter"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="All Status"
                    class="w-full"
                    @change="applyFilters"
                  />
                </div>

                <!-- Search by Title -->
                <div class="flex flex-col">
                  <label class="text-sm font-medium text-gray-700 mb-1">Search by Title</label>
                  <div class="relative">
                    <span class="pi pi-search absolute left-2 top-2 text-gray-400"></span>
                    <InputText 
                      v-model="searchTitle"
                      placeholder="Type to search..."
                      class="w-full pl-8"
                      @input="applyFilters"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Data Table -->
            <DataTable 
              :value="filteredSpeeches"
              class="w-full text-sm"
              :loading="isLoading"
              :paginator="true"
              :rows="10"
              :sortField="sortField"
              :sortOrder="sortOrder"
              @sort="onSort"
              :rowClass="rowClass"
            >
              <Column field="category" header="Category" sortable />
              <Column field="title" header="Title" sortable />
              <Column field="timeGiven" header="Date Given" sortable />
              <Column field="status" header="Status" sortable :body="formatStatus" />
              <Column field="postSpeechRevisions" header="Post-Speech Revisions" :body="formatBoolean" />
              <Column field="lengthInWords" header="Words" sortable />
              <Column field="ministerScore" header="Minister Score" sortable />
              <Column field="structureApplied" header="Structure" />
              <Column field="location" header="Location" />
              <Column field="audienceSize" header="Audience" sortable />
              <Column field="mainTheme" header="Theme" />
              <Column field="staffRating" header="Staff Rating" sortable />
              <Column field="speakingSpeed" header="Speed (WPM)" sortable />
              <Column header="Actions" :body="renderActions" />
            </DataTable>
          </template>
        </Card>
      </div>
    </div>


  `,

  setup() {
    const isLoading = Vue.ref(false)

    // Data for speeches
    const { speeches } = useSpeeches();


    // Filters & Sorting
    const selectedCategoryFilter = Vue.ref(null)
    const selectedStatusFilter = Vue.ref(null)
    const searchTitle = Vue.ref('')

    const categoryOptions = [
      { label: 'All Categories', value: null },
      { label: 'Data Centre Attraction', value: 'Data Centre Attraction' },
      { label: 'Healthcare Reform', value: 'Healthcare Reform' }
      // Add other categories as needed
    ]

    const statusOptions = [
      { label: 'All Status', value: null },
      { label: 'Pending', value: 'pending' },
      { label: 'Complete', value: 'complete' }
    ]

    // Sorting
    const sortField = Vue.ref(null)
    const sortOrder = Vue.ref(null)

    const filteredSpeeches = Vue.computed(() => {
      let result = speeches.value

      // Filter by category
      if (selectedCategoryFilter.value) {
        result = result.filter(s => s.category === selectedCategoryFilter.value)
      }

      // Filter by status
      if (selectedStatusFilter.value) {
        result = result.filter(s => s.status === selectedStatusFilter.value)
      }

      // Search by title
      if (searchTitle.value.trim()) {
        const searchTerm = searchTitle.value.toLowerCase()
        result = result.filter(s => s.title.toLowerCase().includes(searchTerm))
      }

      // Sort if applicable
      if (sortField.value) {
        result = [...result].sort((a, b) => {
          const valA = a[sortField.value]
          const valB = b[sortField.value]

          if (valA == null && valB != null) return -1 * sortOrder.value
          if (valA != null && valB == null) return 1 * sortOrder.value
          if (valA == null && valB == null) return 0

          if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * sortOrder.value
          } else if (valA < valB) {
            return -1 * sortOrder.value
          } else if (valA > valB) {
            return 1 * sortOrder.value
          } else {
            return 0
          }
        })
      }

      return result
    })

    // Methods
    const handleRefresh = async () => {
      try {
        isLoading.value = true
        // Simulate fetch from API
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Refresh logic: In a real scenario, fetch updated speeches from backend
      } catch (error) {
        console.error('Refresh error:', error)
      } finally {
        isLoading.value = false
      }
    }

    const applyFilters = () => {
      // Trigger computed to update by changing refs
    }

    const onSort = (event) => {
      sortField.value = event.sortField
      sortOrder.value = event.sortOrder
    }

    const formatDate = (date) => {
      // Format as yyyy-mm-dd
      return date//.toISOString();//.split('T')[0]
    }

    const formatStatus = (speech) => {
      return speech.status === 'complete' 
        ? 'Complete ✅' 
        : 'Pending ⏳'
    }

    const formatBoolean = (speech) => {
      return speech.postSpeechRevisions ? 'Yes' : 'No'
    }

    const goToGenerateSpeech = () => {
      router.push('/generateSpeech')
    }

    const viewSpeech = (speechId) => {
      // Implement navigation to view speech details
      router.push(`/viewSpeech/${speechId}`)
    }

    const downloadSpeech = (speechId) => {
      // Implementation for downloading the speech
      // For now, just a console log
      console.log(`Downloading speech with ID: ${speechId}`)
    }

    const renderActions = (speech) => {
      return Vue.h('div', { class: 'flex gap-2' }, [
        Vue.h(Button, {
          label: 'View',
          icon: 'pi pi-eye',
          class: 'p-button-text p-button-sm',
          onClick: () => viewSpeech(speech.id)
        }),
        Vue.h(Button, {
          label: 'Download',
          icon: 'pi pi-download',
          class: 'p-button-text p-button-sm',
          onClick: () => downloadSpeech(speech.id)
        })
      ])
    }

    const rowClass = () => {
      return 'border-b border-gray-200'
    }

    return {
      // State
      isLoading,
      speeches,
      selectedCategoryFilter,
      selectedStatusFilter,
      searchTitle,

      // Options
      categoryOptions,
      statusOptions,

      // Computed
      filteredSpeeches,
      sortField,
      sortOrder,

      // Methods
      handleRefresh,
      applyFilters,
      onSort,
      goToGenerateSpeech,
      viewSpeech,
      downloadSpeech,

      // Formatters
      formatDate,
      formatStatus,
      formatBoolean,
      renderActions,
      rowClass
    }
  }
}
