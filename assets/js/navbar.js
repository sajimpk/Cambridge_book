(() => {
  // 1. Theme toggle synchronization
  const themeToggle = document.getElementById('themeToggle');
  const activeTheme = localStorage.getItem('theme') || 'light';

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    }
    localStorage.setItem('theme', theme);
  }

  if (themeToggle) {
    setTheme(activeTheme);
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // 2. Mobile navbar toggle
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const siteNav = document.getElementById('siteNav');

  if (mobileBtn && siteNav) {
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      siteNav.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
      if (!siteNav.contains(e.target) && !mobileBtn.contains(e.target)) {
        siteNav.classList.remove('is-open');
      }
    });
  }
})();
