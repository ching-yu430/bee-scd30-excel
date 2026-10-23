/* A shared workspace for station, simultaneous and repeated experiments. */
const purposeTitles={single:'單一資料圖表',weather:'實驗與氣象站比較',parallel:'同時進行的實驗比較',different:'不同次實驗比較'};
const experimentRangeReferences=new Map();
const purposePanel=document.createElement('section');purposePanel.className='card purpose-panel';
purposePanel.innerHTML='<div><p class="eyebrow">EXPERIMENT WORKSPACE</p><h2>先看整體，再查看異常</h2><p>每組實驗分開讀取檔案，使用自己的名稱與分析期間。</p></div><label>這次要比較什麼？<select id="experimentPurpose"><option value="different">不同次實驗比較</option><option value="parallel">同時進行的實驗比較</option><option value="weather">實驗與氣象站比較</option></select></label><p id="purposeHint" class="help-text"></p>';
sourceStep.prepend(purposePanel);
sourcePanel.querySelector(':scope > summary').textContent='加入實驗資料';
mappingFold.querySelector(':scope > summary').textContent='檔案格式與欄位配對（需要時調整）';
const uploadPanels=[...uploads.querySelectorAll('.upload-panel')];
const experimentCards=new Map();
for(const [index,source]of experimentSources.entries()){
 const card=document.createElement('article');card.className='experiment-card';card.id=source+'ExperimentCard';
 card.innerHTML='<div class="experiment-card-heading"><span class="experiment-badge">'+(index?'B':'A')+'</span><label>實驗名稱<input id="'+source+'Name" maxlength="60" value="實驗 '+(index?'B':'A')+'" placeholder="例如：第一次實驗"></label></div>';
 const files=uploadPanels[index];files.className='experiment-upload';files.querySelector('.source-icon').remove();files.querySelector('h3').textContent='實驗資料';files.querySelector('p').textContent='同一次實驗可多選 CSV／Excel；各組獨立辨識欄位。';
 files.querySelector('.file-button').firstChild.textContent='選擇實驗檔案';card.appendChild(files);
 const summary=document.createElement('p');summary.id=source+'DataSummary';summary.className='experiment-data-summary';card.appendChild(summary);
 const mappingButton=document.createElement('button');mappingButton.type='button';mappingButton.className='secondary mapping-shortcut';mappingButton.textContent='檢查檔案與欄位';mappingButton.onclick=()=>{mappingFold.open=true;mappingFold.scrollIntoView({behavior:'smooth',block:'start'})};card.appendChild(mappingButton);
 const weatherToggle=document.createElement('label');weatherToggle.className='check-tile experiment-weather-toggle';weatherToggle.innerHTML='<input id="'+source+'UseWeather" type="checkbox">搭配這次實驗的氣象站資料';card.appendChild(weatherToggle);
 const station=document.createElement('details');station.id=source+'StationFiles';station.className='experiment-station';station.open=true;station.innerHTML='<summary>氣象站檔案</summary><p class="help-text">請使用這次實驗期間與地點對應的觀測資料。</p>';
 if(index===0){const files=uploadPanels[2];files.className='experiment-upload';files.querySelector('.source-icon').remove();files.querySelector('h3').remove();station.appendChild(files)}
 else station.insertAdjacentHTML('beforeend','<label class="file-button" tabindex="0" role="button">選擇氣象站檔案<input id="weatherPeerFile" type="file" accept=".csv,.xlsx,.xls" multiple></label><p id="weatherPeerStatus" class="file-status">尚未選擇檔案</p>');
 card.appendChild(station);uploads.appendChild(card);experimentCards.set(source,card);
}
$('weatherPeerFile').onchange=event=>{if(event.target.files.length)load(event.target.files,'weatherPeer')};
$('weatherPeerFile').closest('label').onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();$('weatherPeerFile').click()}};

