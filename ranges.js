/* Visual comparison regions use plot coordinates; measurements remain untouched. */
let comparisonRanges=[],editingRange=null,rangeFormScope='',rangeDrawing=null,rangeTarget=null;
const rangeBlock=studioBlock(annotationGroup,'區間框選','拖曳框出重點，或輸入範圍。只改變外觀，下載 PNG 也會保留。');
rangeBlock.id='rangeBlock';annotationGroup.prepend(rangeBlock);
rangeBlock.insertAdjacentHTML('beforeend','<button id="rangeDrag" type="button" class="secondary" aria-pressed="false">在圖上拖曳框選</button><label>拖曳方式<select id="rangeKind"><option value="time">整段時間（全高度）</option><option value="box">矩形（時間與數值）</option></select></label><details id="rangeManual" class="settings-manual"><summary>輸入範圍／調整外框</summary><div class="range-fields"><div class="settings-field-row"><label><span id="rangeFromCaption">開始時間</span><input id="rangeFrom" aria-labelledby="rangeFromCaption"></label><label><span id="rangeToCaption">結束時間</span><input id="rangeTo" aria-labelledby="rangeToCaption"></label></div><label id="rangeAxisField">數值座標軸<select id="rangeAxis"></select></label><div class="settings-field-row"><label>數值下界（選填）<input id="rangeMin" type="number" step="any" placeholder="全高度"></label><label>數值上界（選填）<input id="rangeMax" type="number" step="any" placeholder="全高度"></label></div><label>區間名稱（選填）<input id="rangeLabel" maxlength="60" value="重點區間"></label><div class="settings-field-row"><label>外框與底色<input id="rangeColor" type="color" value="#b7791f"></label><label>底色濃度（%）<input id="rangeOpacity" type="number" min="0" max="40" step="1" value="12"></label></div><button id="rangeSave" type="button" class="primary">新增區間</button><button id="rangeCancel" type="button" class="secondary" hidden>取消編輯</button></div></details><p id="rangeStatus" class="studio-hint" role="status" aria-live="polite"></p><div id="rangeList"></div><button id="rangeClear" type="button" class="secondary">清除此圖的區間</button>');
const rangeToolbar=document.createElement('button');rangeToolbar.id='selectRange';rangeToolbar.type='button';rangeToolbar.className='secondary';rangeToolbar.textContent='框選區間';rangeToolbar.setAttribute('aria-pressed','false');chartActions.appendChild(rangeToolbar);
$('rangeManual').before($('rangeStatus'),$('rangeList'),$('rangeClear'));

