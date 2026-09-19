// Stable point identities do not depend on a series' editable display name.
const manualLabels=new Set();
function pointValue(p){return p!==null&&typeof p==='object'?p.y:p}
function pointIdentity(ds,i){const p=ds.data[i];return ds.researchSeries+'|'+(p!==null&&typeof p==='object'?p.x:ds.researchXKeys?.[i]??i)+'|'+pointValue(p)}
function annotationIndices(ds,o){
 const result=new Map();if(o.showValues)selectIndices(ds.data,o.labelLimit).forEach(i=>result.set(i,'auto'));
 let min=-1,max=-1;ds.data.forEach((p,i)=>{const y=pointValue(p);if(y===null||!Number.isFinite(+y))return;if(min<0||+y<+pointValue(ds.data[min]))min=i;if(max<0||+y>+pointValue(ds.data[max]))max=i;if(manualLabels.has(pointIdentity(ds,i)))result.set(i,'指定')});
 if(o.showMin&&min>=0)result.set(min,'最低');if(o.showMax&&max>=0)result.set(max,max===min&&o.showMin?'最高／最低':'最高');return result;
}
function preparePointLabels(config,o){
 const mode=value('chartMode');config.data.datasets.forEach(ds=>{ds.researchXKeys=config.data.labels;ds.researchSeries=[mode,effectiveMode(),metricOf(ds),ds.customName?ds.label:ds.borderDash?.length?'weather':'hive'].join('|');ds.researchSelected=annotationIndices(ds,o);const dots=selectIndices(ds.data,o.labelLimit),single=ds.data.filter(p=>pointValue(p)!==null).length===1;ds.pointRadius=c=>ds.researchSelected.has(c.dataIndex)||single||(o.showPoints&&dots.has(c.dataIndex))?Math.max(single?3:0,o.pointSize):0});
 config.options.onClick=(event,elements,chart)=>{if(!checked('pickPoints'))return;const hit=chart.getElementsAtEventForMode(event,'nearest',{intersect:false},false)[0];if(!hit)return;const ds=chart.data.datasets[hit.datasetIndex],i=hit.index;if(pointValue(ds.data[i])===null)return;togglePoint(chart,ds,i)};
}
function togglePoint(chart,ds,i,remove=false){const id=pointIdentity(ds,i);if(remove||manualLabels.has(id))manualLabels.delete(id);else manualLabels.add(id);refreshPointLabels(chart)}
function refreshPointLabels(chart){chart.data.datasets.forEach(ds=>ds.researchSelected=annotationIndices(ds,chart.$researchOptions));chart.update('none');chart.$refreshPointList?.()}
function pointTime(chart,ds,i){const p=ds.data[i];if(ds.researchSeries.startsWith('co2hour|'))return chart.data.labels?.[i]||String(i).padStart(2,'0')+':00';if(ds.researchSeries.startsWith('overlay|')){const seconds=Math.round(p.x*3600);return String(Math.floor(seconds/3600)).padStart(2,'0')+':'+String(Math.floor(seconds%3600/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}return local(new Date(p.x)).replace('T',' ')}
function normalizedPointTime(text){
 text=String(text).normalize('NFKC').trim().replace('T',' ').replace(/[年月/]/g,'-').replace(/日/g,' ').replace(/\s+/g,' ');
 const m=text.match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})\s+)?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);if(!m)return null;
 const h=+m[4],min=+m[5],s=+(m[6]||0);if(h>23||min>59||s>59)return null;
 let day='';if(m[1]){const d=new Date(+m[1],+m[2]-1,+m[3]);if(d.getFullYear()!==+m[1]||d.getMonth()!==+m[2]-1||d.getDate()!==+m[3])return null;day=[m[1],m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-')}
 return {day,clock:[h,min,s].map(v=>String(v).padStart(2,'0')).join(':'),seconds:h*3600+min*60+s};
}
function findPointTime(chart,ds,text){const target=normalizedPointTime(text);if(!target)return {matches:[],suggestions:[],invalid:true};const matches=[],ranked=[];const hourMode=/^(co2hour|overlay)\|/.test(ds.researchSeries);
 ds.data.forEach((p,i)=>{if(pointValue(p)===null||!Number.isFinite(+pointValue(p)))return;const t=normalizedPointTime(pointTime(chart,ds,i));if(!t)return;if((hourMode||!target.day||t.day===target.day)&&t.clock===target.clock)matches.push(i);const distance=hourMode||!target.day?Math.abs(t.seconds-target.seconds):Math.abs(+new Date(t.day+'T'+t.clock)- +new Date(target.day+'T'+target.clock));ranked.push({i,distance})});ranked.sort((a,b)=>a.distance-b.distance);return {matches,suggestions:ranked.slice(0,3).map(x=>x.i)};
}
function addPointEditor(chart){
 const card=chart.canvas.closest('.chart-card');card.querySelector('.point-editor')?.remove();const panel=document.createElement('details');panel.className='point-editor';panel.innerHTML='<summary>指定要顯示數值的時間點</summary><p>直接開啟上方「點選標示」，再點曲線；也可在這裡輸入確切時間。再次點選可取消。</p><div class="point-fields"><label>選擇線條<select class="point-series"></select></label><label>時間（須為圖上的資料點）<input class="point-time" placeholder="例如 2026-07-22 08:00:00"></label><button type="button" class="secondary point-add">標示這個點</button></div><p class="point-status" role="status"></p><div class="point-list"></div>';
 const select=panel.querySelector('select');chart.data.datasets.forEach((ds,i)=>{const option=document.createElement('option');option.value=i;option.textContent=ds.label;select.appendChild(option)});
 const input=panel.querySelector('input'),status=panel.querySelector('.point-status');
 const sample=()=>{const ds=chart.data.datasets[+select.value],i=ds.data.findIndex(p=>pointValue(p)!==null);input.value=i<0?'':pointTime(chart,ds,i);input.placeholder=input.value;status.textContent='已帶入這條線的第一個有效時間，可直接標示或修改。支援斜線日期與省略秒數。';};select.onchange=sample;sample();
 const choose=i=>{const ds=chart.data.datasets[+select.value];manualLabels.add(pointIdentity(ds,i));refreshPointLabels(chart);input.value=pointTime(chart,ds,i);status.textContent='已標示 '+input.value};
 panel.querySelector('.point-add').onclick=()=>{const ds=chart.data.datasets[+select.value],result=findPointTime(chart,ds,input.value);if(result.matches.length===1){choose(result.matches[0]);return}status.replaceChildren();status.textContent=result.invalid?'時間格式無法辨識，請使用 2026/7/22 08:00，或小時圖使用 08:00。':result.matches.length>1?'多個日期都有這個時間，請補上日期，或選擇下列實際資料點：':'此時間沒有資料（可能已平均或篩除）。請確認下列鄰近資料點後點選，不會自動改選：';(result.matches.length?result.matches.slice(0,3):result.suggestions).forEach(i=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=pointTime(chart,ds,i)+' · '+Number(pointValue(ds.data[i])).toFixed(chart.$researchOptions.decimals);b.onclick=()=>choose(i);status.appendChild(b)})};
 chart.$refreshPointList=()=>{const list=panel.querySelector('.point-list');list.replaceChildren();chart.data.datasets.forEach(ds=>ds.data.forEach((p,i)=>{if(!manualLabels.has(pointIdentity(ds,i)))return;const b=document.createElement('button');b.className='secondary';b.textContent=ds.label+' · '+pointTime(chart,ds,i)+' · '+pointValue(p)+' ×';b.title='取消此數值標示';b.onclick=()=>togglePoint(chart,ds,i,true);list.appendChild(b)}));if(!list.children.length)list.textContent='尚未指定時間點。最高／最低標籤由上方開關控制。'};card.appendChild(panel);chart.$refreshPointList();
}
