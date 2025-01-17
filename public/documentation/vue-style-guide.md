# LogicStudio.ai Vue.js Development Style Guide

## Component Structure

### Base Template
All components should follow this basic structure:
```javascript
// ComponentName.js
export default {
  name: 'ComponentName',
  template: ``,
  setup() {
    return {}
  }
}
```

### Component Naming
- Use PascalCase for component names (e.g., `MinisterProfile`, `SpeechBuilder`)
- File name should match component name
- Use descriptive, feature-based names

## Template Syntax

### Template Structure
- Use backticks (`) for template strings
- Maintain proper indentation (2 spaces)
- Group related elements with comments
```javascript
template: `
  <div class="container">
    <!-- Section Header -->
    <div class="header">
    </div>

    <!-- Main Content -->
    <div class="content">
    </div>
  </div>
`
```

### Component Layout
1. Container div with responsive classes
2. Card components for major sections
3. Consistent spacing using Tailwind classes

### PrimeVue Components
- Use PrimeVue 4.x components
- Common components:
  - Card (for section containers)
  - Button (for actions)
  - Select (and not Dropdown) (for selections)
  - MultiSelect (for multiple selections)
  - InputText (for text input)
  - Textarea (for large text input)
  - Checkbox (for multiple selections)
  - RadioButton (for single selections)

## Reactivity

### Ref Declarations
- Always use `Vue.ref` instead of `ref`
- Declare all refs at the start of setup()
```javascript
const someValue = Vue.ref(null)
const isLoading = Vue.ref(false)
```

### Computed Properties
- Use Vue.computed for derived values
```javascript
const computedValue = Vue.computed(() => {
  return someValue.value + otherValue.value
})
```

## Layout & Styling

### CSS Classes
- Use Tailwind CSS utility classes
- Common patterns:
  - Spacing: `space-y-4`, `gap-4`
  - Grid: `grid grid-cols-1 md:grid-cols-2`
  - Flex: `flex items-center justify-between`
  - Text: `text-sm font-medium text-gray-700`

### Responsive Design
- Use Tailwind breakpoints consistently
- Default to mobile-first approach
- Common breakpoints:
  - md: 768px
  - lg: 1024px

## Event Handling

### Method Naming
- Use descriptive, action-based names
- Common prefixes:
  - handle: For UI events
  - toggle: For boolean states
  - update: For data updates
  - fetch: For data retrieval

### Event Methods
```javascript
const handleClick = () => {
  // Handle the click event
}

const toggleState = () => {
  isOpen.value = !isOpen.value
}
```

## Data Management

### State Organization
- Group related state together
- Use clear, descriptive names
```javascript
const profile = Vue.ref({
  basic: { /* basic info */ },
  preferences: { /* preferences */ }
})
```

### Props and Events
- Use v-model when appropriate
- Emit events with descriptive names
```javascript
const emit = defineEmits(['update:modelValue', 'save', 'cancel'])
```

## Error Handling
- Use try/catch blocks for async operations
- Provide user feedback for errors
- Use toast/notification system when available

## Comments and Documentation
- Use section comments in template
- Document complex computations
- Explain non-obvious business logic
