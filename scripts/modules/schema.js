// Schema, validation, and migration utilities for versioned data (no external deps)
// Exposes window.Modules.Schema with runtime guards and helpers.
//
// Version envelope (v1):
// {
//   version: "1.0.0",
//   exportedAt: "2025-11-09T09:00:00.000Z",
//   app: { name: "containment-skills-ui" },
//   data: {
//     containmentObjects: ContainmentItem[],
//     skills: Skill[]
//   }
// }
//
// Back-compat: also accepts legacy schema:
// { containmentObjects: [...], skills: [...] } and migrates to the v1 envelope.
//
// Note: This is plain JS with JSDoc typedefs and runtime guards, suitable for static hosting.

/**
 * @typedef {Object} ContainmentItem
 * @property {string} id - unique id
 * @property {string} name - display name
 * @property {("B"|"A"|"S")=} rating - optional; visualization color encoding
 * @property {("捕捉"|"融合")=} acquisition - optional
 * @property {string[]=} skills - list of skill ids
 */

/**
 * @typedef {Object} Skill
 * @property {string} id - unique id
 * @property {string} name - display name
 * @property {("蓝色"|"紫色")=} quality - optional; visualization color encoding
 * @property {number=} cooldown - optional; seconds
 * @property {string=} effect - optional; textual description
 */

/**
 * @typedef {Object} DataV1
 * @property {ContainmentItem[]} containmentObjects
 * @property {Skill[]} skills
 */

/**
 * @typedef {Object} EnvelopeV1
 * @property {"1.0.0"} version
 * @property {string} exportedAt - ISO timestamp
 * @property {{ name: string }} app
 * @property {DataV1} data
 */

