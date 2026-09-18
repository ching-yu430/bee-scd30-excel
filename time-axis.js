// Always include both observed endpoints; trim nearby interior ticks, not endpoints.
function endpointTicks(min,max,base,width=900){
 if(!Number.isFinite(min)||!Number.isFinite(max)||max<min)return [];
 if(min===max)return [{value:min}];
 const capacity=Math.max(2,Math.min(10,Math.floor(width/145))),span=max-min;
 const step=base*Math.max(1,Math.ceil(span/base/(capacity-1)));
 const anchor=+new Date(new Date(min).setHours(0,0,0,0));
 const gap=span/(capacity-1)*.75,ticks=[{value:min}];
 for(let t=anchor+Math.ceil((min-anchor)/step)*step;t<max;t+=step){if(t-min>=gap&&max-t>=gap)ticks.push({value:t})}
 ticks.push({value:max});return ticks;
}
xScale=function(day=false){return {type:'linear',afterBuildTicks:axis=>{
 const base=({raw:60000,'5min':300000,'15min':900000,hour:3600000,day:86400000})[effectiveMode()]||3600000;
 axis.ticks=endpointTicks(axis.min,axis.max,base,axis.chart.width);
 },ticks:{autoSkip:false,minRotation:0,maxRotation:0,align:'inner',callback:v=>{const text=timeLabel(v,false);return day?text.slice(11):[text.slice(0,10),text.slice(11)]}},title:{display:true,text:day?'時間':'日期與時間'}}};
