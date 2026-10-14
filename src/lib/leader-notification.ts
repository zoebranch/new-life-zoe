type Assignment = {userId:string; email:string; leader:string; kind:"cell"|"zone"; name:string};
export type NotificationResult = {status:"accepted"|"not_configured"|"failed"; message:string};

export function assignmentEmail(assignment:Assignment, siteUrl:string) {
  const login=new URL("/leaders",siteUrl).href;
  const role=assignment.kind==="cell"?"Cell Leader":"Zone Leader";
  return {
    subject:`Zoe Branch — Your ${role} assignment`,
    text:`Hello ${assignment.leader || "Leader"},\n\nYou have been appointed as ${role} for ${assignment.name} at New Life Christian Center, Zoe Branch.\n\nYour sign-in email is ${assignment.email}.\nSign in here: ${login}\n\nPlease contact the church administrator for your temporary password.\n\nThank you for serving your church.\nZoe Branch Administration`,
  };
}

export async function notifyLeaderAssignment(assignment:Assignment):Promise<NotificationResult> {
  const key=process.env.RESEND_API_KEY, from=process.env.LEADER_EMAIL_FROM, site=process.env.APP_SITE_URL;
  if(!key||!from||!site)return {status:"not_configured",message:"The account is ready. Email notifications are not configured; share the sign-in details with the leader."};
  let url:URL;
  try {url=new URL(site);if(url.protocol!=="https:"||url.hostname==="localhost"||url.hostname==="127.0.0.1")throw Error();}
  catch{return {status:"not_configured",message:"The account is ready. A public HTTPS website address is required before notification emails can be sent."};}
  try {
    const email=assignmentEmail(assignment,url.origin);
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`leader-assignment/${assignment.userId}`},
      body:JSON.stringify({from,to:[assignment.email],...email}),signal:AbortSignal.timeout(10000),
    });
    if(!response.ok)throw Error();
    const result=await response.json();if(typeof result.id!=="string")throw Error();
    return {status:"accepted",message:"The assignment email has been accepted for delivery to the leader."};
  } catch {return {status:"failed",message:"The account is ready, but its notification email could not be sent. Share the sign-in details with the leader or retry the notification."};}
}
