/* Keep viewing, source appearance and image downloads in the results workspace. */
function sourceLineColor(source,key){return value('sourceColorValue-'+source+'-'+key)||state.metrics[key]?.color}
function sourceIsShown(source){return !sourceIds.includes(source)||checked('sourceShown-'+source)}
function resultCharts(){return [...state.charts,...(state.co2Chart?[state.co2Chart]:[])]}
function datasetSource(dataset){return String(dataset.sourceId||'').split('|')[0]}
const resultsTools=document.createElement('section');resultsTools.id='resultsTools';resultsTools.setAttribute('aria-label','顯示來源');
resultsTools.innerHTML='<div id="resultSources" class="result-sources"><span class="result-source-heading">顯示來源</span></div><button id="showAllSources" class="secondary" type="button">全部顯示</button>';
overviewControls.after(resultsTools);
const sourceColorInputs=new Map();
for(const source of sourceIds){
 const row=document.createElement('label');row.className='result-source';row.id='resultSource-'+source;
 const input=document.createElement('input');input.type='checkbox';input.id='sourceShown-'+source;input.checked=true;
 const name=document.createElement('span');name.className='result-source-name';row.append(input,name);$('resultSources').appendChild(row);
 settingIds.push(input.id);input.onchange=()=>{applyAllSourceVisibility();syncResultTools()};
 for(const key of keys){
  const stored=document.createElement('input');stored.type='hidden';stored.id='sourceColorValue-'+source+'-'+key;settingIds.push(stored.id);
  const field=document.createElement('label');field.className='source-color-control';field.innerHTML='<span>'+label(key)+'</span>';
  const color=document.createElement('input');color.type='color';color.id='panelColor-'+source+'-'+key;color.value=state.metrics[key].color;
  color.oninput=()=>{stored.value=color.value;syncResultColors();queueFormatPreview()};color.onchange=()=>{stored.value=color.value;flushFormatPreview();syncResultTools()};field.appendChild(color);
  const legendField=$(legendPrefixes[source]+key).closest('label'),pair=document.createElement('div');pair.className='source-legend-edit';legendField.before(pair);pair.append(legendField,field,stored);
  sourceColorInputs.set(source+'|'+key,[color]);
 }
}
lineBlock.querySelector('.studio-hint').textContent='各來源可在圖例名稱旁分別調色。';
const resetLineColors=document.createElement('button');resetLineColors.id='resetLineColors';resetLineColors.className='secondary';resetLineColors.type='button';resetLineColors.textContent='還原預設線色';
resetLineColors.onclick=()=>{for(const key of keys){state.metrics[key].color=defaultMetricColors[key];for(const source of sourceIds)$('sourceColorValue-'+source+'-'+key).value=''}syncResultColors();flushFormatPreview()};lineBlock.appendChild(resetLineColors);
function syncResultColors(){
 for(const source of sourceIds)for(const key of keys){
  const color=sourceLineColor(source,key);for(const input of sourceColorInputs.get(source+'|'+key)){input.value=color;input.setAttribute('aria-label',sourceName(source)+' '+label(key)+'線條顏色');input.title=sourceName(source)+' '+label(key)+'：'+color.toUpperCase()}
  const stroke=$(legendPrefixes[source]+key).closest('label').querySelector('.settings-source-stroke line');if(stroke)stroke.setAttribute('stroke',color);
 }
}
function applySourceVisibility(chart){
 chart.data.datasets.forEach((dataset,index)=>{
  const allowed=sourceIsShown(datasetSource(dataset)),visible=selectedVisible.get(dataset.researchSeries)??selectedVisible.get(dataset.label)??true;
  chart.setDatasetVisibility(index,allowed&&visible);
  chart.canvas.closest('.chart-card')?.querySelectorAll('.line-legend button')[index]?.setAttribute('aria-pressed',String(allowed&&visible));
 });chart.update('none');
}
function applyAllSourceVisibility(){for(const chart of resultCharts())applySourceVisibility(chart)}
const createBeforeResultTools=createChart;
createChart=function(canvas,config){
 for(const dataset of config.data.datasets){const source=datasetSource(dataset),key=metricOf(dataset);if(sourceIds.includes(source)&&keys.includes(key)&&(value('chartMode')!=='overlay'||value('sourceColorValue-'+source+'-'+key)))dataset.borderColor=sourceLineColor(source,key)}
 const chart=createBeforeResultTools(canvas,config);applySourceVisibility(chart);
 chart.canvas.closest('.chart-card')?.querySelectorAll('.line-legend button').forEach((button,index)=>{
  const before=button.onclick;button.onclick=()=>{const source=datasetSource(chart.data.datasets[index]);if(sourceIds.includes(source))$('sourceShown-'+source).checked=true;before();applyAllSourceVisibility();syncResultTools()};
 });return chart;
};
$('showAllSources').onclick=()=>{for(const source of sourceIds)$('sourceShown-'+source).checked=true;selectedVisible.clear();applyAllSourceVisibility();syncResultTools()};
// Keep primary actions beside the chart; less frequent downloads stay in More.
const downloads=document.createElement('details');downloads.id='resultDownloads';downloads.innerHTML='<summary>更多</summary><div class="result-more-actions"></div>';
const moreActions=downloads.querySelector('div');chartActions.append($('downloadCurrentPng'),$('downloadCsv'),downloads);
$('downloadCurrentPng').textContent='下載 PNG';$('downloadCsv').textContent='下載 CSV';$('downloadPng').textContent='合併此模式全部圖表 PNG';moreActions.appendChild($('downloadPng'));
const exportOptionsButton=document.createElement('button');exportOptionsButton.id='imageOptions';exportOptionsButton.type='button';exportOptionsButton.className='secondary';exportOptionsButton.textContent='圖片尺寸／設定檔';
exportOptionsButton.onclick=()=>{downloads.open=false;toggleStyle(true);selectSettingsTab(3)};moreActions.appendChild(exportOptionsButton);
const changeDataButton=document.createElement('button');changeDataButton.id='resultChangeData';changeDataButton.type='button';changeDataButton.className='secondary';changeDataButton.textContent='更換資料／模式';changeDataButton.onclick=()=>{downloads.open=false;showWorkspaceStage(1,false)};moreActions.appendChild(changeDataButton);
const periodDetails=document.createElement('details');periodDetails.id='resultPeriodDetails';periodDetails.innerHTML='<summary>分析期間</summary>';periodDetails.appendChild(context);resultsTools.after(periodDetails);
const chartNavigation=document.createElement('div');chartNavigation.id='resultChartNavigation';
const previousChart=document.createElement('button');previousChart.id='previousResultChart';previousChart.type='button';previousChart.className='secondary';previousChart.textContent='上一張';
const nextChart=document.createElement('button');nextChart.id='nextResultChart';nextChart.type='button';nextChart.className='secondary';nextChart.textContent='下一張';chartNavigation.append(previousChart,chartPickerLabel,nextChart);resultsTools.before(chartNavigation);
function moveResultChart(direction){const next=Number(chartPicker.value)+direction;if(next<0||next>=chartPicker.options.length)return;chartPicker.value=String(next);chartPicker.onchange()}
previousChart.onclick=()=>moveResultChart(-1);nextChart.onclick=()=>moveResultChart(1);
// The same chart selector works in step 2 and directly above the results.
for(const option of $('chartMode').options){if($('overviewView').querySelector('option[value="'+option.value+'"]'))continue;const copy=option.cloneNode(true);copy.dataset.resultMode='true';$('overviewView').appendChild(copy)}
const resultsExtra=document.createElement('details');resultsExtra.id='resultModeOptions';resultsExtra.innerHTML='<summary>這張圖的其他選項</summary>';resultsTools.before(resultsExtra);
for(const node of [$('overlayMetric').closest('label'),overlaySourceField,rainStationField,rainControls])resultsExtra.appendChild(node);
$('chartMode').closest('label').hidden=true;advancedComparison.hidden=true;
$('overviewView').closest('label').firstChild.textContent='圖表模式';
function placeResultControls(anchor,nodes){if(nodes.some((node,index)=>(index?nodes[index-1]:anchor).nextElementSibling!==node))anchor.after(...nodes)}
function syncResultTools(){
 const viewing=workspacePage==='plot'&&workspaceStage===3;
 resultsTools.hidden=periodDetails.hidden=!viewing;comparisonPanel.hidden=viewing||isQuickMode();
 chartNavigation.hidden=!viewing||chartPicker.options.length<2||['continuous','co2hour'].includes(value('chartMode'));
 placeResultControls(overviewControls,viewing?[chartNavigation,resultsExtra,resultsTools,periodDetails]:[comparisonPanel,resultsExtra]);
 $('overviewView').value=value('chartMode');
 for(const option of $('overviewView').querySelectorAll('[data-result-mode]')){option.hidden=false;option.disabled=$('chartMode').querySelector('option[value="'+option.value+'"]')?.disabled||isQuickMode()&&['difference','rainfall'].includes(option.value)}
 previousChart.disabled=Number(chartPicker.value)<=0;nextChart.disabled=Number(chartPicker.value)>=chartPicker.options.length-1;chartPickerLabel.hidden=chartNavigation.hidden;
 const mode=value('chartMode');resultsExtra.hidden=!['overlay','rainfall'].includes(mode);if(!viewing)resultsExtra.open=true;
 $('overlayMetric').closest('label').hidden=overlaySourceField.hidden=mode!=='overlay';rainControls.hidden=rainStationField.hidden=mode!=='rainfall';
 const chart=currentSettingsChart(),sources=new Set(resultCharts().flatMap(c=>c.data.datasets.map(datasetSource)));
 for(const source of sourceIds){
  const row=$('resultSource-'+source);row.hidden=!sources.has(source);row.querySelector('.result-source-name').textContent=sourceName(source);$('sourceShown-'+source).setAttribute('aria-label','顯示'+sourceName(source));row.classList.toggle('source-muted',!sourceIsShown(source));
  for(const key of keys)$('panelColor-'+source+'-'+key).closest('.source-legend-edit').hidden=$(legendPrefixes[source]+key).closest('label').hidden;
 }
 $('downloadCurrentPng').disabled=$('downloadPng').disabled=!chart;
 if(viewing)modeBar.hidden=true;
 profileHelp.hidden=viewing||mode!=='co2hour';$('profileMethod').title=profileHelp.textContent;$('diurnalStart').title=profileHelp.textContent;
 syncResultColors();syncSwapActions();
}
const pickerBeforeResultTools=syncChartPicker;syncChartPicker=function(){pickerBeforeResultTools();syncResultTools()};
const uiBeforeResultTools=syncExperimentUI;syncExperimentUI=function(){uiBeforeResultTools();syncResultTools()};
const studioBeforeResultTools=syncStudio;syncStudio=function(){studioBeforeResultTools();syncResultColors()};
const resetBeforeResultTools=applyDefaultFormat;applyDefaultFormat=function(){for(const source of sourceIds){$('sourceShown-'+source).checked=true;for(const key of keys)$('sourceColorValue-'+source+'-'+key).value=''}resetBeforeResultTools();syncResultTools()};
const restoreBeforeResultTools=restoreExperimentSettings;restoreExperimentSettings=function(saved){
 // Older settings have no source overrides or group switches.
 for(const source of sourceIds){$('sourceShown-'+source).checked=saved.settings['sourceShown-'+source]!==false;for(const key of keys){const id='sourceColorValue-'+source+'-'+key,stored=saved.settings[id];$(id).value=typeof stored==='string'&&/^#[\da-f]{6}$/i.test(stored)?stored:''}}
 restoreBeforeResultTools(saved);syncResultTools();
};

/* Exchange the data objects and their identity settings, without reading files again. */
const swapActions=document.createElement('div');swapActions.id='swapActions';swapActions.innerHTML='<button id="swapExperiments" type="button" class="secondary">交換 A ⇄ B</button><span id="swapStatus" role="status" class="results-sr-only"></span>';
sourcePanel.before(swapActions);
let resultImportsPending=0;
function syncSwapActions(){
 swapActions.hidden=isQuickMode()||workspacePage!=='plot'||Boolean(state.experimentDetail)||Boolean(state.querySubset);
 $('swapExperiments').disabled=!state.hive||!state.peer||resultImportsPending>0;
 if(workspaceStage===3){if(swapActions.parentNode!==chartActions)chartActions.insertBefore(swapActions,downloads)}else{const target=workspaceStage===1?sourcePanel:rangePanel;if(target.previousElementSibling!==swapActions)target.before(swapActions)}
}
const loadBeforeResultTools=load;load=async function(files,source){resultImportsPending++;syncSwapActions();try{return await loadBeforeResultTools(files,source)}finally{resultImportsPending--;syncResultTools()}};
const swappedSources={hive:'peer',peer:'hive',weather:'weatherPeer',weatherPeer:'weather'};
function exchangeSettings(settings){
 const original={...settings};
 for(const source of experimentSources)for(const suffix of ['Name','UseWeather','PeriodStart','PeriodEnd','Origin','OriginConfirmed'])if(Object.hasOwn(original,source+suffix))settings[source+suffix]=original[swappedSources[source]+suffix];
 for(const source of sourceIds){
  for(const key of keys)for(const [own,other]of [[legendPrefixes[source]+key,legendPrefixes[swappedSources[source]]+key],['sourceColorValue-'+source+'-'+key,'sourceColorValue-'+swappedSources[source]+'-'+key],['rain-'+source+'-'+key,'rain-'+swappedSources[source]+'-'+key]])if(Object.hasOwn(original,own))settings[own]=original[other];
  const id='sourceShown-'+source;if(Object.hasOwn(original,id))settings[id]=original['sourceShown-'+swappedSources[source]];
 }
 for(const id of ['filterSource','overlaySource','rainStation','querySource','anomalySource'])if(swappedSources[original[id]])settings[id]=swappedSources[original[id]];
 // These modes follow the same data, even when its A/B role changes.
 if(original.comparisonMode==='mine')settings.comparisonMode='peerOnly';else if(original.comparisonMode==='peerOnly')settings.comparisonMode='mine';
 return settings;
}
$('swapExperiments').onclick=()=>{
 if(!state.hive||!state.peer||resultImportsPending)return;
 stopRangeSelection();clearTimeout(formatPreviewTimer);formatPreviewTimer=null;
 const step=workspaceStage,scroll=scrollY,open=!stylePanel.hidden,period={start:value('startDate'),end:value('endDate'),mode:value('periodMode')};
 const ids=[...settingIds,'querySource','anomalySource'],settings=exchangeSettings(Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?checked(id):value(id)])));
 const original=Object.fromEntries(sourceIds.map(source=>[source,state[source]]));for(const source of sourceIds)state[source]=original[swappedSources[source]];
 for(const [id,setting]of Object.entries(settings)){if($(id).type==='checkbox')$(id).checked=setting;else $(id).value=setting}
 for(const source of experimentSources)experimentRangeReferences.set(source,state[source]);
 for(const saved of modeAnalyses.values()){exchangeSettings(saved.settings);saved.data.reverse()}
 const remapIdentity=id=>id.split('|').map(token=>swappedSources[token]||token).join('|');
 const hidden=[...selectedVisible].map(([id,shown])=>[remapIdentity(id),shown]);selectedVisible.clear();hidden.forEach(([id,shown])=>selectedVisible.set(id,shown));
 const points=[...manualLabels].map(remapIdentity);manualLabels.clear();points.forEach(id=>manualLabels.add(id));
 for(const [a,b]of [['hiveStatus','peerStatus'],['weatherStatus','weatherPeerStatus']]){const text=$(a).textContent;$(a).textContent=$(b).textContent;$(b).textContent=text}
 for(const source of sourceIds)$(source+'File').value='';
 comparisonCache=null;state.experimentDetail=null;experimentOverviewReturn=null;state.querySubset=null;invalidateQuery('A／B 已交換，請重新查詢。');invalidateAnomalies();
 // Rebuild file mapping controls with closures bound to their new source.
 // setup preserves the import position when it sees an existing import stage.
 workspaceStage=1;setup();workspaceStage=step;
 $('startDate').value=period.start;$('endDate').value=period.end;$('periodMode').value=period.mode;syncPeriodUI();
 markDirty();syncExperimentData();syncComparison();syncExperimentUI();
 if(step===3){render();if(open)toggleStyle(true)}
 $('swapStatus').textContent='已交換：A 為「'+sourceName('hive')+'」，B 為「'+sourceName('peer')+'」。可再按一次換回。';
 requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
};
syncResultTools();
