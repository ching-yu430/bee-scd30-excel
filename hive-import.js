/* Normalize each file independently; all existing analysis consumes the same schema. */
function hiveQualityReasons(row){
 const limits={temp:[0,50],humidity:[0,100],co2:[0,40000]};
 return keys.filter(k=>row[k]!==''&&(!Number.isFinite(Number(row[k]))||Number(row[k])<limits[k][0]||Number(row[k])>limits[k][1])).map(k=>`${label(k)}超出 ${limits[k].join('～')} ${units[k]}`);
}
function mergeHiveBatches(batches,screen=true){
 const byTime=new Map(), conflicts=new Set(),qualityIssues=[];let duplicates=0,invalid=0;
 for(const batch of batches){
  batch.valid=0;batch.invalid=0;batch.first=null;batch.last=null;
  for(const [index,original] of batch.rows.entries()){
   const date=rowDate({...original,__fileDate:batch.fileDate},batch);
   if(!date){invalid++;batch.invalid++;continue}
   batch.valid++;const t=+date;
   batch.first=batch.first===null?t:Math.min(batch.first,t);batch.last=batch.last===null?t:Math.max(batch.last,t);
   const row={'日期時間':date,__fileName:batch.name};
   for(const k of keys){const text=String(original[batch.mapping[k]]??'').trim();row[k]=text!==''?text:''}
   const reasons=hiveQualityReasons(row);
   if(reasons.length){qualityIssues.push({file:batch.name,row:index+2,time:local(date),values:keys.map(k=>row[k]),reason:reasons.join('；')});if(screen)continue}
   for(const k of keys)row[k]=row[k]!==''&&Number.isFinite(Number(row[k]))?Number(row[k]):'';
   const prior=byTime.get(t);
   if(prior){if(keys.every(k=>prior[k]===row[k]))duplicates++;else conflicts.add(t)}else byTime.set(t,row);
  }
 }
 const rows=[...byTime].filter(([t])=>!conflicts.has(t)).sort(([a],[b])=>a-b).map(([,r])=>r);
 const mapping={time:'日期時間',clock:''};for(const key of keys)mapping[key]=batches.some(b=>b.mapping[key])?key:'';
 return {rows,headers:['日期時間',...keys],mapping,format:'auto',batches,screen,qualityIssues,importStats:{duplicates,conflicts:conflicts.size,invalid}};
}
function hiveImportSummary(){
 const d=state.hive;if(!d?.batches)return;const s=d.importStats;
 $('hiveStatus').textContent=`已合併 ${d.batches.length} 個檔案，${d.rows.length.toLocaleString()} 筆可用時間紀錄。`+
 (s.duplicates?`相同紀錄去重 ${s.duplicates} 筆。`:'')+(s.conflicts?`同時間數值衝突 ${s.conflicts} 個時刻，已排除，請檢查是否混入不同蜂箱。`:'')+(s.invalid?`無法解析時間 ${s.invalid} 筆，請確認各檔欄位。`:'')+`品質檢查：${d.qualityIssues.length} 筆超出範圍（${d.screen?'已排除整筆':'未排除，可能影響圖表尺度'}）。`;
}
function showHiveMappings(){
 const d=state.hive;if(!d?.batches)return;
 document.querySelector('[data-source="hive"]')?.closest('.mapping-group')?.remove();
 $('hiveFileMappings')?.remove();
 const section=document.createElement('div');section.id='hiveFileMappings';section.style.cssText='grid-column:1/-1;min-width:0';
 const title=document.createElement('h3');title.textContent='內部 SCD30（逐檔辨識欄位）';section.appendChild(title);
 const note=document.createElement('p');note.className='mapping-help';note.textContent='點開檔名可修正欄位。單位：溫度 °C、濕度 %、CO₂ ppm；每次選檔會取代上一批。';section.appendChild(note);
 const quality=document.createElement('div');quality.style.cssText='padding:16px;border:1px solid #bd8d35;border-radius:10px;margin-bottom:16px;background:#fff9ed';
 quality.innerHTML='<label class="check-tile"><input id="hiveQualityScreen" type="checkbox">排除超出 SCD30 檢查範圍的整筆紀錄</label><p>溫度 0～50 °C（操作範圍）、濕度 0～100%、CO₂ 0～40000 ppm（數位量測範圍）。任一項超出或非數值，整筆不參與繪圖、平均、查詢與異常檢查；空白不補零。這不是蜂群健康門檻，原始檔不變。</p><a href="https://sensirion.com/media/documents/4EAF6AF8/61652C3C/Sensirion_CO2_Sensors_SCD30_Datasheet.pdf" target="_blank" rel="noopener">SCD30 規格依據</a> ';
 const toggle=quality.querySelector('input');toggle.checked=d.screen;toggle.onchange=()=>{state.hive=mergeHiveBatches(d.batches,toggle.checked);state.querySubset=null;manualLabels.clear();markDirty();setup()};
 const report=document.createElement('button');report.type='button';report.className='secondary';report.textContent=`下載品質檢查紀錄（${d.qualityIssues.length} 筆）`;report.disabled=!d.qualityIssues.length;
 report.onclick=()=>downloadText([['來源檔名','資料列序號（含標題列）','時間','溫度原值','濕度原值','CO₂原值','原因','處理'],...d.qualityIssues.map(r=>[r.file,r.row,r.time,...r.values,r.reason,d.screen?'排除整筆':'保留'])].map(r=>r.map(csvCell).join(',')).join('\n'),'SCD30品質檢查紀錄.csv');quality.appendChild(report);section.appendChild(quality);
 d.batches.forEach((batch,index)=>{
  const details=document.createElement('details');details.className='mapping-group';details.style.display='block';
  details.open=Boolean(batch.invalid||!batch.mapping.time||!keys.some(k=>batch.mapping[k]));
  const summary=document.createElement('summary');summary.style.cssText='overflow-wrap:anywhere;cursor:pointer;padding:10px 0';
  summary.textContent=`${batch.name} · ${batch.valid.toLocaleString()}／${batch.rows.length.toLocaleString()} 筆時間有效`+(batch.first!==null?` · ${local(new Date(batch.first)).replace('T',' ')} ～ ${local(new Date(batch.last)).replace('T',' ')}`:'');details.appendChild(summary);
  const fields=document.createElement('div');fields.className='mapping-time-fields';
  for(const key of ['time','clock',...keys,'format']){
   const field=document.createElement('label');field.textContent=key==='format'?'日期格式':key==='clock'?'獨立時間欄（選填）':label(key);
   const select=document.createElement('select');select.setAttribute('aria-label',`${batch.name} ${field.textContent}`);
   const options=key==='format'?[['auto','自動辨識'],['ymd','年／月／日'],['dmy','日／月／年'],['mdy','月／日／年']]:[['','不使用'],...batch.headers.map(h=>[h,h])];
   for(const [v,text]of options){const option=document.createElement('option');option.value=v;option.textContent=text;option.selected=v===(key==='format'?batch.format:batch.mapping[key]);select.appendChild(option)}
   select.onchange=()=>{if(key==='format')batch.format=select.value;else batch.mapping[key]=select.value;state.hive=mergeHiveBatches(d.batches,d.screen);state.querySubset=null;manualLabels.clear();markDirty();setup();$('hiveFileMappings').querySelectorAll('details')[index].open=true};
   field.appendChild(select);fields.appendChild(field);
  }
  details.appendChild(fields);section.appendChild(details);
 });
 $('mappingGrid').prepend(section);hiveImportSummary();
 if(d.qualityIssues.length||d.importStats.invalid||d.importStats.conflicts||!keys.some(k=>d.mapping[k]))mappingFold.open=true;
}
const setupBeforeHiveImport=setup;
setup=function(){setupBeforeHiveImport();showHiveMappings()};
const loadBeforeHiveImport=load;let hiveLoadGeneration=0;
load=async function(files,source){
 if(source!=='hive')return loadBeforeHiveImport(files,source);
 const generation=++hiveLoadGeneration,list=[...files];$('hiveStatus').textContent=`正在讀取 ${list.length} 個檔案…`;
 try{
  const batches=[];
  for(const file of list){
   const rows=await read(file),batch={name:file.name,rows,headers:Object.keys(rows[0]),format:'auto',fileDate:dateFromName(file.name)};
   batch.mapping=autoMapping(batch);batches.push(batch);
  }
  if(generation!==hiveLoadGeneration)return;
  state.hive=mergeHiveBatches(batches);state.querySubset=null;markDirty();if(typeof invalidateAnomalies==='function')invalidateAnomalies();setup();
 }catch(error){if(generation===hiveLoadGeneration)$('hiveStatus').textContent=`匯入失敗，原資料未更動：${error.message}`}
};