function rangeDomain(){return value('chartMode')==='co2hour'?'hours':value('chartMode')==='overlay'?'overlay':isRelativeComparison()?'elapsed':'calendar'}
function rangeScope(canvas,config,domain){return JSON.stringify([value('workspaceMode'),value('chartMode'),domain,[...new Set(config.data.datasets.map(metricOf))].sort(),canvas.id])}
function rangeCharts(){return [...state.charts,...(state.co2Chart?[state.co2Chart]:[])]}
function rangeMessage(message,error=false){$('rangeStatus').textContent=message;$('rangeStatus').classList.toggle('has-error',error)}
function rangeTimeText(domain,x){if(domain==='hours')return String(x).padStart(2,'0')+':00';if(domain==='elapsed')return String(Number((x/86400000+1).toFixed(6)));if(domain==='overlay')return String(Number(x.toFixed(6)));return local(new Date(x))}
function rangeValue(domain,input){
 const text=input.value;if(!text.trim())throw Error('請輸入完整的區間起點與終點。');
 if(domain==='hours'){if(!/^\d{2}:00$/.test(text)||+text.slice(0,2)>23)throw Error('24 小時平均圖請使用整點，例如 18:00。');return +text.slice(0,2)}
 if(domain==='calendar'){const date=new Date(text);if(!Number.isFinite(+date))throw Error('請輸入有效的日期時間。');return +date}
 const number=Number(text);if(!Number.isFinite(number)||domain==='elapsed'&&number<1||domain==='overlay'&&(number<0||number>24))throw Error(domain==='elapsed'?'實驗天數須大於或等於 1，可包含小數。':'請輸入 0～24 小時。');return domain==='elapsed'?(number-1)*86400000:number;
}
function rangeAppearance(){const opacity=Number(value('rangeOpacity'));if(value('rangeOpacity')===''||!Number.isFinite(opacity)||opacity<0||opacity>40)throw Error('底色濃度請輸入 0～40%。');return {label:value('rangeLabel').trim().slice(0,60),color:value('rangeColor'),opacity:opacity/100}}
function rangeYAxis(chart){return chart.scales[value('rangeAxis')]||Object.values(chart.scales).find(scale=>scale.axis==='y')}
function rangeForm(chart,record=null){
 if(!chart)return;const domain=chart.$rangeDomain,axes=Object.values(chart.scales).filter(scale=>scale.axis==='y'),previous=record?.yAxis||value('rangeAxis');
 $('rangeAxis').replaceChildren(...axes.map(scale=>{const option=document.createElement('option');option.value=scale.id;option.textContent=scale.options.title?.text||scale.id;return option}));
 $('rangeAxis').value=axes.some(scale=>scale.id===previous)?previous:axes[0]?.id||'';$('rangeAxisField').hidden=axes.length<2;
 const hours=domain==='hours',elapsed=domain==='elapsed',overlay=domain==='overlay';
 for(const id of ['rangeFrom','rangeTo']){const input=$(id);input.type=hours?'time':domain==='calendar'?'datetime-local':'number';input.step=hours?'3600':domain==='calendar'?'1':'any'}
 $('rangeFromCaption').textContent=elapsed?'開始實驗天數（可用小數）':overlay?'開始小時（0～24）':'開始時間';$('rangeToCaption').textContent=elapsed?'結束實驗天數（可用小數）':overlay?'結束小時（0～24）':'結束時間';
 const first=hours?Number(chart.data.labels[0].slice(0,2)):chart.scales.x.min,last=hours?Number(chart.data.labels[6].slice(0,2)):chart.scales.x.max;
 $('rangeFrom').value=rangeTimeText(domain,record?.x1??first);$('rangeTo').value=rangeTimeText(domain,record?.x2??last);
 $('rangeMin').value=record?.y1??'';$('rangeMax').value=record?.y2??'';
 if(record){$('rangeLabel').value=record.label;$('rangeColor').value=record.color;$('rangeOpacity').value=String(Math.round(record.opacity*100))}
 $('rangeSave').textContent=record?'儲存區間':'新增區間';$('rangeCancel').hidden=!record;
 rangeFormScope=chart.$rangeScope;syncStudioColors();
}
function rangeSummary(record){const from=rangeTimeText(record.domain,record.x1).replace('T',' '),to=rangeTimeText(record.domain,record.x2).replace('T',' ');return from+' → '+(record.domain==='hours'&&record.x2<record.x1?'隔日 ':'')+to+(record.yAxis?' · '+record.y1+' ～ '+record.y2:'')}
function syncRanges(){
 const chart=currentSettingsChart(),scope=chart?.$rangeScope;
 if(rangeTarget&&rangeTarget!==chart){stopRangeSelection();return}
 for(const id of ['rangeDrag','rangeSave','rangeClear','selectRange'])$(id).disabled=!chart;
 if(chart&&scope!==rangeFormScope){editingRange=null;rangeForm(chart)}
 const list=$('rangeList');list.replaceChildren();
 for(const record of comparisonRanges.filter(record=>record.scope===scope)){
  const row=document.createElement('div');row.className='range-item';const name=document.createElement('strong');name.textContent=record.label||'區間';name.style.borderLeftColor=record.color;
  const description=document.createElement('span');description.textContent=rangeSummary(record);const actions=document.createElement('div');actions.className='range-item-actions';
  for(const [text,action]of [['編輯',()=>{editingRange=record;rangeForm(chart,record);$('rangeManual').open=true;$('rangeFrom').focus()}],['刪除',()=>{comparisonRanges=comparisonRanges.filter(item=>item!==record);if(editingRange===record){editingRange=null;rangeForm(chart)}refreshRanges();rangeMessage('已刪除區間。')}]] ){
   const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=text;button.onclick=action;actions.appendChild(button);
  }
  row.append(name,description,actions);list.appendChild(row);
 }
 if(!list.children.length){const empty=document.createElement('p');empty.className='studio-hint';empty.textContent='此圖尚未框選區間。';list.appendChild(empty)}
 $('rangeClear').disabled=!chart||!comparisonRanges.some(record=>record.scope===scope);
 for(const button of [rangeToolbar,$('rangeDrag')])button.setAttribute('aria-pressed',String(Boolean(rangeTarget)));
 rangeToolbar.textContent=rangeTarget?'取消框選（Esc）':'框選區間';$('rangeDrag').textContent=rangeTarget?'取消框選（Esc）':'在圖上拖曳框選';
}
function refreshRanges(){for(const chart of rangeCharts())if(chart.canvas)chart.draw();syncRanges()}
function storeRange(record){
 if(!editingRange&&comparisonRanges.length>=20)throw Error('最多保留 20 個區間，請先刪除不需要的區間。');
 if(editingRange)Object.assign(editingRange,record);else comparisonRanges.push(record);
 editingRange=null;refreshRanges();rangeForm(currentSettingsChart());rangeMessage('已套用區間，下載 PNG 會保留外框與底色。');
}
$('rangeSave').onclick=()=>{
 try{
  const chart=currentSettingsChart();if(!chart)throw Error('請先產生圖表。');const domain=chart.$rangeDomain,x1=rangeValue(domain,$('rangeFrom')),x2=rangeValue(domain,$('rangeTo'));
  if(domain!=='hours'&&x1>=x2)throw Error('區間起點必須小於終點。');
  const lower=value('rangeMin'),upper=value('rangeMax');if((lower==='')!==(upper==='')||lower!==''&&(!Number.isFinite(+lower)||!Number.isFinite(+upper)||+lower>=+upper))throw Error('請同時填寫有效的數值上下界，且下界須小於上界；或兩欄都留白。');
  storeRange({scope:chart.$rangeScope,domain,x1,x2,yAxis:lower===''?null:rangeYAxis(chart).id,y1:lower===''?null:+lower,y2:upper===''?null:+upper,...rangeAppearance()});
 }catch(error){rangeMessage(error.message,true)}
};
$('rangeCancel').onclick=()=>{editingRange=null;rangeForm(currentSettingsChart());rangeMessage('已取消編輯。')};
$('rangeClear').onclick=()=>{const chart=currentSettingsChart();comparisonRanges=comparisonRanges.filter(record=>record.scope!==chart?.$rangeScope);editingRange=null;refreshRanges();rangeForm(chart);rangeMessage('已清除此圖的區間。')};
function stopRangeSelection(){
 const chart=rangeTarget,drag=rangeDrawing;rangeTarget=null;rangeDrawing=null;
 if(drag&&chart)chart.$rangeSuppressClickUntil=performance.now()+400;
 if(drag&&chart?.canvas?.hasPointerCapture(drag.pointerId))chart.canvas.releasePointerCapture(drag.pointerId);
 for(const item of rangeCharts())item.canvas?.classList.remove('range-selecting');
 if(chart?.canvas){chart.canvas.classList.remove('range-selecting');chart.draw()}
 syncRanges();
}
function startRangeSelection(){
 if(rangeTarget){stopRangeSelection();return}
 if(!flushFormatPreview())return;const chart=currentSettingsChart();if(!chart)return;
 try{rangeAppearance()}catch(error){rangeMessage(error.message,true);return}
 editingRange=null;rangeTarget=chart;chart.canvas.classList.add('range-selecting');
 if(!stylePanel.hidden)toggleStyle(false);syncRanges();rangeMessage('在圖表內按住拖曳以新增區間；按 Esc 可取消。');
 requestAnimationFrame(()=>{if(rangeTarget===chart)chart.canvas.scrollIntoView({block:'center',behavior:'instant'})});
}
rangeToolbar.onclick=$('rangeDrag').onclick=startRangeSelection;
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&rangeTarget){stopRangeSelection();rangeMessage('已取消框選。')}});

