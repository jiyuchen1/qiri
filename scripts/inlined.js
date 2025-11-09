// Toast helper
function showToast(msg){
    let el = document.getElementById('appToast');
    if (!el){ el = document.createElement('div'); el.id='appToast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(()=>{ el.style.display='none'; }, 2000);
}
// 应用程序全局变量
let cy;
let originalData = null;
let currentData = null;
let degreeCounts = {};
let isDarkTheme = false;
let isBipartiteLayout = true;
let layoutMode = 'bipartite';

// 颜色映射

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用程序
function initializeApp() {
    // 创建cytoscape实例
    cy = cytoscape({
        container: document.getElementById('cy'),
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'text-wrap': 'wrap',
                    'text-max-width': '100px',
                    'font-size': '9px',
                    'color': 'white',
                    'text-outline-color': 'black',
                    'text-outline-width': 1
                }
            },
            {
                selector: 'node[type = "skill"][quality = "蓝色"]',
                style: {
                    'background-color': '#2196F3'
                }
            },
            {
                selector: 'node[type = "skill"][quality = "紫色"]',
                style: {
                    'background-color': '#9C27B0'
                }
            },
            {
                selector: 'node[type = "containment"]',
                style: {
                    'background-color': '#9E9E9E',
                    'shape': 'ellipse',
                    'width': 'mapData(size, 0, 10, 40, 100)',
                    'height': 'mapData(size, 0, 10, 40, 100)',
                    'text-max-width': '140px'
                }
            },
            {
                selector: 'node[type = "containment"][rating = "B"]',
                style: {
                    'background-color': '#4CAF50'
                }
            },
            {
                selector: 'node[type = "containment"][rating = "A"]',
                style: {
                    'background-color': '#2196F3'
                }
            },
            {
                selector: 'node[type = "containment"][rating = "S"]',
                style: {
                    'background-color': '#9C27B0'
                }
            },
            {
                selector: 'node[type = "skill"]',
                style: {
                    'background-color': 'data(color)',
                    'shape': 'rectangle',
                    'width': 'mapData(size, 0, 20, 30, 70)',
                    'height': 'mapData(size, 0, 20, 30, 70)',
                    'text-max-width': '100px'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 'mapData(weight, 0, 10, 1, 5)',
                    'line-color': 'data(color)',
                    'target-arrow-color': 'data(color)',
                    'target-arrow-shape': 'none',
                    'curve-style': 'bezier',
                    'opacity': 0.6
                }
            },
            {
                selector: 'node.highlighted',
                style: {
                    'border-width': 3,
                    'border-color': '#f1c40f',
                    'z-index': 9999
                }
            },
            {
                selector: 'edge.highlighted',
                style: {
                    'width': 3,
                    'line-color': '#f1c40f',
                    'opacity': 0.9
                }
            }
        ],
        autoungrabify: false,
        layout: { name: 'preset' }
    });

    // 允许节点拖拽，支持鼠标拖动调整位置

    // 加载默认数据
    loadData('data.json');
    
    // 绑定事件处理器
    bindEventHandlers();

    // 初始化关联下拉（确保初次渲染即可选择）
    if (typeof refreshLinkSelects === 'function') { refreshLinkSelects(); }
    
    // 初始化统计信息
    updateStats();

    // 恢复 UI 状态（主题与布局偏好），并确保标签可见、边标签关闭
    restoreUIState();
}

// 数据加载和验证函数
function loadData(dataPath) {
    // 如果传入的是字符串（文件路径），则发起fetch请求
    if (typeof dataPath === 'string') {
        fetch(dataPath)
            .then(response => response.json())
            .then(jsonData => {
                processAndValidateData(jsonData);
            })
            .catch(error => {
                console.error('Error loading data:', error);
                alert('加载数据时出错，请检查data.json文件是否存在且格式正确。');
            });
    } else {
        // 如果传入的是JSON对象，直接处理
        processAndValidateData(dataPath);
    }
}

 // 处理和验证数据（体系化：版本信封+校验+归一化）
function processAndValidateData(input) {
    try {
        var Store = window.Modules && window.Modules.Store;
        var Schema = window.Modules && window.Modules.Schema;
        if (!Store || !Schema) {
            // Fallback：保持旧行为（无版本信封）
            if (!input || !input.containmentObjects || !input.skills) {
                alert('数据格式错误：缺少 containmentObjects 或 skills 字段');
                return;
            }
            originalData = input;
            currentData = JSON.parse(JSON.stringify(input));
        } else {
            // 新管道：任意输入 -> v1 信封（校验+归一化）
            var res = Store.validateAndNormalize(input);
            if (!res.ok) {
                console.error('数据校验失败:', res.errors);
                alert('导入失败：' + (res.errors || []).slice(0,4).join('；'));
                return;
            }
            var env = res.envelope;
            // 保存完整信封便于追溯；运行态仅持 data
            originalData = JSON.parse(JSON.stringify(env));
            currentData = JSON.parse(JSON.stringify(env.data));
        }

        // 计算度数并重建图
        calculateDegreeCounts();
        buildGraphData();

        // 应用布局与刷新联动
        applyLayout();
        if (typeof refreshLinkSelects === 'function') { refreshLinkSelects(); }

        // 更新统计与提示
        updateStats();
        showToast('数据已加载并验证');
    } catch (e) {
        console.error('处理数据异常:', e);
        alert('处理数据异常，请检查格式或重试。');
    }
}

// 计算节点度数
function calculateDegreeCounts() {
    degreeCounts = {};

    // 初始化技能度数
    currentData.skills.forEach(skill => {
        degreeCounts[skill.id] = 0;
    });

    // 计算技能被引用次数
    currentData.containmentObjects.forEach(containment => {
        containment.skills.forEach(skillId => {
            if (degreeCounts.hasOwnProperty(skillId)) {
                degreeCounts[skillId]++;
            }
        });
    });
}

// 构建图形数据
function buildGraphData() {
    const elements = [];

    // 添加收容物节点
    currentData.containmentObjects.forEach(containment => {
        elements.push({
            data: {
                id: containment.id,
                label: containment.name,
                type: 'containment',
                rating: containment.rating,
                acquisition: containment.acquisition,
                skills: containment.skills,
                // 为避免节点尺寸映射缺省导致交互区域过小，提供稳定的默认尺寸
                size: 3
            },
            position: { x: 0, y: 0 } // 位置将在布局中确定
        });
    });

    // 添加技能节点
    currentData.skills.forEach(skill => {
        elements.push({
            data: {
                id: skill.id,
                label: skill.name,
                type: 'skill',
                quality: skill.quality,
                cooldown: skill.cooldown,
                effect: skill.effect,
                degree: degreeCounts[skill.id] || 0,
                // 技能颜色按品质映射：蓝色→#2196F3，紫色→#9C27B0，其它/缺失→#9E9E9E
                color: (skill.quality === '蓝色') ? '#2196F3' : ((skill.quality === '紫色') ? '#9C27B0' : '#9E9E9E'),
                // 映射尺寸以保证可见与可交互（度数越高稍大）
                size: Math.min(20, (degreeCounts[skill.id] || 0) + 2)
            },
            position: { x: 0, y: 0 } // 位置将在布局中确定
        });
    });

    // 添加边（收容物-技能关系）
    currentData.containmentObjects.forEach(containment => {
        containment.skills.forEach(skillId => {
            // 检查技能是否存在
            const skillExists = currentData.skills.some(skill => skill.id === skillId);
            if (skillExists) {
                elements.push({
                    data: {
                        id: `${containment.id}-${skillId}`,
                        source: containment.id,
                        target: skillId,
                        weight: 1
                    }
                });
            }
        });
    });

    // 清除现有元素并添加新元素
    cy.elements().remove();
    cy.add(elements);
}

