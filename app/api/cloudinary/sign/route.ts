import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const missingConfiguration = [
    !cloudName && 'CLOUDINARY_CLOUD_NAME',
    !apiKey && 'CLOUDINARY_API_KEY',
    !apiSecret && 'CLOUDINARY_API_SECRET',
  ].filter((name): name is string => Boolean(name));
  if (missingConfiguration.length) {
    return NextResponse.json({ error: `إعداد Cloudinary غير مكتمل. أضف: ${missingConfiguration.join(', ')} إلى .env.local ثم أعد تشغيل الخادم.` }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const admin = await adminDb.collection('admins').doc(decoded.uid).get();
    if (!admin.exists || admin.data()?.active !== true) {
      return NextResponse.json({ error: 'هذا الحساب ليس مديراً نشطاً.' }, { status: 403 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'r-one/products';
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    return NextResponse.json({ cloudName, apiKey, timestamp, folder, signature });
  } catch (error) {
    const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    console.error('[cloudinary/sign] Firebase Admin verification failed', { code: errorCode || 'unknown' });
    if (errorCode === 'auth/argument-error' || errorCode === 'auth/id-token-expired' || errorCode === 'auth/id-token-revoked' || errorCode === 'auth/invalid-id-token') {
      return NextResponse.json({ error: 'جلسة الدخول غير صالحة أو انتهت. سجّل الخروج ثم ادخل مرة أخرى.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'اعتماد Firebase Admin غير مهيأ على الخادم. أضف FIREBASE_SERVICE_ACCOUNT_JSON أو عيّن GOOGLE_APPLICATION_CREDENTIALS لمسار ملف الخدمة، ثم أعد تشغيل Next.js.' }, { status: 503 });
  }
}