import { pathToFileURL } from 'node:url';
import { config } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User } from '../src/models/index.js';
import { hashPassword } from '../src/services/passwordService.js';

export async function seedDemoUsers() {
  if (config.nodeEnv === 'production') throw new Error('Demo seeding is disabled in production.');
  if (!config.mongoUri) throw new Error('Set MONGODB_URI in server/.env before seeding.');
  if (!process.env.DEMO_PASSWORD) throw new Error('Set DEMO_PASSWORD in server/.env before seeding.');
  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD);
  await connectDatabase();
  await User.init();
  for (const [role, name] of [['admin', 'Demo Administrator'], ['teacher', 'Demo Supervisor'], ['student', 'Demo Student']]) {
    const email = `${role}.demo@fyp.local`;
    // Reruns preserve existing passwords, roles and user edits. No collection is cleared.
    await User.updateOne({ email }, {
      $setOnInsert: { name, email, role, passwordHash, isActive: true, department: 'Computer Science' },
    }, { upsert: true, runValidators: true });
    console.log(`[seed] Available: ${email} (${role})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await seedDemoUsers();
  } catch (error) {
    const safeMessage = error.name === 'MongoServerSelectionError' || error.name === 'MongoParseError'
      ? 'MongoDB connection failed. Check the URI and network access.'
      : error.message;
    console.error(`[seed] ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}
