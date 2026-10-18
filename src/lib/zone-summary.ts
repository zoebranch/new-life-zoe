import {hasEvangelismActivity} from './report-details';
type Cell={id:number;name:string;leader:string};
type Meeting={cellId:number;date:string;attendance:number;visitors:number;offeringAmount:number;evangelismDate:string|null;peopleReached:number;tracts:number;soulsWon:number;teamCount:number;contacts:number;evangelismNotes:string};
type Outreach={cellId:number;date:string;peopleReached:number;tracts:number;soulsWon:number};
export function buildZoneSummary(cells:Cell[],reports:Meeting[],outreach:Outreach[],from:string,to:string){
 return cells.map(cell=>{const meetings=reports.filter(r=>r.cellId===cell.id&&r.date>=from&&r.date<=to);const integrated=reports.filter(r=>r.cellId===cell.id&&r.evangelismDate&&r.evangelismDate>=from&&r.evangelismDate<=to&&hasEvangelismActivity(r));const evangelism=[...outreach.filter(r=>r.cellId===cell.id&&r.date>=from&&r.date<=to),...integrated];const attendance=meetings.reduce((s,r)=>s+r.attendance,0);return {id:cell.id,name:cell.name,leader:cell.leader,meetings:meetings.length,attendance,average:meetings.length?attendance/meetings.length:0,visitors:meetings.reduce((s,r)=>s+r.visitors,0),offering:meetings.reduce((s,r)=>s+r.offeringAmount,0),outreachReports:evangelism.length,reached:evangelism.reduce((s,r)=>s+r.peopleReached,0),tracts:evangelism.reduce((s,r)=>s+r.tracts,0),souls:evangelism.reduce((s,r)=>s+r.soulsWon,0)};});
}
