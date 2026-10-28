/*
 * حسابات العملاء عبر Firebase Authentication (REST) + بيانات العميل وطلباته في Firestore.
 * يُحمَّل قبل app.js ويعرض window.LSAuth.
 */
(function(){
'use strict';
var S=(window.STORE_DATA||{}).settings||{};
var KEY=String(S.firebaseApiKey||'').trim(),PID=String(S.firebaseProjectId||'').trim();
var SK='ls-auth';
var user=null,listeners=[];
var ID='https://identitytoolkit.googleapis.com/v1/';
var DB=PID?'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(PID)+'/databases/(default)/documents':'';

function ready(){return !!(KEY&&PID)}
function load(){try{var j=JSON.parse(localStorage.getItem(SK)||'null');if(j&&j.uid&&j.refresh)user=j}catch(e){user=null}}
function save(){try{if(user)localStorage.setItem(SK,JSON.stringify(user));else localStorage.removeItem(SK)}catch(e){}}
function fire(){listeners.forEach(function(f){try{f(user)}catch(e){}})}
function onChange(f){listeners.push(f)}

var MSG={
  EMAIL_EXISTS:'هذا البريد مسجّل من قبل. سجّل دخولك بدل إنشاء حساب جديد.',
  INVALID_EMAIL:'البريد الإلكتروني غير صحيح.',
  MISSING_EMAIL:'اكتب البريد الإلكتروني.',
  MISSING_PASSWORD:'اكتب كلمة المرور.',
  INVALID_LOGIN_CREDENTIALS:'البريد أو كلمة المرور غير صحيحة.',
  INVALID_PASSWORD:'البريد أو كلمة المرور غير صحيحة.',
  EMAIL_NOT_FOUND:'لا يوجد حساب بهذا البريد.',
  USER_DISABLED:'هذا الحساب موقوف.',
  OPERATION_NOT_ALLOWED:'تسجيل الدخول بالبريد غير مفعّل في Firebase.',
  TOO_MANY_ATTEMPTS_TRY_LATER:'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.'
};
function errMsg(j,status){
  var m=j&&j.error&&j.error.message||'';
  var k=String(m).split(' ')[0].split(':')[0];
  if(/^WEAK_PASSWORD/.test(m))return 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.';
  if(MSG[k])return MSG[k];
  return status===0?'تعذّر الاتصال. تأكد من الإنترنت.':'تعذّر إتمام العملية. حاول مرة أخرى.';
}
function call(url,body){
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){if(!r.ok)throw new Error(errMsg(j,r.status));return j});
  },function(){throw new Error(errMsg(null,0))});
}
function setUser(j,name){
  user={uid:j.localId,email:j.email,name:name||j.displayName||'',idToken:j.idToken,refresh:j.refreshToken,exp:Date.now()+(Number(j.expiresIn)||3600)*1000-60000};
  save();fire();return user;
}
function signUp(email,pw,name){
  if(!ready())return Promise.reject(new Error('تسجيل الدخول غير مفعّل بعد.'));
  name=String(name||'').trim();
  return call(ID+'accounts:signUp?key='+encodeURIComponent(KEY),{email:email,password:pw,returnSecureToken:true}).then(function(j){
    var u=setUser(j,name);
    if(!name)return u;
    return call(ID+'accounts:update?key='+encodeURIComponent(KEY),{idToken:j.idToken,displayName:name,returnSecureToken:false}).then(function(){return u},function(){return u});
  });
}
function signIn(email,pw){
  if(!ready())return Promise.reject(new Error('تسجيل الدخول غير مفعّل بعد.'));
  return call(ID+'accounts:signInWithPassword?key='+encodeURIComponent(KEY),{email:email,password:pw,returnSecureToken:true}).then(function(j){return setUser(j)});
}
function signOut(){user=null;save();fire()}
function resetPassword(email){
  if(!ready())return Promise.reject(new Error('تسجيل الدخول غير مفعّل بعد.'));
  return call(ID+'accounts:sendOobCode?key='+encodeURIComponent(KEY),{requestType:'PASSWORD_RESET',email:email});
}
function token(){
  if(!user)return Promise.reject(new Error('noauth'));
  if(Date.now()<user.exp&&user.idToken)return Promise.resolve(user.idToken);
  return fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(KEY),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(user.refresh)}).then(function(r){
    return r.json().then(function(j){
      if(!r.ok){signOut();throw new Error('انتهت الجلسة. سجّل دخولك مرة أخرى.')}
      user.idToken=j.id_token;user.refresh=j.refresh_token||user.refresh;user.exp=Date.now()+(Number(j.expires_in)||3600)*1000-60000;save();return user.idToken;
    });
  });
}
function api(path,opt){
  return token().then(function(t){
    opt=opt||{};opt.headers=Object.assign({'Authorization':'Bearer '+t},opt.headers||{});
    return fetch(DB+path,opt);
  });
}
function fsStr(v){return {stringValue:String(v==null?'':v)}}
function getProfile(){
  return api('/users/'+encodeURIComponent(user.uid)).then(function(r){
    if(r.status===404)return {};
    if(!r.ok)throw new Error('تعذّر تحميل بياناتك.');
    return r.json().then(function(d){var f=d.fields||{};return {name:(f.name||{}).stringValue||'',phone:(f.phone||{}).stringValue||'',address:(f.address||{}).stringValue||''}});
  });
}
function saveProfile(p){
  var fields={name:fsStr(String(p.name||'').slice(0,100)),phone:fsStr(String(p.phone||'').slice(0,20)),address:fsStr(String(p.address||'').slice(0,400))};
  return api('/users/'+encodeURIComponent(user.uid),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:fields})}).then(function(r){if(!r.ok)throw new Error('تعذّر حفظ بياناتك.')});
}
function val(v){
  if(!v)return null;
  if('stringValue' in v)return v.stringValue;
  if('integerValue' in v)return Number(v.integerValue);
  if('doubleValue' in v)return v.doubleValue;
  if('timestampValue' in v)return v.timestampValue;
  if('arrayValue' in v)return (v.arrayValue.values||[]).map(val);
  if('mapValue' in v){var o={},f=v.mapValue.fields||{};Object.keys(f).forEach(function(k){o[k]=val(f[k])});return o}
  return null;
}
function myOrders(){
  var q={structuredQuery:{from:[{collectionId:'orders'}],where:{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:user.uid}}},limit:50}};
  return api(':runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)}).then(function(r){
    if(!r.ok)throw new Error('تعذّر تحميل طلباتك.');
    return r.json();
  }).then(function(rows){
    var list=rows.filter(function(x){return x.document}).map(function(x){
      var o={},f=x.document.fields||{};Object.keys(f).forEach(function(k){o[k]=val(f[k])});return o;
    });
    list.sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt))});
    return list;
  });
}
load();
window.LSAuth={ready:ready,user:function(){return user},onChange:onChange,signUp:signUp,signIn:signIn,signOut:signOut,resetPassword:resetPassword,token:token,getProfile:getProfile,saveProfile:saveProfile,myOrders:myOrders};
})();
