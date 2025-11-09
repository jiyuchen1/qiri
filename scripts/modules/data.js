// Data module for zero-build static architecture
(function(){
  'use strict';
  if (!window.Modules) window.Modules = {};

  // Utilities
  function deepClone(obj){
    try { return JSON.parse(JSON.stringify(obj)); } catch(e){ return obj; }
  }

  function validateSchema(data){
    var ok = !!(data && Array.isArray(data.containmentObjects) && Array.isArray(data.skills));
    return { ok: ok, error: ok ? null : '数据格式错误：缺少 containmentObjects 或 skills 字段' };
  }

  // Mirror index.html calculateDegreeCounts() behavior but as pure function
  // see [calculateDegreeCounts()](index.html:449)
  function calculateDegreeCounts(data){
    var degreeCounts = {};
    try {
      (data.skills || []).forEach(function(skill){ degreeCounts[skill.id] = 0; });
      (data.containmentObjects || []).forEach(function(containment){
        (containment.skills || []).forEach(function(skillId){
          if (Object.prototype.hasOwnProperty.call(degreeCounts, skillId)){
            degreeCounts[skillId] += 1;
          }
        });
      });
    } catch(e){}
    return degreeCounts;
  }

  // Build Cytoscape elements from data; mirrors [buildGraphData()](index.html:468)
  function buildElements(data, degreeCounts){
    var elements = [];
    try {
      // Containment nodes
      (data.containmentObjects || []).forEach(function(containment){
        elements.push({
          data: {
            id: containment.id,
            label: containment.name,
            type: 'containment',
            rating: containment.rating,
            acquisition: containment.acquisition,
            skills: containment.skills
          },
          position: { x: 0, y: 0 }
        });
      });
      // Skill nodes
      (data.skills || []).forEach(function(skill){
        elements.push({
          data: {
            id: skill.id,
            label: skill.name,
            type: 'skill',
            quality: skill.quality,
            cooldown: skill.cooldown,
            effect: skill.effect,
            degree: degreeCounts[skill.id] || 0
          },
          position: { x: 0, y: 0 }
        });
      });
      // Edges (containment-skill)
      (data.containmentObjects || []).forEach(function(containment){
        (containment.skills || []).forEach(function(skillId){
          var exists = (data.skills || []).some(function(s){ return s.id === skillId; });
          if (exists){
            elements.push({
              data: {
                id: containment.id + '-' + skillId,
                source: containment.id,
                target: skillId,
                weight: 1
              }
            });
          }
        });
      });
    } catch(e){}
    return elements;
  }

  function attachElements(cy, elements){
    if (!cy) return;
    try {
      cy.elements().remove();
      cy.add(elements || []);
    } catch(e){}
  }

  // Export helpers (mirror index export behavior)
  function toJsonString(obj){
    try { return JSON.stringify(obj, null, 2); } catch(e){ return ''; }
  }

  function exportAll(currentData){
    try { return toJsonString(currentData || window.currentData || {}); } catch(e){ return ''; }
  }

  function exportSelection(cy, currentData){
    try {
      var selectedNodes = cy.nodes(':selected');
      var selectedIds = new Set(selectedNodes.map(function(n){ return n.data('id'); }));
      var selectedEdges = cy.edges().filter(function(e){
        return selectedIds.has(e.data('source')) && selectedIds.has(e.data('target'));
      });

      var subContainment = [];
      var subSkills = [];
      selectedNodes.forEach(function(n){
        if (n.data('type') === 'containment'){
          var fullCo = (currentData.containmentObjects || []).find(function(co){ return co.id === n.data('id'); });
          if (fullCo) subContainment.push(fullCo);
        } else if (n.data('type') === 'skill'){
          var fullSk = (currentData.skills || []).find(function(sk){ return sk.id === n.data('id'); });
          if (fullSk) subSkills.push(fullSk);
        }
      });

      var subgraph = {
        containmentObjects: subContainment,
        skills: subSkills,
        links: selectedEdges.map(function(e){ return ({ source: e.data('source'), target: e.data('target') }); })
      };
      return toJsonString(subgraph);
    } catch(e){ return ''; }
  }

  // High-level loaders (non-invasive; do not replace window.loadData unless explicitly used)
  function fromPath(path){
    return fetch(path)
      .then(function(res){ return res.json(); })
      .then(function(json){
        var v = validateSchema(json);
        if (!v.ok) throw new Error(v.error || '数据格式错误');
        var original = json;
        var current = deepClone(json);
        var degrees = calculateDegreeCounts(current);
        var elements = buildElements(current, degrees);
        return { originalData: original, currentData: current, degreeCounts: degrees, elements: elements };
      });
  }

  function fromObject(obj){
    var v = validateSchema(obj);
    if (!v.ok) throw new Error(v.error || '数据格式错误');
    var original = obj;
    var current = deepClone(obj);
    var degrees = calculateDegreeCounts(current);
    var elements = buildElements(current, degrees);
    return { originalData: original, currentData: current, degreeCounts: degrees, elements: elements };
  }

  // Bridge helpers to work with existing globals without changing public API
  function rebuildCyElementsWithCurrent(){
    try {
      var cy = window.cy;
      var data = window.currentData;
      if (!cy || !data) return false;
      var degrees = calculateDegreeCounts(data);
      var els = buildElements(data, degrees);
      attachElements(cy, els);
      return true;
    } catch(e){ return false; }
  }

  // Public API
  window.Modules.Data = {
    validateSchema,
    calculateDegreeCounts,
    buildElements,
    attachElements,
    exportAll,
    exportSelection,
    fromPath,
    fromObject,
    rebuildCyElementsWithCurrent
  };
})();