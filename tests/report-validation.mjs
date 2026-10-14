import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module'; const require=createRequire(import.meta.url); const ts=require('typescript');
const source=fs.readFileSync(new URL('../src/lib/report-validation.ts',import.meta.url),'utf8');const context={exports:{},Number,Math};vm.runInNewContext(ts.transpile(source,{module:ts.ModuleKind.CommonJS}),context);
const valid=context.exports.isValidOffering;
for(const amount of [0,0.29,1.10,10.01,100,999.99])assert.equal(valid(amount),true,`valid money ${amount}`);
for(const amount of [-1,NaN,Infinity,1.001,Number.MAX_SAFE_INTEGER])assert.equal(valid(amount),false,`invalid money ${amount}`);
console.log('Passed 11 offering validation cases.');
const periodSource=fs.readFileSync(new URL('../src/components/cell-report-generator.tsx',import.meta.url),'utf8');
const periodCode=periodSource.slice(periodSource.indexOf('type Period ='),periodSource.indexOf('export function CellReportGenerator'));
const periodContext={exports:{},Date};vm.runInNewContext(ts.transpile(periodCode,{module:ts.ModuleKind.CommonJS}),periodContext);
const range=periodContext.exports.reportRange;
for(const [period,date,from,to,expected] of [
 ['week','2026-01-01','','',{from:'2025-12-29',to:'2026-01-04'}],
 ['week','2026-10-11','','',{from:'2026-10-05',to:'2026-10-11'}],
 ['month','2024-02-15','','',{from:'2024-02-01',to:'2024-02-29'}],
 ['year','2026-10-07','','',{from:'2026-01-01',to:'2026-12-31'}],
 ['custom','2026-10-07','2026-03-01','2026-08-31',{from:'2026-03-01',to:'2026-08-31'}],
 ['custom','','2026-03-01','2026-08-31',{from:'2026-03-01',to:'2026-08-31'}],
 ['month','','','',{from:'',to:''}]
])assert.equal(JSON.stringify(range(period,date,from,to)),JSON.stringify(expected));
console.log('Passed 7 report-period boundary cases.');
