/* Presentation only: move existing controls, retaining their values and handlers. */
function studioBlock(parent,title,hint=''){
 const block=document.createElement('section');block.className='studio-block';
 const h=document.createElement('h4');h.textContent=title;block.appendChild(h);
 if(hint){const p=document.createElement('p');p.className='studio-hint';p.textContent=hint;block.appendChild(p)}
 parent.appendChild(block);return block;
}
function studioGroup(parent,id,title,hint){
 const group=section(title);group.id=id;group.classList.add('studio-group');
 const small=document.createElement('span');small.className='studio-summary-hint';small.textContent=hint;group.querySelector('summary').appendChild(small);
 parent.appendChild(group);return group;
}
function studioLabel(id,text){
 const input=$(id),field=input?.closest('label');if(!field)return;
 for(const node of [...field.childNodes])if(node.nodeType===3)node.remove();
 const span=document.createElement('span');span.className='field-caption';span.textContent=text;
 if(input.type==='checkbox')field.appendChild(span);else field.prepend(span);
 input.setAttribute('aria-label',text);
}
// Keep a visible swatch and readable color value for every palette control.
function syncStudioColors(){
 for(const input of stylePanel.querySelectorAll('input[type=color]')){
  const field=input.closest('label');if(!field)continue;
  field.classList.add('studio-color-field');
  if(!field.querySelector('.color-copy')){
   const copy=document.createElement('span');copy.className='color-copy';
   for(const node of [...field.childNodes])if(node!==input)copy.appendChild(node);
   const code=document.createElement('output');code.className='color-code';code.setAttribute('aria-hidden','true');copy.appendChild(code);
   field.prepend(copy);
  }
  field.querySelector('.color-code').textContent=input.value.toUpperCase();
  input.style.backgroundColor=input.value;
  input.title='點選變更顏色：'+input.value.toUpperCase();
 }
}
const studioEditor=document.querySelector('.chart-editor');
const oldStudioGroups=[...studioEditor.querySelectorAll(':scope > .editor-section')];
const lookGroup=studioGroup(studioEditor,'studioAppearance','圖表外觀','標題、文字、線條與圖例');
const annotationGroup=studioGroup(studioEditor,'studioAnnotations','數值與標註','指定時間、最高／最低值與超標區域');
const axisGroup=studioGroup(studioEditor,'studioAxes','座標軸','軸標題、顯示範圍與格線');
// Rainfall originally puts color and axis title inside the same label.
const oldRainField=$('rainColor').closest('label');
for(const id of ['rainColor','rainAxisTitle']){const field=document.createElement('label');oldRainField.before(field);field.appendChild($(id))}oldRainField.remove();

const titleBlock=studioBlock(lookGroup,'標題與文字');moveFields(titleBlock,['chartTitle','chartSubtitle','fontSize']);
const lineBlock=studioBlock(lookGroup,'線條與顏色','同一指標共用顏色；資料來源以線型區分。');
lineBlock.appendChild($('metricControls'));moveFields(lineBlock,['rainColor','lineWidth']);
controls=function(){return keys.map(k=>'<label class="metric studio-color"><strong>'+label(k)+'</strong><input data-metric="'+k+'" data-prop="color" type="color" value="'+state.metrics[k].color+'" aria-label="'+label(k)+'線條顏色"></label>').join('')};
const legendBlock=studioBlock(lookGroup,'圖例');moveFields(legendBlock,['showLegend']);
const legendNames=section('修改圖例名稱');legendNames.classList.add('studio-nested');legendBlock.appendChild(legendNames);
for(const k of keys){const group=studioBlock(legendNames,label(k));moveFields(group,['innerName-'+k,'peerName-'+k,'outerName-'+k]);studioLabel('innerName-'+k,'我的蜂箱');studioLabel('peerName-'+k,'他人的蜂箱');studioLabel('outerName-'+k,'外部氣象站')}

