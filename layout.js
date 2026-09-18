// Keep labels, fields and action buttons in separate, predictable layout cells.
document.querySelectorAll('.chart-editor > .editor-section').forEach((panel,index)=>{
 const body=document.createElement('div');body.className='editor-body'+(index===3?' export-settings':'');
 [...panel.children].filter(el=>el.tagName!=='SUMMARY').forEach(el=>body.appendChild(el));panel.appendChild(body);
});
document.querySelectorAll('label:has(> input[type="checkbox"])').forEach(label=>label.classList.add('check-tile'));
document.querySelectorAll('.file-button').forEach(label=>{label.tabIndex=0;label.setAttribute('role','button');label.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();label.querySelector('input').click()}})});
const setupBeforeLayout=setup;
document.querySelector('footer').textContent='蜂箱環境資料分析台 v8.1 · 資料僅在瀏覽器處理 · 請以台灣時區使用';
setup=function(){setupBeforeLayout();
 document.querySelectorAll('.mapping-group').forEach(card=>{
  const source=card.querySelector('[data-source]')?.dataset.source;
  const time=document.createElement('div');time.className='mapping-block';time.innerHTML='<h4>① 確認時間</h4><p class="mapping-help"></p><div class="mapping-time-fields"></div>';
  time.querySelector('p').textContent=source==='weather'?'單日氣象站：日期取自檔名，時間選觀測小時欄；24 時視為隔日 00:00。':'日期與時間分開時，兩欄都要選；完整日期時間在同欄時，獨立時間選「不使用」。';
  const values=document.createElement('div');values.className='mapping-block';values.innerHTML='<h4>② 配對量測數值</h4><div class="mapping-value-fields"></div>';
  [...card.querySelectorAll('select')].forEach(select=>{const label=select.closest('label');const key=select.dataset.key;if(['temp','humidity','co2'].includes(key)){values.lastElementChild.appendChild(label)}else{time.lastElementChild.appendChild(label);if(key==='clock')label.firstChild.textContent='獨立時間欄（選填）';if(key==='time')label.firstChild.textContent=source==='weather'?'觀測小時／日期時間':'日期／完整日期時間'}});
  card.append(time,values);
 });
};
