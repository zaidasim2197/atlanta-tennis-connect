const mongoose=require('mongoose');
const {createHash}=require('crypto');
require('dotenv').config({path:require('path').resolve(__dirname,'../.env')});
const hash=s=>createHash('sha256').update(s).digest().readUInt32LE(0);
const first=['Nolan','Clara','Gabriel','Vivian','Aaron','Naomi','Simon','Audrey','Evan','Lucia','Isaac','Talia','Oscar','Serena','Felix','Nadia','Hugo','Celeste','Dean','Bianca'];
const last=['Whitaker','Sutton','Chandler','Lawson','Bishop','Montgomery','Vega','Castillo','Porter','Walsh','Henderson','Reynolds','Spencer','Fleming','Carrington','Delgado','Barrett','Pearson','Dawson','Holloway'];
async function run(){
 await mongoose.connect(process.env.MONGODB_URI);
 const db=mongoose.connection.db;
 const leagues=await db.collection('leagues').find({slug:/^demo-league-/}).sort({slug:1}).toArray();
 const report=[];
 for(const [index,l] of leagues.entries()){
  await mongoose.connection.transaction(async session=>{
   const target=index===0?20:18+2*(hash(l.slug+'expanded')%7);
   let regs=await db.collection('reservations').find({leagueSlug:l.slug,status:'registered'},{session}).toArray();
   if(regs.length<target){
    const source=await db.collection('reservations').find({leagueSlug:l.slug,idempotencyKey:/^demo-/,paymentProvider:'mock'},{session}).sort({playerSlug:1}).toArray();
    if(!source.length) throw new Error('Missing seed roster');
    const doubles=l.format.includes('doubles');
    const unit=doubles?2:1;
    for(let n=0;regs.length<target;n+=unit){
     const pair=[];
     for(let side=0;side<unit;side++){
      const position=n+side;
      const slug=`demo-extra-${index}-${position}`;
      const email=`extra${index}.${position}@demo.example.test`;
      const template=await db.collection('players').findOne({slug:source[(position)%source.length].playerSlug},{session});
      if(!template) throw new Error('Missing player');
      const {_id,...profile}=template;
      await db.collection('players').updateOne({slug},{$setOnInsert:{...profile,slug,email,firstName:first[(index+position)%first.length],lastName:last[(index*7+Math.floor(position/2))%last.length],dataSource:'synthetic-registration-expansion',profileBio:'Entirely fictional demonstration player.'}},{upsert:true,session});
      pair.push({slug,email});
     }
     for(const [side,p] of pair.entries()){
      const {_id,...base}=source[0];
      const registration={...base,playerSlug:p.slug,playerEmail:p.email,idempotencyKey:`demo-expanded-${l.slug}-${p.slug}`,status:'registered',paymentProvider:'mock',amountCents:l.feeCents,heldAt:new Date(),paidAt:new Date(),expiresAt:new Date(),simulationNote:'Synthetic confirmed registration. No actual charge.'};
      delete registration.cancelledAt;delete registration.paymentIntentId;delete registration.partnerSlug;
      if(doubles) registration.partnerSlug=pair[1-side].slug;
      await db.collection('reservations').updateOne({idempotencyKey:registration.idempotencyKey},{$setOnInsert:registration},{upsert:true,session});
      regs.push(registration);
     }
    }
   }
   const active=await db.collection('reservations').countDocuments({leagueSlug:l.slug,status:{$in:['held','payment_pending','paid','registered']}},{session});
   const remaining=index===0?0:1+hash(l.slug+'availability')%11;
   await db.collection('leagues').updateOne({_id:l._id},{$set:{playerLimit:active+remaining,spotsRemaining:remaining,registrationOpen:remaining>0&&new Date(l.registrationDeadline)>new Date(),expansionRevision:1}},{session});
   const confirmed=await db.collection('reservations').countDocuments({leagueSlug:l.slug,status:'registered'},{session});
   const roster=await db.collection('reservations').find({leagueSlug:l.slug,status:'registered'},{session}).toArray();
   await db.collection('schedules').updateMany({leagueSlug:l.slug,bracket:null},{$set:{roster:roster.map(r=>r.playerSlug),scheduleNotice:'Roster updated; simulated fixtures await reassignment.'}},{session});
   report.push({name:l.name,confirmed,capacity:active+remaining});
  });
 }
 const total=report.reduce((n,l)=>n+l.confirmed,0);
 if(total<500)throw new Error('Confirmed total below 500: '+total);
 console.log(JSON.stringify({confirmed:total,leagues:report},null,2));
 await mongoose.disconnect();
}
run().catch(async e=>{console.error(e.message);await mongoose.disconnect();process.exitCode=1;});