// 绑定事件处理器
function bindEventHandlers() {
    // 数据加载按钮
    const loadBtn = document.getElementById('loadDataBtn');
    if (loadBtn) loadBtn.addEventListener('click', () => {
        const fi = document.getElementById('fileInput');
        if (fi) {
            fi.click();
        } else {
            // 动态创建临时文件选择器作为后备
            const t = document.createElement('input');
            t.type = 'file';
            t.accept = '.json';
            t.style.display = 'none';
            t.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        try {
                            const jsonData = JSON.parse(ev.target.result);
                            loadData(jsonData);
                        } catch (error) {
                            alert('JSON文件格式错误，请检查文件内容。');
                        }
                    };
                    reader.readAsText(file);
                }
            });
            document.body.appendChild(t);
            t.click();
        }
    });

    const fileInputEl = document.getElementById('fileInput');
    if (fileInputEl) fileInputEl.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    loadData(jsonData);
                    if (typeof refreshLinkSelects === 'function') { refreshLinkSelects(); }
                } catch (error) {
                    alert('JSON文件格式错误，请检查文件内容。');
                }
            };
            reader.readAsText(file);
        }
    });



    // 导出数据按钮（全量）：使用 Schema 归一化，确保缺失字段被补齐并包含在 JSON 中
    const exportDataBtnEl = document.getElementById('exportDataBtn');
    function performExportData(){
        try {
            var Store = window.Modules && window.Modules.Store;
            if (!currentData) { alert('当前无数据可导出'); return; }
            if (Store && typeof Store.validateAndNormalize === 'function') {
                var r = Store.validateAndNormalize(currentData);
                if (!r.ok) { alert('导出失败：数据校验错误'); return; }
                Store.exportEnvelopeToFile(r.envelope, { base: 'containment-skills', minified: false });
            } else {
                var envelope = { version: '1.0.0', exportedAt: new Date().toISOString(), app: { name: 'containment-skills-ui' }, data: JSON.parse(JSON.stringify(currentData)) };
                const dataStr = JSON.stringify(envelope, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const link = document.createElement('a');
                link.download = 'containment-skills_v' + (envelope.version || '1.0.0') + '_' + (new Date()).toISOString().slice(0,19).replace(/[-:T]/g,'') + '.json';
                link.href = URL.createObjectURL(dataBlob);
                link.click();
            }
            showToast('已导出 JSON');
        } catch (e) {
            alert('导出失败：' + (e && e.message ? e.message : String(e)));
        }
    }
    if (exportDataBtnEl) exportDataBtnEl.addEventListener('click', performExportData);


    // 布局按钮（容错：这些按钮可能已从 DOM 移除）
    const bpBtn = document.getElementById('bipartiteLayoutBtn');
    if (bpBtn) bpBtn.addEventListener('click', () => {
        isBipartiteLayout = true;
        layoutMode = 'bipartite';
        applyLayout();
        persistUIState();
    });

    const frBtn = document.getElementById('forceLayoutBtn');
    if (frBtn) frBtn.addEventListener('click', () => {
        isBipartiteLayout = false;
        layoutMode = 'cose';
        applyLayout('cose');
        persistUIState();
    });

    const cirBtn = document.getElementById('circleLayoutBtn');
    if (cirBtn) cirBtn.addEventListener('click', () => {
        isBipartiteLayout = false;
        layoutMode = 'circle';
        applyLayout('circle');
        persistUIState();
    });

    const gridBtn = document.getElementById('gridLayoutBtn');
    if (gridBtn) gridBtn.addEventListener('click', () => {
        isBipartiteLayout = false;
        layoutMode = 'grid';
        applyLayout('grid');
        persistUIState();
    });
     // 清空数据（带快照与撤销）
    const clearDataBtnEl = document.getElementById('clearDataBtn');
    function performClearData(){
        if (!confirm('确定要清空所有数据和图形吗？此操作不可撤销（可在30秒内撤销）。')) return;
        try {
            var Store = window.Modules && window.Modules.Store;
            if (Store && currentData) {
                var env = Store.buildEnvelope(currentData);
                Store.saveSnapshot(env);
            }
            currentData = { containmentObjects: [], skills: [] };
            cy.elements().remove();
            if (typeof refreshLinkSelects === 'function') { refreshLinkSelects(); }
            updateStats();
            showUndoBanner();
            showToast('数据已清空');
        } catch(e){
            alert('清空失败：' + (e && e.message ? e.message : String(e)));
        }
    }
    if (clearDataBtnEl) clearDataBtnEl.addEventListener('click', performClearData);
    // 添加收容物
    const addContainmentBtnEl = document.getElementById('addContainmentBtn');
    function performAddContainment(name, rating, acquisition){
        if (!name) { showToast('请输入收容物名称'); return; }
        if (name.length > 64) { showToast('收容物名称长度需 ≤ 64'); return; }
        if (currentData.containmentObjects.some(c => (c.name || '').toLowerCase() === name.toLowerCase())) { showToast('收容物名称已存在'); return; }
        const newId = `co_${String(Date.now()).slice(-6)}`;
        const newObj = { id: newId, name, rating, acquisition, skills: [] };
        currentData.containmentObjects.push(newObj);
        const node = { data: { id: newId, label: name, type: 'containment', rating, acquisition, skills: newObj.skills, size: 3 } };
        cy.add(node);
        const addedNode = cy.getElementById(newId); if (addedNode) addedNode.grabify();
        applyLayout();
        updateStats();
        if (typeof refreshLinkSelects === 'function') { refreshLinkSelects(); }
        showToast('收容物已添加');
    }
    if (addContainmentBtnEl) addContainmentBtnEl.addEventListener('click', () => {
        const name = document.getElementById('newContainmentName').value.trim();
        const rating = (document.getElementById('newContainmentRating')?.value) || 'B';
        const acquisition = (document.getElementById('newContainmentAcquisition')?.value) || '捕捉';
        performAddContainment(name, rating, acquisition);
        const rEl = document.getElementById('newContainmentRating'); if (rEl) rEl.value = 'B';
        const aEl = document.getElementById('newContainmentAcquisition'); if (aEl) aEl.value = '捕捉';
        const nEl = document.getElementById('newContainmentName'); if (nEl) nEl.value = '';
    });
    // 添加技能
    const addSkillBtnEl = document.getElementById('addSkillBtn');
    function performAddSkill(name, quality, cooldown, effect){
        if (!name) { alert('请输入技能名称'); return; }
        const newId = `sk_${String(Date.now()).slice(-6)}`;
        const newSkill = { id: newId, name, quality, cooldown, effect };
        currentData.skills.push(newSkill);
        const node = { data: { id: newId, label: name, type: 'skill', quality, cooldown, effect, degree: 0, color: (quality === '蓝色') ? '#2196F3' : ((quality === '紫色') ? '#9C27B0' : '#9E9E9E'), size: 2 } };
        cy.add(node);
        const addedNode = cy.getElementById(newId); if (addedNode) addedNode.grabify();
        applyLayout();
        updateStats();
        if (typeof refreshLinkSelects === 'function') { refreshLinkSelects(); }
        showToast('技能已添加');
    }
    if (addSkillBtnEl) addSkillBtnEl.addEventListener('click', () => {
        const name = document.getElementById('newSkillName').value.trim();
        const quality = (document.getElementById('newSkillQuality')?.value) || '蓝色';
        const cooldownInput = document.getElementById('newSkillCooldown');
        const cooldown = cooldownInput && cooldownInput.value !== '' ? Number(cooldownInput.value) : 0;
        const effect = document.getElementById('newSkillEffect')?.value?.trim() || '';
        performAddSkill(name, quality, cooldown, effect);
        const nEl = document.getElementById('newSkillName'); if (nEl) nEl.value = '';
    });
    // 建立关联（收容物-技能）
    const linkBtnEl = document.getElementById('linkBtn');
    function performLink(coId, skId){
        if (!coId || !skId) { alert('请选择收容物和技能'); return; }
        const co = currentData.containmentObjects.find(c => c.id === coId);
        const sk = currentData.skills.find(s => s.id === skId);
        if (!co || !sk) { alert('ID不存在，请检查'); return; }
        if (!co.skills.includes(skId)) co.skills.push(skId);
        const existingEdge = cy.edges().some(e => e.data('source') === coId && e.data('target') === skId);
        if (!existingEdge) {
            cy.add({ data: { id: `e_${coId}_${skId}`, source: coId, target: skId, weight: 1 } });
        }
        updateStats();
        showToast('已建立关联');
    }
    if (linkBtnEl) linkBtnEl.addEventListener('click', () => {
        const coId = document.getElementById('linkContainmentSelect')?.value?.trim();
        const skId = document.getElementById('linkSkillSelect')?.value?.trim();
        performLink(coId, skId);
    });

    // 视图控制按钮
    // 移除放大按钮（按需保留）

    // 移除缩小按钮（按需保留）

    const fitBtn = document.getElementById('fitBtn');
    if (fitBtn) fitBtn.addEventListener('click', () => {
        cy.fit();
        cy.center();
    });


    // 侧栏关闭按钮
    const closeBtn = document.getElementById('sidebarCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function() {
        const sidebarEl = document.getElementById('sidebar');
        if (!sidebarEl) return;
        sidebarEl.classList.remove('active');
        sidebarEl.style.transform = 'translateX(100%)';
        sidebarEl.style.display = 'none';
    });
    
    // 节点详情面板内的操作委托（编辑/删除/解除关联/保存/取消）
    const detailsRoot = document.getElementById('nodeDetails');
    if (detailsRoot) detailsRoot.addEventListener('click', function(e){
        const btn = e.target && e.target.closest('button');
        if (!btn) return;
        const act = btn.getAttribute('data-action');
        const type = btn.getAttribute('data-type');
        if (act === 'delete') {
            const id = btn.getAttribute('data-id');
            if (type === 'containment') { performDeleteContainment(id); }
            if (type === 'skill') { performDeleteSkill(id); }
        } else if (act === 'edit') {
            const id = btn.getAttribute('data-id');
            if (type === 'containment') { enterEditContainment(id); }
            if (type === 'skill') { enterEditSkill(id); }
        } else if (act === 'unlink') {
            const co = btn.getAttribute('data-co');
            const sk = btn.getAttribute('data-sk');
            if (co && sk) performUnlink(co, sk);
        } else if (act === 'save-edit-co') {
            const id = btn.getAttribute('data-id');
            const name = (document.getElementById('editCoName')?.value || '').trim();
            const rating = document.getElementById('editCoRating')?.value || 'B';
            const acq = document.getElementById('editCoAcq')?.value || '捕捉';
            performUpdateContainment(id, { name, rating, acquisition: acq });
        } else if (act === 'save-edit-sk') {
            const id = btn.getAttribute('data-id');
            const name = (document.getElementById('editSkName')?.value || '').trim();
            const effect = (document.getElementById('editSkEffect')?.value || '').trim();
            const quality = document.getElementById('editSkQuality')?.value || '蓝色';
            const cooldownVal = document.getElementById('editSkCooldown')?.value;
            const cooldown = cooldownVal !== '' ? Number(cooldownVal) : 0;
            performUpdateSkill(id, { name, effect, quality, cooldown });
        } else if (act === 'cancel-edit') {
            const id = btn.getAttribute('data-id');
            const n = cy.getElementById(id);
            if (n && !n.empty()) showNodeDetails(n);
        }
    });

    // 搜索和筛选
    const searchEl = document.getElementById('searchInput');
    if (searchEl) searchEl.addEventListener('input', handleSearch);
    const typeEl = document.getElementById('typeFilter');
    if (typeEl) typeEl.addEventListener('change', handleFilter);
    const ratingEl = document.getElementById('ratingFilter');
    if (ratingEl) ratingEl.addEventListener('change', handleFilter);
    const acqEl = document.getElementById('acqFilter');
    if (acqEl) acqEl.addEventListener('change', handleFilter);



    // 主题切换
    const themeBtnEl = document.getElementById('themeToggleBtn');
    if (themeBtnEl) themeBtnEl.addEventListener('click', toggleTheme);

    // 图表交互事件
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        handleNodeClick(node);
    });

    cy.on('mouseover', 'node', function(evt) {
        const node = evt.target;
        const e = evt.originalEvent || evt;
        showTooltip(e, node);
    });

    // 持续更新鼠标移动时的 Tooltip 位置，避免初次触发后不再跟随
    cy.on('mousemove', 'node', function(evt) {
        const node = evt.target;
        const e = evt.originalEvent || evt;
        showTooltip(e, node);
    });

    cy.on('mouseout', 'node', function() {
        hideTooltip();
    });

    // 点击空白区域时隐藏 Tooltip
    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            hideTooltip();
        }
    });

    cy.on('cxttap', function(evt) {
        // 右键点击清除选择
        cy.elements().removeClass('highlighted');
    });

    // 数据管理浮动面板：打开/关闭与三项动作（导入/清空/导出）
    const dmBtn = document.getElementById('dataManagerBtn');
    const dmPanel = document.getElementById('dmPanel');

    if (dmBtn && dmPanel) {
        dmBtn.addEventListener('click', function () {
            var isOpen = dmPanel.style.display && dmPanel.style.display !== 'none';
            dmPanel.style.display = isOpen ? 'none' : 'block';
        });
    }

    // 导入数据 JSON：触发隐藏的文件输入（沿用现有 fileInput 行为）
    const dmImportBtn = document.getElementById('dmImportBtn');
    if (dmImportBtn) dmImportBtn.addEventListener('click', function () {
        var fi = document.getElementById('fileInput');
        if (fi) {
            fi.click();
        } else {
            // 动态创建并触发文件选择
            var t = document.createElement('input');
            t.type = 'file';
            t.accept = '.json';
            t.style.display = 'none';
            t.addEventListener('change', function(e){
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(ev){
                        try {
                            const jsonData = JSON.parse(ev.target.result);
                            loadData(jsonData);
                        } catch(error){
                            alert('JSON文件格式错误，请检查文件内容。');
                        }
                    };
                    reader.readAsText(file);
                }
            });
            document.body.appendChild(t);
            t.click();
        }
        if (dmPanel) dmPanel.style.display = 'none';
    });

    // 清空数据：复用已有清空按钮逻辑
    const dmClearBtn = document.getElementById('dmClearBtn');
    if (dmClearBtn) dmClearBtn.addEventListener('click', function () {
        var cb = document.getElementById('clearDataBtn');
        if (cb) cb.click();
        else performClearData();
        if (dmPanel) dmPanel.style.display = 'none';
    });

    // 导出数据 JSON：复用已有导出按钮逻辑
    const dmExportBtn = document.getElementById('dmExportBtn');
    if (dmExportBtn) dmExportBtn.addEventListener('click', function () {
        var eb = document.getElementById('exportDataBtn');
        if (eb) eb.click();
        else performExportData();
        if (dmPanel) dmPanel.style.display = 'none';
    });

    // 补充：在数据管理面板中动态注入“新增”类按钮（收容物/技能/关联）
    (function ensureDmButtons(){
        try {
            if (!dmPanel) return;
            function addBtn(id, text, cls){
                if (document.getElementById(id)) return;
                var b = document.createElement('button');
                b.id = id;
                b.textContent = text;
                if (cls) b.className = cls;
                b.style.marginBottom = '8px';
                // 插入到面板顶部
                if (dmPanel.firstChild) dmPanel.insertBefore(b, dmPanel.firstChild);
                else dmPanel.appendChild(b);
            }
            addBtn('dmAddLinkBtn', '新增关联', 'normal-btn');
            addBtn('dmAddSkillBtn', '新增技能', 'normal-btn');
            addBtn('dmAddContainmentBtn', '新增收容物', 'normal-btn');
        } catch(_){}
    })();

    // 构建右上角上浮表单（覆盖层内的三种表单）
    (function ensureOverlays(){
        try {
            var container = document.querySelector('.graph-container');
            if (!container) return;
            if (document.getElementById('formContainmentOverlay')) return; // 已存在

            var wrap = document.createElement('div');
            wrap.className = 'dm-overlays';
            wrap.style.position = 'absolute';
            wrap.style.top = '20px';
            wrap.style.right = '20px';
            wrap.style.zIndex = '8';

            wrap.innerHTML = [
                '<div id="formContainmentOverlay" class="overlay-card" style="display:none; background: rgba(255,255,255,0.98); border-radius: 10px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 10px; width: 320px; position: relative;">',
                '  <button id="closeFormContainment" class="modal-close-btn" style="position:absolute; right:6px; top:6px;">×</button>',
                '  <h4 style="margin-bottom:8px;">新增收容物</h4>',
                '  <label>名称</label><input id="overlayContainmentName" type="text" style="width:100%; margin-bottom:6px;">',
                '  <div style="display:flex; gap:8px; margin-bottom:6px;">',
                '    <div style="flex:1;"><label>评级</label><select id="overlayContainmentRating" style="width:100%;"><option value="B">B</option><option value="A">A</option><option value="S">S</option></select></div>',
                '    <div style="flex:1;"><label>获取方式</label><select id="overlayContainmentAcquisition" style="width:100%;"><option value="捕捉">捕捉</option><option value="融合">融合</option></select></div>',
                '  </div>',
                '  <button id="submitContainmentOverlay" class="normal-btn">提交</button>',
                '</div>',

                '<div id="formSkillOverlay" class="overlay-card" style="display:none; background: rgba(255,255,255,0.98); border-radius: 10px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 10px; width: 320px; position: relative;">',
                '  <button id="closeFormSkill" class="modal-close-btn" style="position:absolute; right:6px; top:6px;">×</button>',
                '  <h4 style="margin-bottom:8px;">新增技能</h4>',
                '  <label>名称</label><input id="overlaySkillName" type="text" style="width:100%; margin-bottom:6px;">',
                '  <label>技能效果</label><input id="overlaySkillEffect" type="text" style="width:100%; margin-bottom:6px;">',
                '  <div style="display:flex; gap:8px; margin-bottom:6px;">',
                '    <div style="flex:1;"><label>品质</label><select id="overlaySkillQuality" style="width:100%;"><option value="蓝色">蓝色</option><option value="紫色">紫色</option></select></div>',
                '    <div style="flex:1;"><label>冷却(秒)</label><input id="overlaySkillCooldown" type="number" min="0" max="86400" style="width:100%;"></div>',
                '  </div>',
                '  <button id="submitSkillOverlay" class="normal-btn">提交</button>',
                '</div>',

                '<div id="formLinkOverlay" class="overlay-card" style="display:none; background: rgba(255,255,255,0.98); border-radius: 10px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 10px; width: 320px; position: relative;">',
                '  <button id="closeFormLink" class="modal-close-btn" style="position:absolute; right:6px; top:6px;">×</button>',
                '  <h4 style="margin-bottom:8px;">新增关联</h4>',
                '  <label>选择收容物</label><select id="overlayLinkContainmentSelect" style="width:100%; margin-bottom:6px;"></select>',
                '  <label>选择技能</label><select id="overlayLinkSkillSelect" style="width:100%; margin-bottom:6px;"></select>',
                '  <button id="submitLinkOverlay" class="normal-btn">建立关联</button>',
                '</div>'
            ].join('');

            container.appendChild(wrap);
        } catch(_){}
    })();

    // 工具函数：显示/隐藏 overlay
    function hideAllOverlays(){
        var ids = ['formContainmentOverlay','formSkillOverlay','formLinkOverlay'];
        ids.forEach(function(id){ var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }
    function showOverlay(id){
        hideAllOverlays();
        var el = document.getElementById(id);
        if (el) el.style.display = 'block';
    }

    // 打开三个上浮表单
    var dmAddContainmentBtn = document.getElementById('dmAddContainmentBtn');
    if (dmAddContainmentBtn) dmAddContainmentBtn.addEventListener('click', function(){
        showOverlay('formContainmentOverlay');
        if (dmPanel) dmPanel.style.display = 'none';
    });
    var dmAddSkillBtn = document.getElementById('dmAddSkillBtn');
    if (dmAddSkillBtn) dmAddSkillBtn.addEventListener('click', function(){
        showOverlay('formSkillOverlay');
        if (dmPanel) dmPanel.style.display = 'none';
    });
    var dmAddLinkBtn = document.getElementById('dmAddLinkBtn');
    if (dmAddLinkBtn) dmAddLinkBtn.addEventListener('click', function(){
        // 打开前填充选择项
        try {
            var coSel = document.getElementById('overlayLinkContainmentSelect');
            var skSel = document.getElementById('overlayLinkSkillSelect');
            if (coSel && skSel) {
                coSel.innerHTML = '<option value="">请选择收容物</option>';
                (currentData?.containmentObjects || []).forEach(function(co){
                    var opt = document.createElement('option'); opt.value = co.id; opt.textContent = co.name; coSel.appendChild(opt);
                });
                skSel.innerHTML = '<option value="">请选择技能</option>';
                (currentData?.skills || []).forEach(function(sk){
                    var opt2 = document.createElement('option'); opt2.value = sk.id; opt2.textContent = sk.name; skSel.appendChild(opt2);
                });
            }
        } catch(_){}
        showOverlay('formLinkOverlay');
        if (dmPanel) dmPanel.style.display = 'none';
    });

    // overlay 关闭按钮
    var closeFormContainment = document.getElementById('closeFormContainment');
    if (closeFormContainment) closeFormContainment.addEventListener('click', hideAllOverlays);
    var closeFormSkill = document.getElementById('closeFormSkill');
    if (closeFormSkill) closeFormSkill.addEventListener('click', hideAllOverlays);
    var closeFormLink = document.getElementById('closeFormLink');
    if (closeFormLink) closeFormLink.addEventListener('click', hideAllOverlays);

    // overlay 提交：复用原有按钮与输入，避免重复实现
    var submitContainmentOverlay = document.getElementById('submitContainmentOverlay');
    if (submitContainmentOverlay) submitContainmentOverlay.addEventListener('click', function(){
        try {
            var name = document.getElementById('overlayContainmentName')?.value?.trim() || '';
            var rating = document.getElementById('overlayContainmentRating')?.value || 'B';
            var acq = document.getElementById('overlayContainmentAcquisition')?.value || '捕捉';
            // 直接调用新增逻辑（不依赖隐藏按钮）
            performAddContainment(name, rating, acq);
            // 清空表单输入并收起
            var nEl = document.getElementById('overlayContainmentName'); if (nEl) nEl.value = '';
            var rEl = document.getElementById('overlayContainmentRating'); if (rEl) rEl.value = 'B';
            var aEl = document.getElementById('overlayContainmentAcquisition'); if (aEl) aEl.value = '捕捉';
            hideAllOverlays();
        } catch(_){}
    });

    var submitSkillOverlay = document.getElementById('submitSkillOverlay');
    if (submitSkillOverlay) submitSkillOverlay.addEventListener('click', function(){
        try {
            var name = document.getElementById('overlaySkillName')?.value?.trim() || '';
            var effect = document.getElementById('overlaySkillEffect')?.value?.trim() || '';
            var quality = document.getElementById('overlaySkillQuality')?.value || '蓝色';
            var cooldownRaw = document.getElementById('overlaySkillCooldown')?.value || '';
            var cooldown = cooldownRaw !== '' ? Number(cooldownRaw) : 0;
            // 直接调用新增逻辑（不依赖隐藏按钮）
            performAddSkill(name, quality, cooldown, effect);
            // 清空表单输入并收起
            var nEl = document.getElementById('overlaySkillName'); if (nEl) nEl.value = '';
            var eEl = document.getElementById('overlaySkillEffect'); if (eEl) eEl.value = '';
            var qEl = document.getElementById('overlaySkillQuality'); if (qEl) qEl.value = '蓝色';
            var cEl = document.getElementById('overlaySkillCooldown'); if (cEl) cEl.value = '';
            hideAllOverlays();
        } catch(_){}
    });

    var submitLinkOverlay = document.getElementById('submitLinkOverlay');
    if (submitLinkOverlay) submitLinkOverlay.addEventListener('click', function(){
        try {
            var coSel = document.getElementById('overlayLinkContainmentSelect');
            var skSel = document.getElementById('overlayLinkSkillSelect');
            var coId = coSel ? coSel.value : '';
            var skId = skSel ? skSel.value : '';
            // 直接调用建立关联逻辑（不依赖隐藏按钮）
            performLink(coId, skId);
            hideAllOverlays();
        } catch(_){}
    });

    // 点击非面板区域时自动收起（适配移动到导航栏后的结构）
    document.addEventListener('click', function (e) {
        try {
            // 数据管理面板点击外收起
            if (dmPanel) {
                var isPanelOpen = dmPanel.style.display && dmPanel.style.display !== 'none';
                if (isPanelOpen) {
                    var mgr = document.querySelector('.nav-extras') || dmPanel.parentElement;
                    if (!(mgr && mgr.contains(e.target))) {
                        dmPanel.style.display = 'none';
                    }
                }
            }
            // 搜索建议点击外收起
            var sugg = document.getElementById('searchSuggestions');
            var input = document.getElementById('topSearchInput') || document.getElementById('searchInput');
            if (sugg && sugg.style.display && sugg.style.display !== 'none') {
                var host = input && input.parentElement ? input.parentElement : null;
                if (!(sugg.contains(e.target) || (host && host.contains(e.target)))) {
                    sugg.style.display = 'none';
                }
            }
        } catch (_) {}
    });
}

// 应用布局
function applyLayout(layoutName = null) {
    let layout;
    const mode = layoutName || layoutMode || (isBipartiteLayout ? 'bipartite' : 'cose');

    if (mode === 'bipartite') {
        layout = createBipartiteLayout();
    } else {
        layout = {
            name: mode,
            animate: true,
            animationDuration: 500,
            fit: true,
            padding: 50
        };
    }

    cy.layout(layout).run();
    setTimeout(() => cy.fit(), 100); // 确保布局应用后适配视图

    // 同步并持久化当前布局模式
    isBipartiteLayout = (mode === 'bipartite');
    layoutMode = mode;
    persistUIState();
}

// 创建双部图布局
function createBipartiteLayout() {
    // 将收容物放在左侧，技能放在右侧
    const containmentNodes = cy.nodes('[type = "containment"]');
    const skillNodes = cy.nodes('[type = "skill"]');

    // 计算左右两侧的节点数
    const containmentCount = containmentNodes.length;
    const skillCount = skillNodes.length;

    // 设置收容物节点位置（左侧）
    containmentNodes.forEach((node, i) => {
        const y = (i - (containmentCount - 1) / 2) * 100;
        node.position({ x: -300, y: y });
    });

    // 设置技能节点位置（右侧）
    skillNodes.forEach((node, i) => {
        const y = (i - (skillCount - 1) / 2) * 100;
        node.position({ x: 300, y: y });
    });

    // 返回一个简单的布局配置
    return {
        name: 'preset',
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 50
    };
}

// 处理节点点击
function handleNodeClick(node) {
    // 清除之前的高亮
    cy.elements().removeClass('highlighted');
    
    // 高亮当前节点及相邻节点
    node.addClass('highlighted');
    node.neighborhood().addClass('highlighted');
    
    // 显示节点详情
    showNodeDetails(node);
    
    // 更新统计信息
    updateStats();
}

// 显示节点详情
function showNodeDetails(node) {
    const data = node.data();
    const detailsElement = document.getElementById('nodeDetails');
    const sidebarEl = document.getElementById('sidebar');
    if (!detailsElement || !sidebarEl) return;

    let detailsHtml = '';
    const headerEl = sidebarEl.querySelector('h3');
    if (headerEl) headerEl.textContent = (data.type === 'containment') ? '收容物详情' : '技能详情';
    
    if (data.type === 'containment') {
        detailsHtml += `
            <div class="detail-actions" style="margin-bottom:8px; display:flex; gap:8px;">
              <button class="normal-btn" data-action="edit" data-type="containment" data-id="${data.id}">修改</button>
              <button class="highlight-btn" data-action="delete" data-type="containment" data-id="${data.id}">删除</button>
            </div>
            <p><strong>名称:</strong> ${data.label}</p>
            <p><strong>评级:</strong> ${data.rating || 'B'}</p>
            <p><strong>获取方式:</strong> ${data.acquisition || '捕捉'}</p>
            <p><strong>技能数:</strong> ${Array.isArray(data.skills) ? data.skills.length : 0}</p>
            <p><strong>技能列表:</strong></p>
            <ul>
        `;
        (data.skills || []).forEach(skillId => {
            const skill = currentData.skills.find(s => s.id === skillId);
            if (skill) {
                detailsHtml += `<li>${skill.name} <button class="highlight-btn" data-action="unlink" data-co="${data.id}" data-sk="${skill.id}" style="margin-left:6px; padding:2px 6px;">删除关联</button></li>`;
            }
        });
        detailsHtml += `</ul>`;
    } else if (data.type === 'skill') {
        detailsHtml += `
            <div class="detail-actions" style="margin-bottom:8px; display:flex; gap:8px;">
              <button class="normal-btn" data-action="edit" data-type="skill" data-id="${data.id}">修改</button>
              <button class="highlight-btn" data-action="delete" data-type="skill" data-id="${data.id}">删除</button>
            </div>
            <p><strong>名称:</strong> ${data.label}</p>
            <p><strong>品质:</strong> ${data.quality || '蓝色'}</p>
            <p><strong>冷却时间:</strong> ${Number.isFinite(data.cooldown) ? data.cooldown : 0} 秒</p>
        `;
        
        const containmentWithSkill = currentData.containmentObjects.filter(co => co.skills.includes(data.id));
        detailsHtml += `<p><strong>拥有该技能的收容物:</strong></p>`;
        if (containmentWithSkill.length > 0) {
            detailsHtml += `<ul>`;
            containmentWithSkill.forEach(co => { detailsHtml += `<li>${co.name} <button class="highlight-btn" data-action="unlink" data-co="${co.id}" data-sk="${data.id}" style="margin-left:6px; padding:2px 6px;">删除关联</button></li>`; });
            detailsHtml += `</ul>`;
        } else {
            detailsHtml += `<p>暂无</p>`;
        }
    }
    
    if (data.type === 'skill') {
        // 技能详情已在上方按顺序渲染（名称/品质/冷却时间/拥有者）
    }
    detailsElement.innerHTML = detailsHtml;
    
    sidebarEl.classList.add('active');
    sidebarEl.style.transform = 'translateX(0)';
    sidebarEl.style.display = 'block';
}

/** ====== 编辑/删除/解除关联 工具函数 ====== */

function recomputeDegreesAndSync(){
    try {
        // 重新统计 degreeCounts 并同步到 skill 节点 data('degree')
        degreeCounts = {};
        (currentData.skills || []).forEach(function(sk){ degreeCounts[sk.id] = 0; });
        (currentData.containmentObjects || []).forEach(function(co){
            (co.skills || []).forEach(function(sid){
                if (Object.prototype.hasOwnProperty.call(degreeCounts, sid)){
                    degreeCounts[sid] += 1;
                }
            });
        });
        cy.nodes('[type = "skill"]').forEach(function(n){
            var id = n.data('id');
            var deg = degreeCounts[id] || 0;
            n.data('degree', deg);
        });
    } catch(e){}
}

function enterEditContainment(id){
    try {
        var co = (currentData.containmentObjects || []).find(function(c){ return c.id === id; });
        if (!co) { showToast('未找到收容物'); return; }
        var box = document.getElementById('nodeDetails'); if (!box) return;
        box.innerHTML = [
          '<div class="edit-form">',
          '  <h4 style="margin-bottom:8px;">编辑收容物</h4>',
          '  <label>名称</label><input id="editCoName" type="text" value="'+ (co.name||'') +'" style="width:100%; margin-bottom:6px;">',
          '  <div style="display:flex; gap:8px; margin-bottom:6px;">',
          '    <div style="flex:1;"><label>评级</label>',
          '      <select id="editCoRating" style="width:100%;">',
          '        <option value="B" ' + (((co.rating||'B')==='B')?'selected':'') + '>B</option>',
          '        <option value="A" ' + ((co.rating==='A')?'selected':'') + '>A</option>',
          '        <option value="S" ' + ((co.rating==='S')?'selected':'') + '>S</option>',
          '      </select>',
          '    </div>',
          '    <div style="flex:1;"><label>获取方式</label>',
          '      <select id="editCoAcq" style="width:100%;">',
          '        <option value="捕捉" ' + (((co.acquisition||'捕捉')==='捕捉')?'selected':'') + '>捕捉</option>',
          '        <option value="融合" ' + ((co.acquisition==='融合')?'selected':'') + '>融合</option>',
          '      </select>',
          '    </div>',
          '  </div>',
          '  <div style="display:flex; gap:8px;">',
          '    <button class="normal-btn" data-action="save-edit-co" data-id="'+ id +'">保存</button>',
          '    <button class="highlight-btn" data-action="cancel-edit" data-id="'+ id +'">取消</button>',
          '  </div>',
          '</div>'
        ].join('');
    } catch(e){}
}

function performUpdateContainment(id, changes){
    try {
        var co = (currentData.containmentObjects || []).find(function(c){ return c.id === id; });
        if (!co) { showToast('未找到收容物'); return; }
        if (changes.name) co.name = changes.name;
        if (changes.rating) co.rating = changes.rating;
        if (changes.acquisition) co.acquisition = changes.acquisition;
        var node = cy.getElementById(id);
        if (node && !node.empty()){
            if (changes.name) node.data('label', changes.name);
            if (changes.rating) node.data('rating', changes.rating);
            if (changes.acquisition) node.data('acquisition', changes.acquisition);
        }
        recomputeDegreesAndSync();
        updateStats();
        if (typeof refreshLinkSelects === 'function') refreshLinkSelects();
        if (node && !node.empty()) showNodeDetails(node);
        showToast('收容物已更新');
    } catch(e){ showToast('更新失败'); }
}

function performDeleteContainment(id){
    try {
        if (!confirm('确认删除该收容物及其关联关系？')) return;
        var idx = (currentData.containmentObjects || []).findIndex(function(c){ return c.id === id; });
        if (idx >= 0){
            currentData.containmentObjects.splice(idx, 1);
        }
        // 删除图中的节点与相关边
        try {
            var node = cy.getElementById(id);
            if (node && !node.empty()) cy.remove(node);
        } catch(e){}
        recomputeDegreesAndSync();
        updateStats();
        if (typeof refreshLinkSelects === 'function') refreshLinkSelects();
        // 关闭侧栏
        var sidebarEl = document.getElementById('sidebar');
        if (sidebarEl){ sidebarEl.classList.remove('active'); sidebarEl.style.transform = 'translateX(100%)'; sidebarEl.style.display='none'; }
        showToast('已删除收容物');
    } catch(e){ showToast('删除失败'); }
}

function enterEditSkill(id){
    try {
        var sk = (currentData.skills || []).find(function(s){ return s.id === id; });
        if (!sk) { showToast('未找到技能'); return; }
        var box = document.getElementById('nodeDetails'); if (!box) return;
        box.innerHTML = [
          '<div class="edit-form">',
          '  <h4 style="margin-bottom:8px;">编辑技能</h4>',
          '  <label>名称</label><input id="editSkName" type="text" value="'+ (sk.name||'') +'" style="width:100%; margin-bottom:6px;">',
          '  <label>技能效果</label><input id="editSkEffect" type="text" value="'+ (sk.effect||'') +'" style="width:100%; margin-bottom:6px;">',
          '  <div style="display:flex; gap:8px; margin-bottom:6px;">',
          '    <div style="flex:1;"><label>品质</label>',
          '      <select id="editSkQuality" style="width:100%;">',
          '        <option value="蓝色" ' + (((sk.quality||'蓝色')==='蓝色')?'selected':'') + '>蓝色</option>',
          '        <option value="紫色" ' + ((sk.quality==='紫色')?'selected':'') + '>紫色</option>',
          '      </select>',
          '    </div>',
          '    <div style="flex:1;"><label>冷却(秒)</label><input id="editSkCooldown" type="number" min="0" max="86400" value="'+ (Number.isFinite(sk.cooldown)?sk.cooldown:0) +'" style="width:100%;"></div>',
          '  </div>',
          '  <div style="display:flex; gap:8px;">',
          '    <button class="normal-btn" data-action="save-edit-sk" data-id="'+ id +'">保存</button>',
          '    <button class="highlight-btn" data-action="cancel-edit" data-id="'+ id +'">取消</button>',
          '  </div>',
          '</div>'
        ].join('');
    } catch(e){}
}

function performUpdateSkill(id, changes){
    try {
        var sk = (currentData.skills || []).find(function(s){ return s.id === id; });
        if (!sk) { showToast('未找到技能'); return; }
        if (changes.name != null) sk.name = changes.name;
        if (changes.effect != null) sk.effect = changes.effect;
        if (changes.quality != null) sk.quality = changes.quality;
        if (Number.isFinite(changes.cooldown)) sk.cooldown = changes.cooldown;
        var node = cy.getElementById(id);
        if (node && !node.empty()){
            if (changes.name != null) node.data('label', changes.name);
            if (changes.effect != null) node.data('effect', changes.effect);
            if (changes.quality != null) node.data('quality', changes.quality);
            if (Number.isFinite(changes.cooldown)) node.data('cooldown', changes.cooldown);
            // 颜色映射
            var color = (node.data('quality') === '蓝色') ? '#2196F3' : ((node.data('quality') === '紫色') ? '#9C27B0' : '#9E9E9E');
            node.data('color', color);
        }
        recomputeDegreesAndSync();
        updateStats();
        if (typeof refreshLinkSelects === 'function') refreshLinkSelects();
        if (node && !node.empty()) showNodeDetails(node);
        showToast('技能已更新');
    } catch(e){ showToast('更新失败'); }
}

function performDeleteSkill(id){
    try {
        if (!confirm('确认删除该技能及其关联关系？')) return;
        // 从所有收容物中移除该技能引用
        (currentData.containmentObjects || []).forEach(function(co){
            if (Array.isArray(co.skills)) {
                co.skills = co.skills.filter(function(sid){ return sid !== id; });
            }
        });
        // 从技能列表删除
        var idx = (currentData.skills || []).findIndex(function(s){ return s.id === id; });
        if (idx >= 0){ currentData.skills.splice(idx, 1); }
        // 图中删除节点与相关边
        try {
            var node = cy.getElementById(id);
            if (node && !node.empty()) cy.remove(node);
        } catch(e){}
        recomputeDegreesAndSync();
        updateStats();
        if (typeof refreshLinkSelects === 'function') refreshLinkSelects();
        var sidebarEl = document.getElementById('sidebar');
        if (sidebarEl){ sidebarEl.classList.remove('active'); sidebarEl.style.transform = 'translateX(100%)'; sidebarEl.style.display='none'; }
        showToast('已删除技能');
    } catch(e){ showToast('删除失败'); }
}

function performUnlink(coId, skId){
    try {
        // 数据模型解除
        var co = (currentData.containmentObjects || []).find(function(c){ return c.id === coId; });
        if (!co || !Array.isArray(co.skills)) { showToast('未找到要解除的关联'); return; }
        co.skills = co.skills.filter(function(sid){ return sid !== skId; });
        // 图中删除边（不依赖边id，而是匹配source/target）
        try {
            cy.edges().filter(function(e){
                return e.data('source') === coId && e.data('target') === skId;
            }).remove();
        } catch(e){}
        recomputeDegreesAndSync();
        updateStats();
        if (typeof refreshLinkSelects === 'function') refreshLinkSelects();
        // 若仍在详情面板，刷新其内容
        var n = cy.getElementById(coId);
        if (n && !n.empty()) showNodeDetails(n);
        showToast('已删除关联关系');
    } catch(e){ showToast('操作失败'); }
}

 // 显示工具提示
function showTooltip(event, node) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    const data = node.data();
    
    let tooltipContent = `<strong>${data.label}</strong><br>`;
    
    if (data.type === 'containment') {
        tooltipContent += `类型: 收容物<br>评级: ${data.rating || 'B'}<br>获取方式: ${data.acquisition || '捕捉'}<br>技能数: ${Array.isArray(data.skills) ? data.skills.length : 0}`;
    } else if (data.type === 'skill') {
        tooltipContent += `类型: 技能<br>品质: ${data.quality || '蓝色'}<br>冷却: ${Number.isFinite(data.cooldown) ? data.cooldown : 0} 秒<br>被引用: ${data.degree} 次`;
    }
    tooltip.innerHTML = tooltipContent;
    tooltip.style.display = 'block';
    const container = document.querySelector('.graph-container');
    const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    tooltip.style.left = (event.clientX - rect.left + 10) + 'px';
    tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
}

