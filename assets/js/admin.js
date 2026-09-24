(() => {
  const DEFAULT_KEY = 'sajimpk';

  // Elements
  const authSection = document.getElementById('adminAuthSection');
  const dashboardSection = document.getElementById('adminDashboardSection');
  const saveBar = document.getElementById('adminSaveBar');
  const loginForm = document.getElementById('adminLoginForm');
  const loginKeyInput = document.getElementById('loginKeyInput');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

  // Fields
  const globalPublishBadge = document.getElementById('globalPublishBadge');
  const toggleGlobalPublishBtn = document.getElementById('toggleGlobalPublishBtn');
  const editWhatsappNumber = document.getElementById('editWhatsappNumber');

  const editServicesTitle = document.getElementById('editServicesTitle');
  const editServicesSubtitle = document.getElementById('editServicesSubtitle');
  const editServicesItems = document.getElementById('editServicesItems');

  const editPlatformEyebrow = document.getElementById('editPlatformEyebrow');
  const editPlatformTitle = document.getElementById('editPlatformTitle');
  const editPlatformCta = document.getElementById('editPlatformCta');
  const editPlatformFeatures = document.getElementById('editPlatformFeatures');

  const editGlobalEyebrow = document.getElementById('editGlobalEyebrow');
  const editGlobalTitle = document.getElementById('editGlobalTitle');
  const editGlobalCopy = document.getElementById('editGlobalCopy');
  const editGlobalFeatures = document.getElementById('editGlobalFeatures');
  const editGlobalButtonText = document.getElementById('editGlobalButtonText');

  const editDealTitle = document.getElementById('editDealTitle');
  const editDealSubtitle = document.getElementById('editDealSubtitle');
  const editDealRegularPrice = document.getElementById('editDealRegularPrice');
  const editDealCurrentPrice = document.getElementById('editDealCurrentPrice');
  const editDealPeriod = document.getElementById('editDealPeriod');
  const editDealButtonText = document.getElementById('editDealButtonText');

  const saveAllBannersBtn = document.getElementById('saveAllBannersBtn');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
  const saveStatusToast = document.getElementById('saveStatusToast');

  let activeAdminKey = '';
  let currentBannersState = null;
  let isPublishedState = false;

  // 1. Toast Notification Helper
  function showToast(msg, type = 'success', duration = 4000) {
    if (!saveStatusToast) return;
    saveStatusToast.className = `admin-status-toast ${type}`;
    saveStatusToast.textContent = msg;
    saveStatusToast.style.display = 'inline-block';
    if (duration > 0) {
      setTimeout(() => {
        saveStatusToast.style.display = 'none';
      }, duration);
    }
  }

  // 2. Authentication Check
  function getStoredKey() {
    const urlParams = new URLSearchParams(window.location.search);
    const qKey = urlParams.get('key') || urlParams.get('admin_key');
    if (qKey) return qKey.trim();

    return (
      sessionStorage.getItem('site_admin_key') ||
      localStorage.getItem('site_admin_key') ||
      sessionStorage.getItem('admin_key') ||
      localStorage.getItem('admin_key') ||
      ''
    ).trim();
  }

  async function verifyAdminKey(key) {
    if (!key) return false;
    // Direct check against default key
    if (key === DEFAULT_KEY) return true;

    // Check with server endpoint if available
    try {
      const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`);
      if (res.ok) return true;
    } catch (_) {}

    return false;
  }

  function setAuthenticatedView(isAuthed) {
    if (isAuthed) {
      authSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      saveBar.style.display = 'flex';
      adminLogoutBtn.hidden = false;
    } else {
      authSection.style.display = 'block';
      dashboardSection.style.display = 'none';
      saveBar.style.display = 'none';
      adminLogoutBtn.hidden = true;
    }
  }

  // 3. Update Toggle UI
  function updatePublishToggleUI(published) {
    isPublishedState = Boolean(published);
    if (!globalPublishBadge || !toggleGlobalPublishBtn) return;

    const bannerStatusIndicator = document.getElementById('bannerStatusIndicator');

    if (isPublishedState) {
      globalPublishBadge.textContent = '● Published / Active';
      globalPublishBadge.style.color = '#10b981';
      globalPublishBadge.style.background = 'rgba(16, 185, 129, 0.12)';
      globalPublishBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';

      if (bannerStatusIndicator) {
        bannerStatusIndicator.innerHTML = '<span style="color: #10b981; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">🟢 Live / Visible on Website</span>';
      }
      toggleGlobalPublishBtn.innerHTML = '🛑 Click to Hide & Remove Banners';
      toggleGlobalPublishBtn.className = 'button button-secondary';
      toggleGlobalPublishBtn.style.borderColor = '#ef4444';
      toggleGlobalPublishBtn.style.color = '#ef4444';
    } else {
      globalPublishBadge.textContent = '● Removed / Inactive';
      globalPublishBadge.style.color = '#ef4444';
      globalPublishBadge.style.background = 'rgba(239, 68, 68, 0.12)';
      globalPublishBadge.style.border = '1px solid rgba(239, 68, 68, 0.3)';

      if (bannerStatusIndicator) {
        bannerStatusIndicator.innerHTML = '<span style="color: #ef4444; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">🔴 Hidden / Removed from Website</span>';
      }
      toggleGlobalPublishBtn.innerHTML = '🚀 Click to Publish & Show Banners';
      toggleGlobalPublishBtn.className = 'button button-primary';
      toggleGlobalPublishBtn.style.borderColor = '';
      toggleGlobalPublishBtn.style.color = '';
    }
  }

  // 4. Fetch & Populate Banner Data
  async function loadBannerData() {
    let data = null;

    // Check localStorage custom first (highest local priority)
    try {
      const localCustom = localStorage.getItem('site_banners_custom');
      if (localCustom) data = JSON.parse(localCustom);
    } catch (_) {}

    // Check localStorage site_settings
    let savedPublished = null;
    let savedWhatsapp = null;
    try {
      const localSettings = localStorage.getItem('site_settings');
      if (localSettings) {
        const parsed = JSON.parse(localSettings);
        if (typeof parsed.bannersPublished === 'boolean') savedPublished = parsed.bannersPublished;
        if (parsed.whatsappNumber) savedWhatsapp = parsed.whatsappNumber;
      }
    } catch (_) {}

    if (!data) {
      try {
        let res = await fetch('/api/banners', { cache: 'no-store' });
        if (!res.ok) res = await fetch('/data/banners.json', { cache: 'no-store' });
        if (res.ok) data = await res.json();
      } catch (_) {}
    }

    if (!data) {
      data = {
        bannersPublished: false,
        whatsappNumber: '8801762050353'
      };
    }

    // Only if localStorage doesn't have an explicit user choice, fetch settings from server
    if (savedPublished === null) {
      try {
        let sRes = await fetch('/api/settings', { cache: 'no-store' });
        if (!sRes.ok) sRes = await fetch('/data/settings.json', { cache: 'no-store' });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (typeof sData.bannersPublished === 'boolean') {
            data.bannersPublished = sData.bannersPublished;
          }
          if (sData.whatsappNumber) {
            data.whatsappNumber = sData.whatsappNumber;
          }
        }
      } catch (_) {}
    } else {
      data.bannersPublished = savedPublished;
    }

    if (savedWhatsapp) {
      data.whatsappNumber = savedWhatsapp;
    }

    currentBannersState = data;
    populateForm(data);
  }

  function populateForm(data) {
    if (!data) return;

    // Global
    updatePublishToggleUI(data.bannersPublished);
    if (editWhatsappNumber) editWhatsappNumber.value = data.whatsappNumber || '8801762050353';

    // 1. Services Banner
    if (data.servicesBanner) {
      if (editServicesTitle) editServicesTitle.value = data.servicesBanner.title || 'Our Services';
      if (editServicesSubtitle) editServicesSubtitle.value = data.servicesBanner.subtitle || 'Learn with confidence';
      if (editServicesItems && Array.isArray(data.servicesBanner.items)) {
        editServicesItems.value = data.servicesBanner.items
          .map(item => `${item.title || ''} | ${item.tag || ''} | ${item.desc || ''} | ${item.badge || ''}`)
          .join('\n');
      }
    }

    // 2. Platform Features Banner
    if (data.platformBanner) {
      if (editPlatformEyebrow) editPlatformEyebrow.value = data.platformBanner.eyebrow || 'Computer-Based IELTS';
      if (editPlatformTitle) editPlatformTitle.value = data.platformBanner.title || 'Everything you need';
      if (editPlatformCta) editPlatformCta.value = data.platformBanner.ctaText || 'Ask about the platform →';
      if (editPlatformFeatures && Array.isArray(data.platformBanner.features)) {
        editPlatformFeatures.value = data.platformBanner.features.join('\n');
      }
    }

    // 3. Global IELTS Offer Banner
    if (data.globalOfferBanner) {
      if (editGlobalEyebrow) editGlobalEyebrow.value = data.globalOfferBanner.eyebrow || 'Global IELTS offer';
      if (editGlobalTitle) editGlobalTitle.value = data.globalOfferBanner.title || "One of the world's lowest-priced IELTS mock test experiences.";
      if (editGlobalCopy) editGlobalCopy.value = data.globalOfferBanner.copy || 'Practice smoothly from any country with a fast, learner-friendly experience.';
      if (editGlobalFeatures && Array.isArray(data.globalOfferBanner.features)) {
        editGlobalFeatures.value = data.globalOfferBanner.features.join('\n');
      }
      if (editGlobalButtonText) editGlobalButtonText.value = data.globalOfferBanner.buttonText || 'Contact on WhatsApp';
    }

    // 4. 404 Starter Deal Banner
    if (data.deal404Banner) {
      if (editDealTitle) editDealTitle.value = data.deal404Banner.title || 'Complete IELTS Preparation & Mock Test Pack';
      if (editDealSubtitle) editDealSubtitle.value = data.deal404Banner.subtitle || 'Access authentic Cambridge study materials...';
      if (editDealRegularPrice) editDealRegularPrice.value = data.deal404Banner.originalPrice || '৳1,000';
      if (editDealCurrentPrice) editDealCurrentPrice.value = data.deal404Banner.currentPrice || '৳350';
      if (editDealPeriod) editDealPeriod.value = data.deal404Banner.period || '/ Months Unlimited';
      if (editDealButtonText) editDealButtonText.value = data.deal404Banner.buttonText || 'Claim Starter Deal →';
    }
  }

  function collectFormData() {
    // Parse Services items
    const rawServicesLines = (editServicesItems?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
    const servicesItems = rawServicesLines.map((line, idx) => {
      const parts = line.split('|').map(p => p.trim());
      return {
        id: idx + 1,
        title: parts[0] || '',
        tag: parts[1] || '',
        desc: parts[2] || '',
        badge: parts[3] || ''
      };
    });

    // Parse Platform features
    const platformFeatures = (editPlatformFeatures?.value || '').split('\n').map(l => l.trim()).filter(Boolean);

    // Parse Global offer features
    const globalFeatures = (editGlobalFeatures?.value || '').split('\n').map(l => l.trim()).filter(Boolean);

    const whatsappNum = (editWhatsappNumber?.value || '8801762050353').trim().replace(/\D/g, '') || '8801762050353';

    return {
      bannersPublished: isPublishedState,
      whatsappNumber: whatsappNum,
      servicesBanner: {
        title: editServicesTitle?.value?.trim() || 'Our Services',
        subtitle: editServicesSubtitle?.value?.trim() || 'Learn with confidence',
        ctaText: 'Explore services →',
        items: servicesItems
      },
      platformBanner: {
        eyebrow: editPlatformEyebrow?.value?.trim() || 'Computer-Based IELTS',
        title: editPlatformTitle?.value?.trim() || 'Everything you need',
        ctaText: editPlatformCta?.value?.trim() || 'Ask about the platform →',
        features: platformFeatures
      },
      globalOfferBanner: {
        eyebrow: editGlobalEyebrow?.value?.trim() || 'Global IELTS offer',
        title: editGlobalTitle?.value?.trim() || "One of the world's lowest-priced IELTS mock test experiences.",
        copy: editGlobalCopy?.value?.trim() || 'Practice smoothly from any country with a fast, learner-friendly experience.',
        features: globalFeatures,
        buttonText: editGlobalButtonText?.value?.trim() || 'Contact on WhatsApp'
      },
      deal404Banner: {
        badge: '🔥 Global Starter Deal',
        pill: 'Limited Time Offer',
        title: editDealTitle?.value?.trim() || 'Complete IELTS Preparation & Mock Test Pack',
        subtitle: editDealSubtitle?.value?.trim() || 'Access authentic Cambridge study materials...',
        originalPrice: editDealRegularPrice?.value?.trim() || '৳1,000',
        currentPrice: editDealCurrentPrice?.value?.trim() || '৳350',
        period: editDealPeriod?.value?.trim() || '/ Months Unlimited',
        buttonText: editDealButtonText?.value?.trim() || 'Claim Starter Deal →'
      }
    };
  }

  // 5. Save Banners & Settings
  async function saveBannersAndSettings() {
    saveAllBannersBtn.disabled = true;
    saveAllBannersBtn.textContent = 'Saving...';

    const payload = collectFormData();
    currentBannersState = payload;
    updatePublishToggleUI(payload.bannersPublished);

    // Always update localStorage immediately
    localStorage.setItem('site_banners_custom', JSON.stringify(payload));
    localStorage.setItem('site_settings', JSON.stringify({
      bannersPublished: payload.bannersPublished,
      whatsappNumber: payload.whatsappNumber
    }));

    window.dispatchEvent(new CustomEvent('site-settings-changed', {
      detail: {
        bannersPublished: payload.bannersPublished,
        whatsappNumber: payload.whatsappNumber,
        banners: payload
      }
    }));

    let savedToBackend = false;

    // Attempt backend save via POST
    try {
      const res = await fetch(`/api/banners?key=${encodeURIComponent(activeAdminKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': activeAdminKey,
          'x-api-key': activeAdminKey
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        savedToBackend = true;
      }
    } catch (_) {}

    // Also attempt /api/settings POST
    try {
      await fetch(`/api/settings?key=${encodeURIComponent(activeAdminKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': activeAdminKey,
          'x-api-key': activeAdminKey
        },
        body: JSON.stringify({
          bannersPublished: payload.bannersPublished,
          whatsappNumber: payload.whatsappNumber
        })
      });
    } catch (_) {}

    saveAllBannersBtn.disabled = false;
    saveAllBannersBtn.textContent = '💾 Save & Update Database';

    const statusLabel = payload.bannersPublished ? 'Live / Published' : 'Hidden / Removed';
    if (savedToBackend) {
      showToast(`✓ Database updated! Banners are: ${statusLabel}.`, 'success', 4000);
    } else {
      showToast(`✓ Saved! Banners are now: ${statusLabel}. (Saved in browser & local files)`, 'success', 4000);
    }
  }

  // 6. Event Listeners
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = (loginKeyInput.value || '').trim();
    loginErrorMsg.style.display = 'none';

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Verifying...';

    const isValid = await verifyAdminKey(key);
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'Unlock Dashboard';

    if (isValid) {
      activeAdminKey = key;
      sessionStorage.setItem('site_admin_key', key);
      localStorage.setItem('site_admin_key', key);
      setAuthenticatedView(true);
      await loadBannerData();
      showToast('Welcome back, Admin!', 'success', 2500);
    } else {
      loginErrorMsg.textContent = 'Invalid Admin Key. Please enter the correct authorization key.';
      loginErrorMsg.style.display = 'block';
    }
  });

  adminLogoutBtn?.addEventListener('click', () => {
    activeAdminKey = '';
    sessionStorage.removeItem('site_admin_key');
    localStorage.removeItem('site_admin_key');
    setAuthenticatedView(false);
    if (loginKeyInput) {
      loginKeyInput.value = '';
      loginKeyInput.focus();
    }
  });

  toggleGlobalPublishBtn?.addEventListener('click', async () => {
    const nextState = !isPublishedState;
    updatePublishToggleUI(nextState);
    await saveBannersAndSettings();
  });

  saveAllBannersBtn?.addEventListener('click', () => {
    saveBannersAndSettings();
  });

  resetDefaultsBtn?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all banner content back to default values?')) {
      localStorage.removeItem('site_banners_custom');
      try {
        const res = await fetch('/data/banners.json');
        if (res.ok) {
          const defaults = await res.json();
          populateForm(defaults);
          showToast('Form reset to default values. Click Save to persist.', 'success');
          return;
        }
      } catch (_) {}
      showToast('Defaults reloaded.', 'success');
    }
  });

  // 7. Auto-initialization on page load
  async function init() {
    const existingKey = getStoredKey();
    if (existingKey) {
      const isValid = await verifyAdminKey(existingKey);
      if (isValid) {
        activeAdminKey = existingKey;
        setAuthenticatedView(true);
        await loadBannerData();
        return;
      }
    }
    setAuthenticatedView(false);
  }

  init();
})();
