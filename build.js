#!/usr/bin/env node
/*
 * Login Store - مولّد صفحات SEO
 * يقرأ assets/js/data.js ويكتب صفحات HTML بمحتوى ثابت يقرؤه جوجل مباشرة،
 * مع العناوين والأوصاف والبيانات المنظّمة (JSON-LD)، ثم sitemap.xml و robots.txt.
 * يعمل تلقائيًا عبر GitHub Actions كلما تغيّر data.js، أو يدويًا:  node build.js
 *
 * عند ربط دومين خاص غيّر SITE_URL هنا (أو عبر متغير البيئة SITE_URL).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const SITE = (process.env.SITE_URL || 'https://login-store.github.io/login-store/').replace(/\/?$/, '/');

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s, 'utf8');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(read('assets/js/data.js'), ctx);
const D = ctx.window.STORE_DATA;
if (!D || !D.settings || !Array.isArray(D.products)) throw new Error('ملف data.js غير صالح');
const S = D.settings;
const name = S.name || 'Login Store';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('ar-EG');
const money = (n) => nf.format(Number(n) || 0) + ' ج.م';
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const joinAr = (arr) => arr.join(' و');
const digits = (s) => String(s || '').replace(/\D/g, '');
const absUrl = (u) => (!u || /^data:/i.test(u)) ? null : (/^https?:\/\//i.test(u) ? u : SITE + String(u).replace(/^\//, ''));

const cats = D.categories || [];

/* صور المنتجات المرفوعة من لوحة التحكم تُحفظ داخل data.js كنص base64.
   نستخرجها إلى ملفات حقيقية حتى يستطيع جوجل قراءتها في البيانات المنظّمة. */
const IMG_DIR = 'assets/img/products';
const IMG = {};
const keep = new Set();
D.products.forEach((p) => {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(p.img || '');
  if (m) {
    const ext = m[1].toLowerCase().replace('jpeg', 'jpg');
    const rel = `${IMG_DIR}/${String(p.id).replace(/[^a-z0-9_-]/gi, '')}.${ext}`;
    const abs = path.join(ROOT, rel);
    const buf = Buffer.from(m[2], 'base64');
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs) || !fs.readFileSync(abs).equals(buf)) fs.writeFileSync(abs, buf);
    IMG[p.id] = rel;
    keep.add(path.basename(rel));
  } else {
    IMG[p.id] = p.img || null;
  }
});
try {
  fs.readdirSync(path.join(ROOT, IMG_DIR)).forEach((f) => { if (!keep.has(f)) fs.unlinkSync(path.join(ROOT, IMG_DIR, f)); });
} catch (e) { /* المجلد غير موجود: لا منتجات بصور */ }
const inStock = D.products.filter((p) => p.stock);
const catNames = cats.map((c) => c.name);
const top3 = joinAr(catNames.slice(0, 3));
const allCats = joinAr(catNames);
const logo = SITE + 'assets/img/logo.webp';
const og = SITE + 'assets/img/og.jpg';
const wa = digits(S.whatsapp);
const social = ['facebook', 'instagram', 'tiktok'].map((k) => S[k]).filter((u) => /^https?:\/\//i.test(u || ''));

/* ---------- بيانات منظّمة ---------- */
const crumb = (title, file) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: SITE },
    { '@type': 'ListItem', position: 2, name: title, item: SITE + file },
  ],
});
const storeLd = () => {
  const o = { '@type': 'Store', '@id': SITE + '#store', name, url: SITE, logo, image: og, description: cut(S.heroText || S.tagline, 200), currenciesAccepted: 'EGP', paymentAccepted: 'Cash' };
  if (wa || S.phone) o.telephone = wa ? '+' + wa : S.phone;
  if (S.email) o.email = S.email;
  if (S.address) o.address = { '@type': 'PostalAddress', streetAddress: S.address, addressCountry: 'EG' };
  if (S.hours) o.openingHours = S.hours;
  if (social.length) o.sameAs = social;
  return o;
};
const productLd = (p) => {
  const o = { '@type': 'Product', name: p.name, category: (cats.find((c) => c.id === p.cat) || {}).name, brand: { '@type': 'Brand', name }, offers: { '@type': 'Offer', url: SITE + 'shop.html', price: String(Number(p.price) || 0), priceCurrency: 'EGP', itemCondition: 'https://schema.org/NewCondition', availability: p.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } };
  if (p.desc) o.description = p.desc;
  o.sku = String(p.id);
  const img = absUrl(IMG[p.id]);
  if (img) o.image = img;
  return o;
};