// 隐藏工具提示
function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

// 搜索建议下拉与定位
function locateNodeById(id){
    try {
        const node = cy.getElementById(id);
        if (!node || node.empty()) { showToast('未找到节点'); return; }
        cy.elements().removeClass('highlighted');
        node.addClass('highlighted');
        try { cy.fit(node, 80); cy.center(node); } catch(e){}
        showNodeDetails(node);
        hideTooltip();
        const box = document.getElementById('searchSuggestions');
        if (box){ box.style.display = 'none'; box.innerHTML = ''; }
    } catch(e){}
}
function updateSearchSuggestions(){
    const box = document.getElementById('searchSuggestions');
    const inputEl = document.getElementById('topSearchInput') || document.getElementById('searchInput');
    if (!box || !inputEl) return;
    const q = (inputEl.value || '').trim().toLowerCase();
    if (!q){
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    try {
        const matches = cy.nodes().filter(n => ((n.data('label')||'').toLowerCase().includes(q)));
        const containments = [];
        const skills = [];
        matches.forEach(n => {
            var t = n.data('type');
            if (t === 'containment') containments.push(n);
            else if (t === 'skill') skills.push(n);
        });
        let html = '';
        function section(title, arr){
            if (!arr.length) return;
            html += '<div style="padding:6px 8px; font-weight:600; color:#666;">' + title + '</div>';
            arr.slice(0, 20).forEach(n => {
                const id = n.data('id');
                const label = n.data('label');
                html += '<div class="suggest-item" data-id="' + id + '" style="padding:6px 8px; cursor:pointer;">' + label + '</div>';
            });
        }
        section('收容物', containments);
        section('技能', skills);
        if (!html){
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        box.innerHTML = html;
        box.style.display = 'block';
        if (!box.dataset.bound){
            box.addEventListener('click', function(e){
                const item = e.target.closest('.suggest-item');
                if (item && item.dataset.id){ locateNodeById(item.dataset.id); }
            });
            box.dataset.bound = '1';
        }
    } catch(e){
        box.style.display = 'none';
        box.innerHTML = '';
    }
}
// 顶部/侧边输入触发建议更新
function handleSearch(){
    updateSearchSuggestions();
}

// 处理筛选（仅按类型）
function handleFilter() {
    const typeEl = document.getElementById('typeFilter') || document.getElementById('topTypeFilter');
    const typeFilter = typeEl ? typeEl.value : '';
    cy.elements().show();
    cy.nodes().forEach(function(node){
        const data = node.data();
        let showNode = true;
        if (typeFilter && data.type !== typeFilter) { showNode = false; }
        if (!showNode) {
            node.hide();
            node.connectedEdges().hide();
        }
    });
}

// 高亮重合技能

// 高亮热门技能

// 切换相似度线

// 计算Jaccard相似度


 // 更新统计信息（移除“平均度数”计算与展示）
function updateStats() {
    const containmentCount = cy.nodes('[type = "containment"]').length;
    const skillCount = cy.nodes('[type = "skill"]').length;
    const edgeCount = cy.edges().length;

    // 仅计算最大度数
    let maxDegree = 0;
    cy.nodes('[type = "skill"]').forEach(node => {
        const degree = node.connectedEdges().length;
        if (degree > maxDegree) maxDegree = degree;
    });

        // 更新统计面板（已移除“平均度数”）
    const cEl = document.getElementById('containmentCount');
    if (cEl) cEl.textContent = containmentCount;
    const sEl = document.getElementById('skillCount');
    if (sEl) sEl.textContent = skillCount;
    const eEl = document.getElementById('edgeCount');
    if (eEl) eEl.textContent = edgeCount;
    const mEl = document.getElementById('maxDegree');
    if (mEl) mEl.textContent = maxDegree;
}

// 切换主题
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('dark-theme', isDarkTheme);
    const themeBtn = document.getElementById('themeToggleBtn');
    themeBtn.textContent = isDarkTheme ? '切换亮色主题' : '切换暗色主题';
    cy.style()
        .selector('core')
        .style({ 'background-color': isDarkTheme ? '#1a1a1a' : '#ffffff' })
        .update();
    persistUIState();
}

function persistUIState() {
    try {
        const state = {
            dark: isDarkTheme,
            bipartite: isBipartiteLayout,
            layoutMode: layoutMode
        };
        localStorage.setItem('vizState', JSON.stringify(state));
    } catch (e) {}
}

function restoreUIState() {
    try {
        const raw = localStorage.getItem('vizState');
        if (!raw) return;
        const s = JSON.parse(raw);

        // 主题恢复与按钮文案同步
        isDarkTheme = !!s.dark;
        document.body.classList.toggle('dark-theme', isDarkTheme);
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) themeBtn.textContent = isDarkTheme ? '切换亮色主题' : '切换暗色主题';

        // 布局模式恢复（优先 layoutMode，其次 bipartite 布尔）
        layoutMode = s.layoutMode || (s.bipartite ? 'bipartite' : 'cose');
        isBipartiteLayout = (layoutMode === 'bipartite');

        if (cy) {
            cy.elements().style('text-opacity', 1);
            cy.edges().style('label', '');
            // 应用持久化布局（双部图传 null，使用预设）
            try { applyLayout(layoutMode === 'bipartite' ? null : layoutMode); } catch(_) {}
        }
    } catch (e) {}
}

