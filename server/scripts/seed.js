import { pathToFileURL } from 'node:url';
import { config } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User, Project, Proposal } from '../src/models/index.js';
import { hashPassword } from '../src/services/passwordService.js';

export async function seedDemoUsers({ connect = true } = {}) {
  if (config.nodeEnv === 'production') throw new Error('Demo seeding is disabled in production.');
  if (!config.mongoUri) throw new Error('Set MONGODB_URI in server/.env before seeding.');
  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD || 'FypDemo2026!');
  if (connect) await connectDatabase();
  await User.init();
  for (const [role, name] of [['admin', 'Demo Administrator'], ['teacher', 'Demo Supervisor'], ['student', 'Demo Student']]) {
    const email = `${role}@fyp.demo`;
    // Reruns preserve existing passwords, roles and user edits. No collection is cleared.
    await User.updateOne({ email }, {
      $setOnInsert: { name, email, role, passwordHash, isActive: true, department: 'Computer Science' },
    }, { upsert: true, runValidators: true });
    console.log(`[seed] Available: ${email} (${role})`);
  }
  const student = await User.findOne({ email: 'student@fyp.demo' });
  const teacher = await User.findOne({ email: 'teacher@fyp.demo' });
  let project = await Project.findOne({ createdBy: student._id, teamName: 'Team Horizon' });
  if (!project) project = await Project.create({
    title: 'AI-Assisted Campus Accessibility', summary: 'A student project exploring accessible navigation and campus resource discovery.',
    teamName: 'Team Horizon', createdBy: student._id, members: [student._id], supervisor: teacher._id,
    status: 'proposed', academicYear: '2026–27',
  });
  await Proposal.updateOne({ project: project._id, submittedBy: student._id }, { $setOnInsert: {
    title: project.title, abstract: 'Design and evaluate a campus navigation tool that helps students identify accessible routes and academic resources.',
    status: 'pending', preferredSupervisors: [teacher._id],
  } }, { upsert: true, runValidators: true });
  console.log('[seed] Demo project and proposal available. Existing records were preserved.');
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
