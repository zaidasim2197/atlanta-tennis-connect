const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Player = mongoose.model('Player', new mongoose.Schema({}, { strict: false }));
  const Reservation = mongoose.model('Reservation', new mongoose.Schema({}, { strict: false }));
  const League = mongoose.model('League', new mongoose.Schema({}, { strict: false }));

  const totalPlayers = await Player.countDocuments();
  const totalReservations = await Reservation.countDocuments();
  const totalLeagues = await League.countDocuments();

  const regEmails = await Reservation.distinct('playerEmail');
  const regPlayerSlugs = await Reservation.distinct('playerSlug');

  console.log({ totalPlayers, totalReservations, totalLeagues, distinctRegEmails: regEmails.length, distinctRegSlugs: regPlayerSlugs.length });

  const unreg = await Player.find({ email: { $nin: regEmails } }).select('email slug');
  console.log('Unregistered players count:', unreg.length);
  console.log('Unregistered players:', unreg.map(u => ({ email: u.email, slug: u.slug })));

  const reservationsByStatus = await Reservation.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('Reservations by status:', reservationsByStatus);

  const leagues = await League.find({}).select('slug name spotsRemaining playerLimit');
  console.log('Leagues count:', leagues.length);

  await mongoose.disconnect();
}
run().catch(console.error);