const rangePanel=document.createElement('section');rangePanel.id='experimentRanges';rangePanel.className='experiment-ranges';
for(const [index,source]of experimentSources.entries()){
 const card=document.createElement('section');card.className='experiment-range-card';card.id=source+'RangeCard';
 card.innerHTML='<h3 id="'+source+'RangeTitle">實驗 '+(index?'B':'A')+'</h3><div class="experiment-period-fields"><label>分析開始<input id="'+source+'PeriodStart" type="datetime-local" step="1"></label><label>分析結束<input id="'+source+'PeriodEnd" type="datetime-local" step="1"></label></div><div class="experiment-origin"><label>實驗第 1 天<input id="'+source+'Origin" type="date"></label><label class="check-tile"><input id="'+source+'OriginConfirmed" type="checkbox">確認以此日期作為第 1 天</label><p class="help-text">初值來自資料日期，請確認是否為真正的實驗起點。</p></div><button id="'+source+'FullRange" class="secondary" type="button">使用這組全部資料</button>';
 rangePanel.appendChild(card);
}
comparisonPanel.before(rangePanel);
const overviewControls=document.createElement('section');overviewControls.className='overview-controls';overviewControls.id='overviewControls';
overviewControls.innerHTML='<label>主要檢視<select id="overviewView"><option value="continuous">整體趨勢</option><option value="co2hour">24 小時平均變化</option><option value="advanced" hidden>進階圖表</option></select></label><label>比較指標<select id="overviewMetric"><option value="co2">CO₂</option><option value="temp">溫度</option><option value="humidity">相對濕度</option></select></label><label>時間對齊<select id="timeAlignment"><option value="elapsed">實驗第幾天</option><option value="calendar">實際日期</option></select></label><label>平均方式<select id="profileMethod"><option value="observations">逐筆觀測平均</option><option value="days">每天等權平均</option></select></label>';
overviewControls.appendChild($('aggregation').closest('label'));rangePanel.after(overviewControls);
const experimentWarnings=document.createElement('p');experimentWarnings.id='experimentWarnings';experimentWarnings.className='help-text experiment-warnings';experimentWarnings.setAttribute('role','status');overviewControls.appendChild(experimentWarnings);
const advancedComparison=section('進階：其他圖表與資料來源');advancedComparison.id='advancedComparison';
overviewControls.after(advancedComparison);advancedComparison.append(comparisonPanel,$('chartMode').closest('label'),$('overlayMetric').closest('label'),overlaySourceField,$('diurnalControl'));
const rainStationField=document.createElement('label');rainStationField.innerHTML='降水量來源<select id="rainStation"><option value="weather">實驗 A 氣象站</option><option value="weatherPeer">實驗 B 氣象站</option></select>';advancedComparison.appendChild(rainStationField);
const context=document.createElement('section');context.id='experimentContext';context.className='experiment-context';context.setAttribute('aria-label','目前比較的實驗');document.querySelector('.chart-heading').after(context);
const coverage=document.createElement('details');coverage.id='profileCoverage';coverage.className='card profile-coverage';coverage.innerHTML='<summary>每小時的有效天數與樣本數</summary><p class="help-text">空白代表沒有有效觀測，不補 0；每天等權平均僅納入該小時有資料的日期。</p><div class="query-table-wrap"><table><thead><tr><th>實驗／來源</th><th>時段</th><th>平均值</th><th>有效天數</th><th>觀測筆數</th></tr></thead><tbody id="profileCoverageRows"></tbody></table></div>';$('co2DailyCard').after(coverage);
const anomalyOverview=document.createElement('section');anomalyOverview.id='experimentAnomalies';anomalyOverview.className='card experiment-anomalies';anomalyOverview.innerHTML='<div class="section-heading"><div><h3>異常摘要</h3><p>先看整體差異，發現異常再查看當天。</p></div><button id="openExperimentAnomalies" class="secondary">設定門檻與檢查</button></div><p id="experimentAnomalyStatus" class="help-text">尚未檢查；請先設定適合這次實驗的門檻。</p><div id="experimentAnomalyDays" class="experiment-anomaly-days"></div>';coverage.after(anomalyOverview);
$('openExperimentAnomalies').onclick=()=>switchPage('anomaly');
const returnOverview=document.createElement('button');returnOverview.id='returnExperimentOverview';returnOverview.className='secondary';returnOverview.textContent='返回整體比較';returnOverview.hidden=true;document.querySelector('.chart-heading .actions').prepend(returnOverview);
const experimentSettingIds=['experimentPurpose','overviewMetric','timeAlignment','profileMethod','rainStation',...experimentSources.flatMap(source=>[source+'Name',source+'UseWeather',source+'PeriodStart',source+'PeriodEnd',source+'Origin',source+'OriginConfirmed'])];
settingIds.push(...experimentSettingIds);

