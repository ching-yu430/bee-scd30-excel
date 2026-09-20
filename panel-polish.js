// Keep presentation/export controls off the plotting surface.
styleButton.textContent='外觀、標註與下載';
stylePanel.querySelector('h2').textContent='調整外觀與標註';
const exportSection=document.querySelector('.export-settings').closest('details');
exportSection.querySelector('summary').textContent='下載與匯出設定';stylePanel.appendChild(exportSection);exportSection.open=true;
const exportActions=document.createElement('div');exportActions.className='panel-downloads';exportSection.querySelector('summary').after(exportActions);
const currentPng=document.createElement('button');currentPng.id='downloadCurrentPng';currentPng.className='primary';currentPng.textContent='下載目前圖表 PNG';
currentPng.onclick=()=>{if(!ensureCurrent())return;const chart=[...state.charts,...(state.co2Chart?[state.co2Chart]:[])].find(c=>{const card=c.canvas.closest('.chart-card');return card&&!card.hidden&&!card.classList.contains('hidden')});if(chart)exportCharts([chart])};
exportActions.append(currentPng,$('downloadPng'),$('downloadCsv'),$('exportQuery'),$('downloadEvents'),$('downloadAnomalies'));
stylePanel.appendChild($('backToAnomalies'));
const paletteSection=$('metricControls').closest('details').querySelector('.editor-body');
const shadeStyle=document.createElement('div');shadeStyle.className='shade-palette';shadeStyle.innerHTML='<h4>超標區域顏色</h4><label>短暫超標<input id="shadeShort" type="color" value="#e4972a"></label><label>持續超標<input id="shadeLong" type="color" value="#be3728"></label>';
paletteSection.appendChild(shadeStyle);settingIds.push('shadeShort','shadeLong');
for(const id of ['shadeShort','shadeLong'])$(id).oninput=()=>{if(state.output.length)draw()};
const resetBeforeShade=applyDefaultFormat;applyDefaultFormat=function(){resetBeforeShade();$('shadeShort').value='#e4972a';$('shadeLong').value='#be3728'};
const anomalyNote=document.createElement('p');anomalyNote.className='anomaly-note';anomalyNote.textContent='各指標與條件獨立判斷；同時命中多項會分別列出。「全部異常」涵蓋超標與突升／突降，並非同一時間必須全部符合。';$('anomalySettings').after(anomalyNote);
function syncPanelDownloads(){
 const plot=workspacePage==='plot',query=workspacePage==='query';
 styleButton.hidden=plot?workspaceStage!==3:!(state.hive||state.weather);
 editFold.hidden=!plot;
 exportSection.querySelector('.export-settings').hidden=!plot;
 for(const id of ['downloadCurrentPng','downloadPng','downloadCsv'])$(id).hidden=!plot;
 $('exportQuery').hidden=!query;$('downloadEvents').hidden=!query;$('downloadAnomalies').hidden=workspacePage!=='anomaly';
 $('exportQuery').disabled=!queryRows.length;
 $('backToAnomalies').hidden=!plot||!anomalyActive;
}
const compactBeforePanel=syncCompactNavigation;syncCompactNavigation=function(){compactBeforePanel();syncPanelDownloads()};
const toggleBeforePanel=toggleStyle;toggleStyle=function(open){syncPanelDownloads();toggleBeforePanel(open)};
const pickerBeforePanel=syncChartPicker;syncChartPicker=function(){pickerBeforePanel();syncPanelDownloads()};
document.querySelector('.chart-heading').appendChild(chartPickerLabel);
document.querySelector('.chart-heading h2').textContent='圖表';
syncPanelDownloads();