/* ---------- أجزاء مشتركة للمحتوى الثابت ---------- */
const nav = `<header><a href="index.html">${esc(name)}</a><nav aria-label="القائمة الرئيسية"><a href="index.html">الرئيسية</a> <a href="shop.html">المنتجات</a> <a href="why.html">لماذا نحن</a> <a href="faq.html">أسئلة شائعة</a> <a href="contact.html">تواصل معنا</a></nav></header>`;
const foot = `<footer><p>${esc(name)} - ${esc(S.tagline)}</p><p>© ${new Date().getFullYear()} ${esc(name)}. جميع الحقوق محفوظة.</p></footer>`;
const productLi = (p) => `<li>${IMG[p.id] ? `<img src="${esc(IMG[p.id])}" alt="${esc(p.name)}" width="320" height="320" loading="lazy">` : ''}<h3>${esc(p.name)}</h3>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}<p>السعر: ${money(p.price)}${Number(p.old) > Number(p.price) ? ` (قبل الخصم ${money(p.old)})` : ''}</p><p>${p.stock ? 'متوفر' : 'غير متوفر حاليًا'}</p></li>`;
const features = () => (D.features || []).map((f) => `<li><h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></li>`).join('');

/* ---------- الصفحات ---------- */
const pages = [];

pages.push({
  file: 'index.html', page: 'home', url: SITE,
  title: cut(`${name} | ${S.tagline} - ${top3}`, 68),
  desc: cut(`${name}: ${S.tagline}. ${S.heroText || ''} ${S.announce || ''}`, 155),
  body: `${nav}<main><h1>${esc(S.heroTitle || name)}</h1><p>${esc(S.heroText)}</p>
<h2>تسوّق حسب القسم</h2><ul>${cats.map((c) => `<li><a href="shop.html">${esc(c.name)}</a></li>`).join('')}</ul>
<h2>منتجات مختارة</h2><ul>${inStock.slice(0, 8).map(productLi).join('')}</ul>
<h2>لماذا ${esc(name)}؟</h2><ul>${features()}</ul></main>${foot}`,
  ld: [{ '@type': 'WebSite', '@id': SITE + '#website', name, url: SITE, inLanguage: 'ar' }, storeLd()],
});

pages.push({
  file: 'shop.html', page: 'shop', url: SITE + 'shop.html',
  title: cut(`${top3} للموبايل | ${name}`, 68),
  desc: cut(`تسوّق ${allCats} وإكسسوارات الهاتف من ${name} بأسعار مناسبة. اطلب عبر واتساب والدفع عند الاستلام.`, 155),
  body: `${nav}<main><h1>المنتجات</h1><p>تصفّح كل إكسسوارات الهاتف حسب القسم.</p>${cats.map((c) => {
    const ps = D.products.filter((p) => p.cat === c.id);
    return ps.length ? `<section><h2>${esc(c.name)}</h2><ul>${ps.map(productLi).join('')}</ul></section>` : '';
  }).join('')}</main>${foot}`,
  ld: [crumb('المنتجات', 'shop.html'), { '@type': 'ItemList', name: `منتجات ${name}`, itemListElement: D.products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: productLd(p) })) }],
});

pages.push({
  file: 'why.html', page: 'why', url: SITE + 'why.html',
  title: cut(`لماذا ${name}؟ منتجات مختارة وشحن ودفع عند الاستلام`, 68),
  desc: cut(`${(D.features || []).map((f) => f.t).join('، ')}. تعرّف على ${name} وطريقة الطلب.`, 155),
  body: `${nav}<main><h1>لماذا ${esc(name)}؟</h1><ul>${features()}</ul><h2>كيف تطلب؟</h2><ol><li>اختر منتجاتك وأضفها إلى السلة.</li><li>اكتب بياناتك وأرسل الطلب على واتساب.</li><li>نؤكد معك الطلب ونوصّله، وتدفع عند الاستلام.</li></ol></main>${foot}`,
  ld: [crumb('لماذا نحن', 'why.html')],
});