// 刷新“关联：选择收容物/技能”下拉选项
function refreshLinkSelects() {
    try {
        const coSel = document.getElementById('linkContainmentSelect');
        const skSel = document.getElementById('linkSkillSelect');
        if (!coSel || !skSel) return;

        const prevCo = coSel.value;
        const prevSk = skSel.value;

        // 重建收容物下拉
        coSel.innerHTML = '<option value="">请选择收容物</option>';
        (currentData?.containmentObjects || []).forEach(co => {
            const opt = document.createElement('option');
            opt.value = co.id;
            opt.textContent = co.name;
            coSel.appendChild(opt);
        });

        // 重建技能下拉
        skSel.innerHTML = '<option value="">请选择技能</option>';
        (currentData?.skills || []).forEach(sk => {
            const opt = document.createElement('option');
            opt.value = sk.id;
            opt.textContent = sk.name;
            skSel.appendChild(opt);
        });

        // 恢复先前选择（若依然存在）
        if ([...coSel.options].some(o => o.value === prevCo)) coSel.value = prevCo;
        if ([...skSel.options].some(o => o.value === prevSk)) skSel.value = prevSk;

        // 当无可选项时禁用选择器
        coSel.disabled = coSel.options.length <= 1;
        skSel.disabled = skSel.options.length <= 1;
    } catch (e) {}
}

 // 撤销清空横幅（30秒有效）