(function(){
  'use strict';
  if (!window.Modules) window.Modules = {};
  if (window.Modules.Schema) return;

  /** @type {"1.0.0"} */
  var CURRENT_VERSION = "1.0.0";
  var APP_NAME = "containment-skills-ui";

  // ----------------------------------------
  // Utilities
  // ----------------------------------------
  function isObject(x){ return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function isString(x){ return typeof x === 'string'; }
  function isNonEmptyString(x){ return isString(x) && x.trim().length > 0; }
  function isFiniteNumber(x){ return typeof x === 'number' && Number.isFinite(x); }
  function isStringArray(arr){ return Array.isArray(arr) && arr.every(isString); }

  function deepClone(obj){
    try { return JSON.parse(JSON.stringify(obj)); } catch(e){ return obj; }
  }

  function nowIso(){ return new Date().toISOString(); }

  // Legacy field mappers (one-way from legacy dataset fields to v1 schema)
  function mapLegacyRarityToRating(rarity){
    if (!rarity) return 'B';
    var r = String(rarity).toLowerCase();
    if (r === 'legendary') return 'S';
    if (r === 'epic') return 'A';
    // rare/uncommon/common/default -> B
    return 'B';
  }

  function mapLegacyRarityToQuality(rarity){
    if (!rarity) return '蓝色';
    var r = String(rarity).toLowerCase();
    // group higher tiers as 紫色
    if (r === 'rare' || r === 'epic' || r === 'legendary') return '紫色';
    // common/uncommon/default -> 蓝色
    return '蓝色';
  }

  // ----------------------------------------
  // Element validators with coercion-safe checks
  // ----------------------------------------
  /**
   * @param {any} obj
   * @returns {{ok:boolean, error?:string}}
   */
  function validateContainment(obj){
    if (!isObject(obj)) return { ok:false, error:"containment item 不是对象" };
    if (!isNonEmptyString(obj.id)) return { ok:false, error:"containment.id 缺失或非法" };
    if (!isNonEmptyString(obj.name)) return { ok:false, error:"containment.name 缺失或非法" };
    if (obj.rating != null && ["B","A","S"].indexOf(obj.rating) === -1) return { ok:false, error:"containment.rating 非法（应为 B/A/S）" };
    if (obj.acquisition != null && ["捕捉","融合"].indexOf(obj.acquisition) === -1) return { ok:false, error:"containment.acquisition 非法（应为 捕捉/融合）" };
    if (obj.skills != null && !isStringArray(obj.skills)) return { ok:false, error:"containment.skills 应为字符串数组" };
    return { ok:true };
  }

  /**
   * @param {any} obj
   * @returns {{ok:boolean, error?:string}}
   */
  function validateSkill(obj){
    if (!isObject(obj)) return { ok:false, error:"skill 不是对象" };
    if (!isNonEmptyString(obj.id)) return { ok:false, error:"skill.id 缺失或非法" };
    if (!isNonEmptyString(obj.name)) return { ok:false, error:"skill.name 缺失或非法" };
    if (obj.quality != null && ["蓝色","紫色"].indexOf(obj.quality) === -1) return { ok:false, error:"skill.quality 非法（应为 蓝色/紫色）" };
    if (obj.cooldown != null && !isFiniteNumber(obj.cooldown)) return { ok:false, error:"skill.cooldown 应为有限数值（秒）" };
    if (obj.effect != null && !isString(obj.effect)) return { ok:false, error:"skill.effect 应为字符串" };
    return { ok:true };
  }

  /**
   * @param {any} data - expects DataV1 like object
   * @returns {{ok:boolean, errors?:string[]}}
   */
  function validateDataV1(data){
    var errors = [];
    if (!isObject(data)) return { ok:false, errors:["data 不是对象"] };
    if (!Array.isArray(data.containmentObjects)) errors.push("data.containmentObjects 缺失或不是数组");
    if (!Array.isArray(data.skills)) errors.push("data.skills 缺失或不是数组");
    if (errors.length) return { ok:false, errors: errors };

    // Validate each item; collect first N errors for brevity
    for (var i=0; i<Math.min(data.containmentObjects.length, 1000); i++){
      var r = validateContainment(data.containmentObjects[i]);
      if (!r.ok){ errors.push("containment["+i+"]: "+r.error); if (errors.length > 20) break; }
    }
    for (var j=0; j<Math.min(data.skills.length, 1000); j++){
      var s = validateSkill(data.skills[j]);
      if (!s.ok){ errors.push("skill["+j+"]: "+s.error); if (errors.length > 40) break; }
    }
    return errors.length ? { ok:false, errors: errors } : { ok:true };
  }

  /**
   * @param {any} env
   * @returns {{ok:boolean, errors?:string[]}}
   */
  function validateEnvelopeV1(env){
    var errors = [];
    if (!isObject(env)) return { ok:false, errors:["顶层不是对象"] };
    if (!isNonEmptyString(env.version)) errors.push("version 缺失或非法");
    if (!isNonEmptyString(env.exportedAt)) errors.push("exportedAt 缺失或非法");
    if (!isObject(env.app)) errors.push("app 缺失或非法");
    else if (!isNonEmptyString(env.app.name)) errors.push("app.name 缺失或非法");
    if (!isObject(env.data)) errors.push("data 缺失或非法");
    var r = validateDataV1(env.data || {});
    if (!r.ok) errors = errors.concat(r.errors || []);
    return errors.length ? { ok:false, errors: errors } : { ok:true };
  }

  // ----------------------------------------
  // Migration: legacy -> v1
  // ----------------------------------------
  /**
   * If input is legacy shape ({containmentObjects, skills}) wrap into v1 envelope.
   * If already v1 (has version && data), pass-through (optionally normalize version).
   * @param {any} src
   * @returns {EnvelopeV1}
   */
  function migrateToV1(src){
    // Already v1?
    if (isObject(src) && isNonEmptyString(src.version) && isObject(src.data)){
      // shallow clone to avoid mutation
      var env = deepClone(src);
      // normalize version string to CURRENT_VERSION if semver compatible desired; keep as-is for strict provenance
      return env;
    }

    // Legacy shape
    var legacy = deepClone(src || {});
    var co = Array.isArray(legacy.containmentObjects) ? legacy.containmentObjects : [];
    var sk = Array.isArray(legacy.skills) ? legacy.skills : [];
    return {
      version: CURRENT_VERSION,
      exportedAt: nowIso(),
      app: { name: APP_NAME },
      data: {
        containmentObjects: co,
        skills: sk
      }
    };
  }

  // ----------------------------------------
  // Normalize helpers
  // ----------------------------------------
  /**
   * Remove duplicates by id; trim strings; coerce fields to expected types where safe.
   * @param {DataV1} data
   * @returns {DataV1}
   */
  function normalizeDataV1(data){
    try {
      var coSeen = new Set();
      var skSeen = new Set();
      var co = [];
      var sk = [];

      (data.containmentObjects || []).forEach(function(item){
        if (!item || !isNonEmptyString(item.id)) return;
        if (coSeen.has(item.id)) return;
        coSeen.add(item.id);

        var name = isString(item.name) ? item.name.trim() : "";
        // rating: prefer valid B/A/S, else derive from legacy rarity; default 'B'
        var rating = (item.rating != null && ["B","A","S"].indexOf(item.rating) !== -1)
          ? item.rating
          : mapLegacyRarityToRating(item.rarity);
        // acquisition: prefer valid 捕捉/融合; default '捕捉'
        var acquisition = (item.acquisition != null && ["捕捉","融合"].indexOf(item.acquisition) !== -1)
          ? item.acquisition
          : "捕捉";
        var skills = Array.isArray(item.skills) ? item.skills.filter(isNonEmptyString) : [];

        co.push({
          id: String(item.id),
          name: name,
          rating: rating,
          acquisition: acquisition,
          skills: skills
        });
      });

      (data.skills || []).forEach(function(s){
        if (!s || !isNonEmptyString(s.id)) return;
        if (skSeen.has(s.id)) return;
        skSeen.add(s.id);

        var name = isString(s.name) ? s.name.trim() : "";
        // quality: prefer 蓝色/紫色; else derive from legacy rarity (rare/epic/legendary -> 紫色; else 蓝色)
        var quality = (s.quality != null && (s.quality === "蓝色" || s.quality === "紫色"))
          ? s.quality
          : mapLegacyRarityToQuality(s.rarity);
        // cooldown: numeric; default 0
        var cooldown = (s.cooldown != null && isFiniteNumber(Number(s.cooldown)))
          ? Number(s.cooldown)
          : 0;
        // effect: string; default ''
        var effect = isString(s.effect) ? s.effect.trim() : "";

        sk.push({
          id: String(s.id),
          name: name,
          quality: quality,
          cooldown: cooldown,
          effect: effect
        });
      });

      return { containmentObjects: co, skills: sk };
    } catch(e){
      return { containmentObjects: [], skills: [] };
    }
  }

  /**
   * High-level pipeline: input any -> EnvelopeV1 (validated) with normalized data.
   * @param {any} src
   * @returns {{ ok: boolean, envelope?: EnvelopeV1, errors?: string[] }}
   */
  function toEnvelopeV1(src){
    try {
      var env = migrateToV1(src);
      // Validate envelope fields
      var v = validateEnvelopeV1(env);
      if (!v.ok) return { ok:false, errors: v.errors || ["未知格式错误"] };
      // Normalize data content
      env.data = normalizeDataV1(env.data || { containmentObjects: [], skills: [] });
      // Re-validate content after normalization
      var v2 = validateEnvelopeV1(env);
      if (!v2.ok) return { ok:false, errors: v2.errors || ["数据校验失败"] };
      return { ok:true, envelope: env };
    } catch(e){
      return { ok:false, errors: ["异常: " + (e && e.message ? e.message : String(e))] };
    }
  }

  // ----------------------------------------
  // Export API
  // ----------------------------------------
  window.Modules.Schema = {
    CURRENT_VERSION: CURRENT_VERSION,
    APP_NAME: APP_NAME,
    // validators
    validateContainment: validateContainment,
    validateSkill: validateSkill,
    validateDataV1: validateDataV1,
    validateEnvelopeV1: validateEnvelopeV1,
    // migration and normalize
    migrateToV1: migrateToV1,
    normalizeDataV1: normalizeDataV1,
    toEnvelopeV1: toEnvelopeV1
  };
})();