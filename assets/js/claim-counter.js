(() => {
  const API_URL = '/api/claim-clicks';
  const BUTTON_SELECTOR = '.global-offer__button';

  async function recordClick() {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        keepalive: true
      });
    } catch (error) {
      console.warn('Could not record claim click.', error);
    }
  }

  function bindButton(button) {
    if (button.dataset.clickCounterBound === 'true') return;
    button.dataset.clickCounterBound = 'true';
    button.addEventListener('click', recordClick);
  }

  function bindAvailableButtons() {
    document.querySelectorAll(BUTTON_SELECTOR).forEach(bindButton);
  }

  bindAvailableButtons();

  const observer = new MutationObserver(bindAvailableButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
