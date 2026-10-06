import fs from 'node:fs/promises';
import path from 'node:path';
const root='powerbi', modelPath=path.join(root,'AcuityCompass.SemanticModel/model.bim');
const report=path.join(root,'AcuityCompass.Report/definition');
const backup=path.join('.local',`powerbi-before-interactive-${Date.now()}`);
await fs.mkdir(backup,{recursive:true});
await fs.copyFile(modelPath,path.join(backup,'model.bim'));
await fs.cp(report,path.join(backup,'report-definition'),{recursive:true});
const model=JSON.parse(await fs.readFile(modelPath,'utf8'));
const name='interactive_patients';
const columns={visit_id:'string',arrival_time:'dateTime',arrival_method:'string',stage:'string',triage_level:'string',area_name:'string',bed_number:'int64',latest_event_time:'dateTime',active_count:'int64',waiting_count:'int64',occupied_count:'int64',departed_count:'int64',staffed_beds:'int64',refreshed_at:'dateTime'};
const measures=[
 ['Entered visits','COUNTA(interactive_patients[visit_id])','#,0'],
 ['Current active','SUM(interactive_patients[active_count])','#,0'],
 ['Current waiting','SUM(interactive_patients[waiting_count])','#,0'],
 ['Current occupancy','DIVIDE(SUM(interactive_patients[occupied_count]), MAX(interactive_patients[staffed_beds]), 0)','0.00%'],
 ['Completed departures','SUM(interactive_patients[departed_count])','#,0'],
 ['Refresh label','"Database refresh: " & FORMAT(MAX(interactive_patients[refreshed_at]), "dd MMM yyyy HH:mm:ss") & " IST | Click Home > Refresh after website changes"',null],
];
const table={name,columns:Object.entries(columns).map(([name,dataType])=>({name,dataType,sourceColumn:name,summarizeBy:'none',...(dataType==='dateTime'?{formatString:'dd MMM yyyy HH:mm:ss'}:{})})),
 partitions:[{name,mode:'import',source:{type:'m',expression:['let','    Source = PostgreSQL.Database("127.0.0.1:5433", "acuitycompass", [CreateNavigationProperties=false]),','    Patients = Source{[Schema="reporting",Item="interactive_patients"]}[Data]','in','    Patients']}}],
 measures:measures.map(([name,expression,formatString])=>({name,expression,...(formatString?{formatString}:{})}))};
model.model.tables=model.model.tables.filter(t=>t.name!==name);model.model.tables.push(table);
await fs.writeFile(modelPath,JSON.stringify(model,null,2)+'\n');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const write=async(file,obj)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(obj,null,2)+'\n')};
const newPage=path.join(report,'pages/interactive');
const page=await read(path.join(report,'pages/overview/page.json'));
page.name='interactive';page.displayName='Website patient entries';delete page.visualInteractions;
await write(path.join(newPage,'page.json'),page);
const pages=await read(path.join(report,'pages/pages.json'));pages.pageOrder=[...pages.pageOrder.filter(p=>p!=='interactive'),'interactive'];pages.activePageName='interactive';await write(path.join(report,'pages/pages.json'),pages);
const projection=(property,measure=true)=>({field:{[measure?'Measure':'Column']:{Expression:{SourceRef:{Entity:name}},Property:property}},queryRef:`${name}.${property}`,nativeQueryRef:property});
async function clone(source,id,x,y,width,height){const v=await read(path.join(report,`pages/overview/visuals/${source}/visual.json`));v.name=id;v.position={x,y,width,height,z:1,tabOrder:1};return v;}
async function save(v){await write(path.join(newPage,`visuals/${v.name}/visual.json`),v)}
for(const [id,text,y,size] of [['title','AcuityCompass | Combined patient records',20,25],['subtitle','SYNTHETIC DEMO | September patients + website entries | Original dates retained',75,11],['footer','Demo: Add patient on website, then Home > Refresh here. Discharge releases the bed; visit history stays in PostgreSQL.',795,11]]){
 const v=await clone('title',id,24,y,1232,50);v.visual.objects.general[0].properties.paragraphs[0].textRuns=[{value:text,textStyle:{fontFamily:'Segoe UI',fontSize:`${size}pt`,color:'#203149'}}];await save(v);
}
for(const [i,measure] of ['Entered visits','Current active','Current waiting','Current occupancy','Completed departures'].entries()){
 const v=await clone('kpi_1',`interactive_kpi_${i}`,24+i*249,145,233,125);
 v.visual.query.queryState={Values:{projections:[projection(measure)]}};
 v.visual.visualContainerObjects.title[0].properties.text={expr:{Literal:{Value:`'${measure}'`}}};await save(v);
}
const grid=await clone('kpi_1','patient_records',24,300,1232,360);
grid.visual.visualType='tableEx';grid.visual.objects={};
grid.visual.query.queryState={Values:{projections:['visit_id','arrival_time','triage_level','stage','area_name','bed_number','latest_event_time'].map(p=>projection(p,false))}};
grid.visual.visualContainerObjects.title[0].properties.text={expr:{Literal:{Value:"'Saved patient records (including departed visits)'"}}};await save(grid);
const stamp=await clone('snapshot','interactive_refresh',24,690,1232,80);stamp.visual.query.queryState={Values:{projections:[projection('Refresh label')]}};await save(stamp);
console.log(`Connected interactive report page; prior definitions backed up to ${backup}`);
