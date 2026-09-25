import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({path:'backend/.env',quiet:true});
const { default: handler } = await import('../.vercel/output/functions/__server.func/index.mjs');
const invoke = async (path, opts={}) => {
 const request = new Request('http://localhost:8080'+path, opts);
 const r = typeof handler === 'function' ? await handler(request) : await handler.fetch(request);
 const body=await r.json(); return {status:r.status,headers:r.headers,body};
};
try {
 const leagues=await invoke('/api/leagues');console.log('Built-server catalog:',leagues.status,'leagues:',leagues.body.data?.length);
 const credentials=JSON.parse(readFileSync('demo-credentials.local','utf8')).organizer;
 const login=await invoke('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},body:JSON.stringify(credentials)});
 console.log('Built-server login:',login.status);
 const cookie=login.headers.getSetCookie().at(-1)?.split(';')[0];
 const me=await invoke('/api/auth/me',{headers:{Cookie:cookie}}); console.log('Built-server session:',me.status,me.body.data?.role);
 const overview=await invoke('/api/competition/overview',{headers:{Cookie:cookie}});console.log('Built-server overview:',overview.status,overview.body.data?.registrations?.length);
 if (leagues.status!==200 || login.status!==200 || me.status!==200 || overview.status!==200) process.exitCode=1;
} catch(e) { console.error(e);process.exitCode=1; }
process.exit(process.exitCode || 0);
