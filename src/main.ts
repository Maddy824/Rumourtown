import { mount } from './ui/app';
import './ui/styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) mount(app);
