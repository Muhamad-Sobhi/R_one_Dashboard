import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'r-one-1450f';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service-account JSON path first.');
  process.exit(1);
}

if (!stdin.isTTY || !stdout.isTTY) {
  console.error('Run this script directly in a terminal so the password can be entered privately.');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const db = getFirestore(app);

function askHidden(label) {
  return new Promise((resolve, reject) => {
    stdout.write(label);
    let answer = '';
    const onData = (key) => {
      if (key === '\u0003') {
        cleanup();
        reject(new Error('Cancelled.'));
      } else if (key === '\r' || key === '\n') {
        cleanup();
        stdout.write('\n');
        resolve(answer);
      } else if (key === '\u007f' || key === '\b') {
        answer = answer.slice(0, -1);
      } else if (key >= ' ' && key !== '\u001b') {
        answer += key;
      }
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

try {
  const prompts = createInterface({ input: stdin, output: stdout });
  const email = (process.argv[2] || await prompts.question('Admin email (default ms@r.one): ') || 'ms@r.one').trim().toLowerCase();
  prompts.close();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }

  const password = await askHidden('New password (12+ characters, hidden): ');
  if (password.length < 12) throw new Error('Use a password with at least 12 characters.');
  const confirmation = await askHidden('Confirm password (hidden): ');
  if (password !== confirmation) throw new Error('The passwords do not match.');

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = null;
  }

  if (user) {
    await auth.updateUser(user.uid, { password });
    console.log(`Updated password for existing account ${email}.`);
  } else {
    user = await auth.createUser({ email, password, emailVerified: false });
    console.log(`Created Firebase Authentication account ${email}.`);
  }

  await db.collection('admins').doc(user.uid).set({
    email,
    active: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('Granted dashboard admin access. Sign in at http://localhost:3000');
} finally {
  await app.delete();
}