import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(path){const scope={exports:{},require:(name)=>{if(name==='./report-details')return load('../src/lib/report-details.ts');throw Error('Unexpected import '+name);}};vm.runInNewContext(ts.transpile(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),scope);return scope.exports;}
const {buildZoneSummary}=load('../src/lib/zone-summary.ts');
const cells=[{id:1,name:'One',leader:'Leader one'},{id:2,name:'Missing reports',leader:'Leader two'}];
const base={cellId:1,date:'2026-10-12',attendance:10,visitors:1,offeringAmount:12.5,evangelismDate:null,peopleReached:0,tracts:0,soulsWon:0,teamCount:0,contacts:0,evangelismNotes:''};
const reports=[base,{...base,date:'2026-10-18',attendance:20,visitors:2,offeringAmount:20,evangelismDate:'2026-11-01',peopleReached:999},{...base,date:'2026-10-01',attendance:999,evangelismDate:'2026-10-13',peopleReached:7,tracts:5,soulsWon:2},{...base,cellId:999,attendance:999,evangelismDate:'2026-10-15',peopleReached:999},{...base,date:'2026-11-01',attendance:999}];
const outreach=[{cellId:1,date:'2026-10-14',peopleReached:3,tracts:4,soulsWon:1},{cellId:1,date:'2026-11-01',peopleReached:999,tracts:999,soulsWon:999},{cellId:999,date:'2026-10-14',peopleReached:999,tracts:999,soulsWon:999}];
const result=buildZoneSummary(cells,reports,outreach,'2026-10-12','2026-10-18');
assert.equal(result.length,2);assert.equal(result[0].meetings,2);assert.equal(result[0].attendance,30);assert.equal(result[0].average,15);assert.equal(result[0].visitors,3);assert.equal(result[0].offering,32.5);assert.equal(result[0].outreachReports,2);assert.equal(result[0].reached,10);assert.equal(result[0].tracts,9);assert.equal(result[0].souls,3);assert.equal(result[1].meetings,0);assert.equal(result[1].average,0);assert.equal(result[1].reached,0);
assert.equal(buildZoneSummary([],reports,outreach,'2026-10-12','2026-10-18').length,0);
console.log('Passed zone summary boundaries, active-cell scope, multiple-meeting averages, missing submissions, and evangelism activity-date checks.');
