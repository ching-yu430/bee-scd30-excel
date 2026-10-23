/* Keep navigation and actions visible while one settings category scrolls. */
const settingsTabs=document.createElement('div');settingsTabs.id='settingsTabs';settingsTabs.setAttribute('role','tablist');settingsTabs.setAttribute('aria-label','圖表設定分類');
const settingsScroll=document.createElement('div');settingsScroll.id='settingsScroll';
const settingsContext=document.createElement('p');settingsContext.id='settingsChartContext';
stylePanel.querySelector('.style-header').after(settingsContext,settingsTabs,settingsScroll);
settingsScroll.append(editFold,exportSection);stylePanel.appendChild(styleFeedback);
stylePanel.querySelector('.studio-intro').remove();
// The existing workspace download synchronizer still uses this introductory node.
const settingsIntro=document.createElement('p');settingsIntro.className='studio-intro';settingsIntro.hidden=true;settingsScroll.prepend(settingsIntro);
const settingsGroups=[lookGroup,annotationGroup,axisGroup,exportSection];
const settingsNames=['圖例外觀','數值標註','座標軸','匯出設定'];
const settingsPositions=new Map();let activeSettingsTab=0;
settingsGroups.forEach((group,index)=>{
 const tab=document.createElement('button');tab.type='button';tab.id='settingsTab-'+index;tab.textContent=settingsNames[index];tab.setAttribute('role','tab');tab.setAttribute('aria-controls',group.id);tab.onclick=()=>selectSettingsTab(index);
 group.setAttribute('role','tabpanel');group.setAttribute('aria-labelledby',tab.id);group.tabIndex=0;group.open=true;
 settingsTabs.appendChild(tab);
});
function selectSettingsTab(index){
 settingsPositions.set(activeSettingsTab,settingsScroll.scrollTop);activeSettingsTab=index;
 syncSettingsTabs();settingsScroll.scrollTop=settingsPositions.get(index)||0;
}
function syncSettingsTabs(){
 const plot=workspacePage==='plot';settingsTabs.hidden=!plot;settingsContext.hidden=!plot;
 settingsGroups.forEach((group,index)=>{
  group.hidden=plot?index!==activeSettingsTab:index!==3;
  group.open=true;group.querySelector(':scope > summary').hidden=plot;
  const tab=$('settingsTab-'+index);tab.setAttribute('aria-selected',String(index===activeSettingsTab));tab.tabIndex=index===activeSettingsTab?0:-1;
  group.setAttribute('role',plot?'tabpanel':'group');
 });
 settingsIntro.hidden=true;
 if(plot)styleButton.textContent='圖表設定';
 syncSettingsChartContext();
}
settingsTabs.onkeydown=event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?3:(activeSettingsTab+(event.key==='ArrowLeft'?3:1))%4;
 selectSettingsTab(next);$('settingsTab-'+next).focus();
};
const downloadsBeforeSettingsTabs=syncPanelDownloads;
syncPanelDownloads=function(){downloadsBeforeSettingsTabs();syncSettingsTabs()};
// Keep CSV in exports; the footer has two predictable primary actions.
exportActions.prepend($('panelDownloadCsv'));
const manualSettings=section('指定時間點（需要時展開）');manualSettings.classList.add('settings-manual');pointHost.before(manualSettings);manualSettings.append(pointHost,pointEmpty);
const pointEditorBeforeSettingsTabs=addPointEditor;
addPointEditor=function(chart){pointEditorBeforeSettingsTabs(chart);const panel=[...pointHost.children].find(node=>node.dataset.canvas===chart.canvas.id);if(panel)panel.open=true};
for(const ids of [['fontSize','lineWidth'],['labelDecimals','labelLimit'],['pointStyle','pointSize'],['referenceMetric','referenceValue']]){
 const row=document.createElement('div');row.className='settings-field-row';$(ids[0]).closest('label').before(row);moveFields(row,ids);
}
function currentSettingsChart(){return [...state.charts,...(state.co2Chart?[state.co2Chart]:[])].find(chart=>{const card=chart.canvas.closest('.chart-card');return card&&!card.hidden&&!card.classList.contains('hidden')})}
function syncSettingsChartContext(){
 const chart=currentSettingsChart();settingsContext.textContent=chart?'目前圖表：'+(chart.$title||chart.canvas.closest('.chart-card').querySelector('h3')?.textContent||'圖表'):'產生圖表後即可調整';
 const metrics=new Set(chart?chart.data.datasets.map(metricOf):keys);
 for(const key of keys){
  $('metricControls').querySelector('[data-metric="'+key+'"]')?.closest('label').toggleAttribute('hidden',!metrics.has(key));
  $('axisTitle-'+key).closest('label').hidden=!metrics.has(key);$('axisMin-'+key).closest('.axis-group').hidden=!metrics.has(key);
 }
 const rain=value('chartMode')==='rainfall';$('rainColor').closest('label').hidden=!rain;$('rainAxisTitle').closest('label').hidden=!rain;
 for(const key of keys)for(const source of sourceIds){
  const input=$(legendPrefixes[source]+key),field=input.closest('label');field.classList.add('settings-legend-row');
  if(chart)field.hidden=!chart.data.datasets.some(dataset=>metricOf(dataset)===key&&(String(dataset.sourceId).split('|')[0]===source||value('chartMode')==='difference'&&source==='hive'));
  let stroke=field.querySelector('.settings-source-stroke');
  if(!stroke){stroke=document.createElementNS('http://www.w3.org/2000/svg','svg');stroke.classList.add('settings-source-stroke');stroke.setAttribute('viewBox','0 0 32 10');stroke.setAttribute('aria-hidden','true');const line=document.createElementNS(stroke.namespaceURI,'line');for(const [name,value]of Object.entries({x1:0,x2:32,y1:5,y2:5,'stroke-width':2.5}))line.setAttribute(name,value);stroke.appendChild(line);field.prepend(stroke)}
  stroke.firstChild.setAttribute('stroke',state.metrics[key].color);stroke.firstChild.setAttribute('stroke-dasharray',sourceDash(source).join(' '));
 }
}
const studioBeforeSettingsTabs=syncStudio;syncStudio=function(){studioBeforeSettingsTabs();syncSettingsChartContext()};
const drawBeforeSettingsTabs=draw;draw=function(){const top=settingsScroll.scrollTop;drawBeforeSettingsTabs();settingsScroll.scrollTop=top};
syncSettingsTabs();
