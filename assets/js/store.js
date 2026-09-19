/* ============================================================
   طبقة التخزين — Storage layer
     local    : localStorage (تجربة، لكل جهاز بياناته)
     supabase : قاعدة بيانات مشتركة بين كل الأهالي
   كل المشاركات تظهر مباشرة — لا مراجعة ولا انتظار.
   ============================================================ */

(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var HAS_SB = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);

  var LS_PRINTS = 'nd96.prints';
  var LS_ENTRIES = 'nd96.entries';

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function lsGet(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ---------- Supabase عبر REST (بدون مكتبات) ---------- */

  function sbFetch(path, opts) {
    opts = opts || {};
    var h = { 'apikey': CFG.supabaseAnonKey, 'Authorization': 'Bearer ' + CFG.supabaseAnonKey };
    for (var k in (opts.headers || {})) h[k] = opts.headers[k];
    return fetch(CFG.supabaseUrl + path, { method: opts.method || 'GET', headers: h, body: opts.body })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error('Supabase ' + res.status + ': ' + t.slice(0, 160)); });
        return res.status === 204 ? null : res.json();
      });
  }

  /* ---------- البصمات ---------- */

  function listPrints() {
    if (!HAS_SB) return Promise.resolve(lsGet(LS_PRINTS));
    return sbFetch('/rest/v1/prints?select=id,name,x,y,color,created_at&order=created_at.asc&limit=3000');
  }

  function addPrint(p) {
    var row = { id: uid(), name: p.name, x: p.x, y: p.y, color: p.color, created_at: new Date().toISOString() };
    if (!HAS_SB) {
      var all = lsGet(LS_PRINTS);
      all.push(row);
      lsSet(LS_PRINTS, all);
      return Promise.resolve(row);
    }
    return sbFetch('/rest/v1/prints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ name: row.name, x: row.x, y: row.y, color: row.color })
    }).then(function (r) { return (r && r[0]) || row; });
  }

  /* ---------- الملفات ---------- */

  function uploadMedia(blob, ext) {
    if (!HAS_SB) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(new Error('تعذّرت قراءة الملف')); };
        fr.readAsDataURL(blob);
      });
    }
    var name = uid() + '.' + ext;
    return fetch(CFG.supabaseUrl + '/storage/v1/object/' + CFG.storageBucket + '/' + name, {
      method: 'POST',
      headers: {
        'apikey': CFG.supabaseAnonKey,
        'Authorization': 'Bearer ' + CFG.supabaseAnonKey,
        'Content-Type': blob.type || 'application/octet-stream'
      },
      body: blob
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('Upload ' + res.status + ': ' + t.slice(0, 160)); });
      return CFG.supabaseUrl + '/storage/v1/object/public/' + CFG.storageBucket + '/' + name;
    });
  }

  /* ---------- المشاركات ---------- */

  function listEntries() {
    if (!HAS_SB) {
      return Promise.resolve(lsGet(LS_ENTRIES).slice().sort(function (a, b) {
        return (b.created_at || '').localeCompare(a.created_at || '');
      }));
    }
    return sbFetch('/rest/v1/entries?select=*&order=created_at.desc&limit=500');
  }

  function addEntry(e) {
    var row = {
      id: uid(), kind: e.kind, name: e.name, rel: e.rel,
      text: e.text || null, media_url: e.media_url || null,
      created_at: new Date().toISOString()
    };
    if (!HAS_SB) {
      var all = lsGet(LS_ENTRIES);
      all.push(row);
      if (!lsSet(LS_ENTRIES, all)) {
        return Promise.reject(new Error('امتلأت مساحة المتصفح. فعّل وضع Supabase لمساحة أكبر.'));
      }
      return Promise.resolve(row);
    }
    return sbFetch('/rest/v1/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ kind: row.kind, name: row.name, rel: row.rel, text: row.text, media_url: row.media_url })
    }).then(function (r) { return (r && r[0]) || row; });
  }

  window.Store = {
    listPrints: listPrints,
    addPrint: addPrint,
    listEntries: listEntries,
    addEntry: addEntry,
    uploadMedia: uploadMedia,
    isSharedMode: function () { return HAS_SB; },
    uid: uid
  };
})();
