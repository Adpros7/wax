// Vue entry — bootstraps Pinia and mounts <App>.
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/style.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
