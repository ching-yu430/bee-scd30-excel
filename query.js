// Query original rows independently of chart filters, averaging and visibility.
function queryNumber(v){const t=String(v??'').trim();return t!==''&&Number.isFinite(Number(t))?Number(t):null}
function matchesQuery(row,q){
 if(q.dateMode==='days'&&!q.days.includes(row.day))return false;
 if(q.dateMode==='range'&&(row.day<q.start||row.day>q.end))return false;
 if(q.op==='none')return true;const v=row[q.metric];if(v===null)return false;
 return q.op==='gt'?v>q.min:q.op==='gte'?v>=q.min:q.op==='lt'?v<q.min:q.op==='lte'?v<=q.min:v>=q.min&&v<=q.max;
}
function validateQuery(q){if(q.dateMode==='days'&&!q.days.length)throw Error('請先加入至少一天。');if(q.dateMode==='range'&&(!q.start||!q.end||q.start>q.end))throw Error('請確認查詢開始與結束日期。');if(q.op!=='none'&&(q.min===''||!Number.isFinite(+q.min)))throw Error('請輸入有效的條件數值。');if(q.op==='range'&&(q.max===''||!Number.isFinite(+q.max)||+q.min>+q.max))throw Error('請確認數值上下限。')}