const manualBlock=studioBlock(annotationGroup,'手動指定','開啟點選標註後，點圖上的資料點；或展開下方時間選擇。');
moveFields(manualBlock,['pickPoints']);manualBlock.appendChild(clear);
const pointHost=document.createElement('div');pointHost.id='studioPointEditors';manualBlock.appendChild(pointHost);
const pointEmpty=document.createElement('p');pointEmpty.id='studioPointEmpty';pointEmpty.className='studio-hint';pointEmpty.textContent='產生圖表後，可在這裡指定時間點。';manualBlock.appendChild(pointEmpty);
const autoBlock=studioBlock(annotationGroup,'自動標註','最高／最低值依目前圖表計算；同值取最早一點。');moveFields(autoBlock,['showMax','showMin','showValues']);
autoBlock.classList.add('studio-choice-group');
const numberBlock=studioBlock(annotationGroup,'數值格式');moveFields(numberBlock,['labelDecimals','labelLimit']);
const markerBlock=studioBlock(annotationGroup,'標記點');moveFields(markerBlock,['showPoints','pointStyle','pointSize']);
const referenceBlock=studioBlock(annotationGroup,'參考線');moveFields(referenceBlock,['referenceMetric','referenceValue']);
const shadingBlock=studioBlock(annotationGroup,'超標區域','先在「異常檢查」設定門檻並執行檢查，這裡只調整顏色。');moveFields(shadingBlock,['shadeShort','shadeLong']);

const axisText=studioBlock(axisGroup,'座標軸標題');moveFields(axisText,['xAxisTitle']);
for(const k of keys){const field=document.createElement('label');field.innerHTML='<span class="field-caption">'+label(k)+'縱軸</span><input id="axisTitle-'+k+'" data-metric="'+k+'" data-prop="title" type="text" maxlength="100" aria-label="'+label(k)+'縱軸標題">';axisText.appendChild(field);$('axisTitle-'+k).value=state.metrics[k].title}
moveFields(axisText,['rainAxisTitle']);
const axisBounds=studioBlock(axisGroup,'縱軸範圍與刻度','留白時自動安排。僅改變顯示，不篩除資料。');axisBounds.appendChild($('axisSettings'));moveFields(axisBounds,['beginZero']);
const axisGrid=studioBlock(axisGroup,'格線');moveFields(axisGrid,['showGrid']);

// Retain these nodes: existing workspace switching refers to them directly.
exportSection.id='studioExport';exportSection.classList.add('studio-group');
exportSection.querySelector('summary').textContent='下載與設定檔';
const exportHint=document.createElement('span');exportHint.className='studio-summary-hint';exportHint.textContent='圖表圖片、資料與可重用設定';exportSection.querySelector('summary').appendChild(exportHint);
const oldExportBody=exportSection.querySelector('.export-settings');
const savedControls=['exportWidth','includeNotes','saveSettings','loadSettings','resetFormat'].map(id=>$(id).closest('label')||$(id));
const downloadOptions=document.createElement('div');downloadOptions.className='export-settings studio-export-options';
const imageOptions=studioBlock(downloadOptions,'圖片設定');moveFields(imageOptions,['exportWidth','includeNotes']);
oldExportBody.before(downloadOptions);oldExportBody.remove();
const reusable=studioBlock(downloadOptions,'重用分析設定','設定檔保留分析與外觀設定，不包含上傳的原始資料。');
reusable.append(...savedControls.slice(2));
// Place image quality directly before its download buttons, settings afterward.
exportActions.before(downloadOptions);imageOptions.after(exportActions);downloadOptions.appendChild(reusable);
const dataActions=document.createElement('div');dataActions.className='panel-downloads studio-data-downloads';exportSection.appendChild(dataActions);dataActions.append($('exportQuery'),$('downloadEvents'),$('downloadAnomalies'));