// A clock interval is saved by actual hours, so rotating 09:00–08:00 cannot shift it.
function rangeRectangles(chart,record){
 const area=chart.chartArea,x=chart.scales.x;if(!area||!x)return [];
 let intervals=[];
 if(record.domain==='hours'){
  let start=null;const span=(record.x2-record.x1+24)%24;
  chart.data.labels.forEach((text,index)=>{const hour=Number(text.slice(0,2)),inside=(hour-record.x1+24)%24<=span;if(inside&&start===null)start=index;if(start!==null&&(!inside||index===chart.data.labels.length-1)){intervals.push([x.getPixelForValue(start-.5),x.getPixelForValue((inside?index:index-1)+.5)]);start=null}});
 }else intervals=[[x.getPixelForValue(record.x1),x.getPixelForValue(record.x2)]];
 let top=area.top,bottom=area.bottom;
 if(record.yAxis){const y=chart.scales[record.yAxis];if(!y)return [];top=Math.max(top,y.getPixelForValue(record.y2));bottom=Math.min(bottom,y.getPixelForValue(record.y1))}
 return intervals.map(([left,right])=>({left:Math.max(area.left,left),right:Math.min(area.right,right),top,bottom})).filter(rect=>rect.right>rect.left&&rect.bottom>rect.top);
}
function drawRanges(chart,borders){
 const records=comparisonRanges.filter(record=>record.scope===chart.$rangeScope);
 if(rangeDrawing?.chart===chart&&rangeDrawing.record)records.push(rangeDrawing.record);
 const {ctx,chartArea:area}=chart;if(!area)return;ctx.save();ctx.beginPath();ctx.rect(area.left,area.top,area.right-area.left,area.bottom-area.top);ctx.clip();
 for(const record of records){const rectangles=rangeRectangles(chart,record);rectangles.forEach((rect,index)=>{
  const width=rect.right-rect.left,height=rect.bottom-rect.top;
  if(!borders){ctx.globalAlpha=record.opacity;ctx.fillStyle=record.color;ctx.fillRect(rect.left,rect.top,width,height);ctx.globalAlpha=1;return}
  ctx.strokeStyle=record.color;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(rect.left+1,rect.top+1,Math.max(0,width-2),Math.max(0,height-2));ctx.setLineDash([]);
  if(record.label&&index===0&&width>28){ctx.font=Math.max(11,chart.$researchOptions?.fontSize||12)+'px sans-serif';const textWidth=Math.min(ctx.measureText(record.label).width,width-12);ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(rect.left+4,rect.top+4,textWidth+4,18);ctx.fillStyle=record.color;ctx.fillText(record.label,rect.left+6,rect.top+17,Math.max(1,width-12))}
 })}ctx.restore();
}
function attachRangePointer(chart){
 const canvas=chart.canvas;
 const position=event=>{const box=canvas.getBoundingClientRect(),area=chart.chartArea;return {x:Math.min(area.right,Math.max(area.left,(event.clientX-box.left)*chart.width/box.width)),y:Math.min(area.bottom,Math.max(area.top,(event.clientY-box.top)*chart.height/box.height))}};
 function updateDraft(event){
  const drag=rangeDrawing;if(!drag||drag.chart!==chart)return;const end=position(event),left=Math.min(drag.start.x,end.x),right=Math.max(drag.start.x,end.x),x=chart.scales.x,domain=chart.$rangeDomain;
  const a=x.getValueForPixel(left),b=x.getValueForPixel(right),record={scope:chart.$rangeScope,domain,x1:domain==='hours'?Number(chart.data.labels[a].slice(0,2)):a,x2:domain==='hours'?Number(chart.data.labels[b].slice(0,2)):b,yAxis:null,y1:null,y2:null,...drag.appearance};
  if(drag.kind==='box'){const y=chart.scales[drag.yAxis];record.yAxis=y.id;record.y1=Number(y.getValueForPixel(Math.max(drag.start.y,end.y)).toPrecision(8));record.y2=Number(y.getValueForPixel(Math.min(drag.start.y,end.y)).toPrecision(8))}
  drag.record=record;drag.end=end;chart.draw();
 }
 const down=event=>{
  if(rangeTarget!==chart||!event.isPrimary||event.button!==0)return;const box=canvas.getBoundingClientRect(),area=chart.chartArea,px=(event.clientX-box.left)*chart.width/box.width,py=(event.clientY-box.top)*chart.height/box.height;
  // Touch coordinates can round just outside an edge point by a fraction of a pixel.
  if(px<area.left-1||px>area.right+1||py<area.top-1||py>area.bottom+1)return;
  event.preventDefault();rangeDrawing={chart,pointerId:event.pointerId,start:position(event),kind:value('rangeKind'),yAxis:rangeYAxis(chart).id,appearance:rangeAppearance()};canvas.setPointerCapture(event.pointerId);
 };
 const move=event=>{if(rangeDrawing?.chart===chart&&rangeDrawing.pointerId===event.pointerId){event.preventDefault();updateDraft(event)}};
 const finish=event=>{
  const drag=rangeDrawing;if(drag?.chart!==chart||drag.pointerId!==event.pointerId)return;
  event.preventDefault();updateDraft(event);const record=drag.record,wide=Math.abs(drag.end.x-drag.start.x)>=4,tall=drag.kind!=='box'||Math.abs(drag.end.y-drag.start.y)>=4;
  chart.$rangeSuppressClickUntil=performance.now()+400;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);stopRangeSelection();
  if(wide&&tall)try{storeRange(record)}catch(error){rangeMessage(error.message,true)}else rangeMessage('框選範圍太小，請重新按住拖曳。');
 };
 const cancel=()=>{if(rangeDrawing?.chart===chart)stopRangeSelection()};
 for(const [type,handler]of [['pointerdown',down],['pointermove',move],['pointerup',finish],['pointercancel',cancel]])canvas.addEventListener(type,handler);
 chart.$removeRangePointer=()=>{for(const [type,handler]of [['pointerdown',down],['pointermove',move],['pointerup',finish],['pointercancel',cancel]])canvas.removeEventListener(type,handler);canvas.classList.remove('range-selecting');if(rangeTarget===chart){if(rangeDrawing&&canvas.hasPointerCapture(rangeDrawing.pointerId))canvas.releasePointerCapture(rangeDrawing.pointerId);rangeTarget=null;rangeDrawing=null}};
}
const createBeforeRanges=createChart;
createChart=function(canvas,config){
 const domain=rangeDomain(),scope=rangeScope(canvas,config,domain);
 config.plugins=[...(config.plugins||[]),{id:'comparisonRanges',beforeInit:chart=>{chart.$rangeScope=scope;chart.$rangeDomain=domain},afterInit:chart=>{if(chart.canvas.isConnected)attachRangePointer(chart)},beforeDatasetsDraw:chart=>drawRanges(chart,false),afterDatasetsDraw:chart=>drawRanges(chart,true),beforeEvent:chart=>{if(rangeTarget===chart||performance.now()<(chart.$rangeSuppressClickUntil||0))return false},afterDestroy:chart=>chart.$removeRangePointer?.()}];
 return createBeforeRanges(canvas,config);
};

