// Store, export, snapshot utilities (no external deps)
// Exposes window.Modules.Store to work with versioned envelopes and local snapshots.
//
// Depends on window.Modules.Schema (see scripts/modules/schema.js)
//
// Envelope shape (v1):
// {
//   version: "1.0.0",
//   exportedAt: "ISO8601",
//   app: { name: "containment-skills-ui" },
//   data: { containmentObjects: [...], skills: [...] }
// }

(function(){
  'use strict';
  if (!window.Modules) window.Modules = {};
  if (window.Modules.Store) return;

  var Schema = window.Modules.Schema;
  var SNAPSHOT_KEY = 'vizDataSnapshot';
  var SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  // -------------------------
  // Utilities
  // -------------------------
  function pad(n){ return n < 10 ? '0'+n : ''+n; }
  function tsLocalCompact(){
    var d = new Date();
    var y = d.getFullYear();
    var m = pad(d.getMonth()+1);
    var day = pad(d.getDate());
    var hh = pad(d.getHours());
    var mm = pad(d.getMinutes());
    var ss = pad(d.getSeconds());
    return '' + y + m + day + '-' + hh + mm + ss;
  }

  function deepClone(obj){
    try { return JSON.parse(JSON.stringify(obj)); } catch(e){ return obj; }
  }

  // -------------------------
  // Envelope builders
  // -------------------------
  /**
   * Build a v1 envelope from pure data object.
   * @param {{containmentObjects:any[], skills:any[]}} data
   * @returns {import('./schema.js').EnvelopeV1|any}
   */
  function buildEnvelope(data){
    var env = {
      version: Schema.CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      app: { name: Schema.APP_NAME },
      data: deepClone(data || { containmentObjects: [], skills: [] })
    };
    return env;
  }

  /**
   * Validate and normalize any input to a v1 envelope.
   * @param {any} input
   * @returns {{ ok: boolean, envelope?: any, errors?: string[] }}
   */
  function validateAndNormalize(input){
    try {
      var r = Schema.toEnvelopeV1(input);
      if (!r.ok) return { ok:false, errors: r.errors || ["未知错误"] };
      return { ok:true, envelope: r.envelope };
    } catch(e){
      return { ok:false, errors: ["异常: " + (e && e.message ? e.message : String(e))] };
    }
  }

  // -------------------------
  // Export helpers
  // -------------------------
  /**
   * Make filename like: base_v1.0.0_YYYYMMDD-HHmmss.json
   * @param {string} base
   * @param {string} version
   * @returns {string}
   */
  function makeFileName(base, version){
    var b = (base || 'containment-skills');
    var v = (version || '1.0.0').replace(/\s+/g, '');
    return b + '_v' + v + '_' + tsLocalCompact() + '.json';
  }

  /**
   * Download envelope as a JSON file.
   * @param {any} envelope
   * @param {{ base?: string, minified?: boolean }} [opts]
   */
  function exportEnvelopeToFile(envelope, opts){
    try {
      var base = (opts && opts.base) || 'containment-skills';
      var minified = !!(opts && opts.minified);
      var json = minified ? JSON.stringify(envelope) : JSON.stringify(envelope, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.download = makeFileName(base, envelope && envelope.version ? envelope.version : Schema.CURRENT_VERSION);
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
      return true;
    } catch(e){
      try { console.error('exportEnvelopeToFile failed:', e); } catch(_){}
      return false;
    }
  }

  // -------------------------
  // Snapshot (undo for clear)
  // -------------------------
  /**
   * Save a snapshot to localStorage (with timestamp).
   * @param {any} envelope
   * @returns {boolean}
   */
  function saveSnapshot(envelope){
    try {
      var payload = { savedAt: Date.now(), envelope: envelope };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
      return true;
    } catch(e){ return false; }
  }

  /**
   * Load snapshot if exists and not expired.
   * @returns {{ ok:boolean, envelope?: any, reason?: string }}
   */
  function loadSnapshot(){
    try {
      var raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return { ok:false, reason: 'no_snapshot' };
      var obj = JSON.parse(raw);
      var savedAt = obj && obj.savedAt ? Number(obj.savedAt) : 0;
      if (!savedAt || (Date.now() - savedAt) > SNAPSHOT_TTL_MS){
        return { ok:false, reason: 'expired' };
      }
      return { ok:true, envelope: obj.envelope };
    } catch(e){
      return { ok:false, reason: 'parse_error' };
    }
  }

  function clearSnapshot(){
    try { localStorage.removeItem(SNAPSHOT_KEY); } catch(e){}
  }

  // -------------------------
  // Public API
  // -------------------------
  window.Modules.Store = {
    SNAPSHOT_KEY: SNAPSHOT_KEY,
    SNAPSHOT_TTL_MS: SNAPSHOT_TTL_MS,
    buildEnvelope: buildEnvelope,
    validateAndNormalize: validateAndNormalize,
    makeFileName: makeFileName,
    exportEnvelopeToFile: exportEnvelopeToFile,
    saveSnapshot: saveSnapshot,
    loadSnapshot: loadSnapshot,
    clearSnapshot: clearSnapshot
  };
})();