oldStudioGroups.forEach(group=>group.remove());
$('quickLabels').remove();studioEditor.querySelector(':scope > .help-text')?.remove();
studioEditor.querySelector('.editor-heading')?.remove();
// Exact-time editors now live next to other annotation controls, not below charts.
const pointEditorBeforeStudio=addPointEditor;
addPointEditor=function(chart){pointEditorBeforeStudio(chart);const panel=chart.canvas.closest('.chart-card').querySelector('.point-editor');panel.dataset.canvas=chart.canvas.id;panel.querySelector('summary').textContent='指定要標註的時間點';panel.querySelector('.point-add').textContent='標註這個時間點';panel.querySelector('p').textContent='選擇線條及圖上實際時間；無完全相符的時間時，可選擇提示的鄰近資料點。';pointHost.appendChild(panel)};
function syncStudio(){
 syncStudioColors();
 for(const k of keys)$('axisTitle-'+k).value=state.metrics[k].title;
 const charts=[...state.charts,...(state.co2Chart?[state.co2Chart]:[])];
 for(const panel of pointHost.children){const chart=charts.find(c=>c.canvas.id===panel.dataset.canvas),card=chart?.canvas.closest('.chart-card');panel.hidden=!card||card.hidden||card.classList.contains('hidden')}
 pointEmpty.hidden=charts.length>0;
 $('pointStyle').disabled=!checked('showPoints');$('pointSize').disabled=!(checked('showPoints')||checked('showValues')||checked('showMax')||checked('showMin')||checked('pickPoints')||manualLabels.size);
 $('referenceValue').disabled=!value('referenceMetric');
}
const pickerBeforeStudio=syncChartPicker;syncChartPicker=function(){pickerBeforeStudio();syncStudio()};
const drawBeforeStudio=draw;draw=function(){const open=Boolean(pointHost.querySelector('details[open]'));pointHost.replaceChildren();drawBeforeStudio();syncStudio();if(open)for(const panel of pointHost.children)panel.open=true};
const panelsBeforeStudio=syncPanelDownloads;syncPanelDownloads=function(){panelsBeforeStudio();const plot=workspacePage==='plot',title=plot?'外觀、標註與下載':'資料下載';stylePanel.querySelector('h2').textContent=title;stylePanel.setAttribute('aria-label',title);styleButton.textContent=plot?title:'下載結果';exportSection.querySelector('summary').firstChild.textContent=plot?'下載與設定檔':'下載結果';stylePanel.querySelector('.studio-intro').hidden=!plot;exportActions.hidden=!plot;dataActions.hidden=plot;exportHint.textContent=plot?'圖表圖片、資料與可重用設定':'依目前分頁下載查詢或檢查結果'};

const studioLabels={chartTitle:'圖表標題',chartSubtitle:'副標題（選填）',fontSize:'圖表文字大小（px）',lineWidth:'線條粗細（px）',rainColor:'降水量',showLegend:'顯示圖例',pickPoints:'點選資料點標註',showMax:'標註最高值',showMin:'標註最低值',showValues:'自動挑選數值標註',labelDecimals:'數值小數位數',labelLimit:'自動標註／標記點上限（每條線）',showPoints:'顯示標記點',pointStyle:'標記點形狀',pointSize:'標記點大小（px）',referenceMetric:'參考線指標',referenceValue:'參考線數值',shadeShort:'短暫超標',shadeLong:'持續超標',xAxisTitle:'橫軸標題（留白則自動）',rainAxisTitle:'降水量縱軸',beginZero:'縱軸由 0 開始',showGrid:'顯示格線',exportWidth:'圖片寬度（px）',includeNotes:'圖片附上分析條件'};
for(const [id,text]of Object.entries(studioLabels))studioLabel(id,text);
clear.textContent='清除手動標註';$('saveSettings').textContent='下載分析設定（JSON）';$('resetFormat').textContent='還原圖表外觀';
const settingsLabel=$('loadSettings').closest('label');for(const node of [...settingsLabel.childNodes])if(node.nodeType===3)node.textContent='載入分析設定（JSON）';
$('resetFormat').title='只還原圖表外觀，不清除上傳資料、日期或篩選條件。';
$('co2Preset').textContent='範例：我的蜂箱 CO₂ ＞ 2500';$('queryPreset').textContent='我的蜂箱 CO₂ ＞ 2500';
for(const [id,text]of [['querySource','資料來源'],['queryDateMode','日期範圍'],['queryMetric','查詢指標'],['queryOp','數值條件'],['filterSource','套用來源'],['filterStage','篩選方式'],['overlayMetric','每日疊圖指標'],['overlaySource','每日疊圖來源']])studioLabel(id,text);
for(const k of keys){studioLabel('axisMin-'+k,'最小值');studioLabel('axisMax-'+k,'最大值');studioLabel('axisStep-'+k,'刻度間距')}
$('peerFile').closest('.file-button').setAttribute('aria-label','選擇他人的蜂箱資料');
stylePanel.setAttribute('aria-label','外觀、標註與下載');
stylePanel.querySelector('.style-header').after(Object.assign(document.createElement('p'),{className:'studio-intro',textContent:'外觀即時套用；原始資料不變。'}));
document.addEventListener('change',e=>{if(stylePanel.contains(e.target))syncStudio()});
document.addEventListener('input',e=>{if(stylePanel.contains(e.target)&&e.target.type==='color')syncStudioColors()});
const resetBeforeStudio=applyDefaultFormat;applyDefaultFormat=function(){resetBeforeStudio();syncStudio()};
syncStudio();syncPanelDownloads();
// The legacy tab listener collapses sources after switching; step 1 should stay useful.
tabs.addEventListener('click',()=>{if(workspacePage==='plot'&&workspaceStage===1)sourcePanel.open=true});
document.documentElement.dataset.uiRelease='22';
