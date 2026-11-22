import { cloud,cloudConfigured } from './cloud';
import { hostedAnswerSchema } from '../domain/assistant';
import type { ImageAttachment } from '../domain/attachments';
import type { Kind,LifeRecord } from '../domain/model';
export async function requestAI(options:{query:string;records:LifeRecord[];scope:Kind[];timezone:string;images?:ImageAttachment[];history?:{role:string;content:string}[];lessonId?:string}){
 if(!cloudConfigured||!import.meta.env.VITE_AI_FUNCTION_URL)throw new Error('Hosted AI is not configured. Local tools remain available.');const {data:{session}}=await cloud().auth.getSession();if(!session)throw new Error('Sign in to your MyHours account first.');
 const images=options.images??[];const response=await fetch(import.meta.env.VITE_AI_FUNCTION_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY},body:JSON.stringify({query:options.query,ids:options.records.map(r=>r.id),scope:options.scope,timezone:options.timezone,images,history:options.history??[],...(options.lessonId?{lessonId:options.lessonId}:{})}),signal:AbortSignal.timeout(30000)});
 if(!response.ok){let reason='';try{const result=await response.json();if(typeof result.error==='string')reason=result.error.slice(0,300);}catch{/* Non-JSON gateway failures still have a usable status. */}throw new Error(response.status===429?'AI rate or daily usage limit reached.':response.status===401?'Your session expired. Sign in again.':reason||`AI unavailable (${response.status}). Nothing was changed.`);}
 const answer=hostedAnswerSchema.parse(await response.json());const allowed=new Set([...options.records.map(r=>r.id),...images.map(i=>i.id)]);if([...answer.claims,...answer.suggestions].some(c=>c.references.some(id=>!allowed.has(id))))throw new Error('AI cited unapproved records and the answer was rejected.');return answer;
}
