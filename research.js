/* Research plotting controls. All calculations remain local to the browser. */
const filterOperators={none:'不篩選',gt:'大於 >',gte:'大於等於 ≥',lt:'小於 <',lte:'小於等於 ≤',range:'介於（含上下限）',outside:'排除區間（含上下限）'};
const units={temp:'°C',humidity:'%',co2:'ppm'};
const formatDefaults={chartTitle:'',chartSubtitle:'',xAxisTitle:'',fontSize:'12',lineWidth:'2',pointStyle:'circle',pointSize:'3',labelDecimals:'1',labelLimit:'12',referenceMetric:'',referenceValue:'',exportWidth:'1800',showPoints:false,showValues:false,showGrid:true,showLegend:true,beginZero:false};
const settingIds=[...Object.keys(formatDefaults),'filterSource','filterStage','overlayMetric','aggregation','chartMode','missing',...keys.flatMap(k=>[k+'Op',k+'Min',k+'Max','axisMin-'+k,'axisMax-'+k,'axisStep-'+k,'innerName-'+k,'outerName-'+k])];
const selectedVisible=new Map();
function value(id,fallback=''){const v=$(id)?.value;return v===undefined?fallback:v}
function checked(id){return Boolean($(id)?.checked)}
function numberSetting(id,fallback){const v=value(id);return v===''?fallback:Number(v)}
function metricOf(d){return d.metricKey||(['temp','humidity','co2'].includes(d.yAxisID)?d.yAxisID:'co2')}
function initResearchControls(){
 $('filterRows').innerHTML=keys.map(k=>`<div class="filter-row"><h4>${label(k)} <small>(${units[k]})</small></h4><label>條件<select id="${k}Op">${Object.entries(filterOperators).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><div class="filter-fields"><label><span id="${k}BoundLabel">數值／下限</span><input id="${k}Min" type="number" step="any" aria-label="${label(k)}數值或下限"></label><label id="${k}UpperLabel">上限<input id="${k}Max" type="number" step="any" aria-label="${label(k)}上限"></label></div></div>`).join('');
 $('axisSettings').innerHTML=keys.map(k=>`<div class="axis-group"><h4>${label(k)} (${units[k]})</h4><div class="bounds"><label>軸最小值<input id="axisMin-${k}" type="number" step="any" placeholder="自動"></label><label>軸最大值<input id="axisMax-${k}" type="number" step="any" placeholder="自動"></label><label>刻度間距<input id="axisStep-${k}" type="number" step="any" placeholder="自動"></label></div><label>內部序列名稱<input id="innerName-${k}" maxlength="60" value="內部${label(k)}"></label><label>外部序列名稱<input id="outerName-${k}" maxlength="60" value="外部${label(k)}"></label></div>`).join('');
 for(const k of keys)$(k+'Op').onchange=()=>{syncFilters();markDirty()};
 syncFilters();
}
function syncFilters(){for(const k of keys){const op=value(k+'Op','none'),two=['range','outside'].includes(op);$(k+'Min').disabled=op==='none';$(k+'Max').disabled=!two;$(k+'UpperLabel').classList.toggle('inactive',!two)}$('filterSummary').textContent=filterDescription()+'。每個指標獨立篩選，不會用 CO₂ 條件移除同時刻溫濕度。';}
function filterDescription(){const source={both:'內外部',hive:'僅內部',weather:'僅外部'}[value('filterSource','both')];const conditions=keys.filter(k=>value(k+'Op','none')!=='none').map(k=>label(k)+' '+filterOperators[value(k+'Op')]+' '+value(k+'Min')+(['range','outside'].includes(value(k+'Op'))?' ～ '+value(k+'Max'):'')+' '+units[k]);return conditions.length?source+'；'+conditions.join('；')+'；'+(stage()==='raw'?'先篩選原始值再平均':'先平均再篩選'):'未設定數值條件';}
function stage(){return value('chartMode')==='co2hour'?'raw':value('filterStage','raw')}
keep=function(k,v,source='hive'){
 const target=value('filterSource','both');if(target!=='both'&&target!==source)return true;
 const op=value(k+'Op','none'),lo=Number(value(k+'Min')),hi=Number(value(k+'Max'));
 switch(op){case 'gt':return v>lo;case 'gte':return v>=lo;case 'lt':return v<lo;case 'lte':return v<=lo;case 'range':return v>=lo&&v<=hi;case 'outside':return v<lo||v>hi;default:return true}
};
function validateSettings(){
 const start=value('startDate'),end=value('endDate');if(start&&end&&(!Number.isFinite(+new Date(start))||!Number.isFinite(+new Date(end))||+new Date(start)>+new Date(end)))throw Error('請確認開始與結束時間順序');
 for(const k of keys){const op=value(k+'Op','none');if(op!=='none'){if(value(k+'Min')===''||!Number.isFinite(Number(value(k+'Min'))))throw Error(label(k)+'：請輸入篩選數值');if(['range','outside'].includes(op)&&(value(k+'Max')===''||!Number.isFinite(Number(value(k+'Max')))||+value(k+'Min')>+value(k+'Max')))throw Error(label(k)+'：請確認篩選上下限')}
 const lo=value('axisMin-'+k),hi=value('axisMax-'+k),step=value('axisStep-'+k);if(lo!==''&&hi!==''&&+lo>=+hi)throw Error(label(k)+'座標軸最小值必須小於最大值');if(step!==''&&(!Number.isFinite(+step)||+step<=0))throw Error(label(k)+'刻度間距必須大於 0');if(lo!==''&&hi!==''&&step!==''&&(+hi-+lo)/+step>1000)throw Error('座標軸刻度超過 1000 格，請加大間距');
 }
 for(const [id,min,max] of [['fontSize',10,24],['lineWidth',1,6],['pointSize',1,8],['labelDecimals',0,3],['labelLimit',2,60]]){const n=Number(value(id));if(!Number.isFinite(n)||n<min||n>max)throw Error('請確認圖表格式數值範圍：'+id)}
 if(value('referenceMetric')&&(!Number.isFinite(Number(value('referenceValue')))||value('referenceValue')===''))throw Error('請輸入參考線數值');
}
effectiveMode=function(){const m=value('chartMode'),agg=value('aggregation');if(m==='difference'&&['raw','5min','15min'].includes(agg))return 'hour';if(['overlay','daily'].includes(m)&&agg==='day')return 'hour';return agg};
calculate=function(){
 validateSettings();const start=+new Date(value('startDate')),end=+new Date(value('endDate'));if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)throw Error('開始與結束時間無效');
 const mode=effectiveMode(),raw=[],groups=new Map();state.stats={invalidTime:0,missing:0,filtered:0,filteredBins:0};
 for(const source of ['hive','weather']){const d=state[source];if(!d?.mapping.time||(source==='weather'&&!state.weatherEnabled))continue;
 for(const row of d.rows){const date=rowDate(row,d);if(!date){state.stats.invalidTime++;continue}if(+date<start||+date>end)continue;
 for(const key of keys){const col=d.mapping[key];if(!col)continue;const text=String(row[col]??'').trim(),v=Number(text);if(!text||!Number.isFinite(v)){state.stats.missing++;continue}if(stage()==='raw'&&!keep(key,v,source)){state.stats.filtered++;continue}
 const t=bucket(date,mode),item={source,key,time:t,original:+date,value:v};raw.push(item);const id=source+'|'+key+'|'+t,g=groups.get(id)||{source,key,time:t,sum:0,n:0};g.sum+=v;g.n++;groups.set(id,g);
 }}}
 state.raw=raw;state.output=[...groups.values()].map(g=>({...g,value:g.sum/g.n})).filter(g=>{if(stage()==='aggregate'&&!keep(g.key,g.value,g.source)){state.stats.filteredBins++;return false}return true}).sort((a,b)=>a.time-b.time);return state.output.length?raw.length:0;
};
function chartContext(){return value('startDate').replace('T',' ')+' 至 '+value('endDate').replace('T',' ')+' · '+(value('chartMode')==='co2hour'?'相同小時原始值平均':({raw:'原始值','5min':'5 分鐘平均','15min':'15 分鐘平均',hour:'每小時平均',day:'每日平均'})[effectiveMode()])+' · '+filterDescription()}
function selectIndices(data,limit){const valid=[];data.forEach((p,i)=>{const v=p!==null&&typeof p==='object'?p.y:p;if(v!==null&&Number.isFinite(Number(v)))valid.push(i)});if(valid.length<=limit)return new Set(valid);const picked=new Set();for(let j=0;j<limit;j++)picked.add(valid[Math.round(j*(valid.length-1)/(limit-1))]);return picked}
const researchAnnotations={id:'researchAnnotations',afterDatasetsDraw(chart){
 const o=chart.$researchOptions;if(!o)return;const {ctx,chartArea:area}=chart;
 if(o.referenceMetric&&Number.isFinite(o.referenceValue)&&!o.difference){const scale=chart.scales[o.referenceMetric]||(o.referenceMetric==='co2'?chart.scales.y:null);if(scale){const y=scale.getPixelForValue(o.referenceValue);if(y>=area.top&&y<=area.bottom){ctx.save();ctx.strokeStyle='#64736e';ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(area.left,y);ctx.lineTo(area.right,y);ctx.stroke();ctx.setLineDash([]);ctx.font=o.fontSize+'px sans-serif';ctx.fillStyle='#43534c';ctx.textAlign='right';ctx.fillText(label(o.referenceMetric)+' '+o.referenceValue,area.right-4,Math.max(area.top+14,y-5));ctx.restore()}}}
 if(!o.showValues)return;const placed=[];ctx.save();ctx.font=o.fontSize+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 chart.data.datasets.forEach((ds,di)=>{if(!chart.isDatasetVisible(di))return;const meta=chart.getDatasetMeta(di);const indices=selectIndices(ds.data,o.labelLimit);indices.forEach(i=>{const p=meta.data[i],data=ds.data[i],v=data!==null&&typeof data==='object'?data.y:data;if(!p||p.skip||v===null||!Number.isFinite(+v)||p.x<area.left||p.x>area.right||p.y<area.top||p.y>area.bottom)return;
 const text=Number(v).toFixed(o.decimals),w=ctx.measureText(text).width+6,h=o.fontSize+4,x=Math.min(area.right-w/2,Math.max(area.left+w/2,p.x));let y=p.y-h;let box=[x-w/2,y-h/2,w,h];const overlaps=b=>placed.some(a=>b[0]<a[0]+a[2]&&b[0]+b[2]>a[0]&&b[1]<a[1]+a[3]&&b[1]+b[3]>a[1]);if(y-h/2<area.top||overlaps(box)){y=p.y+h;box=[x-w/2,y-h/2,w,h]}if(y+h/2>area.bottom||overlaps(box))return;placed.push(box);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(...box);ctx.fillStyle=ds.borderColor;ctx.fillText(text,x,y);
 })});ctx.restore();
}};
const v6CreateChart=createChart;
createChart=function(canvas,config){
 const o={fontSize:numberSetting('fontSize',12),showPoints:checked('showPoints'),showValues:checked('showValues'),labelLimit:Math.round(numberSetting('labelLimit',12)),decimals:Math.round(numberSetting('labelDecimals',1)),pointSize:numberSetting('pointSize',3),referenceMetric:value('referenceMetric'),referenceValue:numberSetting('referenceValue',NaN),difference:value('chartMode')==='difference'};
 for(const d of config.data.datasets){const k=metricOf(d);d.metricKey=k;d.borderWidth=numberSetting('lineWidth',2);d.pointStyle=value('pointStyle','circle');d.pointBackgroundColor=d.borderColor;const indices=selectIndices(d.data,o.labelLimit);d.pointRadius=c=>(o.showPoints||o.showValues)&&indices.has(c.dataIndex)?o.pointSize:0;d.pointHoverRadius=5;
 if(!d.customName)d.label=d.borderDash?.length?value('outerName-'+k,'外部'+label(k))+'（虛線）':value('innerName-'+k,'內部'+label(k));
 }
 for(const [name,axis] of Object.entries(config.options.scales||{})){axis.ticks={...axis.ticks,font:{size:o.fontSize}};axis.grid={...axis.grid,display:checked('showGrid')};axis.title={...axis.title,font:{size:o.fontSize+1}};
 if(name==='x'){if(value('xAxisTitle'))axis.title={...axis.title,display:true,text:value('xAxisTitle')}}else{const k=name==='y'?'co2':name;if(keys.includes(k)){axis.beginAtZero=checked('beginZero');for(const [s,prop] of [['axisMin-','min'],['axisMax-','max']])if(value(s+k)!=='')axis[prop]=Number(value(s+k));if(value('axisStep-'+k)!=='')axis.ticks.stepSize=Number(value('axisStep-'+k))}}
 }
 config.plugins=[...(config.plugins||[]),researchAnnotations,{id:'researchInit',beforeInit:c=>{c.$researchOptions=o}}];
 config.options.interaction={mode:'nearest',intersect:false};config.options.plugins={...config.options.plugins,tooltip:{callbacks:{title:items=>{const x=items[0]?.parsed?.x;return ['co2hour','overlay'].includes(value('chartMode'))?items[0]?.label:local(new Date(x)).replace('T',' ')}}}};
 const chart=v6CreateChart(canvas,config);chart.$researchOptions=o;chart.$sourceConfig=config;
 const card=canvas.closest?.('.chart-card');if(card){const h=card.querySelector('h3'),automatic=h.textContent;chart.$title=value('chartTitle')?value('chartTitle')+' — '+automatic:automatic;h.textContent=chart.$title;h.classList.add('chart-title');card.querySelectorAll('.chart-subtitle,.chart-context,.chart-controls').forEach(e=>e.remove());
 if(value('chartSubtitle')){const p=document.createElement('p');p.className='chart-subtitle';p.textContent=value('chartSubtitle');h.after(p)}
 const p=document.createElement('p');p.className='chart-context';p.textContent=chartContext();card.appendChild(p);const controls=document.createElement('div');controls.className='chart-controls';const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='下載這張 PNG';button.onclick=()=>exportCharts([chart]);controls.appendChild(button);card.appendChild(controls);
 const legend=card.querySelector('.line-legend');if(legend){legend.hidden=!checked('showLegend');legend.querySelectorAll('button').forEach((button,i)=>{const key=config.data.datasets[i].label;if(selectedVisible.get(key)===false){chart.setDatasetVisibility(i,false);button.setAttribute('aria-pressed','false')}const before=button.onclick;button.onclick=()=>{before();selectedVisible.set(key,chart.isDatasetVisible(i))}})}
 chart.$subtitle=value('chartSubtitle');chart.$researchContext=chartContext();}
 chart.update('none');return chart;
};
const v6Draw=draw;
draw=function(){
 if(value('chartMode')==='co2hour')state.hourBins=Array.from({length:24},()=>({sum:0,n:0}));
 if(!['overlay','difference'].includes(value('chartMode'))){$('co2DailyCard').querySelector('h3').textContent='CO₂ 24 小時平均圖（蜂箱 SCD30）';v6Draw();return}
 state.charts.forEach(c=>c.destroy());state.charts=[];if(state.co2Chart){state.co2Chart.destroy();state.co2Chart=null}$('co2DailyCard').classList.add('hidden');
 if(value('chartMode')==='difference')drawDifference();else drawOverlay();
};
function insertChart(id,title,sets,axes){const card=document.createElement('div');card.className='chart-card';card.innerHTML='<h3>'+esc(title)+'</h3><canvas id="'+id+'"></canvas>';$('charts').appendChild(card);const c=createChart($(id),{type:'line',data:{datasets:sets},options:opts(axes)});state.charts.push(c)}
function differenceRows(){const rows=[];for(const k of ['temp','humidity']){const external=new Map(state.output.filter(x=>x.key===k&&x.source==='weather').map(x=>[x.time,x]));for(const x of state.output){if(x.source!=='hive'||x.key!==k)continue;const w=external.get(x.time);if(w)rows.push({time:x.time,key:k,value:x.value-w.value,internal:x.value,external:w.value,internal_n:x.n,external_n:w.n})}}return rows.sort((a,b)=>a.time-b.time)}
function drawDifference(){
 $('charts').innerHTML='';state.differences=differenceRows();if(!state.weatherEnabled||!state.differences.length){$('charts').textContent='需要開啟外站，且所選期間內有相同時間桶的溫度或濕度；不插值、不拿相鄰小時代替。';return}
 for(const k of ['temp','humidity']){const rows=state.differences.filter(r=>r.key===k);if(!rows.length)continue;const step=effectiveMode()==='day'?86400000:3600000,data=[];rows.forEach((r,i)=>{if(i&&r.time-rows[i-1].time>step*1.8)data.push({x:rows[i-1].time+step,y:null});data.push({x:r.time,y:r.value})});insertChart('diff-'+k,(k==='temp'?'溫度差 (°C)':'相對濕度差（百分點）')+'：內部 − 外部',[{label:label(k)+'差值',customName:true,metricKey:k,yAxisID:k,data,borderColor:state.metrics[k].color,spanGaps:checked('missing')||value('missing')==='connect'}],{x:xScale(),[k]:{title:{display:true,text:k==='temp'?'溫度差 (°C)':'相對濕度差（百分點）'}}})}
}
function drawOverlay(){
 $('charts').innerHTML='';const k=value('overlayMetric','co2'),rows=state.output.filter(x=>x.source==='hive'&&x.key===k),days=[...new Set(rows.map(r=>local(new Date(r.time)).slice(0,10)))];if(!days.length){$('charts').textContent='此區間沒有符合條件的內部資料。';return}
 const sets=days.map((day,i)=>{const data=rows.filter(r=>local(new Date(r.time)).startsWith(day)).map(r=>{const d=new Date(r.time);return{x:d.getHours()+d.getMinutes()/60+d.getSeconds()/3600,y:r.value}}),gaps=[],step=({raw:1/120,'5min':1/12,'15min':.25,hour:1,day:24})[effectiveMode()];data.forEach((p,j)=>{if(j&&p.x-data[j-1].x>step*1.8)gaps.push({x:data[j-1].x+step,y:null});gaps.push(p)});return{label:day,customName:true,metricKey:k,yAxisID:k,data:gaps,borderColor:'hsl('+Math.round(i*137.508%360)+', 60%, 38%)',borderDash:i%2?[6,3]:[],spanGaps:value('missing')==='connect'}});
 insertChart('overlay',label(k)+' 每日疊圖（內部）',sets,{x:{type:'linear',min:0,max:24,ticks:{stepSize:2,callback:v=>String(Math.floor(v)).padStart(2,'0')+':00'},title:{display:true,text:'一天中的時間'}},[k]:{title:{display:true,text:state.metrics[k].title}}});
}
const v6Render=render;
render=function(){syncFilters();$('filterStage').disabled=value('chartMode')==='co2hour';$('analysisStatus').textContent='';try{validateSettings()}catch(e){$('analysisStatus').textContent=e.message;return}v6Render();if(!state.output.length){$('chartCard').classList.remove('hidden');return}state.lastContext=chartContext();state.renderMode=value('chartMode');state.dirty=false;$('analysisStatus').textContent='已更新：'+chartContext();$('qualitySummary').innerHTML+=`<p class="diagnostics">平均後篩選排除 ${state.stats.filteredBins||0} 個時間桶。${value('chartMode')==='difference'?'內外差值只配對相同時間桶；小於每小時的尺度自動改為每小時。':value('chartMode')==='overlay'?'不同日期以不同顏色表示，圖例可逐日開關。':''}</p>`;};
function markDirty(){state.dirty=true;syncFilters();$('analysisStatus').textContent='設定已變更，請按「更新圖表」或「套用圖表格式」。';}
function ensureCurrent(){if(state.dirty){render();return !state.dirty&&Boolean(state.output.length)}return Boolean(state.output.length)}
function applyFormat(){if(state.hive||state.weather)render()}
function resetFilterValues(){for(const k of keys){$(k+'Op').value='none';$(k+'Min').value='';$(k+'Max').value=''}$('filterSource').value='both';$('filterStage').value='raw';syncFilters()}
function applyDefaultFormat(){for(const [id,v] of Object.entries(formatDefaults)){if(typeof v==='boolean')$(id).checked=v;else $(id).value=v}for(const k of keys){for(const part of ['axisMin-','axisMax-','axisStep-'])$(part+k).value='';$('innerName-'+k).value='內部'+label(k);$('outerName-'+k).value='外部'+label(k)}selectedVisible.clear()}
function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
function currentCsv(){let rows;
 if(value('chartMode')==='co2hour'){rows=[['hour','CO2_mean_ppm','samples'],...state.hourBins.map((b,h)=>[String(h).padStart(2,'0')+':00',b.n?b.sum/b.n:'',b.n])];}
 else if(value('chartMode')==='difference'){rows=[['time_local','metric','internal_minus_external','internal_mean','external_mean','internal_samples','external_samples'],...(state.differences||[]).map(x=>[local(new Date(x.time)),x.key,x.value,x.internal,x.external,x.internal_n,x.external_n])];}
 else rows=[['time_local','source','metric','mean','samples'],...state.output.filter(x=>value('chartMode')!=='overlay'||x.source==='hive'&&x.key===value('overlayMetric')).map(x=>[local(new Date(x.time)),x.source,x.key,x.value,x.n])];return rows.map(r=>r.map(csvCell).join(',')).join('\n');
}
function snapshotSettings(){return {version:7,settings:Object.fromEntries(settingIds.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),metrics:state.metrics,period:{start:value('startDate'),end:value('endDate')},method:'Arithmetic mean; filter scope and stage are explicit. CO2 diurnal means use filtered raw observations; local Taiwan timezone.',hiddenSeries:[...selectedVisible].filter(([,v])=>!v).map(([k])=>k)}}
function wrapText(ctx,text,maxWidth){const lines=[];let line='';for(const c of text){if(ctx.measureText(line+c).width>maxWidth&&line){lines.push(line);line=c}else line+=c}if(line)lines.push(line);return lines}
function exportCharts(charts){
 if(!charts.length)return;const width=numberSetting('exportWidth',1800),parts=[];
 if(charts.length*(width*.44+180)>30000||charts.length*(width*.44+180)*width>70000000){alert('圖表數量過多，請使用各張圖的 PNG 按鈕，或縮短日期範圍。');return}
 for(const chart of charts){const source=chart.$sourceConfig;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(width*.44);
 const exportFont=Math.max(16,chart.$researchOptions.fontSize),scales=Object.fromEntries(Object.entries(source.options.scales).map(([k,a])=>[k,{...a,ticks:{...a.ticks,font:{size:exportFont}},title:{...a.title,font:{size:exportFont+1}}}]));
 const config={...source,data:{...source.data,datasets:source.data.datasets.map((d,i)=>({...d,hidden:!chart.isDatasetVisible(i)}))},options:{...source.options,scales,responsive:false,maintainAspectRatio:false,devicePixelRatio:1,animation:false}};
 const exported=new Chart(canvas,config);exported.$researchOptions={...chart.$researchOptions,fontSize:exportFont};exported.update('none');
 const title=chart.$title||chart.canvas.closest('.chart-card').querySelector('h3').textContent,subtitle=chart.$subtitle||'',context=chart.$researchContext||chartContext();const probe=canvas.getContext('2d');probe.font='24px sans-serif';const titleLines=wrapText(probe,title,width-60);probe.font='17px sans-serif';const notes=wrapText(probe,[subtitle,context].filter(Boolean).join(' · '),width-60);
 const visible=source.data.datasets.filter((d,i)=>chart.isDatasetVisible(i)),legend=[];let x=30,y=0;
 if(checked('showLegend'))for(const d of visible){const w=probe.measureText(d.label).width+95;if(x+w>width-30){x=30;y+=32}legend.push({d,x,y});x+=w}
 const header=titleLines.length*32+notes.length*24+35,legendHeight=legend.length?y+52:10;const snapshot=document.createElement('canvas');snapshot.width=canvas.width;snapshot.height=canvas.height;snapshot.getContext('2d').drawImage(canvas,0,0);parts.push({canvas:snapshot,titleLines,notes,header,legend,height:header+canvas.height+legendHeight});exported.destroy();
 }
 const height=parts.reduce((a,p)=>a+p.height,0);if(height>30000||height*width>70000000){alert('圖片過大，請使用每張圖的 PNG 按鈕，或縮短日期範圍。');return}
 const out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,width,height);let top=0;
 for(const p of parts){ctx.fillStyle='#173132';ctx.font='24px sans-serif';p.titleLines.forEach((line,i)=>ctx.fillText(line,30,top+32+i*32));ctx.font='17px sans-serif';p.notes.forEach((line,i)=>ctx.fillText(line,30,top+p.titleLines.length*32+28+i*24));ctx.drawImage(p.canvas,0,top+p.header);ctx.font='17px sans-serif';for(const {d,x,y} of p.legend){const yy=top+p.header+p.canvas.height+y+28;ctx.strokeStyle=d.borderColor;ctx.lineWidth=3;ctx.setLineDash(d.borderDash||[]);ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+55,yy);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#173132';ctx.fillText(d.label,x+65,yy+5)}top+=p.height}
 out.toBlob(blob=>{if(!blob){$('analysisStatus').textContent='圖片產生失敗，請縮小匯出尺寸。';return}if(state.exportUrl)URL.revokeObjectURL(state.exportUrl);state.exportUrl=URL.createObjectURL(blob);let preview=$('exportPreview');if(!preview){preview=document.createElement('details');preview.id='exportPreview';$('chartCard').appendChild(preview)}preview.innerHTML='<summary>檢視最近匯出的圖片</summary><a download="hive-research-v7.png">儲存 PNG 圖片</a><img alt="匯出圖表預覽" style="width:100%;height:auto">';preview.querySelector('img').src=state.exportUrl;const a=preview.querySelector('a');a.href=state.exportUrl;a.click();$('analysisStatus').textContent='已產生 '+width+' × '+height+' px 圖片，可在圖表下方預覽或再次儲存。'},'image/png');
}
initResearchControls();
$('renderButton').onclick=render;$('applyFormat').onclick=render;
$('resetFilters').onclick=()=>{resetFilterValues();markDirty();applyFormat()};
$('co2Preset').onclick=()=>{resetFilterValues();$('filterSource').value='hive';$('co2Op').value='gt';$('co2Min').value='2500';markDirty();applyFormat()};
$('resetFormat').onclick=()=>{applyDefaultFormat();markDirty();applyFormat()};
$('downloadCsv').onclick=()=>{if(ensureCurrent())downloadText(currentCsv(),'hive-analysis-v7.csv')};
$('downloadPng').onclick=()=>{if(ensureCurrent())exportCharts(state.co2Chart?[state.co2Chart]:state.charts)};
$('saveSettings').onclick=()=>{try{validateSettings();const blob=new Blob([JSON.stringify(snapshotSettings(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hive-settings-v7.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){$('analysisStatus').textContent=e.message}};
$('loadSettings').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(obj.version!==7||typeof obj.settings!=='object')throw Error('請使用 v7 匯出的設定檔');for(const id of settingIds){const v=obj.settings[id],el=$(id);if(v===undefined)continue;if(el.type==='checkbox'){if(typeof v==='boolean')el.checked=v}else if(['string','number'].includes(typeof v))el.value=String(v).slice(0,300)}for(const k of keys){const m=obj.metrics?.[k];if(m&&/^#[\da-f]{6}$/i.test(m.color)){state.metrics[k].color=m.color;state.metrics[k].title=String(m.title||label(k)).slice(0,100)}}if(obj.period){if(parse(obj.period.start))$('startDate').value=obj.period.start;if(parse(obj.period.end))$('endDate').value=obj.period.end}selectedVisible.clear();if(Array.isArray(obj.hiddenSeries))obj.hiddenSeries.filter(x=>typeof x==='string').forEach(x=>selectedVisible.set(x,false));markDirty();validateSettings();applyFormat()}catch(err){$('analysisStatus').textContent='無法載入設定：'+err.message}};
for(const id of settingIds){if(id.endsWith('Op'))continue;$(id).onchange=()=>{markDirty();if(['chartMode','aggregation','missing','overlayMetric'].includes(id))applyFormat()};}
for(const id of ['startDate','endDate'])$(id).onchange=markDirty;
