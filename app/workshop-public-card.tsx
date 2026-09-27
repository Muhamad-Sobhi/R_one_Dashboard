import { Clock3, Facebook, Instagram, Mail, MapPin, Phone, Send } from 'lucide-react';
import { normalizePublicUrl, type WorkshopProfile } from './workshop-profile';

export function WorkshopPublicCard({ profile }: { profile: WorkshopProfile }) {
  const location = [profile.address, profile.city, profile.governorate].filter(Boolean).join('، ');
  const whatsappDigits = profile.whatsapp.replace(/\D/g, '');
  const whatsapp = whatsappDigits.startsWith('00')
    ? whatsappDigits.slice(2)
    : whatsappDigits.startsWith('0')
      ? `20${whatsappDigits.slice(1)}`
      : whatsappDigits;
  const contacts = [
    profile.phone && { label: profile.phone, href: `tel:${profile.phone}`, icon: Phone },
    whatsapp && { label: `واتساب ${profile.whatsapp}`, href: `https://wa.me/${whatsapp}`, icon: Send },
    profile.email && { label: profile.email, href: `mailto:${profile.email}`, icon: Mail },
    location && { label: location, href: normalizePublicUrl(profile.mapUrl), icon: MapPin },
    profile.workingHours && { label: profile.workingHours, href: '', icon: Clock3 },
  ].filter((item): item is { label: string; href: string; icon: typeof Phone } => Boolean(item));
  const socialLinks = [
    profile.instagram && { label: 'Instagram', href: normalizePublicUrl(profile.instagram), icon: Instagram },
    profile.facebook && { label: 'Facebook', href: normalizePublicUrl(profile.facebook), icon: Facebook },
    profile.tiktok && { label: 'TikTok', href: normalizePublicUrl(profile.tiktok), icon: Send },
  ].filter((item): item is { label: string; href: string; icon: typeof Instagram } => Boolean(item));

  return <article className="workshop-public-card" dir="rtl">
    <div className="workshop-public-top"><span className="workshop-public-mark">R/</span><span className="eyebrow">معلومات الورشة</span></div>
    <h2>{profile.name || 'ورشة الملابس'}</h2>
    {profile.description && <p className="workshop-public-description">{profile.description}</p>}
    {contacts.length ? <div className="workshop-public-links">{contacts.map(({ label, href, icon: Icon }) => href ? <a key={label} href={href} target={href.startsWith('https://') ? '_blank' : undefined} rel={href.startsWith('https://') ? 'noreferrer' : undefined}><Icon size={15} /><span>{label}</span></a> : <div key={label}><Icon size={15} /><span>{label}</span></div>)}</div> : <p className="workshop-preview-empty">أضف وسائل التواصل لتظهر للزوار هنا.</p>}
    {socialLinks.length > 0 && <div className="workshop-social-links">{socialLinks.map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}><Icon size={16} /></a>)}</div>}
    <span className="workshop-public-footer">{[profile.name, [profile.city, profile.governorate].filter(Boolean).join('، ')].filter(Boolean).join(' · ')}</span>
  </article>;
}