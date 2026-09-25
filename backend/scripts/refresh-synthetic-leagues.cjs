// Non-destructive, repeatable migration of the original synthetic league cohort.
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const names = ['Peachtree After Hours', 'Chastain Racquet Social', 'West End Rally Club', 'Piedmont Autumn Classic', 'Washington Park Challenge', 'Grant Park Rally', 'East Atlanta Court Crew', 'Midtown Baseline Series', 'Buckhead Evening Aces', 'Atlanta Fall Invitational', 'The Match Club', 'Capital City Racquet League', 'Candler Park Court Sessions', 'Northside Net Masters', 'Southside Tennis', 'Intown Autumn Rally', 'Atlanta Sunset Rally', 'The Racquet Club', 'Peachtree Partners Cup', 'City Lights Tennis', 'The Autumn Court Collective', 'Atlanta Winter Warmup', 'Neighborhood Net League', 'The Service Club', 'Metro Atlanta Racquet Series'];
const day = 86400000;
function randomFor(id) { let n = require('crypto').createHash('sha256').update(id).digest().readUInt32LE(0); return () => { n = (Math.imul(n,1664525)+1013904223)>>>0; return n/4294967296; }; }
async function run() {
 await mongoose.connect(process.env.MONGODB_URI);
 const db = mongoose.connection.db;
 const leagues = await db.collection('leagues').find({slug:/^demo-league-/}).sort({slug:1}).toArray();
 if (leagues.length > names.length) throw new Error('Add unique names before migrating additional leagues');
 const summary=[];
 for (const [i,l] of leagues.entries()) {
  await mongoose.connection.transaction(async session => {
   if (l.seedRevision === 'varied-autumn-v2') return;
   const regs=await db.collection('reservations').find({leagueSlug:l.slug,status:{$in:['registered','paid','held','payment_pending']}},{session}).toArray();
   const occupied=regs.length;
   const random=randomFor(l.slug);
   const extra=i===0?0:1+Math.floor(random()*13);
   const capacity=occupied+extra;
   const start=new Date(Date.UTC(2026,9,3)+Math.floor(random()*49)*day);
   const end=new Date(start.getTime()+(7+Math.floor(random()*6))*7*day);
   const deadline=new Date(start.getTime()-2*day+3*3600000);
   const times=['9:00 AM','10:30 AM','5:30 PM','6:30 PM','7:00 PM'];
   const time=times[Math.floor(random()*times.length)];
   // Shift synthetic fixtures by the same offset, preserving their relative order.
   const shift=start.getTime()-Date.parse(l.startDate);
   const schedules=await db.collection('schedules').find({leagueSlug:l.slug},{session}).toArray();
   function move(value) {
    if(Array.isArray(value)) return value.map(move);
    if(value && typeof value==='object' && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([k,v])=>[k, k==='date' && typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(Date.parse(v)+shift).toISOString().slice(0,10) : move(v)]));
    return value;
   }
   for(const s of schedules) { const update={}; if(s.fixtures) update.fixtures=move(s.fixtures); if(s.bracket) update.bracket=move(s.bracket); await db.collection('schedules').updateOne({_id:s._id},{$set:update},{session}); }
   await db.collection('leagues').updateOne({_id:l._id},{$set:{name:names[i],playerLimit:capacity,spotsRemaining:extra,startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),registrationDeadline:deadline,registrationOpen:extra>0&&deadline>new Date(),scheduleDay:start.toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}),scheduleTime:time,seedRevision:'varied-autumn-v2',description:'Synthetic demonstration league. Players arrange match times and confirm court availability.'}},{session});
   summary.push({name:names[i],registered:occupied,capacity,remaining:extra,start:start.toISOString().slice(0,10)});
  });
 }
 console.log(JSON.stringify(summary,null,2));
 await mongoose.disconnect();
}
run().catch(async e=>{console.error(e.message);await mongoose.disconnect();process.exitCode=1;});

