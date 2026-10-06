import test from 'node:test';
import assert from 'node:assert/strict';
import { powerBIReportUrl } from '../src/utils/powerBIReportUrl.ts';
const report='11111111-2222-3333-4444-555555555555';
test('Power BI configuration validates Microsoft report URLs without credentials',()=>{
 assert.equal(powerBIReportUrl(undefined),null);
 for(const input of ['http://app.powerbi.com/reportEmbed?reportId='+report,'https://app.powerbi.com.evil.example/reportEmbed?reportId='+report,'https://app.powerbi.com/view?r=public','https://app.powerbi.com/reportEmbed?reportId=bad','https://app.powerbi.com/reportEmbed?reportId='+report+'&access_token=secret']) assert.equal(powerBIReportUrl(input),null);
 const url=new URL(powerBIReportUrl('https://app.powerbi.com/reportEmbed?reportId='+report)!);
 assert.equal(url.searchParams.get('reportId'),report);assert.equal(url.searchParams.get('autoAuth'),'true');assert.equal(url.searchParams.get('navContentPaneEnabled'),'false');
});

test('approved public reports retain only their embed code',()=>{
 const code='eyJrIjoiZmljdGlvbmFsLXRlc3QtcmVwb3J0In0=';
 const url=new URL(powerBIReportUrl('https://app.powerbi.com/view?r='+encodeURIComponent(code)+'&unrelated=value')!);
 assert.equal(url.pathname,'/view');
 assert.equal(url.searchParams.get('r'),code);
 assert.deepEqual([...url.searchParams.keys()],['r']);
 assert.equal(powerBIReportUrl('https://app.powerbi.com/view'),null);
 assert.equal(powerBIReportUrl('https://name:password@app.powerbi.com/view?r='+code),null);
 assert.equal(powerBIReportUrl('https://app.powerbi.com.evil.example/view?r='+code),null);
});
