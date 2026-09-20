// Shared canonical timestamps remain compatible with calculation, queries and saved settings.
function wholeDayBounds(start,end){const a=new Date(start+'T00:00:00'),b=new Date(end+'T00:00:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(+a)||!Number.isFinite(+b)||a>b)throw Error('請選擇有效且依序的日期');b.setDate(b.getDate()+1);return {start:local(a),end:local(new Date(+b-1))+'.999'}}
const periodPanel=document.createElement('section');periodPanel.className='period-panel';periodPanel.innerHTML='<label>日期選擇<select id="periodMode"><option value="days">整日</option><option value="exact">精確時間</option></select></label><label id="dayStartLabel">開始日期<input id="dayStart" type="date"></label><label id="dayEndLabel">結束日期（含當日）<input id="dayEnd" type="date"></label><button id="singleDay" type="button" class="secondary">只看開始這一天</button>';
const preciseLabels=['startDate','endDate'].map(id=>$(id).closest('label'));for(const id of ['startDate','endDate'])$(id).step='1';for(const el of preciseLabels)periodPanel.appendChild(el);
document.querySelector('#controlsCard .controls-grid').before(periodPanel);
settingIds.push('periodMode');
let periodSnapshot='';
function syncPeriodUI(){const days=value('periodMode')==='days';if(!days){let changed=false;for(const id of ['startDate','endDate']){const next=value(id).replace(/\.\d+$/,'');changed=changed||next!==value(id);$(id).value=next}if(changed){markDirty();invalidateAnomalies()}}$('dayStartLabel').hidden=!days;$('dayEndLabel').hidden=!days;$('singleDay').hidden=!days;preciseLabels.forEach(el=>el.hidden=days);$('dayStart').value=value('startDate').slice(0,10);$('dayEnd').value=value('endDate').slice(0,10);periodSnapshot=value('startDate')+'|'+value('endDate')}
function applyDayPeriod(){try{const p=wholeDayBounds(value('dayStart'),value('dayEnd'));$('startDate').value=p.start;$('endDate').value=p.end;periodSnapshot=value('startDate')+'|'+value('endDate');markDirty();invalidateAnomalies()}catch(e){$('startDate').value='';$('endDate').value='';markDirty();$('workflowStatus').textContent=e.message}}
$('periodMode').onchange=()=>{if(value('periodMode')==='days'){syncPeriodUI();applyDayPeriod()}syncPeriodUI()};
$('dayStart').onchange=()=>{if(!value('dayEnd')||value('dayEnd')<value('dayStart'))$('dayEnd').value=value('dayStart');applyDayPeriod()};$('dayEnd').onchange=applyDayPeriod;
$('singleDay').onclick=()=>{$('dayEnd').value=value('dayStart');applyDayPeriod()};
const baseRenderWorkflow=render;render=function(){if(periodSnapshot!==value('startDate')+'|'+value('endDate')){const whole=/T00:00(?::00)?$/.test(value('startDate'))&&value('endDate').endsWith('T23:59:59.999');if(!whole)$('periodMode').value='exact';syncPeriodUI()}baseRenderWorkflow();syncChartPicker()};
const baseSetupWorkflow=setup;setup=function(){baseSetupWorkflow();syncPeriodUI();if(value('periodMode')==='days')applyDayPeriod();sourcePanel.open=true;$('sourceTimeHint')?.remove();showWorkspaceStage(1,false)};
document.querySelectorAll('[data-range]').forEach(button=>{const before=button.onclick;button.onclick=()=>{before?.();syncPeriodUI();if(value('periodMode')==='days')applyDayPeriod()}});
const workspaceStatus=document.createElement('p');workspaceStatus.id='workflowStatus';workspaceStatus.setAttribute('role','status');tabs.after(workspaceStatus);
document.querySelector('.hero').hidden=true;guide.hidden=true;formatStatus.hidden=true;$('emptyPlot').hidden=true;
const sourceStep=document.createElement('section');sourceStep.id='sourceStep';sourcePanel.before(sourceStep);sourceStep.appendChild(sourcePanel);sourceStep.before(tabs,workspaceStatus);
sourceStep.insertAdjacentHTML('beforeend','<div class="step-actions"><button id="sourceNext" class="primary">下一步：日期與圖表</button></div>');
const stepNav=document.createElement('nav');stepNav.className='step-navigation';stepNav.setAttribute('aria-label','繪圖步驟');stepNav.innerHTML='<button class="secondary" data-step="1">1 匯入資料</button><button class="secondary" data-step="2">2 日期與圖表</button><button class="secondary" data-step="3">3 看圖與下載</button>';document.body.appendChild(stepNav);
const anomalyPage=document.createElement('section');anomalyPage.id='anomalyPage';anomalyPage.hidden=true;anomalyPage.setAttribute('role','tabpanel');anomalyPage.setAttribute('aria-labelledby','anomalyTab');queryPage.after(anomalyPage);anomalyPage.appendChild(anomalyPanel);anomalyPanel.hidden=false;
const anomalyTab=document.createElement('button');anomalyTab.id='anomalyTab';anomalyTab.textContent='異常檢查';anomalyTab.setAttribute('role','tab');anomalyTab.setAttribute('aria-controls','anomalyPage');anomalyTab.setAttribute('aria-selected','false');tabs.appendChild(anomalyTab);
const stylePanel=document.createElement('aside');stylePanel.id='stylePanel';stylePanel.hidden=true;stylePanel.setAttribute('aria-label','調整圖表外觀與標示');stylePanel.innerHTML='<div class="style-header"><h2>圖表外觀與標示</h2><button id="closeStyle" class="secondary">收合</button></div>';document.body.appendChild(stylePanel);stylePanel.appendChild(editFold);editFold.open=true;editFold.querySelector(':scope > summary').hidden=true;
const styleButton=document.createElement('button');styleButton.id='openStyle';styleButton.className='secondary';styleButton.textContent='調整外觀與標示';styleButton.setAttribute('aria-expanded','false');styleButton.setAttribute('aria-controls','stylePanel');document.querySelector('.chart-heading .actions').prepend(styleButton);
function toggleStyle(open){stylePanel.hidden=!open;document.body.classList.toggle('style-open',open);styleButton.setAttribute('aria-expanded',String(open));requestAnimationFrame(()=>[...state.charts,...(state.co2Chart?[state.co2Chart]:[])].forEach(c=>c.resize()));if(open)$('closeStyle').focus()}
styleButton.onclick=()=>toggleStyle(stylePanel.hidden);$('closeStyle').onclick=()=>{toggleStyle(false);styleButton.focus()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!stylePanel.hidden){toggleStyle(false);styleButton.focus()}});
const chartPickerLabel=document.createElement('label');chartPickerLabel.className='chart-picker';chartPickerLabel.textContent='目前查看';const chartPicker=document.createElement('select');chartPicker.id='chartPicker';chartPickerLabel.appendChild(chartPicker);document.querySelector('.chart-heading').after(chartPickerLabel);
function syncChartPicker(){const all=[...document.querySelectorAll('#charts > .chart-card'),...(!$('co2DailyCard').classList.contains('hidden')?[$('co2DailyCard')]:[])],previous=chartPicker.value;chartPicker.replaceChildren();all.forEach((card,i)=>{const op=document.createElement('option');op.value=String(i);op.textContent=card.querySelector('h3')?.textContent||'圖表 '+(i+1);chartPicker.appendChild(op)});chartPicker.value=previous!==''&&all[Number(previous)]?previous:'0';all.forEach((card,i)=>card.hidden=String(i)!==chartPicker.value);chartPickerLabel.hidden=all.length<2;requestAnimationFrame(()=>[...state.charts,...(state.co2Chart?[state.co2Chart]:[])].forEach(c=>c.resize()))}
chartPicker.onchange=()=>syncChartPicker();const beforeDrawWorkflow=draw;draw=function(){beforeDrawWorkflow();syncChartPicker()};
$('downloadPng').textContent='下載全部圖表 PNG';
let workspaceStage=1,workspacePage='plot';
function showWorkspaceStage(step,generate=true){if(step===3&&generate&&(state.hive||state.weather)){try{validateSettings();if(!value('startDate')||!value('endDate'))throw Error('請先選擇有效的開始與結束日期')}catch(e){showWorkspaceStage(2,false);workspaceStatus.textContent=e.message;return}}if(step>1&&!state.hive&&!state.weather){workspaceStatus.textContent='請先匯入內部或外部資料。';step=1}workspacePage='plot';workspaceStage=step;workspaceStatus.textContent=step===1&&!state.hive&&!state.weather?'請先匯入資料，再按下一步。':'';sourceStep.hidden=step!==1;sourcePanel.open=true;plotPage.hidden=step===1;queryPage.hidden=true;anomalyPage.hidden=true;periodPanel.hidden=false;document.querySelector('#controlsCard .controls-grid').before(periodPanel);$('controlsCard').hidden=step!==2;$('chartCard').hidden=step!==3;stepNav.hidden=false;toggleStyle(false);for(const name of ['plot','query','anomaly'])$(name+'Tab').setAttribute('aria-selected',String(name==='plot'));stepNav.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-current',Number(b.dataset.step)===step?'step':'false')});if(step===3&&generate){markDirty();render()}else if(step===3)syncChartPicker();document.body.dataset.stage=String(step);window.scrollTo({top:0,behavior:'instant'})}
switchPage=function(name){if(name==='plot'){showWorkspaceStage(workspaceStage,false);return}workspacePage=name;sourceStep.hidden=true;plotPage.hidden=true;queryPage.hidden=name!=='query';anomalyPage.hidden=name!=='anomaly';anomalyPanel.hidden=false;stepNav.hidden=true;toggleStyle(false);for(const item of ['plot','query','anomaly'])$(item+'Tab').setAttribute('aria-selected',String(item===name));if(name==='anomaly'){anomalyPanel.before(periodPanel);periodPanel.hidden=false}workspaceStatus.textContent=state.hive||state.weather?'':'請先到「製作圖表」的第 1 步匯入資料。';window.scrollTo({top:0,behavior:'instant'})};
$('plotTab').onclick=()=>switchPage('plot');$('queryTab').onclick=()=>switchPage('query');anomalyTab.onclick=()=>switchPage('anomaly');
tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const names=['plot','query','anomaly'],i=names.indexOf(workspacePage),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowLeft'?2:1))%3;switchPage(names[next]);$(names[next]+'Tab').focus()};
stepNav.querySelectorAll('button').forEach(b=>b.onclick=()=>showWorkspaceStage(Number(b.dataset.step)));$('sourceNext').onclick=()=>showWorkspaceStage(2);$('renderButton').onclick=()=>showWorkspaceStage(3);
const plotQueryBeforeWorkflow=$('plotQueryResults').onclick;$('plotQueryResults').onclick=()=>{plotQueryBeforeWorkflow();if(state.querySubset){$('periodMode').value='exact';syncPeriodUI();showWorkspaceStage(3,false)}};
const focusBeforeWorkflow=focusAnomaly;focusAnomaly=function(e){focusBeforeWorkflow(e);$('periodMode').value='exact';syncPeriodUI();showWorkspaceStage(3,false)};
const restoreBeforeWorkflow=$('restoreAnomalyRange').onclick;$('restoreAnomalyRange').onclick=()=>{restoreBeforeWorkflow();syncPeriodUI()};
// Keep the return action reachable after navigating from the anomaly page to a chart.
const anomalyReturn=document.createElement('button');anomalyReturn.className='secondary';anomalyReturn.id='backToAnomalies';anomalyReturn.textContent='返回異常檢查';anomalyReturn.onclick=()=>switchPage('anomaly');document.querySelector('.chart-heading .actions').appendChild(anomalyReturn);
const beforeStyleLoad=$('loadSettings').onchange;$('loadSettings').onchange=async e=>{await beforeStyleLoad(e);syncPeriodUI()};
syncPeriodUI();showWorkspaceStage(1,false);

// Compact navigation: keep navigation out of the plotting surface.
document.querySelector('.topbar > div').after(tabs);
const stepPages=document.createElement('div');stepPages.className='step-pages';
for(const button of [...stepNav.querySelectorAll('[data-step]')])stepPages.appendChild(button);
stepNav.append(stepPages,$('sourceNext'));document.querySelector('.step-actions')?.remove();
$('sourceNext').onclick=()=>showWorkspaceStage(workspaceStage===1?2:3);
document.body.appendChild(styleButton);
function syncCompactNavigation(){
 document.body.dataset.workspacePage=workspacePage;
 $('sourceNext').hidden=workspacePage!=='plot'||workspaceStage===3;
 $('sourceNext').textContent=workspaceStage===1?'下一步 →':'更新並看圖 →';
 styleButton.hidden=workspacePage!=='plot'||workspaceStage!==3;
 for(const name of ['plot','query','anomaly'])$(name+'Tab').tabIndex=name===workspacePage?0:-1;
}
const stageBeforeCompact=showWorkspaceStage;showWorkspaceStage=function(...args){stageBeforeCompact(...args);syncCompactNavigation()};
const pageBeforeCompact=switchPage;switchPage=function(...args){pageBeforeCompact(...args);syncCompactNavigation()};
function arrangeChartFooters(){
 for(const card of document.querySelectorAll('#charts > .chart-card,#co2DailyCard')){
  const frame=card.querySelector('.canvas-frame');let plot=frame;
  if(frame){if(!frame.parentElement.classList.contains('chart-scroll')){const scroll=document.createElement('div');scroll.className='chart-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','圖表區，可左右捲動');frame.before(scroll);scroll.appendChild(frame)}plot=frame.parentElement}
  const legend=card.querySelector('.line-legend'),controls=card.querySelector('.chart-controls');
  if(!legend&&!controls)continue;
  let row=card.querySelector('.chart-footer-row');if(!row){row=document.createElement('div');row.className='chart-footer-row'}
  plot?.after(row);
  if(legend)row.appendChild(legend);if(controls)row.appendChild(controls);
 }
 $('backToAnomalies').hidden=!anomalyActive;
}
const pickerBeforeCompact=syncChartPicker;syncChartPicker=function(){pickerBeforeCompact();arrangeChartFooters()};
syncCompactNavigation();
