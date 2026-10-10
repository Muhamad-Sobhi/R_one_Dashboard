'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

type AccessState = { user: User | null; authorized: boolean | null };

/**
 * Admin gate for standalone dashboard routes (product editor, ...).
 * Mirrors the check used by the main dashboard screen so a route and the
 * dashboard shell never disagree about who can write.
 */
export function useAdminAccess() {
  const [state, setState] = useState<AccessState>({ user: null, authorized: null });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, authorized: false });
        return;
      }
      setState({ user, authorized: null });
      try {
        const snapshot = await getDoc(doc(db, 'admins', user.uid));
        setState({ user, authorized: snapshot.exists() && snapshot.data().active === true });
      } catch {
        setState({ user, authorized: false });
      }
    });
  }, []);

  return state;
}

export function AccessGate({ authorized, children }: { authorized: boolean | null; children: React.ReactNode }) {
  if (authorized === null) {
    return <main className="loading-screen"><div className="loading-mark">R/</div><span>بنتحقق من الصلاحيات...</span></main>;
  }
  if (!authorized) {
    return (
      <main className="access-denied">
        <div className="denied-mark">R/</div>
        <span className="eyebrow">حساب غير مصرّح</span>
        <h1>المساحة دي للفريق فقط</h1>
        <p>سجّل الدخول بحساب مدير مصرّح له، أو ارجع للوحة التحكم.</p>
        <a className="button button-dark" href="/">رجوع للوحة التحكم</a>
      </main>
    );
  }
  return <>{children}</>;
}