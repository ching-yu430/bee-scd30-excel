// A visible diagnostic instead of silently missing controls after a partial upload.
const missingWebsiteParts=[];
if(!document.getElementById('xTickInterval'))missingWebsiteParts.push('tick-controls.js（橫軸刻度控制）');
if(typeof fixedTimeTicks!=='function'||typeof selectedTimeStep!=='function')missingWebsiteParts.push('新版 time-axis.js（刻度計算）');
if(typeof exceedanceRuns!=='function')missingWebsiteParts.push('exceedance.js（超標統計）');
if(typeof aggregateRainfall!=='function')missingWebsiteParts.push('rainfall.js（降水量比較）');
if(!document.getElementById('plotQueryResults')||!document.getElementById('calculateEvents'))missingWebsiteParts.push('query-actions.js（查詢功能）');
if(getComputedStyle(document.documentElement).getPropertyValue('--bee-tick-controls').trim()!=='ready')missingWebsiteParts.push('新版 ease.css（刻度區排版）');
if(missingWebsiteParts.length){const banner=document.createElement('div');banner.setAttribute('role','alert');banner.style.cssText='padding:18px;margin:16px;border:2px solid #a33;background:#fff4ec;color:#721c14;line-height:1.8';banner.textContent='網站更新不完整：缺少或仍使用舊版 '+missingWebsiteParts.join('、')+'。請完整上傳同一版本的檔案，再重新整理。';document.querySelector('main').prepend(banner)}
else document.querySelector('footer').textContent='蜂箱環境資料分析台 v12 · 刻度、超標統計、查詢繪圖與降水量比較已載入 · 資料僅在瀏覽器處理';
const initialHelp=document.getElementById('emptyPlot');if(initialHelp)initialHelp.textContent='先在上方匯入資料。「製作圖表」中會出現橫軸刻度間距；「查詢資料」完成查詢後，可統計超標時段或將結果繪圖。';
