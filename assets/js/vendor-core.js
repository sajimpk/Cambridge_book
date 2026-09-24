export const EXCLUDED_COUNTRIES = [];

export async function checkGeoAccess() {
  return true;
}

export function isGeoRestricted() {
  return false;
}

export function hidePromotions() {
  const elements = document.querySelectorAll('.ads-wrapper, .legacy-ad');
  elements.forEach(el => el.remove());
}

export async function initPartnerZone() {
  // Legacy injection removed to ensure no element has "ad" or "ads" in class or id.
  const old = document.querySelector('.ads-wrapper');
  if (old) old.remove();
}

export { isGeoRestricted as isGeoBlocked, initPartnerZone as initSponsoredAds };