/* Normalize each file independently; all existing analysis consumes the same schema. */
function hiveQualityReasons(row){
 const limits={temp:[0,50],humidity:[0,100],co2:[0,40000]};
 return keys.filter(k=>row[k]!==''&&(!Number.isFinite(Number(row[k]))||Number(row[k])<limits[k][0]||Number(row[k])>limits[k][1])).map(k=>`${label(k)}超出 ${limits[k].join('～')} ${units[k]}`);
}
function mergeHiveBatches(batches,screen=true){
 const byTime=new Map(), conflicts=new Set(),qualityIssues=[],timeIssues=[];let duplicates=0,invalid=0,repeated=0;
 for(const [batchIndex,batch] of batches.entries()){
  batch.valid=0;batch.invalid=0;batch.first=null;batch.last=null;
  for(const [index,original] of batch.rows.entries()){
   const date=rowDate({...original,__fileDate:batch.fileDate},batch);
   if(!date){invalid++;batch.invalid++;timeIssues.push({file:batch.name,row:index+2,time:String(original[batch.mapping.time]??''),values:keys.map(k=>original[batch.mapping[k]]??''),reason:'無法解析日期時間',invalidTime:true});continue}
   batch.valid++;const t=+date;
   batch.first=batch.first===null?t:Math.min(batch.first,t);batch.last=batch.last===null?t:Math.max(batch.last,t);
   const row={'日期時間':date,__fileName:batch.name,__batch:batchIndex,__row:index+2};
   for(const k of keys){const text=String(original[batch.mapping[k]]??'').trim();row[k]=text!==''?text:''}
   const reasons=hiveQualityReasons(row);
   if(reasons.length){qualityIssues.push({file:batch.name,row:index+2,time:local(date),values:keys.map(k=>row[k]),reason:reasons.join('；')});if(screen)continue}
   for(const k of keys)row[k]=row[k]!==''&&Number.isFinite(Number(row[k]))?Number(row[k]):'';
   const prior=byTime.get(t);
   if(!prior)byTime.set(t,[row]);else if(prior[0].__batch===batchIndex){prior[0].__sharedTime=true;row.__sharedTime=true;prior.push(row);repeated++}else if(prior.some(p=>keys.every(k=>p[k]===row[k])))duplicates++;else conflicts.add(t);
  }
 }
 const rows=[...byTime].filter(([t])=>!conflicts.has(t)).sort(([a],[b])=>a-b).flatMap(([,r])=>r);
 const mapping={time:'日期時間',clock:''};for(const key of keys)mapping[key]=batches.some(b=>b.mapping[key])?key:'';
 return {rows,headers:['日期時間',...keys],mapping,format:'auto',batches,screen,qualityIssues,timeIssues,importStats:{duplicates,conflicts:conflicts.size,invalid,repeated}};
}
function hiveImportSummary(source='hive'){
 const d=state[source];if(!d?.batches)return;const s=d.importStats;
 $(source+'Status').textContent=`已合併 ${d.batches.length} 個檔案，${d.rows.length.toLocaleString()} 筆可用時間紀錄。`+
 (s.duplicates?`相同紀錄去重 ${s.duplicates} 筆。`:'')+(s.conflicts?`同時間數值衝突 ${s.conflicts} 個時刻，已排除，請檢查是否混入不同蜂箱。`:'')+(s.invalid?`無法解析時間 ${s.invalid} 筆，請確認各檔欄位。`:'')+(s.repeated?`同檔重複時間 ${s.repeated} 筆已保留；無法推測秒數，平均依實際筆數。`:'')+`品質檢查：${d.qualityIssues.length} 筆超出範圍（${d.screen?'已排除整筆':'未排除，可能影響圖表尺度'}）。`;
}
function showHiveMappings(source='hive'){
 const d=state[source];if(!d?.batches)return;
 document.querySelector('[data-source="'+source+'"]')?.closest('.mapping-group')?.remove();
 $(source+'FileMappings')?.remove();
 const section=document.createElement('div');section.id=source+'FileMappings';section.style.cssText='grid-column:1/-1;min-width:0';
 const title=document.createElement('h3');title.textContent=sourceName(source)+'（逐檔辨識欄位）';section.appendChild(title);
 const note=document.createElement('p');note.className='mapping-help';note.textContent='點開檔名可修正欄位。單位：溫度 °C、濕度 %、CO₂ ppm；每次選檔會取代上一批。';section.appendChild(note);
 const quality=document.createElement('div');quality.className='import-quality';
 quality.innerHTML='<label class="check-tile"><input id="'+source+'QualityScreen" type="checkbox">排除超出 SCD30 檢查範圍的整筆紀錄</label><p>溫度 0～50 °C（操作範圍）、濕度 0～100%、CO₂ 0～40000 ppm（數位量測範圍）。任一項超出或非數值，整筆不參與繪圖、平均、查詢與異常檢查；空白不補零。這不是蜂群健康門檻，原始檔不變。</p><a href="https://sensirion.com/media/documents/4EAF6AF8/61652C3C/Sensirion_CO2_Sensors_SCD30_Datasheet.pdf" target="_blank" rel="noopener">SCD30 規格依據</a> ';
 const toggle=quality.querySelector('input');toggle.checked=d.screen;toggle.onchange=()=>{state[source]=mergeHiveBatches(d.batches,toggle.checked);state.querySubset=null;manualLabels.clear();markDirty();setup()};
 const issues=[...d.qualityIssues,...(d.timeIssues||[])];const report=document.createElement('button');report.type='button';report.className='secondary';report.textContent=`下載品質與時間檢查紀錄（${issues.length} 筆）`;report.disabled=!issues.length;
 report.onclick=()=>downloadText([['來源檔名','資料列序號（含標題列）','時間','溫度原值','濕度原值','CO₂原值','原因','處理'],...issues.map(r=>[r.file,r.row,r.time,...r.values,r.reason,r.invalidTime||d.screen?'排除整筆':'保留'])].map(r=>r.map(csvCell).join(',')).join('\n'),sourceName(source)+'-SCD30檢查紀錄.csv');quality.appendChild(report);section.appendChild(quality);
 const fileFold=document.createElement('details');fileFold.className='source-files-fold';const fileSummary=document.createElement('summary');fileSummary.textContent='檢查個別檔案與欄位（'+d.batches.length+' 個檔案）';fileFold.appendChild(fileSummary);section.appendChild(fileFold);
 d.batches.forEach((batch,index)=>{
  const details=document.createElement('details');details.className='mapping-group';details.style.display='block';
  details.open=Boolean(batch.invalid||!batch.mapping.time||!keys.some(k=>batch.mapping[k]));
  const summary=document.createElement('summary');summary.style.cssText='overflow-wrap:anywhere;cursor:pointer;padding:10px 0';
  summary.textContent=`${batch.name} · ${batch.valid.toLocaleString()}／${batch.rows.length.toLocaleString()} 筆時間有效`+(batch.first!==null?` · ${local(new Date(batch.first)).replace('T',' ')} ～ ${local(new Date(batch.last)).replace('T',' ')}`:'');details.appendChild(summary);
  const fields=document.createElement('div');fields.className='mapping-time-fields';
  for(const key of ['time','clock',...keys,'format']){
   const field=document.createElement('label');field.textContent=key==='format'?'日期格式':key==='clock'?'獨立時間欄（選填）':label(key);
   const select=document.createElement('select');select.setAttribute('aria-label',`${sourceName(source)} ${batch.name} ${field.textContent}`);
   const options=key==='format'?[['auto','自動辨識'],['ymd','年／月／日'],['dmy','日／月／年'],['mdy','月／日／年']]:[['','不使用'],...batch.headers.map(h=>[h,h])];
   for(const [v,text]of options){const option=document.createElement('option');option.value=v;option.textContent=text;option.selected=v===(key==='format'?batch.format:batch.mapping[key]);select.appendChild(option)}
   select.onchange=()=>{if(key==='format')batch.format=select.value;else batch.mapping[key]=select.value;state[source]=mergeHiveBatches(d.batches,d.screen);state.querySubset=null;manualLabels.clear();markDirty();setup();$(source+'FileMappings').querySelectorAll('.source-files-fold > details')[index].open=true};
   field.appendChild(select);fields.appendChild(field);
  }
  details.appendChild(fields);fileFold.appendChild(details);if(details.open)fileFold.open=true;
 });
 $('mappingGrid').prepend(section);hiveImportSummary(source);
 if(d.qualityIssues.length||d.importStats.invalid||d.importStats.conflicts||!keys.some(k=>d.mapping[k]))mappingFold.open=true;
}
const setupBeforeHiveImport=setup;
setup=function(){setupBeforeHiveImport();showHiveMappings('hive');showHiveMappings('peer')};
const loadBeforeHiveImport=load;const hiveLoadGeneration={hive:0,peer:0};
load=async function(files,source){
 if(!['hive','peer'].includes(source))return loadBeforeHiveImport(files,source);
 const generation=++hiveLoadGeneration[source],list=[...files];$(source+'Status').textContent=`正在讀取 ${list.length} 個檔案…`;
 try{
  const batches=[];
  for(const [fileIndex,file] of list.entries()){
   $(source+'Status').textContent=`正在讀取 ${fileIndex+1}／${list.length}：${file.name}`;await new Promise(resolve=>setTimeout(resolve,0));
   const rows=await read(file),batch={name:file.name,rows,headers:Object.keys(rows[0]),format:'auto',fileDate:dateFromName(file.name)};
   batch.mapping=autoMapping(batch);batches.push(batch);
  }
  if(generation!==hiveLoadGeneration[source])return;
  state[source]=mergeHiveBatches(batches);if(source==='peer'&&!state.hive&&!state.weather&&$('comparisonMode'))$('comparisonMode').value='peerOnly';state.querySubset=null;manualLabels.clear();markDirty();if(typeof invalidateAnomalies==='function')invalidateAnomalies();setup();
 }catch(error){if(generation===hiveLoadGeneration[source])$(source+'Status').textContent=`匯入失敗，原資料未更動：${error.message}`}
};
