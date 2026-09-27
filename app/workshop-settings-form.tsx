'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, MapPin, Save } from 'lucide-react';
import { defaultWorkshopProfile, type WorkshopProfile } from './workshop-profile';
import { WorkshopPublicCard } from './workshop-public-card';

export function WorkshopSettingsForm({ profile, onSave }: { profile: WorkshopProfile; onSave: (profile: WorkshopProfile) => Promise<void> }) {
  const [form, setForm] = useState<WorkshopProfile>(profile || defaultWorkshopProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setForm(profile), [profile]);
  function change(field: keyof WorkshopProfile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await onSave(form); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ معلومات الورشة.'); }
    finally { setBusy(false); }
  }

  return <div className="workshop-settings-grid">
    <section className="panel workshop-form-panel">
      <div className="panel-heading workshop-form-heading"><div><span className="eyebrow">الملف العام</span><h2>بيانات الورشة</h2><p className="muted">هذه التفاصيل مصدرها Firestore وتُقرأ من واجهة الموقع.</p></div><span className="panel-icon"><MapPin size={17} /></span></div>
      <form className="workshop-settings-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-two">اسم الورشة<input required maxLength={100} value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="ورشة R/ONE" /></label>
          <label className="span-two">نبذة عن الورشة<textarea rows={3} maxLength={400} value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="تعريف مختصر يظهر للزوار" /></label>
          <label>رقم التواصل<input type="tel" dir="ltr" maxLength={30} value={form.phone} onChange={(event) => change('phone', event.target.value)} placeholder="+20 10 0000 0000" /></label>
          <label>رقم واتساب<input type="tel" dir="ltr" maxLength={30} value={form.whatsapp} onChange={(event) => change('whatsapp', event.target.value)} placeholder="+20 10 0000 0000" /></label>
          <label className="span-two">البريد الإلكتروني<input type="email" dir="ltr" maxLength={120} value={form.email} onChange={(event) => change('email', event.target.value)} placeholder="hello@r-one.com" /></label>
          <label className="span-two">العنوان بالتفصيل<input maxLength={180} value={form.address} onChange={(event) => change('address', event.target.value)} placeholder="اسم الشارع أو علامة مميزة" /></label>
          <label>المدينة<input maxLength={60} value={form.city} onChange={(event) => change('city', event.target.value)} placeholder="طوخ" /></label>
          <label>المحافظة<input maxLength={60} value={form.governorate} onChange={(event) => change('governorate', event.target.value)} placeholder="القليوبية" /></label>
          <label className="span-two">رابط واجهة المتجر<input type="url" dir="ltr" maxLength={300} value={form.websiteUrl} onChange={(event) => change('websiteUrl', event.target.value)} placeholder="https://your-store.com" /></label>
          <label className="span-two">رابط الموقع على الخريطة<input type="url" dir="ltr" maxLength={300} value={form.mapUrl} onChange={(event) => change('mapUrl', event.target.value)} placeholder="https://maps.google.com/..." /></label>
          <label className="span-two">مواعيد العمل<input maxLength={160} value={form.workingHours} onChange={(event) => change('workingHours', event.target.value)} placeholder="السبت إلى الخميس · 10 صباحاً إلى 8 مساءً" /></label>
          <label>Instagram<input type="url" dir="ltr" maxLength={200} value={form.instagram} onChange={(event) => change('instagram', event.target.value)} placeholder="https://instagram.com/..." /></label>
          <label>Facebook<input type="url" dir="ltr" maxLength={200} value={form.facebook} onChange={(event) => change('facebook', event.target.value)} placeholder="https://facebook.com/..." /></label>
          <label className="span-two">TikTok<input type="url" dir="ltr" maxLength={200} value={form.tiktok} onChange={(event) => change('tiktok', event.target.value)} placeholder="https://tiktok.com/@..." /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="workshop-save-row"><span className="muted">معلومات الاتصال والموقع ستكون عامة للزوار.</span><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ...' : <><Save size={15} /> حفظ معلومات الورشة</>}</button></div>
      </form>
    </section>
    <aside className="workshop-preview-column"><div><span className="eyebrow">معاينة الواجهة</span><h2>كما يراها زوار الموقع</h2></div><WorkshopPublicCard profile={form} /><div className="workshop-preview-note"><Check size={15} /><span>يقرأ الموقع البيانات العامة من <code>workshopSettings/main</code>.</span></div></aside>
  </div>;
}