const mongoose=require('../backend/node_modules/mongoose');
require('../backend/node_modules/dotenv').config({path:'backend/.env'});
(async()=>{await mongoose.connect(process.env.MONGODB_URI);const c=mongoose.connection;
const [players, leagues, regs, schedules] = await Promise.all([c.collection('players').find({slug:/^demo-player-/}).toArray(),c.collection('leagues').find({slug:/^demo-league-/}).toArray(),c.collection('reservations').find({idempotencyKey:/^demo-/}).toArray(),c.collection('schedules').find({leagueSlug:/^demo-league-/}).toArray()]);
const courts=require('../backend/dist/lib/courts').COURTS;
let mismatch=0;for(const r of regs){const l=leagues.find(l=>l.slug===r.leagueSlug),p=players.find(p=>p.slug===r.playerSlug),court=courts.find(c=>c.id===r.homeCourtId);if(r.zipCode!==l.zipCode||p.zipCode!==l.zipCode||court?.zipCode!==l.zipCode)mismatch++;}
const legs=schedules.reduce((n,s)=>n+s.bracket.ties.filter(t=>!t.bye).length*2,0);
console.log(JSON.stringify({players:players.length,leagues:leagues.length,registrations:regs.length,publishedBrackets:schedules.length,matchLegs:legs,zipViolations:mismatch,completedChampionships:schedules.filter(s=>s.bracket.ties.at(-1).winner).length}));await mongoose.disconnect();if(mismatch)process.exitCode=1;})();
