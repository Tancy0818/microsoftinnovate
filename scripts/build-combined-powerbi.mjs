import fs from 'node:fs/promises';
const root='powerbi/AcuityCompass.Report/definition';
const modelPath='powerbi/AcuityCompass.SemanticModel/model.bim';
const backup=`.local/powerbi-before-unified-${Date.now()}`;
await fs.mkdir(backup,{recursive:true});
await fs.copyFile(modelPath,`${backup}/model.bim`);
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,v)=>{await fs.mkdir(p.substring(0,p.lastIndexOf('/')),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')};
const templates={};
for(const id of ['title','subtitle','footer','kpi_1','snapshot','arrivals_departures','area_capacity','urgency']) templates[id]=await read(`${root}/pages/overview/visuals/${id}/visual.json`);
const page=await read(`${root}/pages/overview/page.json`);
const model=await read(modelPath);
function table(name,columns,measures){return {name,columns:Object.entries(columns).map(([name,dataType])=>({name,dataType,sourceColumn:name,summarizeBy:'none',...(dataType==='dateTime'?{formatString:'dd MMM yyyy'}:{})})),partitions:[{name,mode:'import',source:{type:'m',expression:['let',' Source = PostgreSQL.Database("127.0.0.1:5433", "acuitycompass", [CreateNavigationProperties=false]),',` Data = Source{[Schema="reporting",Item="${name}"]}[Data]`,'in',' Data']}}],measures:measures.map(([name,expression,formatString])=>({name,expression,formatString}))};}
model.model.tables=model.model.tables.filter(t=>!['operational_daily','operational_areas'].includes(t.name));
model.model.tables.push(table('operational_daily',{report_date:'dateTime',arrivals:'int64',departures:'int64'},[['Daily arrivals','SUM(operational_daily[arrivals])','#,0'],['Daily departures','SUM(operational_daily[departures])','#,0']]));
model.model.tables.push(table('operational_areas',{area_name:'string',staffed_capacity:'int64',occupied:'int64'},[['Area occupancy','DIVIDE(SUM(operational_areas[occupied]),SUM(operational_areas[staffed_capacity]),0)','0.0%']]));
const patients=model.model.tables.find(t=>t.name==='interactive_patients');
patients.measures.find(m=>m.name==='Refresh label').expression='"Refreshed: " & FORMAT(MAX(interactive_patients[refreshed_at]), "dd MMM yyyy HH:mm") & " IST | Home > Refresh after website changes"';
await write(modelPath,model);
await fs.cp(`${root}/pages`,`${backup}/pages`,{recursive:true});
const clearFiles=async p=>{for(const e of await fs.readdir(p,{withFileTypes:true})){const f=p+"/"+e.name;if(e.isDirectory())await clearFiles(f);else await fs.unlink(f);}};
await clearFiles(`${root}/pages`);
page.displayName='Combined ED dashboard';page.visualInteractions=[];
await write(`${root}/pages/overview/page.json`,page);
await write(`${root}/pages/pages.json`,{$schema:'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json',pageOrder:['overview'],activePageName:'overview'});
const projection=(table,property,measure=true)=>({field:{[measure?'Measure':'Column']:{Expression:{SourceRef:{Entity:table}},Property:property}},queryRef:`${table}.${property}`,nativeQueryRef:property,...(!measure?{active:true}:{})});
const visuals=[];
const clone=(id,name)=>{const v=structuredClone(templates[id]);v.name=name;delete v.filterConfig;return v};
function title(v,text){v.visual.visualContainerObjects.title[0].properties.text={expr:{Literal:{Value:`'${text}'`}}};}
for(const [id,text,y] of [['title','AcuityCompass | Combined ED dashboard',20],['subtitle','SYNTHETIC DATA | September dataset + website entries | Original dates retained',75],['footer','Counts show the current saved state. Trends include all recorded dates. This continues a historical snapshot; it is not a live hospital feed.',795]]){
 const v=clone(id,id);v.position={x:24,y,width:1232,height:50,z:1,tabOrder:1};v.visual.objects.general[0].properties.paragraphs[0].textRuns[0].value=text;visuals.push(v);
}
for(const [i,[measure,label]] of [['Entered visits','All recorded visits'],['Current active','Active patients · now'],['Current waiting','Patients waiting · now'],['Current occupancy','Bed occupancy · now'],['Completed departures','All ED departures']].entries()){
 const v=clone('kpi_1',`kpi_${i+1}`);v.position={x:24+i*249,y:145,width:233,height:125,z:1,tabOrder:2+i};v.visual.query={queryState:{Values:{projections:[projection('interactive_patients',measure)]}}};title(v,label);visuals.push(v);
}
for(const [id,table,category,measures,label] of [
 ['arrivals_departures','operational_daily','report_date',['Daily arrivals','Daily departures'],'Daily arrivals and departures · all records'],
 ['area_capacity','operational_areas','area_name',['Area occupancy'],'Bed occupancy by area · now'],
 ['urgency','interactive_patients','triage_level',['Current active'],'Urgency of active patients · now']]){
 const v=clone(id,id);v.visual.query={queryState:{Category:{projections:[projection(table,category,false)]},Y:{projections:measures.map(m=>projection(table,m))}}};title(v,label);visuals.push(v);
}
const stamp=clone('snapshot','snapshot');stamp.visual.query={queryState:{Values:{projections:[projection('interactive_patients','Refresh label')]}}};visuals.push(stamp);
// Charts are explanatory; selections do not change the current-state KPI totals.
for(const source of ['arrivals_departures','area_capacity','urgency'])for(const v of visuals)if(v.name!==source)page.visualInteractions.push({source,target:v.name,type:'NoFilter'});
await write(`${root}/pages/overview/page.json`,page);
for(const v of visuals)await write(`${root}/pages/overview/visuals/${v.name}/visual.json`,v);
console.log(`One combined dashboard created. Backup: ${backup}`);
