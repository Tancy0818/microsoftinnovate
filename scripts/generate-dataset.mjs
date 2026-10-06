import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Entirely fictional operational activity. No source patient data is used.
const output = fileURLToPath(new URL('../dataset/', import.meta.url));
const start = Date.parse('2026-08-29T00:00:00+05:30');
const cutoff = Date.parse('2026-09-28T00:00:00+05:30');
const minute = 60000, hour = 60 * minute;
let seed = 28092026;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const integer = (low, high) => low + Math.floor(random() * (high - low + 1));
const local = (t) => new Date(t + 330 * minute).toISOString().slice(0, 19).replace('T', ' ');
const areas = [
  {area_id:'A01',area_name:'Triage',staffed_capacity:6,is_bed_area:0},
  {area_id:'A02',area_name:'Waiting Area',staffed_capacity:24,is_bed_area:0},
  {area_id:'A03',area_name:'Resuscitation',staffed_capacity:4,is_bed_area:1},
  {area_id:'A04',area_name:'Examination',staffed_capacity:18,is_bed_area:1},
  {area_id:'A05',area_name:'Observation',staffed_capacity:12,is_bed_area:1},
  {area_id:'A06',area_name:'Boarding',staffed_capacity:10,is_bed_area:1},
];
const beds = Object.fromEntries(areas.filter(a=>a.is_bed_area).map(a=>[a.area_id,Array.from({length:a.staffed_capacity},(_,i)=>({id:`${a.area_id}-${String(i+1).padStart(2,'0')}`,free:start}))]));
function reserve(area,ready,duration){const bed=[...beds[area]].sort((a,b)=>a.free-b.free||a.id.localeCompare(b.id))[0];const at=Math.max(ready,bed.free);bed.free=at+duration*minute;return {bed:bed.id,start:at,end:bed.free};}
const raw=[];
for(let h=0;h<720;h++){
  const day=Math.floor(h/24),clock=h%24;
  const surge=[5,6,12,19,20,26,27].includes(day)&&clock>=10&&clock<22;
  const count=integer(clock<7?1:3,clock<7?3:6)+(surge?4:0);
  for(let n=0;n<count;n++)raw.push({arrival:start+h*hour+integer(1,59)*minute,surge});
}
raw.sort((a,b)=>a.arrival-b.arrival);
const visits=[], segments=[];
for(const [i,r] of raw.entries()){
  const visit_id=`SYN-${String(i+1).padStart(5,'0')}`;
  const draw=random();const triage=draw<.03?'Red':draw<.16?'Orange':draw<.57?'Yellow':draw<.88?'Green':'Blue';
  const area=triage==='Red'?'A03':random()<.28?'A05':'A04';
  const prewait=triage==='Red'?0:triage==='Orange'?integer(3,12):integer(8,r.surge?65:30);
  const registration=triage==='Red'?1:integer(2,5),triageDuration=triage==='Red'?1:integer(3,7);
  const ready=r.arrival+(registration+triageDuration+prewait)*minute;
  const duration=integer(70,r.surge?225:165);
  const allocation=reserve(area,ready,duration);
  const path=[];
  const add=(stage,area_id,from,to,bed_id='')=>{if(to>from)path.push({visit_id,stage,area_id,from,to,bed_id});};
  const regEnd=r.arrival+registration*minute, triageEnd=regEnd+triageDuration*minute;
  add('Registration','A01',r.arrival,regEnd);
  add('Triage','A01',regEnd,triageEnd);
  add('Waiting','A02',triageEnd,allocation.start);
  const assessed=allocation.start+integer(12,25)*minute;
  add('Assessment',area,allocation.start,assessed,allocation.bed);
  add('Treatment',area,assessed,allocation.end-5*minute,allocation.bed);
  let departure=allocation.end;
  if(random()<.22){
    const transfer=reserve('A06',allocation.end,integer(60,r.surge?300:180));
    add('Awaiting Bed','A02',allocation.end-5*minute,transfer.start);
    add('Awaiting Bed','A06',transfer.start,transfer.end-5*minute,transfer.bed);
    add('Discharge','A06',transfer.end-5*minute,transfer.end,transfer.bed);
    departure=transfer.end;
  }else add('Discharge',area,allocation.end-5*minute,allocation.end,allocation.bed);
  const current=path.find(s=>s.from<cutoff&&s.to>=cutoff);
  const observed=path.filter(s=>s.from<cutoff);
  segments.push(...observed);
  const preAssessmentWait=Math.max(0,(Math.min(allocation.start,cutoff)-r.arrival)/minute);
  visits.push({visit_id,arrival_time:local(r.arrival),arrival_date:local(r.arrival).slice(0,10),departure_time:departure<cutoff?local(departure):'',departure_date:departure<cutoff?local(departure).slice(0,10):'',triage_level:triage,arrival_condition:r.surge?'High Demand':'Normal Operations',first_care_area_id:area,first_assessment_time:allocation.start<cutoff?local(allocation.start):'',wait_to_assessment_minutes:allocation.start<cutoff?preAssessmentWait:null,wait_elapsed_minutes:preAssessmentWait,ed_stay_minutes:departure<cutoff?(departure-r.arrival)/minute:null,status_at_cutoff:current?'Active':'Departed',stage_at_cutoff:current?.stage||'Departed',area_at_cutoff:current?.area_id||'',synthetic:1});
}
const visitMap=new Map(visits.map(v=>[v.visit_id,v]));
const events=segments.map((s,i)=>({event_id:`EV-${String(i+1).padStart(6,'0')}`,visit_id:s.visit_id,stage:s.stage,area_id:s.area_id,bed_id:s.bed_id,stage_start:local(s.from),stage_end:s.to<cutoff?local(s.to):'',observed_minutes:(Math.min(s.to,cutoff)-s.from)/minute,synthetic:1}));
const capacity=[], hourly=[];
for(let h=1;h<=720;h++){
  const at=start+h*hour,from=at-hour;
  const active=segments.filter(s=>s.from<at&&s.to>=at);
  const waiting=active.filter(s=>['Registration','Triage','Waiting','Awaiting Bed'].includes(s.stage));
  let occupiedBeds=0;
  for(const area of areas){
    const group=active.filter(s=>s.area_id===area.area_id);
    const occupied=area.is_bed_area?group.filter(s=>s.bed_id).length:group.length;
    const overflow=Math.max(0,occupied-area.staffed_capacity);
    if(area.is_bed_area){assert.equal(overflow,0);occupiedBeds+=occupied;}
    capacity.push({snapshot_time:local(at),report_date:local(from).slice(0,10),area_id:area.area_id,staffed_capacity:area.staffed_capacity,occupied,waiting:group.filter(s=>['Registration','Triage','Waiting','Awaiting Bed'].includes(s.stage)).length,overflow,is_bed_area:area.is_bed_area,synthetic:1});
  }
  const arrivals=raw.filter(r=>r.arrival>=from&&r.arrival<at).length;
  const departures=visits.filter(v=>v.departure_time&&v.departure_time>=local(from)&&v.departure_time<local(at)).length;
  const average=waiting.length?waiting.reduce((n,s)=>n+(at-(Date.parse(visitMap.get(s.visit_id).arrival_time.replace(' ','T')+'+05:30')))/minute,0)/waiting.length:0;
  const prev=hourly.at(-1)?.active_patients||0;
  assert.equal(prev+arrivals-departures,active.length);
  hourly.push({hour_start:local(from),snapshot_time:local(at),report_date:local(from).slice(0,10),hour_of_day:(h-1)%24,arrivals,departures,active_patients:active.length,patients_waiting:waiting.length,average_elapsed_wait_minutes:Math.round(average*100)/100,occupied_beds:occupiedBeds,staffed_beds:44,high_acuity_waiting_over_15:waiting.filter(s=>['Red','Orange'].includes(visitMap.get(s.visit_id).triage_level)&&(at-Date.parse(visitMap.get(s.visit_id).arrival_time.replace(' ','T')+'+05:30'))/minute>15).length,synthetic:1});
}
const dates=Array.from({length:30},(_,i)=>{const t=start+i*24*hour;return {report_date:local(t).slice(0,10),day_number:i+1,day_name:new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'Asia/Kolkata'}).format(t)};});
assert.equal(new Set(visits.map(v=>v.visit_id)).size,visits.length);
for(const v of visits){const p=segments.filter(s=>s.visit_id===v.visit_id);for(let i=1;i<p.length;i++)assert.equal(p[i-1].to,p[i].from);}
for(const bed of Object.values(beds).flat()){const timeline=segments.filter(s=>s.bed_id===bed.id).sort((a,b)=>a.from-b.from);for(let i=1;i<timeline.length;i++)assert.ok(timeline[i].from>=timeline[i-1].to);}
const tables={areas,dates,visits,flow_events:events,area_capacity_hourly:capacity,department_hourly:hourly};
await fs.mkdir(output,{recursive:true});
const escape=(v)=>v==null?'':`"${String(v).replaceAll('"','""')}"`;
for(const [name,rows] of Object.entries(tables)){const keys=Object.keys(rows[0]);await fs.writeFile(`${output}/${name}.csv`,keys.join(',')+'\r\n'+rows.map(r=>keys.map(k=>escape(r[k])).join(',')).join('\r\n')+'\r\n');}
await fs.writeFile(`${output}/dataset.json`,JSON.stringify(tables));
const metadata={generator:'AcuityCompass synthetic operational simulation v1',seed:28092026,period_start:local(start),period_end_exclusive:local(cutoff),timezone:'Asia/Kolkata (UTC+05:30), timestamps have no offset in CSV',source:'Entirely fictional; no real patient or hospital source',rows:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),checks:'Unique IDs, continuous stage timelines, no overlapping bed assignments, no bed-capacity overflow, hourly census conservation passed',latest_snapshot:hourly.at(-1)};
await fs.writeFile(`${output}/manifest.json`,JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata,null,2));
