(() => {
  const DEFAULT_SETTINGS = {
    bannersPublished: false,
    whatsappNumber: '8801762050353'
  };

  const PROMO_SELECTORS = [
    '.global-offer-bar',
    '.global-offer',
    '.services-section',
    '.services-sidebar-card',
    '.platform-features-card',
    '.promo-banner-wrapper',
    '.offer-card-wrapper',
    '.starter-deal-card'
  ];

  let currentSettings = { ...DEFAULT_SETTINGS };

  // 1. Immediate cache restore to eliminate layout shift
  let currentBanners = null;

  function escapeText(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // 1. Immediate cache restore to eliminate layout shift
  try {
    const cached = localStorage.getItem('site_settings');
    if (cached) {
      const parsed = JSON.parse(cached);
      currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
    }
    const cachedBanners = localStorage.getItem('site_banners_custom');
    if (cachedBanners) {
      currentBanners = JSON.parse(cachedBanners);
      if (typeof currentBanners.bannersPublished === 'boolean' && (!cached || JSON.parse(cached).bannersPublished === undefined)) {
        currentSettings.bannersPublished = currentBanners.bannersPublished;
      }
    }
  } catch (_) {}

  // Apply root dataset immediately so CSS display:none !important takes effect instantly
  const initialPublished = currentSettings.bannersPublished !== false;
  document.documentElement.dataset.bannersHidden = initialPublished ? 'false' : 'true';
  if (document.body) {
    document.body.classList.toggle('banners-hidden', !initialPublished);
  }

  // 2. Banner Content Application function
  function applyBannerData(banners) {
    if (!banners) return;
    currentBanners = { ...currentBanners, ...banners };

    // 1. Services Banner
    if (currentBanners.servicesBanner) {
      const sb = currentBanners.servicesBanner;
      document.querySelectorAll('.services-section .section-header h2, .services-header h2').forEach((el) => {
        if (sb.title) el.textContent = sb.title;
      });
      document.querySelectorAll('#servicesSidebarTitle').forEach((el) => {
        if (sb.title) el.textContent = sb.title;
      });
      document.querySelectorAll('.services-sidebar-header p').forEach((el) => {
        if (sb.subtitle) el.textContent = sb.subtitle;
      });
    }

    // 2. Platform Features Banner
    if (currentBanners.platformBanner) {
      const pb = currentBanners.platformBanner;
      document.querySelectorAll('.platform-features-card__header p').forEach((el) => {
        if (pb.eyebrow) el.textContent = pb.eyebrow;
      });
      document.querySelectorAll('#platformFeaturesTitle').forEach((el) => {
        if (pb.title) el.textContent = pb.title;
      });
      document.querySelectorAll('.platform-features-card__cta').forEach((el) => {
        if (pb.ctaText) {
          el.innerHTML = `${escapeText(pb.ctaText)} <span aria-hidden="true">→</span>`;
        }
      });
      if (Array.isArray(pb.features) && pb.features.length) {
        document.querySelectorAll('.platform-features-list').forEach((list) => {
          list.innerHTML = pb.features.map((f, i) => {
            const num = String(i + 1).padStart(2, '0');
            const parts = f.split(' - ');
            const t = parts[0] || f;
            const d = parts[1] || '';
            return `<li><span>${num}</span><div><strong>${escapeText(t)}</strong>${d ? `<small>${escapeText(d)}</small>` : ''}</div></li>`;
          }).join('');
        });
      }
    }

    // 3. Global Offer Banner
    if (currentBanners.globalOfferBanner) {
      const gob = currentBanners.globalOfferBanner;
      document.querySelectorAll('.global-offer__eyebrow').forEach((el) => {
        if (gob.eyebrow) el.textContent = gob.eyebrow;
      });
      document.querySelectorAll('#globalOfferTitle').forEach((el) => {
        if (gob.title) el.textContent = gob.title;
      });
      document.querySelectorAll('.global-offer__copy').forEach((el) => {
        if (gob.copy) el.textContent = gob.copy;
      });
      document.querySelectorAll('.global-offer__button').forEach((el) => {
        if (gob.buttonText) {
          const span = el.querySelector('[data-offer-i18n="cta"]');
          if (span) span.textContent = gob.buttonText;
        }
      });
      if (Array.isArray(gob.features) && gob.features.length) {
        document.querySelectorAll('.global-offer__features').forEach((list) => {
          list.innerHTML = gob.features.map((f) => {
            return `<li><span aria-hidden="true">✓</span><span>${escapeText(f)}</span></li>`;
          }).join('');
        });
      }
    }

    // 4. Deal 404 Banner
    if (currentBanners.deal404Banner) {
      const db = currentBanners.deal404Banner;
      document.querySelectorAll('.starter-deal-title').forEach((el) => {
        if (db.title) el.textContent = db.title;
      });
      document.querySelectorAll('.starter-deal-subtitle').forEach((el) => {
        if (db.subtitle) el.textContent = db.subtitle;
      });
      document.querySelectorAll('.original-price s').forEach((el) => {
        if (db.originalPrice) el.textContent = db.originalPrice;
      });
      document.querySelectorAll('.current-price').forEach((el) => {
        if (db.currentPrice) el.textContent = db.currentPrice;
      });
      document.querySelectorAll('.price-period').forEach((el) => {
        if (db.period) el.textContent = db.period;
      });
      document.querySelectorAll('.starter-deal-cta').forEach((el) => {
        if (db.buttonText) el.textContent = db.buttonText;
      });
    }
  }

  // 3. DOM application function
  function applySettings(settings) {
    if (!settings) return;
    currentSettings = { ...currentSettings, ...settings };

    // Update WhatsApp links
    const cleanNumber = String(currentSettings.whatsappNumber || '').replace(/\D/g, '') || DEFAULT_SETTINGS.whatsappNumber;
    document.querySelectorAll('a[href*="wa.me/"]').forEach((link) => {
      try {
        link.href = link.href.replace(/wa\.me\/\d+/, `wa.me/${cleanNumber}`);
      } catch (_) {}
    });

    // Update Promotional Banners visibility (WITHOUT touching side ad containers)
    const isPublished = currentSettings.bannersPublished !== false;
    document.documentElement.dataset.bannersHidden = isPublished ? 'false' : 'true';
    if (document.body) {
      document.body.classList.toggle('banners-hidden', !isPublished);
    }

    PROMO_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (isPublished) {
          el.style.display = '';
          el.removeAttribute('aria-hidden');
        } else {
          el.style.setProperty('display', 'none', 'important');
          el.setAttribute('aria-hidden', 'true');
        }
      });
    });

    if (currentBanners) {
      applyBannerData(currentBanners);
    }

    window.dispatchEvent(new CustomEvent('site-settings-changed', { detail: currentSettings }));
  }

  // 4. Fetch latest settings & banners from server
  async function fetchSettings() {
    try {
      let res = await fetch('/api/settings', { cache: 'no-store' });
      if (!res.ok) {
        res = await fetch('/data/settings.json', { cache: 'no-store' });
      }
      if (res.ok) {
        const data = await res.json();
        // If local custom already set, preserve it
        const savedCustom = localStorage.getItem('site_settings');
        if (!savedCustom) {
          currentSettings = { ...DEFAULT_SETTINGS, ...data };
          localStorage.setItem('site_settings', JSON.stringify(currentSettings));
          applySettings(currentSettings);
        } else {
          const parsedCustom = JSON.parse(savedCustom);
          currentSettings = { ...DEFAULT_SETTINGS, ...data, ...parsedCustom };
          applySettings(currentSettings);
        }
      }
    } catch (_) {
      applySettings(currentSettings);
    }

    // Also fetch banners
    try {
      let bRes = await fetch('/api/banners', { cache: 'no-store' });
      if (!bRes.ok) {
        bRes = await fetch('/data/banners.json', { cache: 'no-store' });
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        // If not overridden by local edits, apply
        if (!localStorage.getItem('site_banners_custom')) {
          applyBannerData(bData);
        } else {
          applyBannerData(currentBanners);
        }
      }
    } catch (_) {
      if (currentBanners) applyBannerData(currentBanners);
    }
  }

  // Cross-tab synchronization
  window.addEventListener('storage', (e) => {
    if (e.key === 'site_settings' && e.newValue) {
      try {
        const s = JSON.parse(e.newValue);
        applySettings(s);
      } catch (_) {}
    }
    if (e.key === 'site_banners_custom' && e.newValue) {
      try {
        const b = JSON.parse(e.newValue);
        applyBannerData(b);
      } catch (_) {}
    }
  });

  // In-page settings changed event
  window.addEventListener('site-settings-changed', (e) => {
    if (e.detail?.banners) {
      applyBannerData(e.detail.banners);
    }
  });

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applySettings(currentSettings);
      fetchSettings();
    }, { once: true });
  } else {
    applySettings(currentSettings);
    fetchSettings();
  }
})();


