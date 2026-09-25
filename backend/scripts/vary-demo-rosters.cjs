// Changes only synthetic, mock-paid registrations. Safe to rerun.
const mongoose = require('mongoose');
const { createHash } = require('crypto');
require('dotenv').config({path:require('path').resolve(__dirname,'../.env')});
const rank = value => createHash('sha256').update(value).digest().readUInt32LE(0);
async function run() {
 await mongoose.connect(process.env.MONGODB_URI);
 const db=mongoose.connection.db;
 const leagues=await db.collection('leagues').find({slug:/^demo-league-/}).sort({slug:1}).toArray();
 for(const league of leagues) {
  await mongoose.connection.transaction(async session=>{
   if(league.rosterRevision==='varied-v1') return;
   const schedules=await db.collection('schedules').find({leagueSlug:league.slug},{session}).toArray();
   // Preserve completed history and its supporting roster.
   if(schedules.some(s=>s.bracket?.ties?.some(t=>!t.bye && t.legs?.some(leg=>leg.winner)))) return;
   const regs=await db.collection('reservations').find({leagueSlug:league.slug,status:'registered',paymentProvider:'mock',idempotencyKey:/^demo-/},{session}).toArray();
   const byPlayer=new Map(regs.map(r=>[r.playerSlug,r]));
   const seen=new Set(), groups=[];
   for(const r of regs) {
    if(seen.has(r.playerSlug)) continue;
    const group=[r]; seen.add(r.playerSlug);
    if(league.format.includes('doubles')) {
     const partner=byPlayer.get(r.partnerSlug);
     if(!partner || partner.partnerSlug!==r.playerSlug) throw new Error('Invalid synthetic doubles pair: '+league.slug);
     group.push(partner);seen.add(partner.playerSlug);
    }
    groups.push(group);
   }
   groups.sort((a,b)=>rank(a[0].playerSlug+league.slug)-rank(b[0].playerSlug+league.slug));
   const minimum=league.format.includes('doubles')?3:6;
   const keep=Math.min(groups.length,minimum+rank(league.slug+'roster')%Math.max(1,groups.length-minimum));
   const removed=groups.slice(keep).flat();
   if(removed.length) {
    await db.collection('reservations').updateMany({_id:{$in:removed.map(r=>r._id)}},{$set:{status:'refunded',cancelledAt:new Date(),simulationNote:'Synthetic withdrawal and refund; no real payment moved.'}},{session});
    // Preserve old fixture demonstrations for audit; an outdated bracket must not remain published.
    for(const schedule of schedules) {
     await db.collection('demo_schedule_archives').updateOne({sourceScheduleId:schedule._id},{$setOnInsert:{sourceScheduleId:schedule._id,snapshot:schedule,reason:'Synthetic roster variation',archivedAt:new Date()}},{upsert:true,session});
     await db.collection('schedules').updateOne({_id:schedule._id},{$set:{roster:groups.slice(0,keep).flat().map(r=>r.playerSlug),fixtures:[],bracket:null,published:false,scheduleNotice:'Roster updated; simulated fixtures await reassignment.'}},{session});
    }
   }
   const occupied=await db.collection('reservations').countDocuments({leagueSlug:league.slug,status:{$in:['registered','paid','held','payment_pending']}},{session});
   const remaining=Math.max(0,league.playerLimit-occupied);
   await db.collection('leagues').updateOne({_id:league._id},{$set:{spotsRemaining:remaining,registrationOpen:remaining>0&&new Date(league.registrationDeadline)>new Date(),rosterRevision:'varied-v1'}},{session});
  });
 }
 const report=[];
 for(const l of await db.collection('leagues').find({slug:/^demo-league-/}).toArray()) {
  const confirmed=await db.collection('reservations').countDocuments({leagueSlug:l.slug,status:'registered'});
  report.push({name:l.name,confirmed,capacity:l.playerLimit,remaining:l.spotsRemaining});
  const active=await db.collection('reservations').countDocuments({leagueSlug:l.slug,status:{$in:['registered','paid','held','payment_pending']}});
  if(active+l.spotsRemaining!==l.playerLimit) throw new Error('Capacity mismatch: '+l.slug);
 }
 if(new Set(report.map(r=>r.confirmed)).size<4) throw new Error('Insufficient roster variation');
 console.log(JSON.stringify(report,null,2));
 await mongoose.disconnect();
}
run().catch(async e=>{console.error(e.message);await mongoose.disconnect();process.exitCode=1;});
