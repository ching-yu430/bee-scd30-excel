/* A short guided route, while preserving the full research controls. */
const guide=document.createElement('nav');guide.className='workflow';guide.setAttribute('aria-label','操作流程');guide.innerHTML='<button type="button" id="goSource"><span>1</span><div>匯入資料<small>Excel／CSV，只需上傳一次</small></div></button><button type="button" id="goPlot"><span>2</span><div>選擇用途<small>製作圖表，或查詢紀錄</small></div></button><button type="button" id="goResult"><span>3</span><div>檢視與下載<small>標示重點，保留分析結果</small></div></button>';sourcePanel.before(guide);
const editorPanel=document.querySelector('.chart-editor'),editFold=section('調整圖表外觀與標示（選填）');editorPanel.before(editFold);editFold.appendChild(editorPanel);editFold.classList.add('appearance-fold');
const formatStatus=document.createElement('p');formatStatus.className='quick-note';formatStatus.textContent='先看圖，再展開外觀設定。每張圖下方可指定標示時間點或單張下載。';editFold.before(formatStatus);
// Keep diagnostics available without pushing the next task out of view.
const diagnostics=section('資料品質與計算摘要');$('qualitySummary').before(diagnostics);diagnostics.appendChild($('qualitySummary'));
const beforeEaseSetup=setup;setup=function(){beforeEaseSetup();const preview=$('timePreview');if(preview){let summary=$('sourceTimeHint');if(!summary){summary=document.createElement('p');summary.id='sourceTimeHint';summary.className='quick-note';sourcePanel.after(summary)}summary.textContent=preview.textContent}};
function jump(el){el.scrollIntoView({behavior:'smooth',block:'start'})}
$('goSource').onclick=()=>{sourcePanel.open=true;jump(sourcePanel)};$('goPlot').onclick=()=>jump(tabs);$('goResult').onclick=()=>{const target=queryPage.hidden?$('chartCard'):$('queryResults');if(target.hidden||target.classList.contains('hidden')){jump(queryPage.hidden?$('controlsCard'):queryPage);return}jump(target)};
const oldMarkDirty=markDirty;markDirty=function(){oldMarkDirty();$('renderButton').textContent='套用並更新圖表'};
const beforeEaseRender=render;render=function(){beforeEaseRender();if(!state.dirty)$('renderButton').textContent='更新圖表'};$('renderButton').onclick=render;
$('renderButton').textContent='製作圖表';document.querySelector('footer').textContent='蜂箱環境資料分析台 v10.1 · 資料僅在瀏覽器處理 · 請以台灣時區使用';
