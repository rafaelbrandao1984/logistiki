const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const siteHost = 'www.logistiki.com.br';
const errors = [];
const warnings = [];

function listHtmlFiles() {
  return fs.readdirSync(publicDir)
    .filter((file) => file.endsWith('.html'))
    .sort();
}

function existsPublicFile(relativePath) {
  return fs.existsSync(path.join(publicDir, relativePath));
}

function localPathFromUrl(value) {
  if (!value || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('data:')) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname !== siteHost) return null;
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || 'index.html';
  } catch (_) {
    return decodeURIComponent(value.split('#')[0].split('?')[0]);
  }
}

function collectAttributeValues(html, attribute) {
  const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, 'gi');
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

function getMetaDescription(html) {
  const tag = html.match(/<meta\s+[^>]*name=["']description["'][^>]*>/i);
  if (!tag) return '';
  const content = tag[0].match(/\scontent=(["'])(.*?)\1/i);
  return content ? content[2] : '';
}

function isReferenceLike(value) {
  return /^https?:\/\//i.test(value)
    || value.startsWith('/')
    || /\.(html|png|jpe?g|webp|gif|svg|ico)([?#].*)?$/i.test(value);
}

for (const file of listHtmlFiles()) {
  const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
  const label = `public/${file}`;
  const is404 = file === '404.html';

  if (!/<html[^>]+lang=["']pt-br["']/i.test(html)) {
    errors.push(`${label}: faltou html lang="pt-br"`);
  }

  if (!/<meta\s+name=["']viewport["']/i.test(html)) {
    errors.push(`${label}: faltou meta viewport`);
  }

  if (!/<title>[^<]{10,}<\/title>/i.test(html)) {
    errors.push(`${label}: title ausente ou muito curto`);
  }

  if (!is404 && getMetaDescription(html).length < 50) {
    warnings.push(`${label}: meta description ausente ou curta`);
  }

  if (!is404 && !/<link\s+rel=["']canonical["']/i.test(html)) {
    errors.push(`${label}: canonical ausente`);
  }

  for (const value of [...collectAttributeValues(html, 'href'), ...collectAttributeValues(html, 'src')]) {
    const localPath = localPathFromUrl(value);
    if (!localPath || /^(https?:)?\/\//.test(localPath)) continue;
    if (!existsPublicFile(localPath)) {
      errors.push(`${label}: referencia local inexistente: ${value}`);
    }
  }

  for (const value of collectAttributeValues(html, 'content').filter(isReferenceLike)) {
    const localPath = localPathFromUrl(value);
    if (!localPath || /^(https?:)?\/\//.test(localPath)) continue;
    if (!existsPublicFile(localPath)) {
      errors.push(`${label}: referencia local inexistente: ${value}`);
    }
  }
}

for (const requiredAsset of ['imagem-preview.jpg', 'logo.png', 'favicon-32x32.png', 'apple-touch-icon.png']) {
  if (!existsPublicFile(requiredAsset)) {
    errors.push(`public/${requiredAsset}: asset obrigatorio ausente`);
  }
}

if (warnings.length) {
  console.warn('Avisos de validacao:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error('Erros de validacao:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Validacao do site concluida sem erros.');
