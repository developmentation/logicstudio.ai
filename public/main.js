// Import App and router (which are now simple objects or functions)
import App from './App.js';
import router from './router/index.js';

console.log(Vue.version);

// // Create the Vue app and use the router
const app = Vue.createApp(App);

app.use(router);
app.mount('#app');
