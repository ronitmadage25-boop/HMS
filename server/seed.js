import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Room, Settings, FeeStructure } from './models/index.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('✖ MONGODB_URI is not set in server/.env');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB for seeding');

  // 1. Settings
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({
      institution: 'Sardar Patel Institute of Technology',
      session: '2026-27',
      visitingHours: { start: '09:00', end: '19:00' },
      resolutionHours: { Maintenance: 72, 'Mess/Food': 48, Discipline: 96, Security: 24, Other: 96 },
      maintenanceSla: { Low: 120, Medium: 72, High: 48, Urgent: 24 },
      lateFeeAmount: 500,
    });
    console.log('✔ Initialized system settings');
  }

  // 2. Demo Users (all 4 roles)
  const defaultPassword = await bcrypt.hash('Password@123', 12);
  const usersToSeed = [
    {
      name: 'Administrator',
      username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase(),
      email: (process.env.ADMIN_EMAIL || 'admin@hostel.com').toLowerCase(),
      role: 'admin',
      password: process.env.ADMIN_PASSWORD ? await bcrypt.hash(process.env.ADMIN_PASSWORD, 12) : defaultPassword,
    },
    {
      name: 'Warden',
      username: 'warden',
      email: 'warden@hostel.com',
      role: 'warden',
      phone: '9876543210',
      blocks: ['Block A', 'Block B'],
      password: defaultPassword,
    },
    {
      name: 'Hostel Staff',
      username: 'staff',
      email: 'staff@hostel.com',
      role: 'staff',
      phone: '9876543211',
      password: defaultPassword,
    },
    {
      name: 'Student',
      username: 'student',
      email: 'student@hostel.com',
      role: 'student',
      phone: '9876543212',
      department: 'Computer Engineering',
      year: 'TE',
      academicStanding: 'Good standing',
      disciplinaryHold: false,
      password: defaultPassword,
    },
  ];

  for (const u of usersToSeed) {
    const existing = await User.findOne({ $or: [{ username: u.username }, { email: u.email }] });
    if (!existing) {
      await User.create(u);
      console.log(`✔ Created ${u.role} user: ${u.username}`);
    } else {
      existing.name = u.name;
      await existing.save();
      console.log(`✔ Updated name for ${u.role}: ${u.name} (${u.username})`);
    }
  }

  // 3. Demo Rooms
  const demoRooms = [
    { block: 'Block A', floor: 1, number: '101', type: 'Double', capacity: 2, status: 'Active', categoryQuota: 'Any' },
    { block: 'Block A', floor: 1, number: '102', type: 'Double', capacity: 2, status: 'Active', categoryQuota: 'Any' },
    { block: 'Block A', floor: 2, number: '201', type: 'Double', capacity: 2, status: 'Active', categoryQuota: 'General' },
    { block: 'Block A', floor: 2, number: '202', type: 'Double', capacity: 2, status: 'Active', categoryQuota: 'Reserved' },
    { block: 'Block B', floor: 1, number: '101', type: 'Single', capacity: 1, status: 'Active', categoryQuota: 'Any' },
    { block: 'Block B', floor: 1, number: '102', type: 'Single', capacity: 1, status: 'Active', categoryQuota: 'Any' },
  ];

  for (const rm of demoRooms) {
    const exists = await Room.findOne({ block: rm.block, number: rm.number });
    if (!exists) {
      await Room.create(rm);
      console.log(`✔ Created room ${rm.block}-${rm.number} (${rm.type})`);
    }
  }

  // 4. Demo Fee Structures
  const feeStructures = [
    {
      session: '2026-27',
      roomType: 'Double',
      category: 'All',
      amount: 45000,
      installments: 2,
      dueDate: new Date(Date.now() + 30 * 86400000),
      sessionStart: new Date(Date.now() + 15 * 86400000),
    },
    {
      session: '2026-27',
      roomType: 'Single',
      category: 'All',
      amount: 65000,
      installments: 2,
      dueDate: new Date(Date.now() + 30 * 86400000),
      sessionStart: new Date(Date.now() + 15 * 86400000),
    },
  ];

  for (const fs of feeStructures) {
    const exists = await FeeStructure.findOne({ session: fs.session, roomType: fs.roomType, category: fs.category });
    if (!exists) {
      await FeeStructure.create(fs);
      console.log(`✔ Created fee structure for ${fs.roomType} (${fs.session})`);
    }
  }

  console.log('\n✔ Seeding completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('✖ Seeding failed:', err.message);
  process.exit(1);
});
