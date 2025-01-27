// Import App and router (which are now simple objects or functions)
import App from './App.js';
import router from './router/index.js';

console.log(Vue.version);

// // Create the Vue app and use the router
const app = Vue.createApp(App);


app.directive('tooltip', PrimeVue.Tooltip);

app.use(PrimeVue.Config, {
    // theme: {
    //     // preset: PrimeVue.Themes.Aura,
    //     options: {
    //         darkModeSelector: '.app-dark'
    //     }
    // }
});

// app.component('Button', PrimeVue.Button);
// app.component('Card', PrimeVue.Card);
// app.component('Galleria', PrimeVue.Galleria);
// app.component('InputText', PrimeVue.InputText);
// app.component('InputNumber', PrimeVue.InputNumber);
// app.component('Textarea', PrimeVue.Textarea);
// app.component('Toolbar', PrimeVue.Toolbar);
// app.component('Panel', PrimeVue.Panel);
// app.component('Divider', PrimeVue.Divider);
// app.component('Menu', PrimeVue.Menu);
// app.component('DataTable', PrimeVue.DataTable);
// app.component('Column', PrimeVue.Column);
// app.component('ColumnGroup', PrimeVue.ColumnGroup);
// app.component('Row', PrimeVue.Row);
// app.component('DatePicker', PrimeVue.DatePicker);
// app.component('Password', PrimeVue.Password);
// app.component('InputChips', PrimeVue.InputChips);
// app.component('Slider', PrimeVue.Slider);
// app.component('AutoComplete', PrimeVue.AutoComplete);
// app.component('Chip', PrimeVue.Chip);
// app.component('Tag', PrimeVue.Tag);
app.component('Checkbox', PrimeVue.Checkbox);
// app.component('RadioButton', PrimeVue.RadioButton);
// app.component('FileUpload', PrimeVue.FileUpload);

// app.component('Rating', PrimeVue.Rating);
// app.component('ProgressBar', PrimeVue.ProgressBar);
// app.component('Calendar', PrimeVue.Calendar);

// app.component('Select', PrimeVue.Select);
// app.component('MultiSelect', PrimeVue.MultiSelect);
app.component('Tree', PrimeVue.Tree);
// // app.component('Chart', PrimeVue.Chart);
 


app.use(router);
app.mount('#app');
