/* Independent cohorts: never concatenate different hives into one mean. */
function sourceDate(row,d){return !d.mapping.clock&&row[d.mapping.time] instanceof Date?row[d.mapping.time]:rowDate(row,d)}
function sourceBounds(d){
 if(!d?.mapping.time)return null;
 let min=Infinity,max=-Infinity;
 if(d.batches&&d.rows.length)return {min:+d.rows[0][d.mapping.time],max:+d.rows.at(-1)[d.mapping.time]};
 for(const row of d.rows){const t=sourceDate(row,d);if(t){min=Math.min(min,+t);max=Math.max(max,+t)}}
 return Number.isFinite(min)?{min,max}:null;
}
function comparisonBounds(common=false){const bounds=activePlotSources().map(s=>sourceBounds(state[s])).filter(Boolean);if(!bounds.length)return null;const min=Math[common?'max':'min'](...bounds.map(b=>b.min)),max=Math[common?'min':'max'](...bounds.map(b=>b.max));return min<=max?{min,max}:null}
updatePreview=function(){let el=$('timePreview');if(!el){el=document.createElement('div');el.id='timePreview';$('mappingCard').appendChild(el)}el.innerHTML=sourceIds.filter(s=>state[s]).map(s=>{const d=state[s],b=sourceBounds(d);return '<p><strong>'+sourceName(s)+'</strong>：'+(b?local(new Date(b.min)).replace('T',' ')+' ～ '+local(new Date(b.max)).replace('T',' '):'沒有有效時間')+'</p>'}).join('')};
function seriesName(source,key){return value(({hive:'innerName-',peer:'peerName-',weather:'outerName-'})[source]+key,sourceName(source)+' '+label(key))}
function sourceSeries(source,key,data){return {sourceId:source,metricKey:key,customName:true,label:seriesName(source,key),data,borderColor:state.metrics[key].color,backgroundColor:'transparent',borderDash:source==='peer'?[8,4,2,4]:source==='weather'?[12,7]:[],borderWidth:2,pointRadius:0,tension:0,spanGaps:value('missing')==='connect',yAxisID:key}}
makeSets=function(k,day=null){return activePlotSources().map(source=>sourceSeries(source,k,dataFor(k,source,day))).filter(s=>s.data.length)};
const modeBeforeComparison=effectiveMode;effectiveMode=function(){return value('chartMode')==='co2hour'?'hour':modeBeforeComparison()};

