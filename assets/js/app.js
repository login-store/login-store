/*
 * Login Store - منطق الموقع (عرض المنتجات، السلة، وضع التعديل)
 * البيانات في assets/js/data.js، والتنسيق في assets/css/style.css
 */

(function(){
var LOGO_FULL='assets/img/logo.webp';
var LOGO_ICON='assets/img/logo-icon.webp';

var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var nf=new Intl.NumberFormat('ar-EG');
var money=function(n){return nf.format(Number(n)||0)+' ج.م'};

var S=JSON.parse(JSON.stringify(window.STORE_DATA));
var ADMIN=/[?&]admin(=|&|$)/.test(location.search);
var PAGE_FILE={home:'index.html',shop:'shop.html',why:'why.html',faq:'faq.html',contact:'contact.html'};
function pageUrl(id,extra){var qs=[];if(extra)qs.push(extra);if(ADMIN)qs.push('admin');return PAGE_FILE[id]+(qs.length?'?'+qs.join('&'):'')}
var sortBy='def',qvId=null;
var D=null,admin=false,canEdit=false,artifactApi=null,assetsApi=null;
var ghMode=false,publishMsg='',ghCfg={owner:'',repo:'',branch:'main',path:'assets/js/data.js',token:''};
try{var gs=JSON.parse(localStorage.getItem('ls-gh')||'null');if(gs)ghCfg=Object.assign(ghCfg,gs)}catch(e){}
var cart={},filter='all',q='',dirty=false,layer=null,tab='products',editing=null,confirmDel=null,busy=false;
var cust={name:'',phone:'',addr:'',note:'',hp:''};
try{cart=JSON.parse(localStorage.getItem('ls-cart')||'{}')||{}}catch(e){cart={}}
var saveCart=function(){try{localStorage.setItem('ls-cart',JSON.stringify(cart))}catch(e){}};
var cur=function(){return admin&&D?D:S};

/* icons */
var IC={
 case:'<rect x="18" y="6" width="28" height="52" rx="7"/><rect x="22" y="10" width="13" height="13" rx="3.5"/><circle cx="28.5" cy="16.5" r="3"/>',
 charger:'<rect x="15" y="14" width="34" height="26" rx="5"/><path d="M26 14V6M38 14V6M32 40v10M25 50h14"/>',
 cable:'<path d="M12 48c14 0 6-22 20-22s6 22 20 22"/><rect x="7" y="44" width="9" height="9" rx="2"/><rect x="48" y="44" width="9" height="9" rx="2"/><path d="M52 44v-6"/>',
 earbuds:'<circle cx="21" cy="22" r="9"/><path d="M21 31v21"/><circle cx="43" cy="22" r="9"/><path d="M43 31v21"/>',
 glass:'<rect x="18" y="6" width="28" height="52" rx="6"/><path d="M26 31l5 5 9-11"/>',
 stand:'<path d="M18 52h28M32 52V38"/><rect x="21" y="8" width="22" height="30" rx="4" transform="rotate(-10 32 23)"/>',
 power:'<rect x="13" y="16" width="38" height="32" rx="6"/><path d="M35 22l-9 12h9l-5 10"/><path d="M51 28v8"/>',
 other:'<path d="M12 22h40l-3 32H15z"/><path d="M23 22v-4a9 9 0 0 1 18 0v4"/>'
};
var ICON_NAMES={case:'جراب',charger:'شاحن',cable:'كابل',earbuds:'سماعات',glass:'حماية',stand:'حامل',power:'باور بانك',other:'أخرى'};
var ico=function(n,cls){return '<svg class="'+(cls||'ic')+'" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||IC.other)+'</svg>'};
var UI={
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
 cart:'<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
 close:'<path d="M6 6l12 12M18 6L6 18"/>',
 wa:'<path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 18.7z"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'
};
var ui=function(n){return '<svg class="ui" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+UI[n]+'</svg>'};

function toast(m){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true},3200)}
function getP(o,p){return p.split('.').reduce(function(a,k){return a==null?a:a[k]},o)}
function setP(o,p,v){var k=p.split('.'),l=k.pop(),t=k.reduce(function(a,x){return a[x]},o);t[l]=v}
function markDirty(){dirty=true;saveDraft();var s=$('#dirtyTag');if(s)s.textContent='تغييرات غير منشورة'}
function catOf(c,id){return c.categories.filter(function(x){return x.id===id})[0]}

/* shop */
function productCard(p){
  var c=cur(),cat=catOf(c,p.cat);
  var media=p.img?'<img src="'+esc(p.img)+'" alt="'+esc(p.name)+'" loading="lazy">':ico(cat?cat.icon:'other','pico');
  var badge=!p.stock?'<span class="bd out">نفد</span>':(p.badge?'<span class="bd">'+esc(p.badge)+'</span>':'');
  var off=Number(p.old)>Number(p.price)?'<s>'+money(p.old)+'</s>':'';
  return '<article class="card"><div class="media" data-act="qv" data-id="'+esc(p.id)+'" style="cursor:pointer">'+badge+media+'</div><div class="cbody"><div class="ccat">'+esc(cat?cat.name:'')+'</div><h3 data-act="qv" data-id="'+esc(p.id)+'" style="cursor:pointer">'+esc(p.name)+'</h3>'+
    (p.desc?'<p class="cdesc">'+esc(p.desc)+'</p>':'')+
    '<div class="price"><b>'+money(p.price)+'</b>'+off+'</div><div class="cact">'+
    (p.stock?'<button class="btn cta sm" data-act="add" data-id="'+esc(p.id)+'">أضف للسلة</button>':'<button class="btn sm" disabled>غير متوفر</button>')+
    (admin?'<button class="icon-btn" data-act="edit-p" data-id="'+esc(p.id)+'" aria-label="تعديل المنتج">'+ui('edit')+'</button>':'')+
    '</div></div></article>';
}
function gridHTML(){
  var c=cur();
  var list=c.products.filter(function(p){return (filter==='all'||p.cat===filter)&&(!q||(p.name+' '+(p.desc||'')).indexOf(q)>-1)});
  if(sortBy==='asc')list=list.slice().sort(function(a,b){return a.price-b.price});
  if(sortBy==='desc')list=list.slice().sort(function(a,b){return b.price-a.price});
  return list.length?list.map(productCard).join(''):'<p class="empty">لا توجد منتجات مطابقة.'+(admin?' أضف منتجًا من زر «منتج جديد».':'')+'</p>';
}
function chipsHTML(){
  var c=cur();
  var all='<button class="chip" data-act="filter" data-id="all" aria-pressed="'+(filter==='all')+'">الكل</button>';
  return all+c.categories.map(function(k){return '<button class="chip" data-act="filter" data-id="'+esc(k.id)+'" aria-pressed="'+(filter===k.id)+'">'+ico(k.icon)+esc(k.name)+'</button>'}).join('');
}
function waNum(s){return String(s||'').replace(/\D/g,'')}
function contactRow(label,val,copy){
  if(!val)return '';
  return '<div class="crow"><div class="l"><span>'+label+'</span><b>'+esc(val)+'</b></div>'+(copy?'<button class="icon-btn" data-act="copy" data-v="'+esc(val)+'" aria-label="نسخ">'+ui('copy')+'</button>':'')+'</div>';
}
var PAGES=[['home','الرئيسية'],['shop','المنتجات'],['why','لماذا نحن'],['faq','أسئلة شائعة'],['contact','تواصل معنا']];
var page=document.body.getAttribute('data-page')||'home';
function go(id,extra){location.href=pageUrl(id,extra)}
function pHead(title,sub){
  return '<div class="phead"><div class="wrap"><nav class="crumb" aria-label="مسار الصفحة"><a href="'+pageUrl('home')+'" data-act="go" data-id="home">الرئيسية</a><span>/</span><span>'+esc(title)+'</span></nav><h1>'+esc(title)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div></div>';
}
function pageHTML(c,s,wa){
  var h='';
  if(page==='home'){
    var brands=String(s.brands||'').split(/[·,،|]/).map(function(x){return x.trim()}).filter(Boolean);
    var featured=c.products.filter(function(p){return p.stock}).slice(0,8);
    h+='<div class="wrap"><div class="hero"><div><span class="kicker">'+esc(s.tagline)+'</span><h1>'+esc(s.heroTitle)+'</h1><p>'+esc(s.heroText)+'</p><div class="ctas"><button class="btn cta" data-act="go" data-id="shop">تسوّق الآن</button>'+
      (wa?'<a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+wa+'">'+ui('wa')+'<span>تحدث معنا على واتساب</span></a>':'<button class="btn" data-act="go" data-id="contact">تواصل معنا</button>')+
      '</div><ul class="pills">'+c.features.slice(0,3).map(function(f){return '<li>'+ui('check')+esc(f.t)+'</li>'}).join('')+'</ul></div><div class="art"><div class="plate"><img src="'+LOGO_FULL+'" alt="شعار '+esc(s.name)+'"></div></div></div></div>';
    if(brands.length)h+='<div class="brands"><div class="wrap"><span>نوفّر إكسسوارات لأجهزة</span><ul>'+brands.map(function(b){return '<li>'+esc(b)+'</li>'}).join('')+'</ul></div></div>';
    h+='<section><div class="wrap"><div class="sh"><h2>تسوّق حسب القسم</h2></div><div class="chips wrapchips">'+c.categories.map(function(k){return '<button class="chip" data-act="shop-cat" data-id="'+esc(k.id)+'">'+ico(k.icon)+esc(k.name)+'</button>'}).join('')+'</div></div></section>';
    h+='<section><div class="wrap"><div class="sh"><h2>منتجات مختارة</h2><button class="btn sm" data-act="go" data-id="shop">عرض كل المنتجات</button></div><div class="grid">'+(featured.map(productCard).join('')||'<p class="empty">لا توجد منتجات بعد.</p>')+'</div></div></section>';
    h+='<section><div class="wrap"><div class="sh"><h2>لماذا '+esc(s.name)+'؟</h2></div><div class="why">'+c.features.map(function(f){return '<div><h3>'+esc(f.t)+'</h3><p>'+esc(f.d)+'</p></div>'}).join('')+'</div></div></section>';
    h+='<section><div class="wrap"><div class="band"><div><h2>جاهز لطلبك؟</h2><p>اختر منتجاتك وأرسل الطلب لنا على واتساب، والدفع عند الاستلام.</p></div><div class="ctas"><button class="btn cta" data-act="go" data-id="shop">ابدأ التسوق</button><button class="btn" data-act="go" data-id="contact">تواصل معنا</button></div></div></div></section>';
  }else if(page==='shop'){
    h+=pHead('المنتجات','تصفّح كل إكسسوارات الهاتف حسب القسم أو ابحث عن منتج محدد.');
    h+='<section><div class="wrap"><div class="sh"><h2 class="sr">قائمة المنتجات</h2><div class="tools"><label class="search">'+ui('search')+'<input id="search" type="search" placeholder="ابحث عن منتج" value="'+esc(q)+'" autocomplete="off"></label><select id="sort" aria-label="ترتيب المنتجات"><option value="def"'+(sortBy==='def'?' selected':'')+'>الترتيب الافتراضي</option><option value="asc"'+(sortBy==='asc'?' selected':'')+'>الأقل سعرًا</option><option value="desc"'+(sortBy==='desc'?' selected':'')+'>الأعلى سعرًا</option></select></div></div>'+
      '<div class="chips" id="chips">'+chipsHTML()+'</div><div class="grid" id="grid">'+gridHTML()+'</div></div></section>';
  }else if(page==='why'){
    h+=pHead('لماذا '+s.name+'؟','نهتم بجودة المنتج وسهولة الطلب ووضوح السياسات.');
    h+='<section><div class="wrap"><div class="why">'+c.features.map(function(f){return '<div><h3>'+esc(f.t)+'</h3><p>'+esc(f.d)+'</p></div>'}).join('')+'</div></div></section>';
    h+='<section><div class="wrap"><div class="sh"><h2>كيف تطلب؟</h2></div><ol class="steps"><li><b>اختر منتجاتك</b><span>أضف ما يعجبك إلى السلة.</span></li><li><b>أكّد طلبك</b><span>اكتب بياناتك واضغط تأكيد الطلب، فيصلنا طلبك مباشرة.</span></li><li><b>استلم وادفع</b><span>نتصل بك لتأكيد الطلب ونوصّله، وتدفع عند الاستلام.</span></li></ol></div></section>';
  }else if(page==='faq'){
    h+=pHead('أسئلة شائعة','إجابات سريعة عن الطلب والدفع والتوصيل.');
    h+='<section><div class="wrap">'+((c.faq||[]).length?'<div class="faq">'+c.faq.map(function(f){return '<details><summary>'+esc(f.q)+'</summary><p>'+esc(f.a)+'</p></details>'}).join('')+'</div>':'<p class="empty">لا توجد أسئلة بعد.</p>')+'</div></section>';
  }else{
    var hasContact=s.whatsapp||s.phone||s.email||s.address||s.hours;
    h+=pHead('تواصل معنا','يسعدنا الرد على استفساراتك ومساعدتك في اختيار المنتج المناسب.');
    h+='<section><div class="wrap"><div class="contact"><div class="cbox">'+
      (hasContact?contactRow('واتساب',s.whatsapp?'+'+wa:'',true)+contactRow('الهاتف',s.phone,true)+contactRow('البريد الإلكتروني',s.email,true)+contactRow('العنوان',s.address,false)+contactRow('مواعيد العمل',s.hours,false):'<p class="empty">بيانات التواصل لم تُضبط بعد.</p>')+
      '</div><div class="cbox"><h3 style="font-size:20px;margin-bottom:6px">اطلب بسهولة</h3><p style="color:var(--muted)">أضف المنتجات إلى السلة، اكتب بياناتك، وأكّد الطلب. نتصل بك لتأكيده ونرتب التوصيل، والدفع عند الاستلام.</p>'+
      (wa?'<a class="btn cta" style="margin-top:16px" target="_blank" rel="noopener" href="https://wa.me/'+wa+'">'+ui('wa')+'<span>راسلنا على واتساب</span></a>':'')+'</div></div></div></section>';
  }
  return h;
}
function render(){
  var c=cur(),s=c.settings;
  var count=Object.keys(cart).reduce(function(a,k){return a+(cart[k]||0)},0);
  var parts=String(s.name||'').trim().split(/\s+/);
  var first=parts[0]||'',rest=parts.slice(1).join(' ');
  var wa=waNum(s.whatsapp);
  var links=PAGES.map(function(p){return '<a href="'+pageUrl(p[0])+'" data-act="go" data-id="'+p[0]+'"'+(page===p[0]?' aria-current="page"':'')+'>'+p[1]+'</a>'}).join('');
  var h='';
  if(s.announce)h+='<div class="ann"><div class="wrap">'+esc(s.announce)+'</div></div>';
  h+='<header class="top"><div class="wrap bar"><a class="brand" href="'+pageUrl('home')+'" data-act="go" data-id="home"><img src="'+LOGO_ICON+'" alt="" width="44" height="44"><span class="bname"><b>'+esc(first)+'</b>'+(rest?'<small>'+esc(rest)+'</small>':'')+'</span></a>'+
    '<nav class="nav" aria-label="القائمة الرئيسية">'+links+'</nav>'+
    '<div class="hact">'+((canEdit&&artifactApi&&!admin)?'<button class="btn sm" data-act="admin-enter">'+ui('edit')+'<span>تعديل الموقع</span></button>':'')+
    '<button class="icon-btn" data-act="cart-open" aria-label="سلة المشتريات">'+ui('cart')+(count?'<span class="cnt">'+nf.format(count)+'</span>':'')+'</button>'+
    '<button class="icon-btn menu-btn" data-act="menu" aria-label="القائمة" aria-expanded="false">'+ui('menu')+'</button></div></div>'+
    '<nav class="mnav" aria-label="القائمة">'+links+'</nav></header>';
  h+='<main>'+pageHTML(c,s,wa)+'</main>';
  var soc=[['facebook','فيسبوك'],['instagram','إنستغرام'],['tiktok','تيك توك']].filter(function(x){return /^https?:\/\//i.test(s[x[0]]||'')}).map(function(x){return '<a href="'+esc(s[x[0]])+'" target="_blank" rel="noopener">'+x[1]+'</a>'}).join('');
  h+='<footer><div class="wrap fgrid"><div class="fcol"><div class="fl"><img src="'+LOGO_FULL+'" alt="" width="92"><div><b>'+esc(s.name)+'</b><br><small>'+esc(s.tagline)+'</small></div></div></div><div class="fcol"><h4>روابط سريعة</h4>'+links.replace(/ aria-current="page"/g,'')+'</div><div class="fcol"><h4>تابعنا</h4>'+(soc||'<small>لم تُضف حسابات بعد</small>')+'</div></div><div class="wrap fcopy"><small>© '+new Date().getFullYear()+' '+esc(s.name)+'. جميع الحقوق محفوظة.</small></div></footer>';
  if(wa)h+='<a class="fab" target="_blank" rel="noopener" href="https://wa.me/'+wa+'" aria-label="تحدث معنا على واتساب">'+ui('wa')+'<span>واتساب</span></a>';
  if(admin)h+='<div class="abar"><div class="in"><span class="st">وضع التعديل · <span id="dirtyTag">'+(dirty?'تغييرات غير منشورة':'لا تغييرات')+'</span></span><button class="btn" data-act="new-p">'+ui('plus')+'<span>منتج جديد</span></button><a class="btn" href="admin.html">الطلبات</a><button class="btn" data-act="admin-open">إعدادات الموقع</button><button class="btn" data-act="admin-exit">خروج</button><button class="btn cta" data-act="download-data">تنزيل data.js</button><button class="btn cta" data-act="publish">حفظ ونشر</button></div></div>';
  var app=$('#app');
  app.className=admin?'pad-abar':'';
  app.innerHTML=h;
}

/* cart */
function cartItems(){
  var c=cur();
  return Object.keys(cart).map(function(id){return {p:c.products.filter(function(x){return x.id===id})[0],n:cart[id]}}).filter(function(x){return x.p&&x.p.stock&&x.n>0});
}
function waLink(){
  var items=cartItems(),s=cur().settings;
  var total=items.reduce(function(a,x){return a+x.p.price*x.n},0);
  var lines=['طلب جديد من '+s.name,'','الاسم: '+cust.name,'الهاتف: '+cust.phone,'العنوان: '+cust.addr];
  if(cust.note)lines.push('ملاحظات: '+cust.note);
  lines.push('','المنتجات:');
  items.forEach(function(x){lines.push('- '+x.p.name+' × '+x.n+' = '+money(x.p.price*x.n))});
  lines.push('','الإجمالي: '+money(total),'الدفع: عند الاستلام');
  return 'https://wa.me/'+waNum(s.whatsapp)+'?text='+encodeURIComponent(lines.join('\n'));
}
/* ===== حفظ الطلب في قاعدة بيانات Firestore (عبر REST) ===== */
function fbCfg(){var st=S.settings||{};var k=String(st.firebaseApiKey||'').trim(),pid=String(st.firebaseProjectId||'').trim();return k&&pid?{key:k,pid:pid}:null}
function latinDigits(str){return String(str||'').replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}).replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)})}
function fsVal(v){
  if(typeof v==='string')return {stringValue:v};
  if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v))return {arrayValue:{values:v.map(fsVal)}};
  if(v&&v.__ts)return {timestampValue:v.__ts};
  if(v&&typeof v==='object'){var f={};Object.keys(v).forEach(function(k){f[k]=fsVal(v[k])});return {mapValue:{fields:f}}}
  return {nullValue:null};
}
var doneNo='',ordering=false;
function placeOrder(){
  if(ordering)return;
  var f=fbCfg(),items=cartItems();
  if(!f){toast('استقبال الطلبات غير مفعّل بعد.');return}
  if(!items.length){toast('السلة فارغة');return}
  if(cust.hp)return;
  var name=cust.name.trim(),phone=latinDigits(cust.phone).replace(/[^\d+]/g,''),addr=cust.addr.trim(),note=cust.note.trim();
  var dg=phone.replace(/\D/g,'');
  if(name.length<2){toast('اكتب اسمك');return}
  if(dg.length<8||dg.length>15){toast('اكتب رقم هاتف صحيح');return}
  if(addr.length<5){toast('اكتب العنوان بالتفصيل');return}
  try{if(Date.now()-Number(localStorage.getItem('ls-last-order')||0)<30000){toast('تم إرسال طلب قبل لحظات. انتظر قليلًا.');return}}catch(e){}
  var d=new Date(),no='LS-'+String(d.getFullYear()).slice(2)+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)+'-'+Math.floor(1000+Math.random()*9000);
  var total=items.reduce(function(a,x){return a+x.p.price*x.n},0);
  var order={orderNo:no,createdAt:{__ts:d.toISOString()},name:name,phone:phone,address:addr,items:items.map(function(x){return {id:String(x.p.id),name:String(x.p.name),price:Number(x.p.price),qty:x.n}}),total:total,status:'new'};
  if(note)order.note=note;
  var fields={};Object.keys(order).forEach(function(k){fields[k]=fsVal(order[k])});
  ordering=true;renderLayer();
  fetch('https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(f.pid)+'/databases/(default)/documents/orders?documentId='+encodeURIComponent(no)+'&key='+encodeURIComponent(f.key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:fields})}).then(function(r){
    if(!r.ok)throw new Error('http '+r.status);
    cart={};saveCart();try{localStorage.setItem('ls-last-order',String(Date.now()))}catch(e){}
    cust.note='';doneNo=no;ordering=false;layer='done';renderLayer();render();
  }).catch(function(e){ordering=false;renderLayer();toast('تعذّر إرسال الطلب. حاول مرة أخرى بعد قليل.');try{console.warn(e)}catch(x){}});
}
function doneHTML(){
  return '<div class="sheet"><div class="scrim" data-act="close-layer"></div><div class="panel done" role="dialog" aria-modal="true" aria-label="تم استلام الطلب"><div class="doneb"><div class="doneic">'+ui('check')+'</div><h2>تم استلام طلبك</h2><p>رقم الطلب</p><b class="dno">'+esc(doneNo)+'</b><p>سنتصل بك على رقم الهاتف الذي كتبته لتأكيد الطلب. الدفع عند الاستلام.</p><button class="btn cta" data-act="close-layer">متابعة التسوق</button></div></div></div>';
}
function cartHTML(){
  var items=cartItems(),s=cur().settings;
  var total=items.reduce(function(a,x){return a+x.p.price*x.n},0);
  var c=cur();
  var rows=items.map(function(x){
    var cat=catOf(c,x.p.cat);
    return '<div class="item"><div class="th">'+(x.p.img?'<img src="'+esc(x.p.img)+'" alt="">':ico(cat?cat.icon:'other'))+'</div><div><h4>'+esc(x.p.name)+'</h4><small>'+money(x.p.price)+'</small><div class="qty"><button data-act="dec" data-id="'+esc(x.p.id)+'" aria-label="إنقاص">−</button><span>'+nf.format(x.n)+'</span><button data-act="inc" data-id="'+esc(x.p.id)+'" aria-label="زيادة">+</button></div></div><button class="rm" data-act="rm" data-id="'+esc(x.p.id)+'" aria-label="حذف من السلة">'+ui('trash')+'</button></div>';
  }).join('');
  var form='<div class="co"><div class="fld"><label for="c-name">الاسم</label><input id="c-name" data-cust="name" value="'+esc(cust.name)+'" autocomplete="name"></div>'+
    '<div class="fld"><label for="c-phone">رقم الهاتف</label><input id="c-phone" data-cust="phone" type="tel" inputmode="tel" value="'+esc(cust.phone)+'" autocomplete="tel"></div>'+
    '<div class="fld"><label for="c-addr">العنوان بالتفصيل</label><textarea id="c-addr" data-cust="addr">'+esc(cust.addr)+'</textarea></div>'+
    '<div class="fld"><label for="c-note">ملاحظات (اختياري)</label><input id="c-note" data-cust="note" value="'+esc(cust.note)+'"></div>'+
    '<div class="hp" aria-hidden="true"><label for="c-hp">اترك هذا الحقل فارغًا</label><input id="c-hp" data-cust="hp" tabindex="-1" autocomplete="off"></div></div>';
  var send=fbCfg()?'<button class="btn cta block" data-act="place-order"'+(ordering?' disabled':'')+'>'+(ordering?'جارٍ إرسال الطلب...':'تأكيد الطلب')+'</button>':(waNum(s.whatsapp)?'<a id="wa" class="btn cta block" target="_blank" rel="noopener" href="'+esc(waLink())+'">'+ui('wa')+'<span>إرسال الطلب عبر واتساب</span></a>':'<button class="btn block" disabled>استقبال الطلبات غير مفعّل بعد</button>');
  return '<div class="scrim" data-act="close-layer"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="سلة المشتريات"><div class="dhead"><h2>سلة المشتريات</h2><button class="icon-btn" data-act="close-layer" aria-label="إغلاق">'+ui('close')+'</button></div><div class="dbody">'+
    (items.length?rows+form:'<p class="empty">السلة فارغة. أضف منتجات من المتجر.</p>')+'</div>'+
    (items.length?'<div class="dfoot"><div class="tot"><span>الإجمالي</span><b>'+money(total)+'</b></div>'+send+'<p class="note">الدفع عند الاستلام. سنتصل بك لتأكيد الطلب.</p></div>':'')+'</aside>';
}

