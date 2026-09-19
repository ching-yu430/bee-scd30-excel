// Observed runs only: never extrapolate duration across missing or normal readings.
function exceedanceRuns(rows,threshold,inclusive,maxGapMs){
 if(!Number.isFinite(threshold)||!Number.isFinite(maxGapMs)||maxGapMs<=0)throw Error('請輸入有效門檻與資料間隔。');
 const events=[];for(const source of [...new Set(rows.map(r=>r.source))]){let event=null,previous=null;const sorted=rows.filter(r=>r.source===source).sort((a,b)=>a.time-b.time);
 for(const row of sorted){const v=row.co2,above=v!==null&&Number.isFinite(v)&&(inclusive?v>=threshold:v>threshold);const gap=previous!==null&&row.time-previous>maxGapMs;
 if(!above||gap){if(event){event.endReason=gap?'資料中斷':'恢復正常／缺值';events.push(event);event=null}}
 if(above){if(!event)event={source,start:row.time,end:row.time,peak:v,n:0,spanSeconds:0,endReason:'所選資料結束'};event.end=row.time;event.peak=Math.max(event.peak,v);event.n++;event.spanSeconds=(event.end-event.start)/1000}previous=row.time;
 }if(event)events.push(event)}return events.sort((a,b)=>a.start-b.start);
}
