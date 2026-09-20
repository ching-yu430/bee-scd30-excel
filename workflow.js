workspaceStage = 3;
workspacePage = 'data';

// Shared canonical timestamps remain compatible with calculation, queries and saved settings.
function wholeDayBounds(start, end) {
  const a = new Date(start + 'T00:00:00'), b = new Date(end + 'T00:00:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(+a) || !Number.isFinite(+b) || a > b) throw Error('請選擇有效且依序的日期');
  b.setDate(b.getDate() + 1);
  return {start: local(a), end: local(new Date(+b - 1)) + '.999'};
}

// Ensure elements hide first safely
const heroEl = document.querySelector('.hero');
if (heroEl) heroEl.hidden = true;
if (typeof guide !== 'undefined' && guide) guide.hidden = true;
if (typeof formatStatus !== 'undefined' && formatStatus) formatStatus.hidden = true;
if ($('emptyPlot')) $('emptyPlot').hidden = true;

// Tab Setup
const dataTab = document.createElement('button');
dataTab.id = 'dataTab';
dataTab.textContent = '📂資料';
dataTab.setAttribute('role', 'tab');
tabs.insertBefore(dataTab, tabs.firstChild);

const anomalyTab = document.createElement('button');
anomalyTab.id = 'anomalyTab';
anomalyTab.textContent = '異常檢查';
anomalyTab.setAttribute('role', 'tab');
tabs.appendChild(anomalyTab);

// Page creation
const dataPage = document.createElement('section');
dataPage.id = 'dataPage';
sourcePanel.before(dataPage);
dataPage.appendChild(sourcePanel);

const anomalyPage = document.createElement('section');
anomalyPage.id = 'anomalyPage';
anomalyPage.hidden = true;
anomalyPage.setAttribute('role', 'tabpanel');
queryPage.after(anomalyPage);
anomalyPage.appendChild(anomalyPanel);

const workspaceStatus = document.createElement('p');
workspaceStatus.id = 'workflowStatus';
workspaceStatus.setAttribute('role', 'status');
tabs.after(workspaceStatus);

// 1. Create a sticky control bar at the top of plotPage
const controlBar = document.createElement('div');
controlBar.className = 'control-bar';

controlBar.innerHTML = `
  <div class="control-row">
    <div class="period-controls">
      <label>日期<select id="periodMode"><option value="days">整日</option><option value="exact">精確</option></select></label>
      <label id="dayStartLabel"><input id="dayStart" type="date"></label>
      <label id="dayEndLabel">至 <input id="dayEnd" type="date"></label>
      <button id="singleDay" type="button" class="secondary" title="只看開始這一天">單日</button>
      <button id="period7" type="button" class="secondary">7天</button>
      <button id="period30" type="button" class="secondary">30天</button>
      <button id="periodAll" type="button" class="secondary">全部</button>
      <div id="precisePeriod" class="precise-period"></div>
    </div>
    
    <div class="actions-row">
      <div class="aggregation-controls" id="aggContainer"></div>
      <button id="toggleFilterPanel" class="secondary">篩選 ▾</button>
      <button id="toggleStylePanel" class="secondary">外觀 ▾</button>
      <button id="renderChartsBtn" class="primary">更新圖表</button>
      
      <div class="download-dropdown-container">
        <button id="downloadMenuBtn" class="secondary">📥 下載 ▾</button>
        <div id="downloadDropdown" class="download-dropdown" hidden>
          <button id="dlPng">下載全部圖表 PNG</button>
          <button id="dlZip">下載 Excel + 圖表 (zip)</button>
          <button id="dlJson">儲存分析設定 JSON</button>
          <label class="file-upload-btn">載入分析設定 <input type="file" id="loadSettingsMenu" accept=".json"></label>
        </div>
      </div>
    </div>
  </div>
  <div id="expandFilterPanel" class="expand-panel" hidden></div>
  <div id="expandStylePanel" class="expand-panel" hidden></div>
`;
plotPage.prepend(controlBar);

// Move controls into control bar
settingIds.push('periodMode');
let periodSnapshot = '';
const preciseLabels = ['startDate', 'endDate'].map(id => $(id).closest('label'));
for (const id of ['startDate', 'endDate']) $(id).step = '1';
const precisePeriod = controlBar.querySelector('#precisePeriod');
for (const el of preciseLabels) precisePeriod.appendChild(el);

const expandFilterPanel = controlBar.querySelector('#expandFilterPanel');
const expandStylePanel = controlBar.querySelector('#expandStylePanel');

// Move existing components to expandable panels
expandFilterPanel.appendChild(controlsCard);
controlsCard.hidden = false;
controlsCard.querySelector('h2')?.remove();

// Move aggregation and chartMode to the bar
const aggContainer = controlBar.querySelector('#aggContainer');
const aggLabel = $('aggregation')?.closest('label');
const chartModeLabel = $('chartMode')?.closest('label');
if(aggLabel) aggContainer.appendChild(aggLabel);
if(chartModeLabel) aggContainer.appendChild(chartModeLabel);

expandStylePanel.appendChild(editFold);
editFold.open = true;
const editSummary = editFold.querySelector(':scope > summary');
if (editSummary) editSummary.hidden = true;

// Create dummy styleButton for panel-polish.js
const styleButton = document.createElement('button');
styleButton.id = 'openStyle';
styleButton.hidden = true;
document.body.appendChild(styleButton);

function toggleStyle() {
  expandStylePanel.hidden = true;
}

$('toggleFilterPanel').onclick = () => {
  const isHidden = expandFilterPanel.hidden;
  expandFilterPanel.hidden = !isHidden;
  expandStylePanel.hidden = true;
};
$('toggleStylePanel').onclick = () => {
  const isHidden = expandStylePanel.hidden;
  expandStylePanel.hidden = !isHidden;
  expandFilterPanel.hidden = true;
};

// Download Dropdown
$('downloadMenuBtn').onclick = (e) => {
  e.stopPropagation();
  $('downloadDropdown').hidden = !$('downloadDropdown').hidden;
};
document.addEventListener('click', () => {
  if($('downloadDropdown')) $('downloadDropdown').hidden = true;
});

$('dlPng').onclick = () => { if(typeof ensureCurrent==='function' && ensureCurrent()) exportCharts(state.co2Chart?[state.co2Chart]:state.charts); };
$('dlZip').onclick = () => { if(typeof downloadExcelZip==='function') downloadExcelZip(); };
$('dlJson').onclick = () => $('saveSettings')?.click();
$('loadSettingsMenu').onchange = (e) => {
  if($('loadSettings')) {
    $('loadSettings').files = e.target.files;
    $('loadSettings').dispatchEvent(new Event('change'));
  }
};

// Chart picker
const chartPickerLabel = document.createElement('label');
chartPickerLabel.className = 'chart-picker';
chartPickerLabel.textContent = '目前查看';
const chartPicker = document.createElement('select');
chartPicker.id = 'chartPicker';
chartPickerLabel.appendChild(chartPicker);
const chartHeadingEl = document.querySelector('.chart-heading');
if (chartHeadingEl) {
  chartHeadingEl.after(chartPickerLabel);
} else {
  (document.getElementById('chartCard') || plotPage || document.body).appendChild(chartPickerLabel);
}

function arrangeChartFooters() {
  for (const card of document.querySelectorAll('#charts > .chart-card, #co2DailyCard')) {
    const frame = card.querySelector('.canvas-frame');
    let plot = frame;
    if (frame) {
      if (!frame.parentElement.classList.contains('chart-scroll')) {
        const scroll = document.createElement('div');
        scroll.className = 'chart-scroll';
        scroll.tabIndex = 0;
        scroll.setAttribute('role', 'region');
        scroll.setAttribute('aria-label', '圖表區，可左右捲動');
        frame.before(scroll);
        scroll.appendChild(frame);
      }
      plot = frame.parentElement;
    }
    const legend = card.querySelector('.line-legend'), controls = card.querySelector('.chart-controls');
    if (!legend && !controls) continue;
    let row = card.querySelector('.chart-footer-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'chart-footer-row';
    }
    plot?.after(row);
    if (legend) row.appendChild(legend);
    if (controls) row.appendChild(controls);
  }
  if($('backToAnomalies')) $('backToAnomalies').hidden = typeof anomalyActive !== 'undefined' ? !anomalyActive : true;
}

const pickerBeforeCompact = typeof syncChartPicker === 'function' ? syncChartPicker : function(){};
syncChartPicker = function() {
  const all = [...document.querySelectorAll('#charts > .chart-card'), ...(!$('co2DailyCard').classList.contains('hidden') ? [$('co2DailyCard')] : [])];
  const previous = chartPicker.value;
  chartPicker.replaceChildren();
  all.forEach((card, i) => {
    const op = document.createElement('option');
    op.value = String(i);
    op.textContent = card.querySelector('h3')?.textContent || '圖表 ' + (i + 1);
    chartPicker.appendChild(op);
  });
  chartPicker.value = previous !== '' && all[Number(previous)] ? previous : '0';
  all.forEach((card, i) => card.hidden = String(i) !== chartPicker.value);
  chartPickerLabel.hidden = all.length < 2;
  requestAnimationFrame(() => [...state.charts, ...(state.co2Chart ? [state.co2Chart] : [])].forEach(c => c.resize()));
  arrangeChartFooters();
};
chartPicker.onchange = () => syncChartPicker();

const beforeDrawWorkflow = draw;
draw = function() {
  beforeDrawWorkflow();
  syncChartPicker();
};

// Period Logic
function syncPeriodUI() {
  const days = value('periodMode') === 'days';
  if (!days) {
    let changed = false;
    for (const id of ['startDate', 'endDate']) {
      const next = value(id).replace(/\.\d+$/, '');
      changed = changed || next !== value(id);
      $(id).value = next;
    }
    if (changed) { markDirty(); if(typeof invalidateAnomalies==='function') invalidateAnomalies(); }
  }
  $('dayStartLabel').hidden = !days;
  $('dayEndLabel').hidden = !days;
  $('singleDay').hidden = !days;
  $('period7').hidden = !days;
  $('period30').hidden = !days;
  $('periodAll').hidden = !days;
  preciseLabels.forEach(el => el.hidden = days);
  $('dayStart').value = value('startDate').slice(0, 10);
  $('dayEnd').value = value('endDate').slice(0, 10);
  periodSnapshot = value('startDate') + '|' + value('endDate');
}

function applyDayPeriod() {
  try {
    const p = wholeDayBounds(value('dayStart'), value('dayEnd'));
    $('startDate').value = p.start;
    $('endDate').value = p.end;
    periodSnapshot = value('startDate') + '|' + value('endDate');
    markDirty();
    if(typeof invalidateAnomalies==='function') invalidateAnomalies();
  } catch (e) {
    $('startDate').value = '';
    $('endDate').value = '';
    markDirty();
    $('workflowStatus').textContent = e.message;
  }
}

$('periodMode').onchange = () => {
  if (value('periodMode') === 'days') {
    syncPeriodUI();
    applyDayPeriod();
  }
  syncPeriodUI();
};

$('dayStart').onchange = () => {
  if (!value('dayEnd') || value('dayEnd') < value('dayStart')) $('dayEnd').value = value('dayStart');
  applyDayPeriod();
};
$('dayEnd').onchange = applyDayPeriod;
$('singleDay').onclick = () => { $('dayEnd').value = value('dayStart'); applyDayPeriod(); };

function setPeriodDays(days) {
  const d = [...datesOf(state.hive), ...datesOf(state.weather)].sort((a,b) => a-b);
  if (!d.length) return;
  const end = d.at(-1);
  $('dayEnd').value = local(end).slice(0, 10);
  $('dayStart').value = local(new Date(Math.max(+d[0], +end - days * 86400000))).slice(0, 10);
  applyDayPeriod();
}

$('period7').onclick = () => setPeriodDays(7);
$('period30').onclick = () => setPeriodDays(30);
$('periodAll').onclick = () => {
  const all = [...datesOf(state.hive), ...datesOf(state.weather)].sort((a,b) => a-b);
  if (!all.length) return;
  $('dayStart').value = local(all[0]).slice(0, 10);
  $('dayEnd').value = local(all.at(-1)).slice(0, 10);
  applyDayPeriod();
};

document.querySelectorAll('[data-range]').forEach(button => {
  const before = button.onclick;
  button.onclick = () => {
    before?.();
    syncPeriodUI();
    if (value('periodMode') === 'days') applyDayPeriod();
  };
});

$('renderChartsBtn').onclick = () => {
  try {
    if(typeof validateSettings==='function') validateSettings();
    if (!value('startDate') || !value('endDate')) throw Error('請先選擇有效的開始與結束日期');
    workspaceStatus.textContent = '';
    expandFilterPanel.hidden = true;
    expandStylePanel.hidden = true;
    markDirty();
    render();
  } catch (e) {
    workspaceStatus.textContent = e.message;
  }
};

const baseRenderWorkflow = render;
render = function() {
  if (periodSnapshot !== value('startDate') + '|' + value('endDate')) {
    const whole = /T00:00(?::00)?$/.test(value('startDate')) && value('endDate').endsWith('T23:59:59.999');
    if (!whole) $('periodMode').value = 'exact';
    syncPeriodUI();
  }
  baseRenderWorkflow();
  syncChartPicker();
};

const baseSetupWorkflow = setup;
setup = function() {
  baseSetupWorkflow();
  $('chartCard').classList.remove('hidden');
  $('chartCard').hidden = false;
  syncPeriodUI();
  if (value('periodMode') === 'days') applyDayPeriod();
  sourcePanel.open = true;
  $('sourceTimeHint')?.remove();
  if(state.hive || state.weather) {
    switchPage('plot');
  } else {
    switchPage('data');
  }
};

function syncCompactNavigation() {
  document.body.dataset.workspacePage = workspacePage;
  for (const name of ['data', 'plot', 'query', 'anomaly']) {
    const tab = $(name + 'Tab');
    if(tab) tab.tabIndex = name === workspacePage ? 0 : -1;
  }
}

switchPage = function(name) {
  workspacePage = name;
  dataPage.hidden = name !== 'data';
  plotPage.hidden = name !== 'plot';
  queryPage.hidden = name !== 'query';
  anomalyPage.hidden = name !== 'anomaly';
  
  if(name === 'anomaly') {
    anomalyPanel.hidden = false;
    anomalyPanel.before(controlBar);
    expandFilterPanel.hidden = true;
    expandStylePanel.hidden = true;
  } else if(name === 'plot') {
    plotPage.prepend(controlBar);
  }
  
  for (const item of ['data', 'plot', 'query', 'anomaly']) {
    const t = $(item + 'Tab');
    if(t) t.setAttribute('aria-selected', String(item === name));
  }
  
  workspaceStatus.textContent = (state.hive || state.weather) ? '' : '請先匯入內部或外部資料。';
  window.scrollTo({top: 0, behavior: 'instant'});
  syncCompactNavigation();
};

$('dataTab').onclick = () => switchPage('data');
$('plotTab').onclick = () => switchPage('plot');
$('queryTab').onclick = () => switchPage('query');
if($('anomalyTab')) $('anomalyTab').onclick = () => switchPage('anomaly');

tabs.onkeydown = e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const names = ['data', 'plot', 'query', 'anomaly'];
  const i = names.indexOf(workspacePage);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (i + (e.key === 'ArrowLeft' ? 3 : 1)) % 4;
  switchPage(names[next]);
  $(names[next] + 'Tab')?.focus();
};

