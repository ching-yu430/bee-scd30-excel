/* A short single-dataset path, sharing the same import and chart calculations. */
const homeModes=document.createElement('section');homeModes.id='homeModes';homeModes.className='card home-modes';homeModes.setAttribute('aria-label','選擇使用模式');
homeModes.innerHTML='<div class="home-mode-heading"><h2>這次想做什麼？</h2><p>第一次使用，從快速模式開始。</p></div><div class="home-mode-options"><button id="chooseQuickMode" type="button" aria-pressed="true"><span class="mode-tag">新手推薦</span><strong>快速模式</strong><span>整理一份資料，看整體趨勢或 24 小時平均。</span><small>匯入資料 → 選擇圖表 → 下載圖片</small></button><button id="chooseComparisonMode" type="button" aria-pressed="false"><span class="mode-tag">多組資料</span><strong>實驗比較</strong><span>比較不同次實驗、同時實驗或氣象站資料。</span><small>各組獨立期間、時間對齊與異常檢查</small></button></div><input id="workspaceMode" type="hidden" value="quick">';
sourceStep.prepend(homeModes);settingIds.push('workspaceMode');
const singlePurpose=document.createElement('option');singlePurpose.value='single';singlePurpose.textContent='單一資料整理';singlePurpose.hidden=true;$('experimentPurpose').appendChild(singlePurpose);
const modeBar=document.createElement('div');modeBar.id='workspaceModeBar';modeBar.innerHTML='<span></span><button type="button" class="secondary">切換模式／更換資料</button>';workspaceStatus.after(modeBar);modeBar.querySelector('button').onclick=()=>showWorkspaceStage(1,false);
const quickGuide=document.createElement('p');quickGuide.id='quickImportGuide';quickGuide.className='quick-guide';quickGuide.textContent='1. 選擇一組 CSV／Excel 資料。系統會自動辨識日期、CO₂、溫度與濕度欄位。';sourcePanel.before(quickGuide);
const quickPeriod=section('只想看部分日期？（選填）');quickPeriod.id='quickPeriod';
const quickRange=document.createElement('p');quickRange.id='quickRange';quickRange.className='help-text';
const quickAll=document.createElement('button');quickAll.type='button';quickAll.className='secondary';quickAll.textContent='恢復使用全部資料';quickAll.onclick=()=>{setDates();$('periodMode').value='exact';syncPeriodUI();markDirty();syncQuickMode()};
quickPeriod.appendChild(quickAll);overviewControls.before(quickRange,quickPeriod);
const quickAdvancedFolds=[advanced];
const modeAnalysisIds=[...new Set([...experimentSettingIds,'startDate','endDate','periodMode','chartMode','aggregation','missing','comparisonMode','overlayMetric','overlaySource','diurnalStart','filterSource','filterStage',...keys.flatMap(key=>[key+'Op',key+'Min',key+'Max'])])];
function readModeAnalysis(){return {settings:Object.fromEntries(modeAnalysisIds.map(id=>[id,$(id).type==='checkbox'?checked(id):value(id)])),data:experimentSources.map(source=>state[source])}}
const modeAnalyses=new Map([['comparison',readModeAnalysis()]]);
function isQuickMode(){return value('workspaceMode')==='quick'}
function restoreModeAnalysis(saved){
 const changed=experimentSources.filter((source,index)=>saved.data[index]!==state[source]);
 for(const [id,setting]of Object.entries(saved.settings)){
  if(changed.some(source=>id.startsWith(source)&&/Period|Origin/.test(id)))continue;
  if(changed.includes('hive')&&['startDate','endDate','periodMode'].includes(id))continue;
  const input=$(id);if(input.type==='checkbox')input.checked=setting;else input.value=setting;
 }
 for(const source of changed)if(state[source])resetExperimentRange(source);
 if(changed.includes('hive')||!value('startDate'))setDates();
}
function changeWorkspaceMode(mode){
 const before=value('workspaceMode');if(before===mode)return;
 modeAnalyses.set(before,readModeAnalysis());$('workspaceMode').value=mode;
 if(mode==='quick'){$('experimentPurpose').value='single';$('comparisonMode').value='mine';$('timeAlignment').value='calendar'}
 state.experimentDetail=null;experimentOverviewReturn=null;state.querySubset=null;manualLabels.clear();selectedVisible.clear();
 const saved=modeAnalyses.get(mode);
 if(saved)restoreModeAnalysis(saved);
 else if(mode==='quick'){
  $('chartMode').value='continuous';$('aggregation').value='hour';$('overviewMetric').value='co2';$('profileMethod').value='observations';$('diurnalStart').value='0';$('missing').value='gap';resetFilterValues();setDates();$('periodMode').value='exact';
 }
 if(mode==='quick'){$('experimentPurpose').value='single';$('comparisonMode').value='mine';$('timeAlignment').value='calendar'}
 markDirty();invalidateAnomalies();syncPeriodUI();showWorkspaceStage(1,false);syncQuickMode();
}
$('chooseQuickMode').onclick=()=>changeWorkspaceMode('quick');$('chooseComparisonMode').onclick=()=>changeWorkspaceMode('comparison');
function quickAvailableMetrics(){
 const data=state.hive;if(!data)return [];
 return keys.filter(key=>data.mapping[key]&&data.rows.some(row=>{const text=String(row[data.mapping[key]]??'').trim();return text!==''&&Number.isFinite(Number(text))}));
}
function syncQuickMode(){
 const quick=isQuickMode(),plot=workspacePage==='plot';document.body.dataset.mode=quick?'quick':'comparison';
 $('chooseQuickMode').setAttribute('aria-pressed',String(quick));$('chooseComparisonMode').setAttribute('aria-pressed',String(!quick));
 purposePanel.hidden=quick;quickGuide.hidden=!quick;
 modeBar.hidden=!plot||workspaceStage===1;modeBar.querySelector('span').textContent=quick?'快速模式 · 單一資料整理':'實驗比較 · 多組資料分析';
 $('plotTab').textContent=quick?'製作圖表':'實驗比較';
 if(quick){
  experimentCards.get('peer').hidden=true;$('hiveStationFiles').hidden=true;
  sourcePanel.querySelector(':scope > summary').textContent=state.hive?'已匯入的資料（可展開更換）':'匯入一份資料';
  $('hiveExperimentCard').querySelector('.experiment-upload h3').textContent='你的資料';
  $('hiveExperimentCard').querySelector('.experiment-upload p').textContent='支援 CSV／Excel；同一資料集分成多個檔案時可一起選取。';
  $('controlsCard').querySelector('h2').textContent='2. 選擇想看的圖表';
  const caption=$('overviewMetric').closest('label');if(caption.firstChild.nodeType===3)caption.firstChild.textContent='顯示指標';
  $('modeExplanation').textContent=value('chartMode')==='co2hour'?'把所選期間內相同小時的數值取平均，查看一天中的變化；沒有資料的時段會保留空白。':'依實際日期查看整體變化。預設每小時平均，可改為原始資料或每日平均。';
  document.querySelector('.chart-heading h2').textContent=state.experimentDetail?'異常當日細節':'你的圖表';
  const available=quickAvailableMetrics();
  for(const option of $('overviewMetric').options)option.disabled=Boolean(state.hive)&&!available.includes(option.value);
  if(available.length&&!available.includes(value('overviewMetric')))$('overviewMetric').value=available.includes('co2')?'co2':available[0];
  quickGuide.textContent=state.hive&&!available.length?'目前尚未辨識出 CO₂、溫度或濕度數值，請展開「檔案格式與欄位配對」選擇對應欄位。':'1. 選擇一組 CSV／Excel 資料。系統會自動辨識日期、CO₂、溫度與濕度欄位。';
 }else{
  $('hiveExperimentCard').querySelector('.experiment-upload h3').textContent='實驗資料';
  $('hiveExperimentCard').querySelector('.experiment-upload p').textContent='同一次實驗可多選 CSV／Excel；各組獨立辨識欄位。';
  const caption=$('overviewMetric').closest('label');if(caption.firstChild.nodeType===3)caption.firstChild.textContent='比較指標';
  for(const option of $('overviewMetric').options)option.disabled=false;
 }
 for(const panel of quickAdvancedFolds)panel.hidden=quick;
 quickRange.hidden=quickPeriod.hidden=!quick;
 if(quick&&plot&&workspaceStage===2){
  overviewControls.after(quickRange,quickPeriod);quickPeriod.prepend(periodPanel);periodPanel.hidden=false;
  quickRange.textContent='目前分析範圍：'+(value('startDate')?value('startDate').replace('T',' ')+' ～ '+value('endDate').replace('T',' '):'請先匯入資料')+'。預設為整份資料，可依需要縮小日期。';
 }
 for(const source of experimentSources)if($(source+'FileMappings'))$(source+'FileMappings').hidden=quick&&source!=='hive';
 for(const group of document.querySelectorAll('.mapping-group'))group.hidden=quick&&!group.closest('#hiveFileMappings')&&group.querySelector('[data-source]')?.dataset.source!=='hive';
 for(const button of stepPages.querySelectorAll('[data-step]')){const step=Number(button.dataset.step);button.textContent=(quick?['1 匯入資料','2 選擇圖表','3 看圖與下載']:['1 匯入資料','2 期間與比較','3 看圖與下載'])[step-1]}
}
const uiBeforeQuickMode=syncExperimentUI;syncExperimentUI=function(){uiBeforeQuickMode();syncQuickMode()};
const setupBeforeQuickMode=setup;setup=function(){setupBeforeQuickMode();syncQuickMode()};
const validateBeforeQuickMode=validateSettings;validateSettings=function(){validateBeforeQuickMode();if(isQuickMode()&&!state.querySubset&&!state.experimentDetail){if(!state.hive)throw Error('請先匯入一份資料。');if(!quickAvailableMetrics().length)throw Error('請先在欄位配對中選擇 CO₂、溫度或濕度數值欄位。')}};
const restoreBeforeQuickMode=restoreExperimentSettings;restoreExperimentSettings=function(saved){
 $('workspaceMode').value=saved.settings.workspaceMode==='quick'?'quick':'comparison';restoreBeforeQuickMode(saved);
 if(isQuickMode()){$('experimentPurpose').value='single';$('comparisonMode').value='mine';$('timeAlignment').value='calendar'}
 syncQuickMode();
};
// Start with a complete single-dataset default; the comparison entry retains its own draft.
$('workspaceMode').value='comparison';changeWorkspaceMode('quick');
