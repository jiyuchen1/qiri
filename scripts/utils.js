window.vizUtils = (function(){
  function persistState({ isDarkTheme, isBipartiteLayout }){
    try {
      const state = {
        dark: !!isDarkTheme,
        bipartite: !!isBipartiteLayout
      };
      localStorage.setItem('vizState', JSON.stringify(state));
    } catch(e) {}
  }
  function restoreState(cy){
    try {
      const raw = localStorage.getItem('vizState');
      if (!raw) return {};
      const s = JSON.parse(raw);
      if (s.dark) document.body.classList.add('dark-theme');
      if (cy){
        // 始终显示节点标签；不显示边标签
        cy.elements().style('text-opacity', 1);
        cy.edges().style('label', '');
      }
      return s;
    } catch(e) { return {}; }
  }
  return { persistState, restoreState };
})();