// Add anomaly return button inside chart heading
const anomalyReturn = document.createElement('button');
anomalyReturn.className = 'secondary';
anomalyReturn.id = 'backToAnomalies';
anomalyReturn.textContent = '返回異常檢查';
anomalyReturn.onclick = () => switchPage('anomaly');
const actionsWrap = document.querySelector('.chart-heading .actions');
if(actionsWrap) actionsWrap.appendChild(anomalyReturn);

if(typeof focusAnomaly === 'function') {
  const focusBeforeWorkflow = focusAnomaly;
  focusAnomaly = function(e) {
    focusBeforeWorkflow(e);
    $('periodMode').value = 'exact';
    syncPeriodUI();
    switchPage('plot');
    $('renderChartsBtn').click();
  };
}

if($('plotQueryResults')) {
  const plotQueryBeforeWorkflow = $('plotQueryResults').onclick;
  $('plotQueryResults').onclick = () => {
    if(plotQueryBeforeWorkflow) plotQueryBeforeWorkflow();
    if (state.querySubset) {
      $('periodMode').value = 'exact';
      syncPeriodUI();
      switchPage('plot');
      $('renderChartsBtn').click();
    }
  };
}

if($('restoreAnomalyRange')) {
  const restoreBeforeWorkflow = $('restoreAnomalyRange').onclick;
  $('restoreAnomalyRange').onclick = () => {
    if(restoreBeforeWorkflow) restoreBeforeWorkflow();
    syncPeriodUI();
  };
}

if($('loadSettings')) {
  const beforeStyleLoad = $('loadSettings').onchange;
  $('loadSettings').onchange = async e => {
    if(beforeStyleLoad) await beforeStyleLoad(e);
    syncPeriodUI();
  };
}

// Ensure layout setup is clean
document.querySelector('.topbar > div')?.after(tabs);
syncPeriodUI();
switchPage('data');
syncCompactNavigation();
