// DOM module for zero-build static architecture
(function(){
  'use strict';
  if (!window.Modules) window.Modules = {};
  const DOM = {
    $: function(selector, root){ return (root || document).querySelector(selector); },
    $$: function(selector, root){ return Array.from((root || document).querySelectorAll(selector)); },
    setSidebarTitle: function(type){
      try {
        const headerEl = document.querySelector('#sidebar h3');
        if (!headerEl) return;
        headerEl.textContent = (type === 'containment') ? '收容物详情' : (type === 'skill') ? '技能详情' : '节点详情';
      } catch(e){}
    },
    refreshLinkSelects: function(){
      try {
        const coSel = document.getElementById('linkContainmentSelect');
        const skSel = document.getElementById('linkSkillSelect');
        if (!coSel || !skSel) return;
        const prevCo = coSel.value;
        const prevSk = skSel.value;
        coSel.innerHTML = '<option value="">请选择收容物</option>';
        const data = window.currentData || { containmentObjects: [], skills: [] };
        (data.containmentObjects || []).forEach(function(co){
          const opt = document.createElement('option');
          opt.value = co.id;
          opt.textContent = co.name;
          coSel.appendChild(opt);
        });
        skSel.innerHTML = '<option value="">请选择技能</option>';
        (data.skills || []).forEach(function(sk){
          const opt = document.createElement('option');
          opt.value = sk.id;
          opt.textContent = sk.name;
          skSel.appendChild(opt);
        });
        if ([...coSel.options].some(function(o){ return o.value === prevCo; })) coSel.value = prevCo;
        if ([...skSel.options].some(function(o){ return o.value === prevSk; })) skSel.value = prevSk;
        coSel.disabled = coSel.options.length <= 1;
        skSel.disabled = skSel.options.length <= 1;
      } catch(e){}
    }
  };
  window.Modules.DOM = DOM;
  // provide global alias for compatibility with existing calls in index.html
  if (!window.refreshLinkSelects) window.refreshLinkSelects = DOM.refreshLinkSelects;
})();