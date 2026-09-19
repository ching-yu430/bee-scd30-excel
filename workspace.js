/* Progressive disclosure: calculation first, presentation beside the result. */
function section(title,open=false){const d=document.createElement('details');d.className='editor-section';d.open=open;const s=document.createElement('summary');s.textContent=title;d.appendChild(s);return d}
function moveFields(target,ids){ids.forEach(id=>{const el=$(id);if(el)target.appendChild(el.closest('label')||el)})}
const oldEditor=document.querySelector('.format-panel');
const editor=document.createElement('section');editor.className='chart-editor';editor.innerHTML='<div class="editor-heading"><h3>編輯圖表</h3><span>改完即時預覽 · 不改變原始資料</span></div><div id="quickLabels" class="quick-labels"></div><p class="help-text">點選曲線可標示數值；也可在圖下指定時間。最高／最低依目前圖表計算，同值取最早一點。</p>';
moveFields(editor.querySelector('#quickLabels'),['pickPoints','showMax','showMin']);
const textPanel=section('標題與文字');moveFields(textPanel,['chartTitle','chartSubtitle','xAxisTitle','fontSize']);editor.appendChild(textPanel);
const appearance=section('線條、顏色與數值樣式');appearance.appendChild($('metricControls'));moveFields(appearance,['lineWidth','showPoints','pointStyle','pointSize','labelDecimals','showValues','labelLimit','showGrid','showLegend']);editor.appendChild(appearance);
const axes=section('座標軸與參考線（進階）');moveFields(axes,['beginZero','referenceMetric','referenceValue']);axes.appendChild($('axisSettings'));editor.appendChild(axes);
const exportPanel=section('下載品質與設定檔');moveFields(exportPanel,['exportWidth']);exportPanel.appendChild($('saveSettings'));exportPanel.appendChild($('loadSettings').closest('label'));exportPanel.appendChild($('resetFormat'));editor.appendChild(exportPanel);
const apply=$('applyFormat');apply.hidden=true;editor.appendChild(apply);oldEditor.remove();$('chartCard').insertBefore(editor,$('charts'));
const filter=document.querySelector('.filter-panel'),fold=section('需要時再篩選資料');filter.before(fold);fold.appendChild(filter);
const method=section('進階：條件要套用在哪裡？');moveFields(method,['filterSource','filterStage']);method.insertAdjacentHTML('beforeend','<p id="filterExample" class="explanation"></p>');filter.appendChild(method);
const stageSelect=$('filterStage');stageSelect.options[0].text='挑出符合條件的原始紀錄，再計算平均';stageSelect.options[1].text='保留平均值符合條件的時段';stageSelect.closest('label').firstChild.textContent='你想篩選什麼？';
const modeInfo=document.createElement('p');modeInfo.id='modeExplanation';modeInfo.className='explanation';$('chartMode').closest('.controls-grid').after(modeInfo);
const modeDescriptions={continuous:'按日期先後看變化：溫度、濕度、CO₂ 各一張圖，可比較內外部。',daily:'每天分開看：每個日期、每個指標各一張圖。建議先選少量日期。',combined:'把三個指標放在同一張圖，各自使用不同單位的縱軸。',co2hour:'將所選日期的相同小時取平均，呈現 24 小時變化。',overlay:'內部資料每日各一條線，依時間對齊比較。',difference:'看蜂箱比外面高或低多少：同時段內部平均 − 外部平均。只比較溫度與濕度，需要外站資料。'};
const overlay=$('overlayMetric').closest('label');overlay.firstChild.textContent='這次要比較哪個指標？';
function explain(){const mode=value('chartMode');overlay.hidden=mode!=='overlay';modeInfo.textContent=modeDescriptions[mode];$('aggregation').disabled=mode==='co2hour';$('filterExample').textContent=mode==='co2hour'?'24 小時 CO₂ 圖固定使用「挑出原始紀錄，再平均」，不使用時段平均的篩選方式。':stage()==='raw'?'例如：同一小時有 1000、3000 ppm，條件 > 2500。先保留 3000，再平均，結果為 3000。適合研究「超標紀錄」。':'例如：同一小時有 1000、3000 ppm，先平均為 2000。條件 > 2500，因此整個小時不顯示。適合研究「平均超標的時段」。'}
const priorRender=render;render=function(){priorRender();explain()};$('renderButton').onclick=render;
const formatIds=[...Object.keys(formatDefaults),...keys.flatMap(k=>['axisMin-'+k,'axisMax-'+k,'axisStep-'+k,'innerName-'+k,'outerName-'+k])];
for(const id of formatIds)$(id).onchange=()=>{const needsCalculation=state.dirty;markDirty();try{validateSettings();if(state.output.length){if(needsCalculation){render()}else{draw();state.dirty=false;$('analysisStatus').textContent='圖表外觀已更新。'}}}catch(e){$('analysisStatus').textContent=e.message}};
for(const id of ['chartMode','overlayMetric','aggregation','filterStage']){const before=$(id).onchange;$(id).onchange=()=>{before?.();explain()}}
const clear=document.createElement('button');clear.className='secondary';clear.textContent='清除手動標示';clear.onclick=()=>{manualLabels.clear();[...state.charts,...(state.co2Chart?[state.co2Chart]:[])].forEach(refreshPointLabels)};$('quickLabels').appendChild(clear);
for(const id of ['hiveFile','weatherFile'])$(id).addEventListener('change',()=>manualLabels.clear());
const encoding=document.querySelector('.encoding');const encodingFold=section('欄位亂碼？調整 CSV 編碼');encoding.before(encodingFold);encodingFold.appendChild(encoding);
const extra=section('更多資料處理選項');moveFields(extra,['missing']);$('controlsCard').appendChild(extra);
document.querySelector('.hero h2').textContent='選好資料，看圖，再標出重點。';document.querySelector('.hero-note').innerHTML='<strong>只要三步</strong><ol><li>匯入資料，確認時間</li><li>選期間與圖表，按更新</li><li>點選重點，下載圖片</li></ol>';
document.querySelector('footer').textContent='蜂箱環境資料分析台 v8 · 資料僅在瀏覽器處理 · 請以台灣時區使用';explain();
