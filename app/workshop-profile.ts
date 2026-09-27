import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

export type WorkshopProfile = {
  name: string;
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
};

export const defaultWorkshopProfile: WorkshopProfile = {
  name: 'ورشة R/ONE',
  description: 'ورشة متخصصة في تصنيع الملابس الشبابية.',
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
};

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