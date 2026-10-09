'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, MapPin, Save } from 'lucide-react';
import { defaultWorkshopProfile, socialFields, type WorkshopProfile } from './workshop-profile';
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
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ بيانات العلامة.'); }
    finally { setBusy(false); }
  }

  return <div className="workshop-settings-grid">
    <section className="panel workshop-form-panel">
      <div className="panel-heading workshop-form-heading"><div><span className="eyebrow">الملف العام</span><h2>بيانات العلامة</h2><p className="muted">هذه التفاصيل مصدرها Firestore وتُقرأ من واجهة الموقع.</p></div><span className="panel-icon"><MapPin size={17} /></span></div>
      <form className="workshop-settings-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-two">اسم العلامة<input required maxLength={100} value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="R/ONE" /></label>
          <label className="span-two">الجملة التعريفية<textarea rows={2} maxLength={120} value={form.tagline} onChange={(event) => change('tagline', event.target.value)} placeholder="تفاصيل معمولة علشان تعيش." /></label>
          <label className="span-two">نبذة تعريفية<textarea rows={3} maxLength={400} value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="تعريف مختصر يظهر للزوار" /></label>
          <label>رقم التواصل<input type="tel" dir="ltr" maxLength={30} value={form.phone} onChange={(event) => change('phone', event.target.value)} placeholder="+20 10 0000 0000" /></label>
          <label>البريد الإلكتروني<input type="email" dir="ltr" maxLength={120} value={form.email} onChange={(event) => change('email', event.target.value)} placeholder="hello@r-one.com" /></label>
          <label className="span-two">العنوان بالتفصيل<input maxLength={180} value={form.address} onChange={(event) => change('address', event.target.value)} placeholder="اسم الشارع أو علامة مميزة" /></label>
          <label>المدينة<input maxLength={60} value={form.city} onChange={(event) => change('city', event.target.value)} placeholder="طوخ" /></label>
          <label>المحافظة<input maxLength={60} value={form.governorate} onChange={(event) => change('governorate', event.target.value)} placeholder="القليوبية" /></label>
          <label className="span-two">رابط الموقع على الخريطة<input type="url" dir="ltr" maxLength={300} value={form.mapUrl} onChange={(event) => change('mapUrl', event.target.value)} placeholder="https://maps.google.com/..." /></label>
          <label className="span-two">مواعيد العمل<input maxLength={160} value={form.workingHours} onChange={(event) => change('workingHours', event.target.value)} placeholder="السبت إلى الخميس · 10 صباحاً إلى 8 مساءً" /></label>
        </div>

        <div className="workshop-social-section">
          <div className="workshop-social-head"><span className="eyebrow">وسائل التواصل</span><p className="muted">اكتب اسم المستخدم أو الرابط كامل، والموقع هيبنيه لوحده.</p></div>
          <div className="form-grid">
            {socialFields.map((entry) => (
              <label key={entry.field} className={entry.spanTwo ? 'span-two' : undefined}>
                {entry.label}
                <input dir="ltr" maxLength={300} value={String(form[entry.field] ?? '')} onChange={(event) => change(entry.field, event.target.value)} placeholder={entry.placeholder} />
              </label>
            ))}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="workshop-save-row"><span className="muted">معلومات الاتصال والموقع ستكون عامة للزوار.</span><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ...' : <><Save size={15} /> حفظ البيانات</>}</button></div>
      </form>
    </section>
    <aside className="workshop-preview-column"><div><span className="eyebrow">معاينة الواجهة</span><h2>كما يراها زوار الموقع</h2></div><WorkshopPublicCard profile={form} /><div className="workshop-preview-note"><Check size={15} /><span>يقرأ الموقع البيانات العامة من <code>workshopSettings/main</code>.</span></div></aside>
  </div>;
}