function showUndoBanner(){
    try {
        var existing = document.getElementById('undoBanner');
        if (existing) existing.remove();
        var banner = document.createElement('div');
        banner.id = 'undoBanner';
        banner.className = 'undo-banner';
        banner.style.position = 'fixed';
        banner.style.bottom = '20px';
        banner.style.right = '20px';
        banner.style.zIndex = '150';
        banner.style.background = 'rgba(255,255,255,0.95)';
        banner.style.border = '1px solid #ddd';
        banner.style.padding = '10px 14px';
        banner.style.borderRadius = '6px';
        banner.innerHTML = '已清空数据 <button id="undoClearBtn">撤销</button>';
        document.body.appendChild(banner);
        var btn = document.getElementById('undoClearBtn');
        if (btn) btn.addEventListener('click', function(){
            try {
                var Store = window.Modules && window.Modules.Store;
                if (!Store) { showToast('撤销不可用'); return; }
                var r = Store.loadSnapshot();
                if (r && r.ok && r.envelope) {
                    processAndValidateData(r.envelope);
                    Store.clearSnapshot();
                    showToast('已恢复清空前的数据');
                } else {
                    showToast('撤销失败：' + (r && r.reason ? r.reason : '无快照'));
                }
            } catch(e){ showToast('撤销失败'); }
            try { banner.remove(); } catch(e){}
        });
        setTimeout(function(){ try{ banner.remove(); }catch(e){} }, 30000);
    } catch(e){}
}

