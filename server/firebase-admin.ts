import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type ServiceAccount = {
  project_id?: string;
  client_email: string;
  private_key: string;
};

function loadServiceAccount(): ServiceAccount | null {
  const directJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (directJson) {
    try {
      return JSON.parse(directJson) as ServiceAccount;
    } catch {
      return null;
    }
  }

  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidates = new Set<string>();
  if (configuredPath) {
    candidates.add(resolve(process.cwd(), configuredPath));
    candidates.add(configuredPath);
  }

  for (let currentDir = process.cwd(); currentDir !== dirname(currentDir); currentDir = dirname(currentDir)) {
    candidates.add(resolve(currentDir, 'service-account.json'));
  }
  candidates.add(resolve(process.cwd(), 'service-account.json'));

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const raw = readFileSync(candidate, 'utf8');
      return JSON.parse(raw) as ServiceAccount;
    } catch {
      return null;
    }
  }

  return null;
}

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'r-one-1450f';
  const credentials = loadServiceAccount();

  if (credentials) {
    return initializeApp({
      credential: cert({
        projectId: credentials.project_id || projectId,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key.replace(/\\n/g, '\n'),
      }),
      projectId,
    });
  }

  return initializeApp({ credential: applicationDefault(), projectId });
}

const app = getAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);