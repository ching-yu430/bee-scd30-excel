// Stable point identities do not depend on a series' editable display name.
const manualLabels=new Set();
function pointValue(p){return p!==null&&typeof p==='object'?p.y:p}
function pointIdentity(ds,i){const p=ds.data[i];return ds.researchSeries+'|'+(p!==null&&typeof p==='object'?p.x:i)+'|'+pointValue(p)}
function annotationIndices(ds,o){
 const result=new Map();if(o.showValues)selectIndices(ds.data,o.labelLimit).forEach(i=>result.set(i,'auto'));
 let min=-1,max=-1;ds.data.forEach((p,i)=>{const y=pointValue(p);if(y===null||!Number.isFinite(+y))return;if(min<0||+y<+pointValue(ds.data[min]))min=i;if(max<0||+y>+pointValue(ds.data[max]))max=i;if(manualLabels.has(pointIdentity(ds,i)))result.set(i,'指定')});
 if(o.showMin&&min>=0)result.set(min,'最低');if(o.showMax&&max>=0)result.set(max,max===min&&o.showMin?'最高／最低':'最高');return result;
}
function preparePointLabels(config,o){
 const mode=value('chartMode');config.data.datasets.forEach(ds=>{ds.researchSeries=[mode,effectiveMode(),metricOf(ds),ds.customName?ds.label:ds.borderDash?.length?'weather':'hive'].join('|');ds.researchSelected=annotationIndices(ds,o);const dots=selectIndices(ds.data,o.labelLimit);ds.pointRadius=c=>ds.researchSelected.has(c.dataIndex)||(o.showPoints&&dots.has(c.dataIndex))?o.pointSize:0});
 config.options.onClick=(event,elements,chart)=>{if(!checked('pickPoints'))return;const hit=chart.getElementsAtEventForMode(event,'nearest',{intersect:false},false)[0];if(!hit)return;const ds=chart.data.datasets[hit.datasetIndex],i=hit.index;if(pointValue(ds.data[i])===null)return;togglePoint(chart,ds,i)};
}
function togglePoint(chart,ds,i,remove=false){const id=pointIdentity(ds,i);if(remove||manualLabels.has(id))manualLabels.delete(id);else manualLabels.add(id);refreshPointLabels(chart)}
function refreshPointLabels(chart){chart.data.datasets.forEach(ds=>ds.researchSelected=annotationIndices(ds,chart.$researchOptions));chart.update('none');chart.$refreshPointList?.()}
function pointTime(chart,ds,i){const p=ds.data[i];if(chart.data.labels)return chart.data.labels[i];if(ds.researchSeries.startsWith('overlay|')){const seconds=Math.round(p.x*3600);return String(Math.floor(seconds/3600)).padStart(2,'0')+':'+String(Math.floor(seconds%3600/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}return local(new Date(p.x)).replace('T',' ')}
function addPointEditor(chart){
 const card=chart.canvas.closest('.chart-card');card.querySelector('.point-editor')?.remove();const panel=document.createElement('details');panel.className='point-editor';panel.innerHTML='<summary>指定要顯示數值的時間點</summary><p>直接開啟上方「點選標示」，再點曲線；也可在這裡輸入確切時間。再次點選可取消。</p><div class="point-fields"><label>選擇線條<select class="point-series"></select></label><label>時間（須為圖上的資料點）<input class="point-time" placeholder="例如 2026-07-22 08:00:00"></label><button type="button" class="secondary point-add">標示這個點</button></div><p class="point-status" role="status"></p><div class="point-list"></div>';
 const select=panel.querySelector('select');chart.data.datasets.forEach((ds,i)=>{const option=document.createElement('option');option.value=i;option.textContent=ds.label;select.appendChild(option)});
 const input=panel.querySelector('input');input.placeholder=pointTime(chart,chart.data.datasets[0],0)||'時間';
 panel.querySelector('.point-add').onclick=()=>{const ds=chart.data.datasets[+select.value],text=input.value.trim().replace('T',' ');const i=ds.data.findIndex((p,j)=>pointValue(p)!==null&&(pointTime(chart,ds,j)===text||pointTime(chart,ds,j)===text+':00'));if(i<0){panel.querySelector('.point-status').textContent='找不到此時間的資料点，請依圖上的時間與彙整尺度輸入；不會自動選取鄰近點。';return}manualLabels.add(pointIdentity(ds,i));refreshPointLabels(chart);panel.querySelector('.point-status').textContent='已標示 '+pointTime(chart,ds,i)};
 chart.$refreshPointList=()=>{const list=panel.querySelector('.point-list');list.replaceChildren();chart.data.datasets.forEach(ds=>ds.data.forEach((p,i)=>{if(!manualLabels.has(pointIdentity(ds,i)))return;const b=document.createElement('button');b.className='secondary';b.textContent=ds.label+' · '+pointTime(chart,ds,i)+' · '+pointValue(p)+' ×';b.title='取消此數值標示';b.onclick=()=>togglePoint(chart,ds,i,true);list.appendChild(b)}));if(!list.children.length)list.textContent='尚未指定時間點。最高／最低標籤由上方開關控制。'};card.appendChild(panel);chart.$refreshPointList();
}