// 公共API函数 - 允许外部动态替换数据
window.loadData = loadData;
// 信息弹窗：在 DOMContentLoaded 之后绑定打开/关闭
document.addEventListener('DOMContentLoaded', function() {
  var infoBtn = document.getElementById('infoBtn');
  var modal = document.getElementById('infoModal');
  var closeBtn = document.getElementById('infoModalClose');

  if (infoBtn && modal) {
    infoBtn.addEventListener('click', function() {
      modal.style.display = 'flex'; // overlay 采用 flex 居中
    });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }
  // 点击遮罩空白处关闭
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
});
// 顶部：布局切换下拉与搜索平展的事件绑定（独立于侧边控制面板）
document.addEventListener('DOMContentLoaded', function() {
  // 布局切换菜单开合
  var layoutBtn = document.getElementById('layoutMenuBtn');
  var layoutMenu = document.getElementById('layoutMenu');
  if (layoutBtn && layoutMenu) {
    layoutBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var open = layoutMenu.style.display && layoutMenu.style.display !== 'none';
      layoutMenu.style.display = open ? 'none' : 'block';
    });
    document.addEventListener('click', function(e) {
      try {
        var open = layoutMenu.style.display && layoutMenu.style.display !== 'none';
        if (open && !layoutMenu.contains(e.target) && e.target !== layoutBtn) {
          layoutMenu.style.display = 'none';
        }
      } catch(_) {}
    });
  }
  function closeLayoutMenu(){ if (layoutMenu) layoutMenu.style.display = 'none'; }

  // 顶部布局按钮（不与侧边栏 ID 冲突）
  var tb = document.getElementById('topBipartiteLayoutBtn');
  if (tb) tb.addEventListener('click', function() {
    try {
      isBipartiteLayout = true;
      layoutMode = 'bipartite';
      applyLayout();
      persistUIState();
    } catch(_) {}
    closeLayoutMenu();
  });
  var tf = document.getElementById('topForceLayoutBtn');
  if (tf) tf.addEventListener('click', function() {
    try {
      isBipartiteLayout = false;
      layoutMode = 'cose';
      applyLayout('cose');
      persistUIState();
    } catch(_) {}
    closeLayoutMenu();
  });
  var tc = document.getElementById('topCircleLayoutBtn');
  if (tc) tc.addEventListener('click', function() {
    try {
      isBipartiteLayout = false;
      layoutMode = 'circle';
      applyLayout('circle');
      persistUIState();
    } catch(_) {}
    closeLayoutMenu();
  });
  var tg = document.getElementById('topGridLayoutBtn');
  if (tg) tg.addEventListener('click', function() {
    try {
      isBipartiteLayout = false;
      layoutMode = 'grid';
      applyLayout('grid');
      persistUIState();
    } catch(_) {}
    closeLayoutMenu();
  });

  // 顶部搜索/筛选与侧边隐藏控件镜像，复用既有 handleSearch/handleFilter
  function mirrorAndHandle(srcId, dstId, eventName, handler) {
    var src = document.getElementById(srcId);
    var dst = document.getElementById(dstId);
    if (!src) return;
    src.addEventListener(eventName, function() {
      try { if (dst) dst.value = src.value; } catch(_) {}
      try { if (typeof handler === 'function') handler(); } catch(_) {}
    });
  }
  mirrorAndHandle('topSearchInput', 'searchInput', 'input', handleSearch);
  mirrorAndHandle('topTypeFilter', 'typeFilter', 'change', handleFilter);

  // 初始值同步：侧边（隐藏）-> 顶部平展
  try {
    var pairs = [
      ['searchInput','topSearchInput'],
      ['typeFilter','topTypeFilter']
    ];
    pairs.forEach(function(p){
      var src = document.getElementById(p[0]);
      var dst = document.getElementById(p[1]);
      if (src && dst && (dst.value === '' || dst.value == null)) {
        dst.value = src.value || '';
      }
    });
  } catch(_) {}
});