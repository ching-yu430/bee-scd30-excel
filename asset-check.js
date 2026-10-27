// A visible diagnostic instead of silently missing controls after a partial upload.
const missingWebsiteParts=[];
if(!document.getElementById('resultsTools')||!document.getElementById('swapExperiments')||getComputedStyle(document.documentElement).getPropertyValue('--bee-result-tools').trim()!=='compact')missingWebsiteParts.push('v23.6 來源開關、個別線色與 A／B 交換');
if(!document.getElementById('rangeSession')||getComputedStyle(document.documentElement).getPropertyValue('--bee-theme-version').trim()!=='23.6')missingWebsiteParts.push('v23.6 連續框選與統一樣式');
if(typeof rangeRectangles!=='function'||!document.getElementById('rangeBlock'))missingWebsiteParts.push('v23.6 區間框選');
if(!document.getElementById('settingsTabs')||!document.getElementById('workspaceMode'))missingWebsiteParts.push('v23.6 設定分頁與快速模式');
if(typeof analysisRangeFor!=='function'||!document.getElementById('experimentPurpose'))missingWebsiteParts.push('v23 實驗比較工作區');
if(!document.getElementById('studioAnnotations')||document.documentElement.dataset.uiRelease!=='23.6'||getComputedStyle(document.documentElement).getPropertyValue('--bee-studio-version').trim()!=='23.6')missingWebsiteParts.push('v23.6 介面程式／首頁完整樣式');
if(typeof sourceBounds!=='function'||!document.getElementById('comparisonMode')||!document.getElementById('peerFile')?.multiple)missingWebsiteParts.push('comparison.js（雙蜂箱比較）');
if(typeof mergeHiveBatches!=='function')missingWebsiteParts.push('hive-import.js（內部多檔匯入）');
if(!document.getElementById('downloadCurrentPng'))missingWebsiteParts.push('panel-polish.js（側邊下載與標註配色）');
if(typeof wholeDayBounds!=='function'||!document.getElementById('chartPicker'))missingWebsiteParts.push('workflow.js（三步操作流程）');
if(typeof detectAnomalies!=='function'||!document.getElementById('scanAnomalies'))missingWebsiteParts.push('anomalies.js（異常快速檢查）');
if(!document.getElementById('xTickInterval'))missingWebsiteParts.push('tick-controls.js（橫軸刻度控制）');
if(typeof fixedTimeTicks!=='function'||typeof selectedTimeStep!=='function')missingWebsiteParts.push('新版 time-axis.js（刻度計算）');
if(typeof exceedanceRuns!=='function')missingWebsiteParts.push('exceedance.js（超標統計）');
if(typeof selectedRainSeries!=='function'||!document.getElementById('rain-hive-humidity'))missingWebsiteParts.push('新版 rainfall.js（多指標降水量比較）');
if(!document.getElementById('plotQueryResults')||!document.getElementById('calculateEvents'))missingWebsiteParts.push('query-actions.js（查詢功能）');
if(getComputedStyle(document.documentElement).getPropertyValue('--bee-tick-controls').trim()!=='ready')missingWebsiteParts.push('新版 ease.css（刻度區排版）');
if(missingWebsiteParts.length){const banner=document.createElement('div');banner.setAttribute('role','alert');banner.style.cssText='padding:18px;margin:16px;border:2px solid #a33;background:#fff4ec;color:#721c14;line-height:1.8';banner.textContent='網站更新不完整：缺少或仍使用舊版 '+missingWebsiteParts.join('、')+'。請完整上傳同一版本的檔案，再重新整理。';document.querySelector('main').prepend(banner)}
else document.querySelector('footer').textContent='蜂箱環境資料分析台 v23.6 · 資料僅在瀏覽器處理';
const initialHelp=document.getElementById('emptyPlot');if(initialHelp)initialHelp.textContent='匯入資料後，即可製作圖表或查詢紀錄。';