/* admin */
function field(label,bind,val,type,ph,hint){
  var id='f-'+bind.replace(/\./g,'-');
  var input=type==='area'?'<textarea id="'+id+'" data-bind="'+bind+'" placeholder="'+esc(ph||'')+'">'+esc(val)+'</textarea>':'<input id="'+id+'" data-bind="'+bind+'" value="'+esc(val)+'" placeholder="'+esc(ph||'')+'"'+(type==='tel'?' inputmode="numeric" dir="ltr"':'')+'>';
  return '<div class="fld"><label for="'+id+'">'+label+'</label>'+input+(hint?'<span class="hint">'+hint+'</span>':'')+'</div>';
}
function adminHTML(){
  var c=D,s=c.settings,body='';
  if(tab==='products'){
    body='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>'+nf.format(c.products.length)+' منتج</b><button class="btn cta sm" data-act="new-p">'+ui('plus')+'<span>منتج جديد</span></button></div>'+
    c.products.map(function(p){
      var cat=catOf(c,p.cat);
      var del=confirmDel===p.id?'<button class="btn sm" style="color:var(--bad);border-color:var(--bad)" data-act="del-p" data-id="'+esc(p.id)+'">تأكيد الحذف</button>':'<button class="icon-btn" data-act="del-p" data-id="'+esc(p.id)+'" aria-label="حذف المنتج">'+ui('trash')+'</button>';
      return '<div class="prow"><div class="th">'+(p.img?'<img src="'+esc(p.img)+'" alt="">':ico(cat?cat.icon:'other'))+'</div><div><b>'+esc(p.name)+(p.stock?'':'<span class="tag bad">نفد</span>')+'</b><small>'+money(p.price)+' · '+esc(cat?cat.name:'')+'</small></div><div class="acts"><button class="icon-btn" data-act="edit-p" data-id="'+esc(p.id)+'" aria-label="تعديل المنتج">'+ui('edit')+'</button>'+del+'</div></div>';
    }).join('')||'<p class="empty">لا توجد منتجات بعد.</p>';
  }else if(tab==='settings'){
    body=((!s.firebaseApiKey||!s.firebaseProjectId)?'<div class="warn">لم تُربط قاعدة الطلبات بعد. أدخل بيانات Firebase في آخر هذه الصفحة ليصلك الطلب في صفحة الطلبات.</div>':'')+
      '<div class="row2">'+field('اسم المتجر','settings.name',s.name)+field('وصف قصير','settings.tagline',s.tagline)+'</div>'+
      field('شريط الإعلان العلوي','settings.announce',s.announce,'','اتركه فارغًا لإخفائه')+
      field('عنوان الصفحة الرئيسية','settings.heroTitle',s.heroTitle)+
      field('نص الصفحة الرئيسية','settings.heroText',s.heroText,'area')+
      '<div class="row2">'+field('رقم واتساب','settings.whatsapp',s.whatsapp,'tel','201001234567','بالصيغة الدولية بدون + أو مسافات')+field('رقم الهاتف','settings.phone',s.phone,'tel')+'</div>'+
      '<div class="row2">'+field('البريد الإلكتروني','settings.email',s.email)+field('مواعيد العمل','settings.hours',s.hours)+'</div>'+
      field('العنوان','settings.address',s.address)+
      field('الأجهزة المدعومة (افصل بينها بـ ·)','settings.brands',s.brands)+
      '<div class="row2">'+field('رابط فيسبوك','settings.facebook',s.facebook,'','https://')+field('رابط إنستغرام','settings.instagram',s.instagram,'','https://')+'</div>'+
      field('رابط تيك توك','settings.tiktok',s.tiktok,'','https://')+
      '<b>قاعدة بيانات الطلبات (Firebase)</b>'+
      '<div class="row2">'+field('Project ID','settings.firebaseProjectId',s.firebaseProjectId,'','my-store-12345','من إعدادات مشروع Firebase')+field('Web API Key','settings.firebaseApiKey',s.firebaseApiKey,'','AIza...','مفتاح تطبيق الويب، وهو ليس سرًا')+'</div>'+
      '<b>مميزات المتجر</b>'+c.features.map(function(f,i){return '<div class="row2">'+field('العنوان','features.'+i+'.t',f.t)+field('الوصف','features.'+i+'.d',f.d)+'</div>'}).join('')+
      '<b>أسئلة شائعة</b>'+(c.faq||[]).map(function(f,i){return '<div class="row2">'+field('السؤال','faq.'+i+'.q',f.q)+field('الجواب','faq.'+i+'.a',f.a,'area')+'</div>'}).join('');
  }else if(tab==='publish'){
    body=ghHTML();
  }else{
    body='<div style="display:flex;justify-content:space-between;align-items:center"><b>التصنيفات</b><button class="btn cta sm" data-act="add-cat">'+ui('plus')+'<span>تصنيف جديد</span></button></div>'+
    c.categories.map(function(k,i){
      var opts=Object.keys(ICON_NAMES).map(function(n){return '<option value="'+n+'"'+(k.icon===n?' selected':'')+'>'+ICON_NAMES[n]+'</option>'}).join('');
      return '<div class="crow2"><div class="fld"><label for="cat-n-'+i+'">الاسم</label><input id="cat-n-'+i+'" data-bind="categories.'+i+'.name" value="'+esc(k.name)+'"></div><div class="fld"><label for="cat-i-'+i+'">الأيقونة</label><select id="cat-i-'+i+'" data-bind="categories.'+i+'.icon">'+opts+'</select></div><button class="icon-btn" data-act="del-cat" data-id="'+i+'" aria-label="حذف التصنيف">'+ui('trash')+'</button></div>';
    }).join('');
  }
  var tabs=[['products','المنتجات'],['settings','إعدادات الموقع'],['cats','التصنيفات']].concat(ghMode?[['publish','النشر التلقائي']]:[]).map(function(t){return '<button class="tab" role="tab" data-act="tab" data-id="'+t[0]+'" aria-selected="'+(tab===t[0])+'">'+t[1]+'</button>'}).join('');
  return '<div class="sheet"><div class="scrim" data-act="close-layer"></div><div class="panel" role="dialog" aria-modal="true" aria-label="لوحة التحكم"><div class="dhead"><h2>لوحة التحكم</h2><button class="icon-btn" data-act="close-layer" aria-label="إغلاق">'+ui('close')+'</button></div><div class="tabs" role="tablist">'+tabs+'</div><div class="pbody">'+body+'</div><div class="pfoot"><button class="btn" data-act="close-layer">إغلاق</button><button class="btn cta" data-act="publish">حفظ ونشر</button></div></div></div>';
}
function formHTML(){
  var p=editing,c=D;
  var opts=c.categories.map(function(k){return '<option value="'+esc(k.id)+'"'+(p.cat===k.id?' selected':'')+'>'+esc(k.name)+'</option>'}).join('');
  var up=assetsApi?'<label class="btn sm" for="pimg" style="cursor:pointer">رفع صورة</label><input id="pimg" type="file" accept="image/*" hidden>'+(p.img?'<button class="btn sm" data-act="rm-img">إزالة الصورة</button>':''):'<span class="hint" style="color:var(--muted);font-size:12px">رفع الصور غير متاح لهذا الحساب</span>';
  return '<div class="sheet"><div class="scrim" data-act="cancel-p"></div><div class="panel" role="dialog" aria-modal="true" aria-label="بيانات المنتج"><div class="dhead"><h2>'+(p.isNew?'منتج جديد':'تعديل المنتج')+'</h2><button class="icon-btn" data-act="cancel-p" aria-label="إغلاق">'+ui('close')+'</button></div><div class="pbody">'+
    '<div class="fld"><label for="p-name">اسم المنتج</label><input id="p-name" value="'+esc(p.name)+'"></div>'+
    '<div class="row2"><div class="fld"><label for="p-cat">التصنيف</label><select id="p-cat">'+opts+'</select></div><div class="fld"><label for="p-badge">شارة (مثل: جديد، خصم)</label><input id="p-badge" value="'+esc(p.badge)+'"></div></div>'+
    '<div class="row2"><div class="fld"><label for="p-price">السعر (ج.م)</label><input id="p-price" type="number" min="0" inputmode="decimal" value="'+esc(p.price)+'"></div><div class="fld"><label for="p-old">السعر قبل الخصم (اختياري)</label><input id="p-old" type="number" min="0" inputmode="decimal" value="'+esc(p.old||'')+'"></div></div>'+
    '<div class="fld"><label for="p-desc">الوصف</label><textarea id="p-desc">'+esc(p.desc)+'</textarea></div>'+
    '<div class="imgpick"><div class="th">'+(p.img?'<img src="'+esc(p.img)+'" alt="">':'بدون صورة')+'</div>'+up+'</div>'+
    '<label class="chk" for="p-stock"><input id="p-stock" type="checkbox"'+(p.stock?' checked':'')+'>متوفر في المخزون</label></div>'+
    '<div class="pfoot"><button class="btn" data-act="cancel-p">إلغاء</button><button class="btn cta" data-act="save-p">حفظ المنتج</button></div></div></div>';
}
function readForm(){
  return {name:$('#p-name').value.trim(),cat:$('#p-cat').value,badge:$('#p-badge').value.trim(),price:$('#p-price').value,old:$('#p-old').value,desc:$('#p-desc').value.trim(),stock:$('#p-stock').checked};
}
function qvHTML(){
  var c=cur(),p=c.products.filter(function(x){return x.id===qvId})[0];
  if(!p)return '';
  var cat=catOf(c,p.cat),off=Number(p.old)>Number(p.price)?'<s>'+money(p.old)+'</s>':'';
  return '<div class="sheet"><div class="scrim" data-act="close-layer"></div><div class="panel qv" role="dialog" aria-modal="true" aria-label="'+esc(p.name)+'"><button class="icon-btn qvx" data-act="close-layer" aria-label="إغلاق">'+ui('close')+'</button><div class="qvm media">'+(p.img?'<img src="'+esc(p.img)+'" alt="'+esc(p.name)+'">':ico(cat?cat.icon:'other','pico'))+'</div><div class="qvb"><div class="ccat">'+esc(cat?cat.name:'')+'</div><h2>'+esc(p.name)+'</h2>'+(p.desc?'<p class="qvd">'+esc(p.desc)+'</p>':'')+'<div class="price"><b>'+money(p.price)+'</b>'+off+'</div>'+(p.stock?'<button class="btn cta block" data-act="qv-add" data-id="'+esc(p.id)+'">أضف للسلة</button>':'<button class="btn block" disabled>غير متوفر حاليًا</button>')+'<p class="note">الدفع عند الاستلام</p></div></div></div>';
}
function ghField(label,key,val){var id='gh-'+key;return '<div class="fld"><label for="'+id+'">'+label+'</label><input id="'+id+'" data-gh="'+key+'" dir="ltr" value="'+esc(val)+'"></div>'}
function ghHTML(){
  var c=ghCfg;
  return '<div class="warn">النشر التلقائي يرفع ملف البيانات مباشرة إلى مستودع GitHub، فيتحدّث الموقع خلال دقائق إذا كانت الاستضافة مربوطة بالمستودع (Netlify أو GitHub Pages أو Cloudflare Pages).</div>'+
    '<div class="row2">'+ghField('اسم المستخدم أو المنظمة','owner',c.owner)+ghField('اسم المستودع','repo',c.repo)+'</div>'+
    '<div class="row2">'+ghField('الفرع','branch',c.branch)+ghField('مسار ملف البيانات','path',c.path)+'</div>'+
    '<div class="fld"><label for="gh-token">رمز الوصول (Token)</label><input id="gh-token" data-gh="token" type="password" dir="ltr" autocomplete="off" value="'+esc(c.token)+'" placeholder="github_pat_..."><span class="hint">يُحفظ في هذا المتصفح فقط. أنشئ رمزًا بصلاحية Contents: Read and write لهذا المستودع وحده، ولا تستخدمه على جهاز مشترك.</span></div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn blue sm" data-act="gh-test">اختبار الاتصال</button><button class="btn sm" data-act="gh-clear">مسح الإعدادات</button></div><p class="hint" id="gh-status" style="color:var(--muted);min-height:1.5em"></p>';
}
function ghReady(){var c=ghCfg;return !!(c.owner&&c.repo&&c.branch&&c.path&&c.token)}
function ghHeaders(){return {'Authorization':'Bearer '+ghCfg.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}}
function ghRepoUrl(){return 'https://api.github.com/repos/'+encodeURIComponent(ghCfg.owner)+'/'+encodeURIComponent(ghCfg.repo)}
function ghFileUrl(){return ghRepoUrl()+'/contents/'+ghCfg.path.split('/').map(encodeURIComponent).join('/')}
function ghErr(e){var c=e&&e.code;return c===401?'الرمز غير صحيح أو منتهي الصلاحية.':c===403?'الرمز لا يملك صلاحية الكتابة على هذا المستودع.':c===404?'لم يُعثر على المستودع أو الفرع. راجع الأسماء.':(c===409||c===422)?'تعذّر الحفظ بسبب تعارض. حاول مرة أخرى.':'تعذّر الاتصال بـ GitHub. تأكد من الإنترنت.'}
function b64(str){var b=new TextEncoder().encode(str),bin='';for(var i=0;i<b.length;i+=32768)bin+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return btoa(bin)}
function ghGet(){return fetch(ghFileUrl()+'?ref='+encodeURIComponent(ghCfg.branch),{headers:ghHeaders()}).then(function(r){if(r.status===404)return null;if(!r.ok)throw {code:r.status};return r.json()})}
function ghPut(content,retry){
  return ghGet().then(function(j){
    var body={message:'تحديث بيانات المتجر من لوحة التحكم',content:b64(content),branch:ghCfg.branch};
    if(j&&j.sha)body.sha=j.sha;
    return fetch(ghFileUrl(),{method:'PUT',headers:Object.assign({'Content-Type':'application/json'},ghHeaders()),body:JSON.stringify(body)}).then(function(r){
      if((r.status===409||r.status===422)&&!retry)return ghPut(content,true);
      if(!r.ok)throw {code:r.status};
      return r.json();
    });
  });
}
function ghTest(){
  var st=$('#gh-status');
  if(!ghReady()){if(st)st.textContent='أكمل كل الحقول أولًا.';return}
  if(st)st.textContent='جارٍ الاختبار...';
  fetch(ghRepoUrl(),{headers:ghHeaders()}).then(function(r){if(!r.ok)throw {code:r.status};return r.json()}).then(function(j){
    var ok=!(j.permissions&&j.permissions.push===false);
    if(st)st.textContent=ok?'تم الاتصال بالمستودع '+j.full_name+'.':'تم الاتصال، لكن الرمز لا يملك صلاحية الكتابة.';
  }).catch(function(e){if(st)st.textContent=ghErr(e)});
}
function dlData(){
  var bl=new Blob([buildDoc(D)],{type:'text/javascript;charset=utf-8'}),an=document.createElement('a');
  an.href=URL.createObjectURL(bl);an.download='data.js';document.body.appendChild(an);an.click();
  setTimeout(function(){URL.revokeObjectURL(an.href);an.remove()},1500);
}
function renderLayer(){
  var el=$('#layer');
  if(!layer){el.innerHTML='';document.body.style.overflow='';return}
  document.body.style.overflow='hidden';
  el.innerHTML=layer==='cart'?cartHTML():(layer==='done'?doneHTML():(layer==='admin'?adminHTML():(layer==='qv'?qvHTML():formHTML())));
}
function setLayer(l){layer=l;renderLayer()}
function closeLayer(){layer=null;editing=null;renderLayer();render()}