const faq = D.faq || [];
pages.push({
  file: 'faq.html', page: 'faq', url: SITE + 'faq.html',
  title: cut(`أسئلة شائعة عن الطلب والدفع والتوصيل | ${name}`, 68),
  desc: cut(`إجابات عن أسئلة العملاء: ${faq.slice(0, 3).map((f) => f.q).join(' ')}`, 155),
  body: `${nav}<main><h1>أسئلة شائعة</h1>${faq.map((f) => `<section><h2>${esc(f.q)}</h2><p>${esc(f.a)}</p></section>`).join('')}</main>${foot}`,
  ld: [crumb('أسئلة شائعة', 'faq.html')].concat(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
});

const contactLines = [
  wa && `<li>واتساب: <a href="https://wa.me/${wa}">+${wa}</a></li>`,
  S.phone && `<li>الهاتف: ${esc(S.phone)}</li>`,
  S.email && `<li>البريد الإلكتروني: ${esc(S.email)}</li>`,
  S.address && `<li>العنوان: ${esc(S.address)}</li>`,
  S.hours && `<li>مواعيد العمل: ${esc(S.hours)}</li>`,
].filter(Boolean).join('');
const contactLd = { '@type': 'ContactPage', name: `تواصل مع ${name}`, url: SITE + 'contact.html' };
pages.push({
  file: 'contact.html', page: 'contact', url: SITE + 'contact.html',
  title: cut(`تواصل معنا | ${name} - ${S.tagline}`, 68),
  desc: cut(`تواصل مع ${name} (${S.tagline}) للاستفسار عن المنتجات أو متابعة طلبك${wa ? ' عبر واتساب' : ''}. ${S.hours || ''}`, 155),
  body: `${nav}<main><h1>تواصل معنا</h1><p>يسعدنا الرد على استفساراتك ومساعدتك في اختيار المنتج المناسب.</p><ul>${contactLines}</ul></main>${foot}`,
  ld: [crumb('تواصل معنا', 'contact.html'), contactLd],
});

/* ---------- كتابة الملفات ---------- */
const ldScript = (items) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': items }).replace(/</g, '\\u003c')}</script>`;
const FONTS = 'https://fonts.googleapis.com/css2?family=Lalezar&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap';

pages.forEach((p) => {
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}">
  <link rel="canonical" href="${esc(p.url)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#0B5FD0">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(name)}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:url" content="${esc(p.url)}">
  <meta property="og:image" content="${og}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="ar_AR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(p.title)}">
  <meta name="twitter:description" content="${esc(p.desc)}">
  <meta name="twitter:image" content="${og}">
  <link rel="icon" href="assets/img/logo-icon.webp" type="image/webp">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FONTS}">
  <link rel="stylesheet" href="assets/css/style.css">
  ${ldScript(p.ld)}
</head>
<body data-page="${p.page}">
  <div id="app">${p.body}</div>
  <div id="layer"></div>
  <div id="toast" hidden role="status"></div>
  <noscript><p style="padding:24px;text-align:center">يرجى تفعيل JavaScript لإتمام الطلب من المتجر.</p></noscript>
  <script src="assets/js/data.js"></script>
  <script src="assets/js/app.js"></script>
</body>
</html>
`;
  write(p.file, html);
});

const today = new Date().toISOString().slice(0, 10);
const prio = { home: ['1.0', 'weekly'], shop: ['0.9', 'weekly'], why: ['0.6', 'monthly'], faq: ['0.6', 'monthly'], contact: ['0.7', 'monthly'] };
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${esc(p.url)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${prio[p.page][1]}</changefreq>
    <priority>${prio[p.page][0]}</priority>
  </url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

console.log(`تم بناء ${pages.length} صفحات و sitemap.xml (${D.products.length} منتج) للموقع ${SITE}`);
