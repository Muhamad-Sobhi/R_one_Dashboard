'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

export type ProductGalleryImage = { url: string; publicId?: string };

export function ProductImageGallery({ images, imageUrl, productName }: { images?: ProductGalleryImage[]; imageUrl?: string; productName: string }) {
  const gallery = images?.length ? images : imageUrl ? [{ url: imageUrl }] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = gallery[Math.min(activeIndex, Math.max(gallery.length - 1, 0))];

  if (!activeImage) return <div className="store-gallery-empty" role="img" aria-label={`لا توجد صور لـ${productName}`}><ImageIcon size={30} /><span>لا توجد صور للمنتج</span></div>;

  function move(offset: number) {
    setActiveIndex((current) => (current + offset + gallery.length) % gallery.length);
  }

  return <section className="store-product-gallery" aria-label={`صور ${productName}`}>
    <div className="store-gallery-stage">
      <img className="store-gallery-main-image" src={activeImage.url} alt={`${productName} - صورة ${activeIndex + 1}`} fetchPriority="high" />
      {gallery.length > 1 && <>
        <button className="store-gallery-arrow store-gallery-previous" type="button" title="الصورة السابقة" aria-label="الصورة السابقة" onClick={() => move(-1)}><ChevronRight size={20} /></button>
        <button className="store-gallery-arrow store-gallery-next" type="button" title="الصورة التالية" aria-label="الصورة التالية" onClick={() => move(1)}><ChevronLeft size={20} /></button>
        <span className="store-gallery-count">{activeIndex + 1} / {gallery.length}</span>
      </>}
    </div>
    {gallery.length > 1 && <div className="store-gallery-thumbnails" role="list" aria-label="اختيار صورة المنتج">{gallery.map((image, index) => <button className={`store-gallery-thumbnail ${index === activeIndex ? 'store-gallery-thumbnail-active' : ''}`} type="button" role="listitem" key={`${image.publicId || image.url}-${index}`} aria-label={`عرض الصورة ${index + 1}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)}><img src={image.url} alt="" loading="lazy" /></button>)}</div>}
  </section>;
}