/* publish */
function buildDoc(st){
  return '/* بيانات متجر Login Store. يُنشأ هذا الملف تلقائيًا من وضع التعديل (index.html?admin). */\nwindow.STORE_DATA = '+JSON.stringify(st,null,2)+';\n';
}
function publishNow(){
  if(busy)return;
  if(!artifactApi){toast('النشر غير متاح لهذا الحساب');return}
  busy=true;toast('جارٍ النشر...');
  artifactApi.publish(buildDoc(D)).then(function(){busy=false;toast(publishMsg)}).catch(function(e){
    busy=false;
    var code=e&&e.code;
    toast(e&&e.msg?e.msg:code==='conflict'?'تم تعديل الموقع من مكان آخر. سيتم تحديث الصفحة.':(code==='not_writer'||code==='not_granted')?'ليس لديك صلاحية تعديل هذا الموقع.':'تعذّر الحفظ. حاول مرة أخرى.');
  });
}

/* events */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var a=t.dataset.act,id=t.dataset.id,c=cur();
  if(a==='go'){e.preventDefault();go(id);return}
  if(a==='shop-cat'){go('shop','cat='+encodeURIComponent(id));return}
  if(a==='menu'){var mn=document.querySelector('.mnav');var o=mn.classList.toggle('open');t.setAttribute('aria-expanded',o);return}
  if(a==='filter'){filter=id;if($('#chips')){$('#chips').innerHTML=chipsHTML();$('#grid').innerHTML=gridHTML()}return}
  if(a==='add'){cart[id]=(cart[id]||0)+1;saveCart();render();toast('تمت الإضافة إلى السلة');return}
  if(a==='qv'){qvId=id;setLayer('qv');return}
  if(a==='qv-add'){cart[id]=(cart[id]||0)+1;saveCart();layer=null;renderLayer();render();toast('تمت الإضافة إلى السلة');return}
  if(a==='place-order'){placeOrder();return}
  if(a==='cart-open'){setLayer('cart');return}
  if(a==='close-layer'){closeLayer();return}
  if(a==='inc'){cart[id]=(cart[id]||0)+1;saveCart();renderLayer();return}
  if(a==='dec'){cart[id]=Math.max(0,(cart[id]||0)-1);if(!cart[id])delete cart[id];saveCart();renderLayer();return}
  if(a==='rm'){delete cart[id];saveCart();renderLayer();return}
  if(a==='copy'){var v=t.dataset.v;try{navigator.clipboard.writeText(v).then(function(){toast('تم النسخ')},function(){toast('حدّد الرقم وانسخه يدويًا')})}catch(x){toast('حدّد الرقم وانسخه يدويًا')}return}
  if(a==='admin-enter'){D=JSON.parse(JSON.stringify(S));admin=true;dirty=false;saveDraft();render();return}
  if(a==='admin-exit'){admin=false;D=null;dirty=false;clearDraft();layer=null;renderLayer();render();return}
  if(a==='admin-open'){tab='settings';setLayer('admin');return}
  if(a==='tab'){tab=id;confirmDel=null;renderLayer();return}
  if(a==='gh-test'){ghTest();return}
  if(a==='gh-clear'){ghCfg={owner:'',repo:'',branch:'main',path:'assets/js/data.js',token:''};try{localStorage.removeItem('ls-gh')}catch(x){}renderLayer();toast('تم مسح إعدادات النشر');return}
  if(a==='download-data'){if(D)dlData();return}
  if(a==='publish'){publishNow();return}
  if(a==='new-p'){editing={isNew:true,id:'p'+Date.now().toString(36),name:'',cat:D.categories[0]?D.categories[0].id:'other',badge:'',price:'',old:'',desc:'',img:'',stock:true};setLayer('pform');return}
  if(a==='edit-p'){var p=D.products.filter(function(x){return x.id===id})[0];if(!p)return;editing=Object.assign({isNew:false},p);setLayer('pform');return}
  if(a==='cancel-p'){editing=null;layer=null;renderLayer();render();return}
  if(a==='rm-img'){Object.assign(editing,readForm(),{img:''});renderLayer();return}
  if(a==='save-p'){
    var f=readForm();
    if(!f.name){toast('اكتب اسم المنتج');return}
    if(f.price===''||Number(f.price)<0){toast('اكتب سعر المنتج');return}
    var rec={id:editing.id,name:f.name,cat:f.cat,badge:f.badge,price:Number(f.price),old:f.old===''?0:Number(f.old),desc:f.desc,img:editing.img||'',stock:f.stock};
    var i=D.products.map(function(x){return x.id}).indexOf(rec.id);
    if(i>-1)D.products[i]=rec;else D.products.unshift(rec);
    editing=null;layer=null;renderLayer();markDirty();render();toast('تم حفظ المنتج. اضغط «حفظ ونشر» لنشره على الموقع.');return}
  if(a==='del-p'){
    if(confirmDel!==id){confirmDel=id;renderLayer();return}
    D.products=D.products.filter(function(x){return x.id!==id});delete cart[id];saveCart();confirmDel=null;markDirty();renderLayer();return}
  if(a==='add-cat'){D.categories.push({id:'c'+Date.now().toString(36),name:'تصنيف جديد',icon:'other'});markDirty();renderLayer();return}
  if(a==='del-cat'){
    var k=D.categories[Number(id)];if(!k)return;
    if(D.products.some(function(x){return x.cat===k.id})){toast('انقل منتجات هذا التصنيف أولًا');return}
    D.categories.splice(Number(id),1);if(filter===k.id)filter='all';markDirty();renderLayer();return}
});
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.dataset&&t.dataset.gh){ghCfg[t.dataset.gh]=t.value.trim();try{localStorage.setItem('ls-gh',JSON.stringify(ghCfg))}catch(x){}return}
  if(t.id==='search'){q=t.value.trim();if($('#grid'))$('#grid').innerHTML=gridHTML();return}
  if(t.dataset&&t.dataset.cust){cust[t.dataset.cust]=t.value;var w=$('#wa');if(w)w.setAttribute('href',waLink());return}
  if(t.dataset&&t.dataset.bind&&D){setP(D,t.dataset.bind,t.value);markDirty()}
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='sort'){sortBy=t.value;if($('#grid'))$('#grid').innerHTML=gridHTML();return}
  if(t.id==='pimg'&&assetsApi&&t.files&&t.files[0]){
    var file=t.files[0];toast('جارٍ رفع الصورة...');
    assetsApi.upload(file).then(function(r){Object.assign(editing,readForm(),{img:r.url});renderLayer();toast('تم رفع الصورة')}).catch(function(){toast('تعذّر رفع الصورة')});
    return;
  }
  if(t.dataset&&t.dataset.bind&&D){setP(D,t.dataset.bind,t.value);markDirty()}
});
document.addEventListener('click',function(e){
  var w=e.target.closest('#wa');
  if(w&&(!cust.name.trim()||!cust.phone.trim()||!cust.addr.trim())){e.preventDefault();toast('اكتب الاسم ورقم الهاتف والعنوان أولًا')}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&layer){if(layer==='pform'){editing=null}layer=null;renderLayer();render()}});

