/* صفحة الطلبات: تسجيل دخول المالك عبر Firebase Auth ثم قراءة الطلبات من Firestore (REST) */
(function(){
'use strict';
var S=(window.STORE_DATA||{}).settings||{};
var KEY=String(S.firebaseApiKey||'').trim(),PID=String(S.firebaseProjectId||'').trim();
var app=document.getElementById('app');
var AK='ls-fb-auth';
var lastEmail='',auth=null,orders=[],filter='all',known=null,timer=null,err='',busy=false;
var ST={new:'جديد',confirmed:'تم التأكيد',shipped:'خرج للتوصيل',delivered:'تم التسليم',cancelled:'ملغي'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function egp(n){return Number(n||0).toLocaleString('ar-EG')+' '+(S.currency||'ج.م')}
function save(){try{localStorage.setItem(AK,JSON.stringify({r:auth.refresh,e:auth.email}))}catch(e){}}
function load(){try{return JSON.parse(localStorage.getItem(AK)||'null')}catch(e){return null}}
function api(u,opt){return fetch(u,opt).then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j}},function(){return {ok:r.ok,status:r.status,j:{}}})})}
function signIn(email,pw){
  return api('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pw,returnSecureToken:true})}).then(function(r){
    if(!r.ok)throw new Error('auth');
    auth={tok:r.j.idToken,refresh:r.j.refreshToken,exp:Date.now()+(Number(r.j.expiresIn)||3600)*1000-60000,email:r.j.email};save();
  });
}
function refresh(){
  if(!auth)return Promise.reject(new Error('noauth'));
  if(Date.now()<auth.exp)return Promise.resolve();
  return api('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(KEY),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(auth.refresh)}).then(function(r){
    if(!r.ok)throw new Error('noauth');
    auth.tok=r.j.id_token;auth.refresh=r.j.refresh_token||auth.refresh;auth.exp=Date.now()+(Number(r.j.expires_in)||3600)*1000-60000;save();
  });
}
var BASE='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(PID)+'/databases/(default)/documents';
function fs(path,opt){
  return refresh().then(function(){
    opt=opt||{};opt.headers=Object.assign({'Authorization':'Bearer '+auth.tok},opt.headers||{});
    return api(BASE+path,opt);
  });
}
function val(v){
  if(!v)return null;
  if('stringValue' in v)return v.stringValue;
  if('integerValue' in v)return Number(v.integerValue);
  if('doubleValue' in v)return v.doubleValue;
  if('timestampValue' in v)return v.timestampValue;
  if('booleanValue' in v)return v.booleanValue;
  if('arrayValue' in v)return (v.arrayValue.values||[]).map(val);
  if('mapValue' in v){var o={},f=v.mapValue.fields||{};Object.keys(f).forEach(function(k){o[k]=val(f[k])});return o}
  return null;
}
function doc(d){var o={},f=d.fields||{};Object.keys(f).forEach(function(k){o[k]=val(f[k])});o._id=String(d.name||'').split('/').pop();return o}
function fetchOrders(){
  return fs(':runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'orders'}],orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:300}})}).then(function(r){
    if(r.status===401||r.status===403)throw new Error('denied');
    if(!r.ok)throw new Error('http');
    return (r.j||[]).filter(function(x){return x.document}).map(function(x){return doc(x.document)});
  });
}
function beep(){try{var c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.value=.15;o.start();setTimeout(function(){o.stop();c.close()},350)}catch(e){}}
function poll(first){
  fetchOrders().then(function(list){
    var ids={};list.forEach(function(o){ids[o._id]=1});
    if(known){
      var fresh=list.filter(function(o){return !known[o._id]&&o.status==='new'});
      if(fresh.length){beep();document.title='('+fresh.length+') طلب جديد | Login Store';
        try{if(window.Notification&&Notification.permission==='granted')new Notification('طلب جديد',{body:fresh[0].name+' - '+egp(fresh[0].total)})}catch(e){}}
    }
    known=ids;orders=list;err='';draw();
  }).catch(function(e){
    if(e&&(e.message==='denied'||e.message==='noauth')){err='هذا الحساب غير مصرّح له بقراءة الطلبات. تأكد أن بريد المالك في قواعد Firestore هو نفس بريد الدخول.';logout(true)}
    else if(first){err='تعذّر تحميل الطلبات. تأكد من الاتصال بالإنترنت ومن Project ID.';draw()}
  });
}
function logout(keepErr){auth=null;known=null;try{localStorage.removeItem(AK)}catch(e){}if(!keepErr)err='';draw()}
function fmt(t){try{return new Date(t).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}catch(e){return ''}}
function waNum(p){var d=String(p||'').replace(/\D/g,'');if(d.indexOf('00')===0)d=d.slice(2);if(d.charAt(0)==='0'&&d.length===11)d='20'+d.slice(1);return d}
function loginHTML(){
  if(!KEY||!PID)return '<div class="lg"><h1>الطلبات</h1><div class="msg">لم تُربط قاعدة الطلبات بعد. افتح المتجر بإضافة <b>?admin</b> للرابط، ثم «إعدادات الموقع»، وأدخل Project ID وWeb API Key، واحفظ وانشر. التفاصيل في ملف FIREBASE-SETUP.txt.</div><a class="btn" href="index.html">العودة للمتجر</a></div>';
  return '<form class="lg" id="lf"><h1>دخول المالك</h1>'+(err?'<div class="msg" role="alert">'+esc(err)+'</div>':'')+'<label for="em">البريد الإلكتروني</label><input id="em" type="email" autocomplete="username" required value="'+esc(lastEmail)+'"><label for="pw">كلمة المرور</label><input id="pw" type="password" autocomplete="current-password" required><button class="btn cta" '+(busy?'disabled':'')+'>'+(busy?'جارٍ الدخول...':'دخول')+'</button><a class="btn" href="index.html">العودة للمتجر</a></form>';
}
function cardHTML(o){
  var items=(o.items||[]).map(function(i){return '<div><span>'+esc(i.name)+' × '+esc(i.qty)+'</span><span>'+egp((i.price||0)*(i.qty||0))+'</span></div>'}).join('');
  var opts=Object.keys(ST).map(function(k){return '<option value="'+k+'"'+(o.status===k?' selected':'')+'>'+ST[k]+'</option>'}).join('');
  var n=waNum(o.phone);
  return '<article class="oc'+(o.status==='new'?' isnew':'')+'" data-id="'+esc(o._id)+'"><div class="ot"><b class="no">'+esc(o.orderNo||o._id)+'</b><span class="st '+esc(o.status)+'">'+esc(ST[o.status]||o.status)+'</span><time>'+esc(fmt(o.createdAt))+'</time></div>'+
  '<div class="cu"><b>'+esc(o.name)+'</b><a href="tel:'+esc(o.phone)+'">'+esc(o.phone)+'</a><span>'+esc(o.address)+'</span>'+(o.note?'<span>ملاحظة: '+esc(o.note)+'</span>':'')+'</div>'+
  '<div class="oi">'+items+'</div><div class="tot"><span>الإجمالي</span><span>'+egp(o.total)+'</span></div>'+
  '<div class="oa"><select data-st aria-label="حالة الطلب">'+opts+'</select><a class="btn" href="tel:'+esc(o.phone)+'">اتصال</a>'+(n?'<a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+n+'">واتساب العميل</a>':'')+'<button class="btn bad" data-del>حذف</button></div></article>';
}
function draw(){
  if(!auth){app.innerHTML=loginHTML();var f=document.getElementById('lf');if(f)f.onsubmit=function(e){e.preventDefault();lastEmail=document.getElementById('em').value.trim();var pw=document.getElementById('pw').value;busy=true;err='';draw();signIn(lastEmail,pw).then(function(){busy=false;poll(true)}).catch(function(){busy=false;err='البريد أو كلمة المرور غير صحيحة.';draw()});};return}
  var list=orders.filter(function(o){return filter==='all'||o.status===filter});
  var nNew=orders.filter(function(o){return o.status==='new'}).length;
  var flt=['all'].concat(Object.keys(ST)).map(function(k){return '<button data-f="'+k+'" aria-pressed="'+(filter===k)+'">'+(k==='all'?'الكل ('+orders.length+')':ST[k]+(k==='new'?' ('+nNew+')':''))+'</button>'}).join('');
  app.innerHTML='<div class="oh"><h1>الطلبات</h1><button class="btn" data-r>تحديث</button><button class="btn" data-n>تفعيل التنبيهات</button><a class="btn" href="index.html">المتجر</a><button class="btn" data-out>خروج</button></div>'+(err?'<div class="msg" role="alert">'+esc(err)+'</div>':'')+'<div class="flt">'+flt+'</div><div class="ol">'+(list.length?list.map(cardHTML).join(''):'<div class="em">لا توجد طلبات هنا بعد.</div>')+'</div>';
}
app.addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.hasAttribute('data-f')){filter=t.getAttribute('data-f');draw();return}
  if(t.hasAttribute('data-r')){document.title='الطلبات | Login Store';poll(true);return}
  if(t.hasAttribute('data-out')){logout();return}
  if(t.hasAttribute('data-n')){try{Notification.requestPermission()}catch(x){}return}
  if(t.hasAttribute('data-del')){
    var c=t.closest('.oc'),id=c.getAttribute('data-id');
    if(!confirm('حذف هذا الطلب نهائيًا؟'))return;
    fs('/orders/'+encodeURIComponent(id),{method:'DELETE'}).then(function(r){if(!r.ok)throw 0;orders=orders.filter(function(o){return o._id!==id});if(known)delete known[id];draw()}).catch(function(){err='تعذّر الحذف.';draw()});
  }
});
app.addEventListener('change',function(e){
  var s=e.target.closest('[data-st]');if(!s)return;
  var id=s.closest('.oc').getAttribute('data-id'),v=s.value;
  fs('/orders/'+encodeURIComponent(id)+'?updateMask.fieldPaths=status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{status:{stringValue:v}}})}).then(function(r){
    if(!r.ok)throw 0;orders.forEach(function(o){if(o._id===id)o.status=v});err='';draw();
  }).catch(function(){err='تعذّر تحديث الحالة.';draw()});
});
var saved=load();
if(KEY&&PID&&saved&&saved.r){auth={tok:'',refresh:saved.r,exp:0,email:saved.e};poll(true)}
draw();
timer=setInterval(function(){if(auth&&!document.hidden)poll(false)},30000);
document.addEventListener('visibilitychange',function(){if(!document.hidden){document.title='الطلبات | Login Store';if(auth)poll(false)}});
})();
