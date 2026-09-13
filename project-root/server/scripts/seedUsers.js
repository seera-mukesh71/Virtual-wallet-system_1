import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

// Edit this list with your real 2 heads, 60 students, 10 vendors.
// Passwords are NOT set here — each person sets their own password via OTP signup.
const seedData = [
  { name: 'Head One', email: 'head1@college.edu', role: 'HEAD' },
  { name: 'Head Two', email: 'head2@college.edu', role: 'HEAD' },

  { name: 'Mukesh', email: 'mukesh@college.edu', rollNumber: '23ME001', role: 'STUDENT' },
  { name: 'Rahul', email: 'rahul@college.edu', rollNumber: '23ME002', role: 'STUDENT' },
  { name: 'Yashasri', email: 'yashasri@college.edu', rollNumber: '23ME003', role: 'STUDENT' },
  // ... add remaining 58 students here

  { name: 'Vendor A', email: 'vendor01@example.com', role: 'VENDOR' }
  // ... add remaining 9 vendors here
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Seeding...');

  for (const u of seedData) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`Skip (already exists): ${u.email}`);
      continue;
    }
    await User.create({ ...u, isAuthorized: true, isVerified: false, walletBalance: 0 });
    console.log(`Created authorized record: ${u.email} (${u.role})`);
  }

  console.log('Seeding complete.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