/* وضع التعديل: افتح أي صفحة بإضافة ?admin إلى الرابط، مثل index.html?admin */
var DRAFT_KEY='ls-draft';
function saveDraft(){try{if(D)sessionStorage.setItem(DRAFT_KEY,JSON.stringify(D))}catch(e){}}
function clearDraft(){try{sessionStorage.removeItem(DRAFT_KEY)}catch(e){}}
(function(){var m=location.search.match(/[?&]cat=([^&]+)/);if(m){try{filter=decodeURIComponent(m[1])}catch(e){}}})();
if(ADMIN){
  canEdit=true;
  ghMode=true;
  artifactApi={publish:function(html){
    if(!ghReady()){tab='publish';setLayer('admin');return Promise.reject({code:'no_config',msg:'أدخل بيانات النشر التلقائي أولًا (تبويب النشر التلقائي).'})}
    return ghPut(html).then(function(){
      S=JSON.parse(JSON.stringify(D));dirty=false;clearDraft();
      publishMsg='تم النشر. ستظهر التعديلات للزوار خلال دقائق.';
      var d=$('#dirtyTag');if(d)d.textContent='لا تغييرات';
    },function(e){throw {code:e&&e.code,msg:ghErr(e)}});
  }};
  assetsApi={upload:function(file){return new Promise(function(res,rej){
    var r=new FileReader();
    r.onload=function(){var im=new Image();im.onload=function(){
      var k=Math.min(1,640/Math.max(im.width,im.height)),c=document.createElement('canvas');
      c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      res({url:c.toDataURL('image/jpeg',.82)});
    };im.onerror=rej;im.src=r.result};
    r.onerror=rej;r.readAsDataURL(file);
  })}};
  try{var dr=sessionStorage.getItem(DRAFT_KEY);if(dr){D=JSON.parse(dr);admin=true;dirty=true}}catch(e){}
}
render();
})();
