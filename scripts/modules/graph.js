// Graph module for zero-build static architecture
(function(){
  'use strict';
  if (!window.Modules) window.Modules = {};

  // Helpers
  function safeFit(cy){
    try { cy.fit(); cy.center(); } catch(e){}
  }

  function createBipartiteLayout(cy){
    // Mirror [createBipartiteLayout()](index.html:824) behavior
    try {
      const containmentNodes = cy.nodes('[type = "containment"]');
      const skillNodes = cy.nodes('[type = "skill"]');
      const containmentCount = containmentNodes.length;
      const skillCount = skillNodes.length;

      containmentNodes.forEach(function(node, i){
        const y = (i - (containmentCount - 1) / 2) * 100;
        node.position({ x: -300, y: y });
      });

      skillNodes.forEach(function(node, i){
        const y = (i - (skillCount - 1) / 2) * 100;
        node.position({ x: 300, y: y });
      });

      return {
        name: 'preset',
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 50
      };
    } catch(e){
      return { name: 'preset' };
    }
  }

  function runBipartite(cy){
    const layout = createBipartiteLayout(cy);
    try { cy.layout(layout).run(); } catch(e){}
    setTimeout(function(){ safeFit(cy); }, 100);
  }

  function applyLayout(cy, isBipartite, layoutName){
    if (!cy) return;
    try {
      if (isBipartite){
        runBipartite(cy);
        return;
      }
      const layoutType = layoutName || 'cose';
      const layout = {
        name: layoutType,
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 50
      };
      cy.layout(layout).run();
      setTimeout(function(){ safeFit(cy); }, 100);
    } catch(e){}
  }





  function updateStats(cy, targets){
    // 移除“平均度数”相关逻辑，仅保留计数与最大度数
    if (!cy) return null;
    var ids = targets || {
      containmentCount: 'containmentCount',
      skillCount: 'skillCount',
      edgeCount: 'edgeCount',
      maxDegree: 'maxDegree'
    };
    try {
      var containmentCount = cy.nodes('[type = "containment"]').length;
      var skillCount = cy.nodes('[type = "skill"]').length;
      var edgeCount = cy.edges().length;
      var maxDegree = 0;
      cy.nodes('[type = "skill"]').forEach(function(node){
        var d = node.connectedEdges().length; if (d > maxDegree) maxDegree = d;
      });
      var result = { containmentCount, skillCount, edgeCount, maxDegree };
      // Update DOM if ids exist
      Object.keys(ids).forEach(function(k){
        var el = document.getElementById(ids[k]);
        if (el) el.textContent = result[k];
      });
      return result;
    } catch(e){ return null; }
  }

  function preventDrag(cy, flag){
    try {
      if (cy && typeof cy.autoungrabify === 'function') cy.autoungrabify(!!flag);
    } catch(e){}
  }

  // Public API
  window.Modules.Graph = {
    createBipartiteLayout,
    runBipartite,
    applyLayout,
    updateStats,
    preventDrag
  };
})();