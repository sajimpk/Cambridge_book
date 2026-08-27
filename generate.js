const fs = require('fs');
const path = require('path');

const booksFilePath = path.join(__dirname, 'data', 'book.json');
const templateFilePath = path.join(__dirname, 'book.html');

// Read books data
if (!fs.existsSync(booksFilePath)) {
  console.error('book.json not found!');
  process.exit(1);
}
const booksData = JSON.parse(fs.readFileSync(booksFilePath, 'utf8'));

// Read template
if (!fs.existsSync(templateFilePath)) {
  console.error('book.html template not found!');
  process.exit(1);
}
const templateHtml = fs.readFileSync(templateFilePath, 'utf8');

// Helper to escape HTML string attributes
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// We only want ONE dynamic book page, located under cambridge-ielts
// Delete all other book folders that might exist from previous generations
Object.keys(booksData).concat(['cambridge-ielts-01']).forEach((key) => {
  if (key !== 'cambridge-ielts') {
    const bookDir = path.join(__dirname, key);
    if (fs.existsSync(bookDir)) {
      fs.rmSync(bookDir, { recursive: true, force: true });
      console.log(`Removed old folder: ${key}`);
    }
  }
});

// Now generate ONLY the cambridge-ielts folder as the dynamic template
const key = 'cambridge-ielts';
const bookDir = path.join(__dirname, key);
if (fs.existsSync(bookDir)) {
  fs.rmSync(bookDir, { recursive: true, force: true });
}
fs.mkdirSync(bookDir, { recursive: true });

const title = "Cambridge IELTS • Arif Academy";
const desc = "Open a PDF redirect page with full book details.";
const image = "../assets/images/placeholder.svg";
const bookUrl = `https://arifacademy.com/book/cambridge-ielts`;

let pageHtml = templateHtml
  // 1. Replace assets/ and data/ relative paths to go up one directory (../)
  .replace(/href="assets\//g, 'href="../assets/')
  .replace(/src="assets\//g, 'src="../assets/')
  .replace(/href="manifest\.webmanifest"/g, 'href="../manifest.webmanifest"')
  .replace(/href="index\.html"/g, 'href="../Index.html"')
  
  // 2. Pre-render SEO Meta Tags
  .replace(/<title id="pageTitle">.*?<\/title>/, `<title id="pageTitle">${escapeHtml(title)}</title>`)
  .replace(/<meta name="description" id="metaDescription" content=".*?" \/>/, `<meta name="description" id="metaDescription" content="${escapeHtml(desc)}" />`)
  .replace(/<link rel="canonical" id="canonicalLink" href=".*?" \/>/, `<link rel="canonical" id="canonicalLink" href="${escapeHtml(bookUrl)}" />`)
  .replace(/<meta property="og:title" id="ogTitle" content=".*?" \/>/, `<meta property="og:title" id="ogTitle" content="Cambridge IELTS • Arif Academy" />`)
  .replace(/<meta property="og:description" id="ogDescription" content=".*?" \/>/, `<meta property="og:description" id="ogDescription" content="${escapeHtml(desc)}" />`)
  .replace(/<meta property="og:url" id="ogUrl" content=".*?" \/>/, `<meta property="og:url" id="ogUrl" content="${escapeHtml(bookUrl)}" />`)
  .replace(/<meta property="og:image" id="ogImage" content=".*?" \/>/, `<meta property="og:image" id="ogImage" content="${escapeHtml(image)}" />`)
  .replace(/<meta name="twitter:title" id="twitterTitle" content=".*?" \/>/, `<meta name="twitter:title" id="twitterTitle" content="Cambridge IELTS • Arif Academy" />`)
  .replace(/<meta name="twitter:description" id="twitterDescription" content=".*?" \/>/, `<meta name="twitter:description" id="twitterDescription" content="${escapeHtml(desc)}" />`);

// Write index.html to cambridge-ielts-01/index.html
const outputFilePath = path.join(bookDir, 'index.html');
fs.writeFileSync(outputFilePath, pageHtml, 'utf8');
console.log(`Generated: ${path.relative(__dirname, outputFilePath)}`);

console.log('Static pages generation complete!');
