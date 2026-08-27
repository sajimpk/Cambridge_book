const whatsappNumber = '8801711777508';

function updateWhatsAppLinks() {
  document.querySelectorAll('a[href*="wa.me/"]').forEach((link) => {
    link.href = link.href.replace(/wa\.me\/\d+/, `wa.me/${whatsappNumber}`);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateWhatsAppLinks, { once: true });
} else {
  updateWhatsAppLinks();
}
