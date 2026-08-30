const whatsappNumber = '8801711777508';
const purchaseMessage = 'Hello Arif Academy, I want to purchase the Unlimited IELTS Mock Test package.';

function updateWhatsAppLinks() {
  document.querySelectorAll('a[href*="wa.me/"]').forEach((link) => {
    link.href = link.href.replace(/wa\.me\/\d+/, `wa.me/${whatsappNumber}`);

    if (link.matches('.global-offer__button')) {
      const url = new URL(link.href);
      url.searchParams.set('text', purchaseMessage);
      link.href = url.toString();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateWhatsAppLinks, { once: true });
} else {
  updateWhatsAppLinks();
}