// Aggregate in one pass. Do not allocate a second six-million-object raw table.
let comparisonCache=null;
calculate=function(){
 const signature=JSON.stringify([activePlotSources(),value('startDate'),value('endDate'),effectiveMode(),stage(),value('filterSource'),...keys.flatMap(k=>[value(k+'Op'),value(k+'Min'),value(k+'Max')]),...sourceIds.map(s=>[state[s]?.mapping,state[s]?.format])]);
 if(comparisonCache&&comparisonCache.signature===signature&&comparisonCache.subset===state.querySubset&&sourceIds.every((s,i)=>comparisonCache.data[i]===state[s])){validateSettings();Object.assign(state,comparisonCache.result);return comparisonCache.count}
 state.output=[];state.raw=[];state.hourBinsBySource={};state.stats={invalidTime:0,missing:0,filtered:0,filteredBins:0};
 validateSettings();const start=+new Date(value('startDate')),end=+new Date(value('endDate'));
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)throw Error('開始與結束時間無效');
 const sources=activePlotSources(),mode=effectiveMode(),filterStage=stage(),groups=new Map();let count=0;
 if(!sources.length)throw Error('請匯入所選比較方式需要的資料。');
 for(const source of sources){const d=state[source];if(!d.mapping.time)continue;
 const bins=Array.from({length:24},()=>({sum:0,n:0}));if(source!=='weather')state.hourBinsBySource[source]=bins;
 for(const row of d.rows){if(state.querySubset&&!state.querySubset[source]?.has(row))continue;
 const date=sourceDate(row,d);if(!date||!Number.isFinite(+date)){state.stats.invalidTime++;continue}if(date<start||date>end)continue;
 const t=bucket(date,mode);
 for(const key of keys){const col=d.mapping[key];if(!col)continue;const raw=row[col],v=Number(raw);if(raw===null||raw===undefined||String(raw).trim()===''||!Number.isFinite(v)){state.stats.missing++;continue}
 if(filterStage==='raw'&&!keep(key,v,source)){state.stats.filtered++;continue}count++;
 if(key==='co2'&&source!=='weather'){const b=bins[date.getHours()];b.sum+=v;b.n++}
 const id=source+'|'+key+'|'+t;let g=groups.get(id);if(!g){g={source,key,time:t,sum:0,n:0};groups.set(id,g)}g.sum+=v;g.n++;
 if(groups.size>300000)throw Error('圖表超過 30 萬個資料點，請縮短期間或選每 5 分鐘／每小時平均；原始資料仍可在查詢分頁查閱。');
 }}}
 state.output=[...groups.values()].map(g=>({...g,value:g.sum/g.n})).filter(g=>{if(filterStage==='aggregate'&&!keep(g.key,g.value,g.source)){state.stats.filteredBins++;return false}return true}).sort((a,b)=>a.time-b.time);
 const result={output:state.output,hourBinsBySource:state.hourBinsBySource,stats:state.stats};comparisonCache={signature,subset:state.querySubset,data:sourceIds.map(s=>state[s]),result,count:state.output.length?count:0};
 return comparisonCache.count;
};
drawCO2Daily=function(){
 const bins=state.hourBinsBySource||{},sources=activePlotSources().filter(s=>s!=='weather'&&bins[s]?.some(b=>b.n));
 if(!sources.length){$('charts').textContent='此期間沒有符合條件的蜂箱 CO₂ 資料。';return}
 $('co2DailyCard').classList.remove('hidden');$('co2DailyCard').querySelector('h3').textContent='CO₂ 24 小時平均圖';
 const sets=sources.map(s=>({...sourceSeries(s,'co2',bins[s].map(b=>b.n?b.sum/b.n:null)),yAxisID:'y',spanGaps:false}));
 state.hourBins=bins.hive||bins.peer;
 state.co2Chart=createChart($('co2DailyChart'),{type:'line',data:{labels:Array.from({length:24},(_,h)=>String(h).padStart(2,'0')+':00'),datasets:sets},options:opts({x:{ticks:{autoSkip:false},title:{display:true,text:'每日時間'}},y:{title:{display:true,text:state.metrics.co2.title}}})});
};
differenceRows=function(){const rows=[];for(const source of activePlotSources().filter(s=>s!=='hive'))for(const key of keys){const other=new Map(state.output.filter(r=>r.source===source&&r.key===key).map(r=>[r.time,r]));for(const a of state.output){if(a.source!=='hive'||a.key!==key)continue;const b=other.get(a.time);if(b)rows.push({time:a.time,key,source,value:a.value-b.value,internal:a.value,external:b.value,internal_n:a.n,external_n:b.n})}}return rows.sort((a,b)=>a.time-b.time)};
drawDifference=function(){
 $('charts').replaceChildren();state.differences=differenceRows();
 if(!state.differences.length){$('charts').textContent='差值需要我的蜂箱與另一來源在相同時間桶都有數據；不插補、不配對相鄰時刻。';return}
 for(const key of keys){const sets=activePlotSources().filter(s=>s!=='hive').map(source=>{
 const rows=state.differences.filter(r=>r.key===key&&r.source===source),data=[],step=effectiveMode()==='day'?86400000:3600000;
 rows.forEach((r,i)=>{if(i&&r.time-rows[i-1].time>step*1.8)data.push({x:rows[i-1].time+step,y:null});data.push({x:r.time,y:r.value})});
 return {...sourceSeries(source,key,data),label:'我的蜂箱 − '+sourceName(source)};
 }).filter(s=>s.data.length);if(sets.length)insertChart('diff-'+key,label(key)+'差值',sets,{x:xScale(),[key]:{title:{display:true,text:label(key)+'差值（'+(key==='humidity'?'百分點':units[key])+'）'}}})}
};
const csvBeforeComparison=currentCsv;
currentCsv=function(){
 const mode=value('chartMode');let rows;
 if(mode==='co2hour'){const start=numberSetting('diurnalStart',0);rows=[['資料來源','時段','CO₂平均值（ppm）','樣本數']];for(const s of activePlotSources().filter(s=>s!=='weather'))for(let i=0;i<24;i++){const h=(start+i)%24,b=state.hourBinsBySource?.[s]?.[h]||{n:0};rows.push([sourceName(s),String(h).padStart(2,'0')+':00',b.n?b.sum/b.n:'',b.n])}}
 else if(mode==='difference')rows=[['時間','比較來源（我的蜂箱減此來源）','指標','差值','我的平均值','比較平均值','我的樣本數','比較樣本數'],...(state.differences||[]).map(r=>[local(new Date(r.time)),sourceName(r.source),label(r.key),r.value,r.internal,r.external,r.internal_n,r.external_n])];
 else if(mode==='rainfall')return csvBeforeComparison();
 else rows=[['時間','資料來源','指標','平均值','樣本數'],...state.output.filter(r=>mode!=='overlay'||r.source===value('overlaySource','hive')&&r.key===value('overlayMetric')).map(r=>[local(new Date(r.time)),sourceName(r.source),label(r.key),r.value,r.n])];
 return rows.map(r=>r.map(csvCell).join(',')).join('\n');
};

