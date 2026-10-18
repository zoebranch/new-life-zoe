export type YouthRules={early_min:number;early_max:number;adult_min:number;adult_max:number};
export const defaultYouthRules:YouthRules={early_min:13,early_max:18,adult_min:19,adult_max:34};
export function youthGroup(age:number,rules:YouthRules=defaultYouthRules){if(!Number.isInteger(age)||age<0||age>120)return null;return age>=rules.early_min&&age<=rules.early_max?'early-youth':age>=rules.adult_min&&age<=rules.adult_max?'young-adults':null;}
export function normalizeWhatsAppPhone(value:string){let digits=value.replace(/[^0-9]/g,'');if(digits.length===10&&digits.startsWith('0'))digits='260'+digits.slice(1);else if(digits.startsWith('00'))digits=digits.slice(2);return /^[1-9][0-9]{7,14}$/.test(digits)?'+'+digits:null;}
export function cleanGroupLink(value:string){try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.hostname!=='chat.whatsapp.com'||url.username||url.password||url.port||!/^\/[A-Za-z0-9]+$/.test(url.pathname))return null;return url.origin+url.pathname;}catch{return null;}}
export const groupNames:Record<string,string>={'early-youth':'Early Youths / Teens','young-adults':'Young Adults',women:'Women / Zoe Ladies',men:'Men','praise-team':'Praise Team'};