function snapshotHighlights(){return comparisonRanges.map(record=>({...record}))}
function normalizeHighlights(saved){
 if(saved===undefined)return [];if(!Array.isArray(saved)||saved.length>20)throw Error('區間設定須為清單，最多 20 個。');
 return saved.map(item=>{
  if(!item||typeof item!=='object'||typeof item.scope!=='string'||item.scope.length>300||!['hours','calendar','elapsed','overlay'].includes(item.domain)||![item.x1,item.x2].every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e15))throw Error('區間設定的時間範圍無效。');
  if(item.domain==='hours'?![item.x1,item.x2].every(x=>Number.isInteger(x)&&x>=0&&x<24):item.x1>=item.x2)throw Error('區間設定的起訖順序無效。');
  const yAxis=item.yAxis??null;if(yAxis!==null&&(!['y',...keys,'rain'].includes(yAxis)||![item.y1,item.y2].every(y=>typeof y==='number'&&Number.isFinite(y))||item.y1>=item.y2))throw Error('區間設定的數值上下界無效。');
  if(!/^#[\da-f]{6}$/i.test(item.color)||typeof item.opacity!=='number'||!Number.isFinite(item.opacity)||item.opacity<0||item.opacity>.4||typeof item.label!=='string')throw Error('區間設定的外觀無效。');
  return {scope:item.scope,domain:item.domain,x1:item.x1,x2:item.x2,yAxis,y1:yAxis===null?null:item.y1,y2:yAxis===null?null:item.y2,label:item.label.slice(0,60),color:item.color,opacity:item.opacity};
 });
}
function restoreHighlights(saved){comparisonRanges=normalizeHighlights(saved);editingRange=null;rangeFormScope='';stopRangeSelection()}
const studioBeforeRanges=syncStudio;syncStudio=function(){studioBeforeRanges();syncRanges()};
const pickerBeforeRanges=syncChartPicker;syncChartPicker=function(){pickerBeforeRanges();syncRanges()};
const resetBeforeRanges=applyDefaultFormat;applyDefaultFormat=function(){resetBeforeRanges();restoreHighlights([]);refreshRanges()};
const loadBeforeRanges=load;load=async function(files,source){const before=state[source];await loadBeforeRanges(files,source);if(state[source]!==before){restoreHighlights([]);refreshRanges()}};
const stageBeforeRanges=showWorkspaceStage;showWorkspaceStage=function(...args){if(rangeTarget)stopRangeSelection();stageBeforeRanges(...args)};
const pageBeforeRanges=switchPage;switchPage=function(...args){if(rangeTarget)stopRangeSelection();pageBeforeRanges(...args)};
syncRanges();