const comparisonPanel=document.createElement('div');comparisonPanel.className='comparison-panel';
comparisonPanel.innerHTML='<label>比較方式<select id="comparisonMode"><option value="mine">只看我的蜂箱</option><option value="peerOnly">只看他人的蜂箱</option><option value="weather" selected>我的蜂箱 ＋ 外部氣象站</option><option value="hives">我的蜂箱 ＋ 他人的蜂箱</option><option value="all">兩個蜂箱 ＋ 外部氣象站</option></select></label><button id="commonPeriod" class="secondary" type="button">使用共同資料期間</button><p id="comparisonStatus" role="status"></p>';
document.querySelector('#controlsCard > .section-heading').after(comparisonPanel);
$('peerFile').onchange=e=>e.target.files.length&&load(e.target.files,'peer');
for(const id of ['querySource','anomalySource','filterSource']){const select=$(id);if(!select)continue;const current=select.value;select.replaceChildren();for(const [s,text]of [['both','全部已載入來源'],...sourceIds.map(s=>[s,sourceName(s)])]){const o=document.createElement('option');o.value=s;o.textContent=text;select.appendChild(o)}select.value=current}
const overlaySourceField=document.createElement('label');overlaySourceField.className='overlay-setting';overlaySourceField.innerHTML='每日疊圖來源<select id="overlaySource"><option value="hive">我的蜂箱</option><option value="peer">他人的蜂箱</option></select>';$('overlayMetric').closest('label').after(overlaySourceField);
for(const key of keys){const own=$('innerName-'+key),ext=$('outerName-'+key);own.value='我的蜂箱 '+label(key);ext.value='外部氣象站 '+label(key);own.parentElement.firstChild.textContent='我的蜂箱序列名稱';ext.parentElement.firstChild.textContent='氣象站序列名稱';const field=document.createElement('label');field.innerHTML='他人的蜂箱序列名稱<input id="peerName-'+key+'" maxlength="60" value="他人的蜂箱 '+label(key)+'">';own.closest('.axis-group').appendChild(field);$('peerName-'+key).onchange=()=>{markDirty();applyFormat()}}
settingIds.push('comparisonMode','overlaySource',...keys.map(k=>'peerName-'+k));
function syncComparison(){
 const requested=requestedSources(),available=activePlotSources(),missing=requested.filter(s=>!state[s]);
 $('comparisonStatus').textContent=(state.querySubset?'目前僅繪製查詢結果。':missing.length?'尚未匯入：'+missing.map(sourceName).join('、')+'；只顯示已匯入的來源。':'')+(!state.weatherEnabled&&requested.includes('weather')?' 外部氣象站顯示已關閉。':'')+' 實線：我的蜂箱；點畫線：他人的蜂箱；虛線：氣象站。';
 $('commonPeriod').disabled=available.length<2;
 document.querySelectorAll('.rain-source').forEach((e,i)=>e.hidden=!available.includes(sourceIds[i]));
 overlaySourceField.hidden=value('chartMode')!=='overlay';
 if(!available.includes(value('overlaySource'))&&available.some(s=>s!=='weather'))$('overlaySource').value=available.find(s=>s!=='weather');
}
setDates=function(){
 updatePreview();const primary=activePlotSources()[0],b=sourceBounds(state[primary]);if(!b)return;
 $('startDate').value=local(new Date(b.min));$('endDate').value=local(new Date(b.max));
 $('dataRange').textContent='預設以'+sourceName(primary)+'期間：'+local(new Date(b.min)).replace('T',' ')+' ～ '+local(new Date(b.max)).replace('T',' ');
};
const setupBeforeComparison=setup;setup=function(){setupBeforeComparison();syncComparison();const bounds=sourceIds.map(s=>sourceBounds(state[s])).filter(Boolean);if(bounds.length){$('queryDay').value=local(new Date(Math.min(...bounds.map(b=>b.min)))).slice(0,10);$('queryStart').value=value('queryDay');$('queryEnd').value=local(new Date(Math.max(...bounds.map(b=>b.max)))).slice(0,10)}};
$('comparisonMode').onchange=()=>{state.querySubset=null;manualLabels.clear();markDirty();setDates();syncPeriodUI();if(value('periodMode')==='days')applyDayPeriod();syncComparison()};
$('overlaySource').onchange=()=>{markDirty();applyFormat()};
$('commonPeriod').onclick=()=>{const b=comparisonBounds(true);if(!b){$('comparisonStatus').textContent='所選來源沒有共同資料期間，請確認實驗日期。';return}$('startDate').value=local(new Date(b.min));$('endDate').value=local(new Date(b.max));$('periodMode').value='exact';syncPeriodUI();markDirty();$('comparisonStatus').textContent='已選各來源起訖的交集；中途缺測不會自動插補。'};
const explainBeforeComparison=explain;explain=function(){explainBeforeComparison();syncComparison()};
const selectedBeforeComparison=selectedRainSeries;selectedRainSeries=function(){return selectedBeforeComparison().filter(s=>activePlotSources().includes(s.source))};
const focusBeforeComparison=focusAnomaly;focusAnomaly=function(e){$('comparisonMode').value=e.source==='peer'?'peerOnly':e.source==='weather'?'weather':'mine';focusBeforeComparison(e);syncComparison()};
const renderBeforeComparison=render;render=function(){syncComparison();renderBeforeComparison();if(!state.output.length){state.dirty=true;state.charts.forEach(c=>c.destroy());state.charts=[];state.co2Chart?.destroy();state.co2Chart=null;$('co2DailyCard').classList.add('hidden');$('charts').textContent=$('analysisStatus').textContent||'沒有符合條件的資料。';syncChartPicker()}};
const createBeforeComparison=createChart;createChart=function(canvas,config){const chart=createBeforeComparison(canvas,config);canvas.closest('.chart-card')?.querySelectorAll('.legend-stroke').forEach((e,i)=>{const ds=config.data.datasets[i];e.style.border='none';e.innerHTML='<svg width="48" height="12" aria-hidden="true"><line x1="0" x2="48" y1="6" y2="6" stroke="'+esc(ds.borderColor)+'" stroke-width="3" stroke-dasharray="'+(ds.borderDash||[]).join(' ')+'" /></svg>'});return chart};
const resetBeforeComparison=applyDefaultFormat;applyDefaultFormat=function(){resetBeforeComparison();for(const k of keys){$('innerName-'+k).value='我的蜂箱 '+label(k);$('outerName-'+k).value='外部氣象站 '+label(k);$('peerName-'+k).value='他人的蜂箱 '+label(k)}};
// Step two is a draft: only render after the user proceeds to step three.
applyFormat=function(){if(workspacePage==='plot'&&workspaceStage===2){markDirty();return}if(state.hive||state.peer||state.weather)render()};
for(const id of ['xTickInterval','xTickCount','xTickUnit'])$(id).onchange=()=>{syncTickControls();markDirty();applyFormat()};
const stageBeforeComparison=showWorkspaceStage;showWorkspaceStage=function(step,generate=true){if(step!==3||!generate){stageBeforeComparison(step,generate);return}workspaceStatus.textContent='正在彙整資料與繪圖…';$('sourceNext').disabled=true;setTimeout(()=>{try{stageBeforeComparison(step,generate)}finally{$('sourceNext').disabled=false}},40)};
modeDescriptions.difference='我的蜂箱減去比較來源；只配對相同時間桶，不插補缺值。';
modeDescriptions.continuous='依日期比較所選來源；溫度、濕度與 CO₂ 各一張圖。';modeDescriptions.combined='所選來源的三項指標同圖比較，各用獨立縱軸。';modeDescriptions.co2hour='各蜂箱分開計算相同小時的原始值平均，不受時間彙整尺度影響。';modeDescriptions.overlay='選一個蜂箱，將每天的曲線依時刻疊合；不同日期以不同顏色表示。';
document.querySelector('#chartMode option[value="difference"]').textContent='來源差值（我的蜂箱 − 比較來源）';
document.querySelector('footer').textContent='蜂箱環境資料分析台 v20 · 資料僅在瀏覽器處理 · 台灣本地時間';
explain();
