/* Experiment identity and real observation times stay separate from plot axes. */
sourceIds.push('weatherPeer');
state.weatherPeer=null;
const experimentSources=['hive','peer'];
const weatherSources=['weather','weatherPeer'];
const legendPrefixes={hive:'innerName-',peer:'peerName-',weather:'outerName-',weatherPeer:'weatherPeerName-'};
function parentExperiment(source){return source==='peer'||source==='weatherPeer'?'peer':'hive'}
function experimentName(source){return $(source+'Name')?.value.trim()||({hive:'實驗 A',peer:'實驗 B'})[source]}
sourceName=function(source){return weatherSources.includes(source)?experimentName(parentExperiment(source))+' 氣象站':experimentName(source)||source};
function comparisonPurpose(){return value('experimentPurpose','different')}
function separateExperimentPeriods(){return comparisonPurpose()==='different'&&!state.experimentDetail&&!state.querySubset}
function analysisRangeFor(source){
 if(state.experimentDetail)return {start:state.experimentDetail.start,end:state.experimentDetail.end};
 const experiment=parentExperiment(source);
 return separateExperimentPeriods()?{start:value(experiment+'PeriodStart'),end:value(experiment+'PeriodEnd')}:{start:value('startDate'),end:value('endDate')};
}
function experimentOrigin(source){return +new Date(value(parentExperiment(source)+'Origin')+'T00:00:00')}
function isRelativeComparison(){return separateExperimentPeriods()&&value('timeAlignment')==='elapsed'&&['continuous','combined'].includes(value('chartMode'))}
function plotTimeFor(source,time){return isRelativeComparison()?time-experimentOrigin(source):time}
function relativePlotEnd(){return Math.max(86400000,...activePlotSources().map(source=>plotTimeFor(source,+new Date(analysisRangeFor(source).end))))}
function relativeAxis(){
 const day=86400000;
 return {type:'linear',afterBuildTicks:axis=>{
  const step=Math.max(1,Math.ceil((axis.max-axis.min)/day/8)),ticks=[axis.min];
  for(let index=Math.ceil(axis.min/day);index*day<axis.max;index+=step)if(index*day>axis.min)ticks.push(index*day);
  if(axis.max>axis.min)ticks.push(axis.max);axis.ticks=ticks.map(value=>({value}));
 },ticks:{autoSkip:false,callback:value=>{
  const fraction=((value%day)+day)%day,hour=Math.floor(fraction/3600000),minute=Math.floor(fraction%3600000/60000);
  return '第 '+(Math.floor(value/day)+1)+' 天'+(fraction?' '+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0'):'');
 }},title:{display:true,text:'實驗天數（第 1 天為已確認起點）'}};
}
function diurnalMetric(){return value('overviewMetric','co2')}
function diurnalMean(bin){
 if(!bin?.n)return null;
 if(value('profileMethod','observations')==='days')return [...bin.daily.values()].reduce((sum,day)=>sum+day.sum/day.n,0)/bin.daily.size;
 return bin.sum/bin.n;
}
function experimentCalculationSignature(){return [comparisonPurpose(),...experimentSources.map(source=>{const range=analysisRangeFor(source);return [range.start,range.end]})]}
requestedSources=function(){
 if(state.experimentDetail)return [state.experimentDetail.source];
 if(comparisonPurpose()==='single')return ['hive'];
 const mode=value('comparisonMode','hives');
 const selected=({mine:['hive'],peerOnly:['peer'],weather:['hive','weather'],hives:['hive','peer'],all:sourceIds,stationB:['weatherPeer']})[mode]||['hive','peer'];
 return selected.filter(source=>!weatherSources.includes(source)||!$(parentExperiment(source)+'UseWeather')||checked(parentExperiment(source)+'UseWeather'));
};
activePlotSources=function(){return (state.querySubset?sourceIds.filter(source=>state.querySubset[source]?.size):requestedSources()).filter(source=>state[source]&&(state.experimentDetail||source!=='weather'||state.weatherEnabled))};
function sourceDash(source){return ({hive:[],peer:[8,4,2,4],weather:[12,7],weatherPeer:[3,5]})[source]||[]}
function rainfallSource(){return value('rainStation','weather')}
