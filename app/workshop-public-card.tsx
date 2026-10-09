import {
  Clock3,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { normalizePublicUrl, type WorkshopProfile } from './workshop-profile';

type SocialEntry = { key: string; label: string; href: string; icon: LucideIcon };

function platformHref(raw: string, host: string, base = host, prefix = '') {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const clean = value.replace(/^@/, '').replace(/^\/+/, '');
  if (clean.toLowerCase().includes(host)) return `https://${clean}`;
  return `https://${base}/${prefix}${clean}`;
}

function phoneHref(raw: string) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits.startsWith('00') ? digits.slice(2) : digits.startsWith('0') ? `20${digits.slice(1)}` : digits}`;
}

export function socialEntries(profile: WorkshopProfile): SocialEntry[] {
  const telegramDigits = profile.telegram.replace(/\D/g, '');
  const entries: Array<SocialEntry & { value: string }> = [
    { key: 'whatsapp', label: 'WhatsApp', href: phoneHref(profile.whatsapp), value: profile.whatsapp, icon: Send },
    { key: 'instagram', label: 'Instagram', href: platformHref(profile.instagram, 'instagram.com'), value: profile.instagram, icon: Instagram },
    { key: 'facebook', label: 'Facebook', href: platformHref(profile.facebook, 'facebook.com'), value: profile.facebook, icon: Facebook },
    { key: 'tiktok', label: 'TikTok', href: platformHref(profile.tiktok, 'tiktok.com', 'tiktok.com', '@'), value: profile.tiktok, icon: Music2 },
    { key: 'youtube', label: 'YouTube', href: platformHref(profile.youtube, 'youtube.com', 'youtube.com', '@'), value: profile.youtube, icon: Youtube },
    { key: 'telegram', label: 'Telegram', href: telegramDigits ? `https://t.me/${telegramDigits.replace(/^00/, '').replace(/^0/, '20')}` : platformHref(profile.telegram, 't.me'), value: profile.telegram, icon: Send },
    { key: 'x', label: 'X', href: platformHref(profile.x, 'x.com'), value: profile.x, icon: Twitter },
    { key: 'snapchat', label: 'Snapchat', href: platformHref(profile.snapchat, 'snapchat.com', 'snapchat.com/add'), value: profile.snapchat, icon: MessageCircle },
    { key: 'threads', label: 'Threads', href: platformHref(profile.threads, 'threads.net', 'threads.net', '@'), value: profile.threads, icon: MessageCircle },
    { key: 'linkedin', label: 'LinkedIn', href: platformHref(profile.linkedin, 'linkedin.com', 'linkedin.com/company'), value: profile.linkedin, icon: Linkedin },
    { key: 'pinterest', label: 'Pinterest', href: platformHref(profile.pinterest, 'pinterest.com'), value: profile.pinterest, icon: Music2 },
    { key: 'website', label: 'الموقع', href: profile.websiteUrl ? normalizePublicUrl(profile.websiteUrl) : '', value: profile.websiteUrl, icon: Globe },
  ];
  return entries.filter((entry) => entry.value.trim()).map(({ value, ...entry }) => entry);
}

export function WorkshopPublicCard({ profile }: { profile: WorkshopProfile }) {
  const location = [profile.address, profile.city, profile.governorate].filter(Boolean).join('، ');
  const mapHref = profile.mapUrl ? normalizePublicUrl(profile.mapUrl) : '';
  const contacts = [
    profile.phone && { label: profile.phone, href: `tel:${profile.phone}`, icon: Phone },
    profile.email && { label: profile.email, href: `mailto:${profile.email}`, icon: Mail },
    location && { label: location, href: mapHref, icon: MapPin },
    profile.workingHours && { label: profile.workingHours, href: '', icon: Clock3 },
  ].filter((item): item is { label: string; href: string; icon: LucideIcon } => Boolean(item));
  const socialLinks = socialEntries(profile);
  const whatsapp = socialLinks.find((link) => link.key === 'whatsapp');
  const rest = socialLinks.filter((link) => link.key !== 'whatsapp');

  return <article className="workshop-public-card" dir="rtl">
    <div className="workshop-public-top"><span className="workshop-public-mark">R/</span><span className="eyebrow">معلومات العلامة</span></div>
    <h2>{profile.name || 'R/ONE'}</h2>
    {profile.tagline && <p className="workshop-public-tagline">{profile.tagline}</p>}
    {profile.description && <p className="workshop-public-description">{profile.description}</p>}
    {contacts.length ? <div className="workshop-public-links">{contacts.map(({ label, href, icon: Icon }) => href ? <a key={label} href={href} target={href.startsWith('https://') ? '_blank' : undefined} rel={href.startsWith('https://') ? 'noreferrer' : undefined}><Icon size={15} /><span>{label}</span></a> : <div key={label}><Icon size={15} /><span>{label}</span></div>)}</div> : <p className="workshop-preview-empty">أضف وسائل التواصل لتظهر للزوار هنا.</p>}
    {(whatsapp || rest.length) ? <div className="workshop-social-links">{[...(whatsapp ? [whatsapp] : []), ...rest].map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}><Icon size={16} /></a>)}</div> : <p className="workshop-preview-empty">أضف حساباتك على إنستجرام أو فيسبوك أو تيك توك.</p>}
    <span className="workshop-public-footer">{[profile.name, [profile.city, profile.governorate].filter(Boolean).join('، ')].filter(Boolean).join(' · ')}</span>
  </article>;
}