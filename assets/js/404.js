import { registerServiceWorker } from './pwa.js';
import { initLocalizedCurrency } from './currency.js';

registerServiceWorker();

document.addEventListener('DOMContentLoaded', () => {
  initLocalizedCurrency();
});