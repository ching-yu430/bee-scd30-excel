// Distribute ticks across the full range instead of deleting late interior ticks.
function endpointTicks(min,max,base,width=900){
 if(!Number.isFinite(min)||!Number.isFinite(max)||max<min)return [];
 if(min===max)return [{value:min}];
 const capacity=Math.max(2,Math.min(10,Math.floor(width/145))),span=max-min;
 const intervals=Math.max(1,Math.min(capacity-1,Math.floor(span/base)));
 const anchor=+new Date(new Date(min).setHours(0,0,0,0));
 const ticks=[{value:min}];
 for(let i=1;i<intervals;i++){const target=min+span*i/intervals;const t=anchor+Math.round((target-anchor)/base)*base;if(t>ticks[ticks.length-1].value&&t<max)ticks.push({value:t})}
 ticks.push({value:max});return ticks;
}
xScale=function(day=false){return {type:'linear',afterBuildTicks:axis=>{
 const base=({raw:60000,'5min':300000,'15min':900000,hour:3600000,day:86400000})[effectiveMode()]||3600000;
 axis.ticks=endpointTicks(axis.min,axis.max,base,axis.chart.width);
 },ticks:{autoSkip:false,minRotation:0,maxRotation:0,align:'inner',callback:v=>{const text=timeLabel(v,false);return day?text.slice(11):[text.slice(0,10),text.slice(11)]}},title:{display:true,text:day?'時間':'日期與時間'}}};