function resetExperimentRange(source){
 const bounds=sourceBounds(state[source]);if(!bounds)return;
 $(source+'PeriodStart').value=local(new Date(bounds.min));$(source+'PeriodEnd').value=local(new Date(bounds.max));
 $(source+'Origin').value=local(new Date(bounds.min)).slice(0,10);$(source+'OriginConfirmed').checked=false;
}
function syncExperimentData(){
 for(const source of experimentSources){
  if(state[source]&&experimentRangeReferences.get(source)!==state[source]){state.experimentDetail=null;experimentOverviewReturn=null;resetExperimentRange(source);experimentRangeReferences.set(source,state[source])}
  const bounds=sourceBounds(state[source]),summary=$(source+'DataSummary');
  summary.textContent=bounds?local(new Date(bounds.min)).replace('T',' ')+' ～ '+local(new Date(bounds.max)).replace('T',' ')+' · '+state[source].rows.length.toLocaleString()+' 筆可用紀錄':state[source]?'已讀取檔案，尚無有效時間；請檢查日期格式與欄位。':'尚未加入實驗資料';
  if(state[source]?.batches){const data=state[source],hasIssues=data.qualityIssues.length||data.timeIssues.length||data.importStats.conflicts;$(source+'Status').textContent='已加入 '+data.batches.length+' 個檔案'+(hasIssues?'；部分資料需檢查，詳見欄位配對。':'；品質與時間檢查通過。')}
  $(source+'RangeTitle').textContent=sourceName(source);
 }
 for(const source of sourceIds)for(const key of keys){const input=$(legendPrefixes[source]+key);if(input)input.placeholder=sourceName(source)+' '+label(key)}
 document.querySelectorAll('.rain-source > strong').forEach((heading,index)=>heading.textContent=sourceName(sourceIds[index]));
 for(const id of ['querySource','anomalySource','filterSource','overlaySource','rainStation'])for(const option of $(id).options)if(sourceIds.includes(option.value))option.textContent=sourceName(option.value);
 const loaded=experimentSources.filter(source=>state[source]).length;sourcePanel.querySelector(':scope > summary').textContent=loaded?'實驗資料（已加入 '+loaded+' 組，可展開更換檔案）':'加入實驗資料';
}
setDates=function(){
 syncExperimentData();updatePreview();
 const sources=comparisonPurpose()==='different'?requestedSources().filter(source=>state[source]):[activePlotSources()[0]].filter(Boolean);
 const bounds=sources.map(source=>sourceBounds(state[source])).filter(Boolean);if(!bounds.length)return;
 $('startDate').value=local(new Date(Math.min(...bounds.map(range=>range.min))));$('endDate').value=local(new Date(Math.max(...bounds.map(range=>range.max))));
 $('dataRange').textContent=comparisonPurpose()==='different'?'兩組實驗各自使用上方分析期間。':'以'+sourceName(sources[0])+'的資料期間為初值，可自行調整。';
};
const originalExperimentSetup=setup;
setup=function(){originalExperimentSetup();syncExperimentData();syncExperimentUI()};
function stationBMappings(){
 const data=state.weatherPeer;if(!data)return;
 if(!Object.hasOwn(data.mapping,'rain'))data.mapping.rain=data.headers.find(header=>/降水量|降雨量|雨量|precp|precipitation/i.test(header))||'';
 const card=document.querySelector('[data-source="weatherPeer"]')?.closest('.mapping-group');if(!card)return;
 card.querySelector('h3').textContent=sourceName('weatherPeer');
 const field=document.createElement('label');field.textContent='降水量（mm）';const select=document.createElement('select');select.dataset.source='weatherPeer';select.dataset.key='rain';
 for(const header of ['',...data.headers]){const option=document.createElement('option');option.value=header;option.textContent=header||'不使用';option.selected=header===data.mapping.rain;select.appendChild(option)}
 select.onchange=()=>{data.mapping.rain=select.value;markDirty()};field.appendChild(select);card.appendChild(field);
}
const setupBeforeStationB=setup;setup=function(){setupBeforeStationB();stationBMappings()};
function syncExperimentUI(){
 const different=comparisonPurpose()==='different',stationOnly=comparisonPurpose()==='weather',mode=value('chartMode'),profile=mode==='co2hour';
 $('controlsCard').querySelector('h2').textContent=purposeTitles[comparisonPurpose()]+'設定';
 const missing=requestedSources().filter(source=>!state[source]),empty=!state.dirty&&state.output.length?activePlotSources().filter(source=>!state.output.some(row=>row.source===source)):[];
 experimentWarnings.hidden=!missing.length&&!empty.length;experimentWarnings.textContent=(missing.length?'尚未加入：'+missing.map(sourceName).join('、')+'。目前只會繪製已加入的資料。':'')+(empty.length?'所選期間無可用資料：'+empty.map(sourceName).join('、')+'。':'');
 $('purposeHint').textContent=different?'兩次實驗可使用不同日期；比較整體趨勢或每日 24 小時變化。':stationOnly?'選一組實驗，搭配同期間、同地點的氣象站資料。':'以實際日期對齊，同時比較兩組實驗；氣象站可依需要加入。';
 experimentCards.get('peer').hidden=stationOnly;
 for(const source of experimentSources){
  $(source+'StationFiles').hidden=!checked(source+'UseWeather');
  $(source+'RangeCard').hidden=stationOnly&&source==='peer';
  $(source+'RangeCard').querySelector('.experiment-period-fields').hidden=!different;
  $(source+'FullRange').hidden=!different;
  $(source+'RangeCard').querySelector('.experiment-origin').hidden=!different||profile||value('timeAlignment')!=='elapsed'||!['continuous','combined'].includes(mode);
 }
 rangePanel.hidden=!different;
 periodPanel.hidden=different&&!state.experimentDetail;
 $('commonPeriod').hidden=different;
 $('overviewView').value=['continuous','co2hour'].includes(mode)?mode:'advanced';
 $('overviewView').closest('label').hidden=Boolean(state.experimentDetail);
 document.querySelector('.chart-heading h2').textContent=state.experimentDetail?'異常當日細節':'整體比較';
 $('overviewMetric').closest('label').hidden=!['continuous','co2hour'].includes(mode);
 $('timeAlignment').closest('label').hidden=!different||profile||Boolean(state.experimentDetail)||!['continuous','combined'].includes(mode);
 $('profileMethod').closest('label').hidden=!profile;
 $('aggregation').closest('label').hidden=profile;
 rainStationField.hidden=mode!=='rainfall';
 const difference=$('chartMode').querySelector('option[value="difference"]');difference.disabled=different;
 coverage.hidden=!profile;returnOverview.hidden=!state.experimentDetail;
 $('singleDay').hidden=true;document.querySelector('.range-shortcuts').hidden=different;
 if(workspacePage==='plot'&&workspaceStage===3)context.after(overviewControls);else rangePanel.after(overviewControls);
 context.replaceChildren();
 for(const source of experimentSources.filter(source=>state[source]&&requestedSources().some(selected=>parentExperiment(selected)===source))){
  const card=document.createElement('div');card.className='experiment-context-card';const title=document.createElement('strong');title.textContent=sourceName(source);const period=document.createElement('span');const range=analysisRangeFor(source);period.textContent=range.start.replace('T',' ')+' ～ '+range.end.replace('T',' ');
  card.append(title,period);if(isRelativeComparison()){const origin=document.createElement('span');origin.textContent='第 1 天：'+value(source+'Origin');card.appendChild(origin)}
  const weatherSource=source==='hive'?'weather':'weatherPeer';if(activePlotSources().includes(weatherSource)){const station=document.createElement('span');station.textContent='搭配 '+sourceName(weatherSource);card.appendChild(station)}context.appendChild(card);
 }
 for(const source of sourceIds)for(const key of keys){const field=$(legendPrefixes[source]+key)?.closest('label');if(field){const caption=field.querySelector('.field-caption');if(caption)caption.textContent=sourceName(source)}}
 syncProfileCoverage();syncExperimentAnomalies();
}
function syncProfileCoverage(){
 const body=$('profileCoverageRows');body.replaceChildren();if(value('chartMode')!=='co2hour')return;
 const key=diurnalMetric(),start=numberSetting('diurnalStart',0);
 for(const source of activePlotSources().filter(source=>state.dailyProfiles?.[source]?.[key]?.some(bin=>bin.n)))for(let index=0;index<24;index++){
  const hour=(index+start)%24,bin=state.dailyProfiles?.[source]?.[key]?.[hour];const row=document.createElement('tr');
  for(const cell of [sourceName(source),String(hour).padStart(2,'0')+':00',bin?.n?diurnalMean(bin).toFixed(numberSetting('labelDecimals',1)):'—',bin?.daily.size||0,bin?.n||0]){const element=document.createElement('td');element.textContent=cell;row.appendChild(element)}body.appendChild(row);
 }
}
function syncExperimentAnomalies(){
 $('experimentAnomalyDays').replaceChildren();
 if(!anomalyActive){$('experimentAnomalyStatus').textContent='尚未檢查或條件已變更；請先設定門檻，再檢查各實驗的分析期間。';return}
 $('experimentAnomalyStatus').textContent='已檢查，找到 '+anomalyEvents.length+' 項異常標記。點選日期可查看該來源當天的原始資料。';
 const groups=new Map();for(const event of anomalyEvents){const day=local(new Date(event.start)).slice(0,10),id=event.source+'|'+day;const group=groups.get(id)||{event,day,n:0};group.n++;groups.set(id,group)}
 for(const group of [...groups.values()].slice(0,12)){const button=document.createElement('button');button.className='secondary';button.textContent=sourceName(group.event.source)+' · '+group.day+' · '+group.n+' 項';button.onclick=()=>focusAnomaly(group.event);$('experimentAnomalyDays').appendChild(button)}
 if(groups.size>12){const note=document.createElement('p');note.className='help-text';note.textContent='顯示前 12 個日期，其餘請至異常檢查看完整紀錄。';$('experimentAnomalyDays').appendChild(note)}
}
function experimentSettingsChanged(){state.experimentDetail=null;experimentOverviewReturn=null;state.querySubset=null;manualLabels.clear();markDirty();invalidateAnomalies();syncExperimentData();syncExperimentUI()}
function applyPurpose(){
 advancedComparison.open=false;
 const station=comparisonPurpose()==='weather';$('comparisonMode').value=station?'weather':experimentSources.some(source=>checked(source+'UseWeather'))?'all':'hives';
 if(station)$('hiveUseWeather').checked=true;
 $('timeAlignment').value=comparisonPurpose()==='different'?'elapsed':'calendar';
 if(!['continuous','co2hour'].includes(value('chartMode')))$('chartMode').value='continuous';
 experimentSettingsChanged();setDates();syncPeriodUI();syncExperimentUI();
}
$('experimentPurpose').onchange=applyPurpose;
for(const source of experimentSources){
 $(source+'Name').oninput=()=>{syncExperimentData();if(workspaceStage===3)queueFormatPreview()};$(source+'Name').onchange=()=>{if(workspaceStage===3)flushFormatPreview();syncExperimentUI()};
 $(source+'UseWeather').onchange=()=>{$('comparisonMode').value=experimentSources.some(source=>checked(source+'UseWeather'))?'all':'hives';if(comparisonPurpose()==='weather')$('comparisonMode').value=checked('hiveUseWeather')?'weather':'mine';experimentSettingsChanged();setDates()};
 for(const suffix of ['PeriodStart','PeriodEnd','Origin','OriginConfirmed'])$(source+suffix).onchange=()=>{if(suffix==='Origin')$(source+'OriginConfirmed').checked=true;experimentSettingsChanged()};
 $(source+'FullRange').onclick=()=>{resetExperimentRange(source);experimentSettingsChanged()};
}
function requestExperimentOrigins(){
 if(!isRelativeComparison())return false;
 const unconfirmed=requestedSources().filter(source=>experimentSources.includes(source)&&state[source]).some(source=>!checked(source+'OriginConfirmed')||!Number.isFinite(experimentOrigin(source))||experimentOrigin(source)>+new Date(analysisRangeFor(source).start));
 if(!unconfirmed)return false;
 markDirty();showWorkspaceStage(2,false);workspaceStatus.textContent='請先確認各組實驗的第 1 天，再比較整體趨勢。';return true;
}
$('timeAlignment').onchange=()=>{experimentSettingsChanged();if(workspaceStage===3&&!requestExperimentOrigins())render()};
$('profileMethod').onchange=()=>{queueFormatPreview();flushFormatPreview();syncExperimentUI()};
$('overviewView').onchange=()=>{if(value('overviewView')==='advanced')return;$('chartMode').value=value('overviewView');if(workspaceStage===3&&requestExperimentOrigins())return;$('chartMode').onchange?.();syncExperimentUI()};
$('overviewMetric').onchange=()=>{if(value('chartMode')==='co2hour'&&state.output.length)draw();else syncChartPicker();syncExperimentUI()};
$('rainStation').onchange=()=>{markDirty();applyFormat()};
const oldComparisonChange=$('comparisonMode').onchange;
$('comparisonMode').onchange=()=>{if(['all','weather'].includes(value('comparisonMode')))$('hiveUseWeather').checked=true;if(value('comparisonMode')==='all')$('peerUseWeather').checked=true;oldComparisonChange();syncExperimentUI()};
const oldChartModeChange=$('chartMode').onchange;$('chartMode').onchange=()=>{oldChartModeChange?.();syncExperimentUI()};
const validateBeforeExperiments=validateSettings;
validateSettings=function(){
 validateBeforeExperiments();
 if(!separateExperimentPeriods())return;
 for(const source of requestedSources().filter(source=>experimentSources.includes(source))){
  if(!state[source])throw Error('請先加入'+sourceName(source)+'的資料。');
  const range=analysisRangeFor(source),start=+new Date(range.start),end=+new Date(range.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)throw Error(sourceName(source)+'：請確認分析開始與結束時間。');
  if(isRelativeComparison()&&(!checked(source+'OriginConfirmed')||!Number.isFinite(experimentOrigin(source))))throw Error(sourceName(source)+'：請確認哪一天是實驗第 1 天。');
  if(isRelativeComparison()&&experimentOrigin(source)>start)throw Error(sourceName(source)+'：實驗起點不可晚於分析開始時間。');
 }
 if(value('chartMode')==='difference')throw Error('不同次實驗請使用整體趨勢或 24 小時平均；逐時差值需要相同日期。');
};
const drawBeforeExperiments=draw;draw=function(){drawBeforeExperiments();syncExperimentUI()};
const renderBeforeExperiments=render;render=function(){renderBeforeExperiments();syncExperimentUI()};
const pickerBeforeExperiments=syncChartPicker;
syncChartPicker=function(){
 pickerBeforeExperiments();
 if(value('chartMode')==='continuous'){
  const index=state.charts.findIndex(chart=>chart.data.datasets.some(dataset=>dataset.metricKey===value('overviewMetric')));
  if(index>=0&&chartPicker.value!==String(index)){chartPicker.value=String(index);pickerBeforeExperiments()}
 }
 if(['continuous','co2hour'].includes(value('chartMode')))chartPickerLabel.hidden=true;
};
chartPicker.onchange=()=>{const chart=state.charts[Number(chartPicker.value)];if(chart?.data.datasets[0])$('overviewMetric').value=metricOf(chart.data.datasets[0]);syncChartPicker()};
const stageBeforeExperiments=showWorkspaceStage;showWorkspaceStage=function(step,generate=true){stageBeforeExperiments(step,generate);syncExperimentUI()};
const switchBeforeExperiments=switchPage;switchPage=function(name){switchBeforeExperiments(name);syncExperimentUI()};
const csvBeforeExperiments=currentCsv;
currentCsv=function(){
 if(value('chartMode')==='co2hour'){
  const rows=[['資料來源','指標','時段','平均值','樣本數','有效天數','平均方式','分析開始','分析結束']],key=diurnalMetric(),start=numberSetting('diurnalStart',0);
  for(const source of activePlotSources().filter(source=>state.dailyProfiles?.[source]?.[key]?.some(bin=>bin.n)))for(let index=0;index<24;index++){const hour=(index+start)%24,bin=state.dailyProfiles?.[source]?.[key]?.[hour],range=analysisRangeFor(source);rows.push([sourceName(source),label(key),String(hour).padStart(2,'0')+':00',bin?.n?diurnalMean(bin):'',bin?.n||0,bin?.daily.size||0,value('profileMethod')==='days'?'每天等權平均':'逐筆觀測平均',range.start,range.end])}
  return rows.map(row=>row.map(csvCell).join(',')).join('\n');
 }
 if(isRelativeComparison())return [['實際時間','實驗天數','資料來源','指標','平均值','樣本數'],...state.output.map(row=>[local(new Date(row.time)),plotTimeFor(row.source,row.time)/86400000+1,sourceName(row.source),label(row.key),row.value,row.n])].map(row=>row.map(csvCell).join(',')).join('\n');
 return csvBeforeExperiments();
};
const chartContextBeforeExperiments=chartContext;
chartContext=function(){return (comparisonPurpose()==='different'?experimentSources.filter(source=>state[source]&&requestedSources().some(selected=>parentExperiment(selected)===source)).map(source=>{const range=analysisRangeFor(source);return sourceName(source)+'：'+range.start.replace('T',' ')+' 至 '+range.end.replace('T',' ')}).join('；'):chartContextBeforeExperiments())+(isRelativeComparison()?'；依各自已確認的實驗起點對齊':'')};
function restoreExperimentSettings(saved){
 state.experimentDetail=null;
 if(!saved.settings.experimentPurpose){$('experimentPurpose').value='parallel';$('timeAlignment').value='calendar';$('hiveUseWeather').checked=['all','weather'].includes(value('comparisonMode'));$('peerUseWeather').checked=false}
 if(!purposeTitles[value('experimentPurpose')])$('experimentPurpose').value='different';
 if(!keys.includes(value('overviewMetric')))$('overviewMetric').value='co2';
 if(!['calendar','elapsed'].includes(value('timeAlignment')))$('timeAlignment').value='calendar';
 if(!['observations','days'].includes(value('profileMethod')))$('profileMethod').value='observations';
 syncExperimentData();syncExperimentUI();
}
let experimentOverviewReturn=null;
const queryPlotBeforeExperiments=$('plotQueryResults').onclick;
$('plotQueryResults').onclick=()=>{state.experimentDetail=null;experimentOverviewReturn=null;queryPlotBeforeExperiments()};
focusAnomaly=function(event){
 if(!experimentOverviewReturn)experimentOverviewReturn={settings:Object.fromEntries(['comparisonMode','chartMode','aggregation','startDate','endDate','periodMode','xTickInterval','overviewMetric','filterSource','filterStage',...keys.flatMap(key=>[key+'Op',key+'Min',key+'Max'])].map(id=>[id,value(id)])),querySubset:state.querySubset};
 const day=local(new Date(event.start)).slice(0,10),range=wholeDayBounds(day,day);
 anomalyNavigating=true;
 try{
  state.experimentDetail={source:event.source,start:range.start,end:range.end};state.querySubset=null;
  $('startDate').value=range.start;$('endDate').value=range.end;$('periodMode').value='exact';$('chartMode').value='continuous';$('aggregation').value='raw';$('overviewMetric').value=event.key;$('xTickInterval').value='auto';resetFilterValues();
  showWorkspaceStage(3,false);markDirty();render();anomalySignature=anomalyFingerprint();$('restoreAnomalyRange').hidden=true;syncExperimentUI();
 }finally{anomalyNavigating=false}
};
returnOverview.onclick=()=>{
 if(!experimentOverviewReturn)return;anomalyNavigating=true;
 try{state.experimentDetail=null;state.querySubset=experimentOverviewReturn.querySubset;for(const [id,setting]of Object.entries(experimentOverviewReturn.settings))$(id).value=setting;experimentOverviewReturn=null;syncPeriodUI();showWorkspaceStage(3,false);markDirty();render();anomalySignature=anomalyFingerprint();syncExperimentUI()}finally{anomalyNavigating=false}
};
const invalidateBeforeExperiments=invalidateAnomalies;invalidateAnomalies=function(){invalidateBeforeExperiments();syncExperimentAnomalies()};
for(const source of sourceIds)for(const key of keys)$(legendPrefixes[source]+key).value='';
for(const [value_,text]of [['mine','只看實驗 A'],['peerOnly','只看實驗 B'],['weather','實驗 A 與氣象站'],['hives','實驗 A 與實驗 B'],['all','兩組實驗與各自氣象站']])$('comparisonMode').querySelector('option[value="'+value_+'"]').textContent=text;
$('co2Preset').textContent='範例：實驗 A CO₂ ＞ 2500';$('queryPreset').textContent='實驗 A CO₂ ＞ 2500';
$('plotTab').textContent='實驗比較';stepPages.querySelector('[data-step="2"]').textContent='2 期間與比較';
$('aggregation').value='day';
applyPurpose();syncExperimentData();syncExperimentUI();
