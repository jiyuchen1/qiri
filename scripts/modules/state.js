// State module for zero-build static architecture
(function(){
  'use strict';
  // Expose as window.AppState to avoid module loaders
  if (window.AppState) return;

  const STORAGE_KEY = 'vizState';

  const state = {
    isDarkTheme: false,
    isBipartiteLayout: true,
    cy: null
  };

  function init(cy){
    state.cy = cy || state.cy;
    // read existing UI state via localStorage; do not override index.html behavior
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw){
        const s = JSON.parse(raw);
        state.isDarkTheme = !!s.dark;
        state.isBipartiteLayout = !!s.bipartite;
      }
    } catch(e){}
  }

  function getState(){
    return {
      isDarkTheme: state.isDarkTheme,
      isBipartiteLayout: state.isBipartiteLayout,
      cy: state.cy
    };
  }

  function setTheme(dark){
    state.isDarkTheme = !!dark;
    document.body.classList.toggle('dark-theme', state.isDarkTheme);
    if (state.cy){
      try {
        state.cy.style().selector('core').style({ 'background-color': state.isDarkTheme ? '#1a1a1a' : '#ffffff' }).update();
      } catch(e){}
    }
    persistUI();
  }

  function setBipartite(flag){
    state.isBipartiteLayout = !!flag;
    persistUI();
  }

  // Compatibility helpers mirroring existing functions:
  // see [persistUIState()](index.html:1189) and [restoreUIState()](index.html:1201)
  function persistUI(){
    try {
      const payload = {
        dark: state.isDarkTheme,
        bipartite: state.isBipartiteLayout
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch(e){}
  }

  function restoreUI(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      state.isDarkTheme = !!s.dark;
      state.isBipartiteLayout = !!s.bipartite;
      document.body.classList.toggle('dark-theme', state.isDarkTheme);
      if (state.cy){
        // 始终显示节点标签；不显示边标签
        state.cy.elements().style('text-opacity', 1);
        state.cy.edges().style('label', '');
      }
      return s;
    } catch(e){ return null; }
  }

  // Public API
  window.AppState = {
    init,
    getState,
    setTheme,
    setBipartite,
    persistUI,
    restoreUI
  };
})();