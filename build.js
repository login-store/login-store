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
   نستخرجها إلى ملفات حقيقية (اسمها يحتوي بصمة المحتوى) ونستبدل بها النص داخل data.js نفسه،
   فيبقى data.js خفيفًا وتستطيع جوجل قراءة الصور في البيانات المنظّمة. */
const crypto = require('crypto');
const IMG_DIR = 'assets/img/products';
const IMG = {};
const IMGS = {};
const keep = new Set();
let rewrote = false;
const extract = (u, id) => {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(u || '');
  if (!m) return null;
  const ext = m[1].toLowerCase().replace('jpeg', 'jpg');
  const buf = Buffer.from(m[2], 'base64');
  const h = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const rel = `${IMG_DIR}/${String(id).replace(/[^a-z0-9_-]/gi, '')}-${h}.${ext}`;
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, buf);
  return rel;
};
D.products.forEach((p) => {
  const fix = (u) => { const rel = extract(u, p.id); if (rel) { rewrote = true; return rel; } return u || ''; };
  p.img = fix(p.img);
  if (Array.isArray(p.imgs)) p.imgs = p.imgs.map(fix).filter(Boolean);
  IMGS[p.id] = [p.img].concat(Array.isArray(p.imgs) ? p.imgs : []).filter(Boolean);
  IMG[p.id] = IMGS[p.id][0] || null;
  IMGS[p.id].forEach((u) => { if (u.startsWith(IMG_DIR + '/')) keep.add(path.basename(u)); });
});
if (rewrote) {
  write('assets/js/data.js', '/* بيانات متجر Login Store. يُنشأ هذا الملف تلقائيًا من وضع التعديل (index.html?admin). */\nwindow.STORE_DATA = ' + JSON.stringify(D, null, 2) + ';\n');
}
try {
  fs.readdirSync(path.join(ROOT, IMG_DIR)).forEach((f) => { if (!keep.has(f)) fs.unlinkSync(path.join(ROOT, IMG_DIR, f)); });
} catch (e) { /* المجلد غير موجود: لا منتجات بصور */ }

/* اسم ملف صفحة كل منتج */
const PFILE = {};
const usedSlug = new Set();
D.products.forEach((p, i) => {
  const base = String(p.id).toLowerCase().replace(/[^a-z0-9_-]/g, '') || `p${i + 1}`;
  let u = base, n = 2;
  while (usedSlug.has(u)) u = `${base}-${n++}`;
  usedSlug.add(u);
  PFILE[p.id] = `product-${u}.html`;
});
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
const crumb3 = (cat, p) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: SITE },
    { '@type': 'ListItem', position: 2, name: 'المنتجات', item: SITE + 'shop.html' },
    { '@type': 'ListItem', position: 3, name: p.name, item: SITE + PFILE[p.id] },
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
  const o = { '@type': 'Product', name: p.name, category: (cats.find((c) => c.id === p.cat) || {}).name, brand: { '@type': 'Brand', name }, offers: { '@type': 'Offer', url: SITE + PFILE[p.id], price: String(Number(p.price) || 0), priceCurrency: 'EGP', itemCondition: 'https://schema.org/NewCondition', availability: p.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } };
  const dsc = p.long ? cut(p.long, 500) : p.desc;
  if (dsc) o.description = dsc;
  o.sku = String(p.id);
  o.url = SITE + PFILE[p.id];
  const imgs = (IMGS[p.id] || []).map(absUrl).filter(Boolean);
  if (imgs.length) o.image = imgs.length === 1 ? imgs[0] : imgs;
  return o;
};

/* ---------- أجزاء مشتركة للمحتوى الثابت ---------- */
const nav = `<header><a href="index.html">${esc(name)}</a><nav aria-label="القائمة الرئيسية"><a href="index.html">الرئيسية</a> <a href="shop.html">المنتجات</a> <a href="why.html">لماذا نحن</a> <a href="faq.html">أسئلة شائعة</a> <a href="contact.html">تواصل معنا</a></nav></header>`;
const foot = `<footer><p>${esc(name)} - ${esc(S.tagline)}</p><p>© ${new Date().getFullYear()} ${esc(name)}. جميع الحقوق محفوظة.</p></footer>`;
const productLi = (p) => `<li>${IMG[p.id] ? `<img src="${esc(IMG[p.id])}" alt="${esc(p.name)}" width="320" height="320" loading="lazy">` : ''}<h3><a href="${PFILE[p.id]}">${esc(p.name)}</a></h3>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}<p>السعر: ${money(p.price)}${Number(p.old) > Number(p.price) ? ` (قبل الخصم ${money(p.old)})` : ''}</p><p>${p.stock ? 'متوفر' : 'غير متوفر حاليًا'}</p></li>`;
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
  desc: cut(`تسوّق ${allCats} وإكسسوارات الهاتف من ${name} بأسعار مناسبة. اطلب أونلاين والدفع عند الاستلام.`, 155),
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
  body: `${nav}<main><h1>لماذا ${esc(name)}؟</h1><ul>${features()}</ul><h2>كيف تطلب؟</h2><ol><li>اختر منتجاتك وأضفها إلى السلة.</li><li>اكتب بياناتك وأكّد الطلب.</li><li>نتصل بك لتأكيد الطلب ونوصّله، وتدفع عند الاستلام.</li></ol></main>${foot}`,
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


