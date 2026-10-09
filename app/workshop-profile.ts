import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

export type WorkshopProfile = {
  name: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  governorate: string;
  websiteUrl: string;
  mapUrl: string;
  workingHours: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  telegram: string;
  x: string;
  snapchat: string;
  threads: string;
  linkedin: string;
  pinterest: string;
};

export const defaultWorkshopProfile: WorkshopProfile = {
  name: 'R/ONE',
  tagline: 'تفاصيل معمولة علشان تعيش.',
  description: 'قطع معمولة بعناية، تفصيلة بتفصيلة، لحد بابك.',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: 'طوخ',
  governorate: 'القليوبية',
  websiteUrl: '',
  mapUrl: '',
  workingHours: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  youtube: '',
  telegram: '',
  x: '',
  snapchat: '',
  threads: '',
  linkedin: '',
  pinterest: '',
};

export const socialFields: Array<{ field: keyof WorkshopProfile; label: string; placeholder: string; spanTwo?: boolean }> = [
  { field: 'whatsapp', label: 'WhatsApp', placeholder: '+20 10 0000 0000' },
  { field: 'instagram', label: 'Instagram', placeholder: 'r.one أو رابط كامل' },
  { field: 'facebook', label: 'Facebook', placeholder: 'r.one' },
  { field: 'tiktok', label: 'TikTok', placeholder: '@rone' },
  { field: 'youtube', label: 'YouTube', placeholder: '@rone' },
  { field: 'telegram', label: 'Telegram', placeholder: '@rone أو رقم' },
  { field: 'x', label: 'X (تويتر)', placeholder: '@rone' },
  { field: 'snapchat', label: 'Snapchat', placeholder: 'rone' },
  { field: 'threads', label: 'Threads', placeholder: '@rone' },
  { field: 'linkedin', label: 'LinkedIn', placeholder: 'r-one' },
  { field: 'pinterest', label: 'Pinterest', placeholder: 'rone' },
  { field: 'websiteUrl', label: 'الموقع الإلكتروني', placeholder: 'https://r-one.app', spanTwo: true },
];

export function subscribeWorkshopProfile(
  onProfile: (profile: WorkshopProfile) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'workshopSettings', 'main'),
    (snapshot) => onProfile({ ...defaultWorkshopProfile, ...(snapshot.exists() ? snapshot.data() : {}) }),
    onError,
  );
}

export function normalizePublicUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}