/* ---------- صفحة مستقلة لكل منتج ---------- */
const paras = (t) => String(t || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
const productBody = (p) => {
  const cat = cats.find((c) => c.id === p.cat);
  const imgs = IMGS[p.id] || [];
  const specs = (p.specs || []).filter((x) => x && x.k);
  const rel = D.products.filter((x) => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  return `${nav}<main><nav aria-label="مسار الصفحة"><a href="index.html">الرئيسية</a> / <a href="shop.html">المنتجات</a>${cat ? ` / <a href="shop.html">${esc(cat.name)}</a>` : ''} / ${esc(p.name)}</nav>
<article><h1>${esc(p.name)}</h1>${imgs.map((u, i) => `<img src="${esc(u)}" alt="${esc(p.name)}${imgs.length > 1 ? ' - صورة ' + (i + 1) : ''}" width="640" height="640"${i ? ' loading="lazy"' : ''}>`).join('')}
<p>السعر: ${money(p.price)}${Number(p.old) > Number(p.price) ? ` (قبل الخصم ${money(p.old)})` : ''}</p><p>${p.stock ? 'متوفر' : 'غير متوفر حاليًا'}</p>
${p.desc ? `<p>${esc(p.desc)}</p>` : ''}${p.long ? `<h2>وصف المنتج</h2>${paras(p.long)}` : ''}${specs.length ? `<h2>المواصفات</h2><ul>${specs.map((x) => `<li>${esc(x.k)}${x.v ? ': ' + esc(x.v) : ''}</li>`).join('')}</ul>` : ''}</article>
${rel.length ? `<h2>منتجات مشابهة</h2><ul>${rel.map((x) => `<li><a href="${PFILE[x.id]}">${esc(x.name)}</a> - ${money(x.price)}</li>`).join('')}</ul>` : ''}</main>${foot}`;
};
D.products.forEach((p) => {
  const cat = cats.find((c) => c.id === p.cat);
  const img = absUrl(IMG[p.id]);
  pages.push({
    file: PFILE[p.id], page: 'product', pid: p.id, url: SITE + PFILE[p.id], ogImage: img, ogType: 'product',
    title: cut(`${p.name} | ${cat ? cat.name + ' | ' : ''}${name}`, 68),
    desc: cut(`${p.name}${p.desc ? ' - ' + String(p.desc).replace(/[.。\s]+$/, '') : ''}. السعر ${money(p.price)}. ${p.stock ? 'متوفر' : 'غير متوفر حاليًا'} في ${name}، والدفع عند الاستلام.`, 155),
    body: productBody(p),
    ld: [crumb3(cat, p), productLd(p)],
  });
});
pages.push({
  file: 'product.html', page: 'product', url: SITE + 'product.html', noindex: true,
  title: `المنتج | ${name}`, desc: `تفاصيل المنتج في ${name}.`,
  body: `${nav}<main><h1>المنتج</h1></main>${foot}`, ld: [],
});
pages.push({
  file: 'account.html', page: 'account', url: SITE + 'account.html', noindex: true,
  title: `حسابي | ${name}`, desc: `حساب العميل في ${name}.`,
  body: `${nav}<main><h1>حسابي</h1></main>${foot}`, ld: [],
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
  ${p.noindex ? '' : `<link rel="canonical" href="${esc(p.url)}">`}
  <meta name="robots" content="${p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
  <meta name="theme-color" content="#0B5FD0">
  <meta property="og:type" content="${p.ogType || 'website'}">
  <meta property="og:site_name" content="${esc(name)}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:url" content="${esc(p.url)}">
  <meta property="og:image" content="${p.ogImage || og}">${p.ogImage ? '' : `
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">`}
  <meta property="og:locale" content="ar_AR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(p.title)}">
  <meta name="twitter:description" content="${esc(p.desc)}">
  <meta name="twitter:image" content="${p.ogImage || og}">
  <link rel="icon" href="assets/img/logo-icon.webp" type="image/webp">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FONTS}">
  <link rel="stylesheet" href="assets/css/style.css">
  ${ldScript(p.ld)}
</head>
<body data-page="${p.page}"${p.pid != null ? ` data-pid="${esc(p.pid)}"` : ''}>
  <div id="app">${p.body}</div>
  <div id="layer"></div>
  <div id="toast" hidden role="status"></div>
  <noscript><p style="padding:24px;text-align:center">يرجى تفعيل JavaScript لإتمام الطلب من المتجر.</p></noscript>
  <script src="assets/js/data.js"></script>
  <script src="assets/js/account.js"></script>
  <script src="assets/js/app.js"></script>
</body>
</html>
`;
  write(p.file, html);
});

const made = new Set(pages.map((p) => p.file));
fs.readdirSync(ROOT).forEach((f) => { if (/^product-.*\.html$/.test(f) && !made.has(f)) fs.unlinkSync(path.join(ROOT, f)); });

const today = new Date().toISOString().slice(0, 10);
const prio = { home: ['1.0', 'weekly'], shop: ['0.9', 'weekly'], why: ['0.6', 'monthly'], faq: ['0.6', 'monthly'], contact: ['0.7', 'monthly'], product: ['0.7', 'weekly'] };
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.filter((p) => !p.noindex).map((p) => `  <url>
    <loc>${esc(p.url)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${prio[p.page][1]}</changefreq>
    <priority>${prio[p.page][0]}</priority>
  </url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

console.log(`تم بناء ${pages.length} صفحة و sitemap.xml (${D.products.length} منتج) للموقع ${SITE}`);
