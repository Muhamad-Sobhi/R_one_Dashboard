'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  Bell,
  BellRing,
  Building2,
  Boxes,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Copy,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileText,
  Ellipsis,
  Eye,
  ImagePlus,
  LoaderCircle,
  Mail,
  MessageSquare,
  LayoutDashboard,
  LogOut,
  Phone,
  Menu,
  Package,
  Pencil,
  Percent,
  Plus,
  Search,
  Settings2,
  MapPin,
  Send,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  Truck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, increment, limit as fbLimit, onSnapshot, orderBy, query as fsQuery, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { defaultWorkshopProfile, normalizePublicUrl, type WorkshopProfile } from './workshop-profile';
import { buildProductDraft, getErrorMessage, normalizeLabel, uploadProductImages, alphaSizePresets, numericSizePresets, type CatalogEntry, type CatalogKind, type Product, type ProductColor, type ProductImage, type ProductSize } from './product-shared';
import { WorkshopSettingsForm } from './workshop-settings-form';
import { AnalyticsPanel, BlogPanel, MessagesPanel, NewsletterPanel, PagesPanel } from './insights';

type Page = 'overview' | 'analytics' | 'products' | 'brands' | 'categories' | 'offers' | 'orders' | 'suppliers' | 'customers' | 'reviews' | 'messages' | 'newsletter' | 'blog' | 'pages' | 'notifications' | 'shippingRates' | 'workshopSettings';
type OrderStatus = 'جديد' | 'قيد التجهيز' | 'تم الشحن' | 'مكتمل' | 'ملغي';
type OrderItem = { productId?: string; productName?: string; sku?: string; imageUrl?: string; quantity?: number; unitPrice?: number; lineTotal?: number };
type Order = { id: string; source?: 'storefront' | 'whatsapp' | 'quick-buy'; customerName: string; customerPhone?: string; customerEmail?: string; itemsCount: number; items?: OrderItem[]; subtotal?: number; shippingArea?: string; shippingCost?: number | null; shippingPending?: boolean; city?: string; address?: string; total: number; status: OrderStatus; createdAt?: { seconds: number } };
type Customer = { id: string; name: string; email?: string; phone?: string; ordersCount?: number; totalSpent?: number; createdAt?: { seconds: number } };
type Supplier = { id: string; name: string; contactName?: string; phone?: string; email?: string; address?: string; notes?: string; isActive: boolean; createdAt?: { seconds: number } };
type PurchaseLine = { productId: string; productName: string; quantity: number; unitCost: number };
type Purchase = { id: string; supplierId: string; supplierName: string; items: PurchaseLine[]; total: number; status: 'مستلمة' | 'ملغاة'; createdAt?: { seconds: number } };
type ShippingRate = { id: string; area: string; price: number; deliveryDays: number; isActive: boolean };
type Message = { id: string; name: string; phone?: string; email?: string; message: string; status?: string; createdAt?: { seconds: number } };
type Subscriber = { id: string; email: string; source?: string; createdAt?: { seconds: number } };
type SearchLog = { id: string; term: string; results: number; createdAt?: { seconds: number } };
type ProductStat = { id: string; productId?: string; productName?: string; views?: number; carts?: number; lastViewedAt?: { seconds: number } };
type DailyStat = { id: string; date: string; views?: number; searches?: number; messages?: number; addToCarts?: number; checkoutStarts?: number; whatsappClicks?: number };
type BlogPost = { id: string; title: string; slug?: string; excerpt?: string; content?: string; coverImage?: string; author?: string; readMinutes?: number; tags?: string[]; isPublished?: boolean; publishedAt?: { seconds: number } };
type InfoPage = { id: string; title: string; slug?: string; content?: string; group?: string; isPublished?: boolean; updatedAt?: { seconds: number } };
type Review = { id: string; customerName: string; productName: string; rating: number; comment: string; status: 'جديدة' | 'معتمدة' | 'مخفية'; createdAt?: { seconds: number } };
type Offer = { id: string; title: string; description?: string; discountType: 'percentage' | 'fixed'; discountValue: number; productIds: string[]; startsOn: string; endsOn: string; isActive: boolean; createdAt?: { seconds: number } };
type GlobalSearchResult = { id: string; title: string; detail: string; type: string; page: Page; query: string };

const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });
const statusOptions: OrderStatus[] = ['جديد', 'قيد التجهيز', 'تم الشحن', 'مكتمل', 'ملغي'];
const navGroups: { title: string; items: { id: Page; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { title: 'نظرة عامة', items: [{ id: 'overview', label: 'لوحة المتابعة', icon: LayoutDashboard }, { id: 'analytics', label: 'التحليلات', icon: ChartNoAxesColumn }] },
  { title: 'الكتالوج', items: [{ id: 'products', label: 'المنتجات', icon: Shirt }, { id: 'brands', label: 'العلامات التجارية', icon: Tags }, { id: 'categories', label: 'التصنيفات', icon: Boxes }, { id: 'offers', label: 'العروض', icon: Sparkles }] },
  { title: 'العمليات', items: [{ id: 'orders', label: 'الطلبات', icon: ShoppingBag }, { id: 'suppliers', label: 'الموردون', icon: Truck }] },
  { title: 'العملاء والتفاعل', items: [{ id: 'customers', label: 'العملاء', icon: UsersRound }, { id: 'reviews', label: 'التقييمات', icon: Star }, { id: 'messages', label: 'الرسائل', icon: MessageSquare }, { id: 'newsletter', label: 'النشرة', icon: Mail }, { id: 'notifications', label: 'التنبيهات', icon: BellRing }] },
  { title: 'المحتوى', items: [{ id: 'blog', label: 'المدونة', icon: BookOpen }, { id: 'pages', label: 'الصفحات', icon: FileText }] },
  { title: 'الإعدادات', items: [{ id: 'workshopSettings', label: 'بيانات العلامة', icon: Building2 }, { id: 'shippingRates', label: 'أسعار الشحن', icon: MapPin }] },
];
const pageCopy: Record<Page, { title: string; eyebrow: string; description: string }> = {
  overview: { title: 'صباح الشغل', eyebrow: 'نظرة عامة', description: 'دي لقطة سريعة على كل شغلك النهارده.' },
  analytics: { title: 'التحليلات', eyebrow: 'الأرقام', description: 'أرقام المبيعات والبحث والمشاهدات اللي بتوجّه قراراتك.' },
  messages: { title: 'الرسائل', eyebrow: 'العملاء والتفاعل', description: 'رسائل العملاء اللي جاية من صفحة التواصل.' },
  newsletter: { title: 'النشرة الإخبارية', eyebrow: 'العملاء والتفاعل', description: 'الإيميلات المسجلة من الموقع.' },
  blog: { title: 'المدونة', eyebrow: 'المحتوى', description: 'مقالات بتظهر في صفحة المدونة على الموقع.' },
  pages: { title: 'الصفحات', eyebrow: 'المحتوى', description: 'صفحات الموقع الثابتة (الشحن، الاسترجاع، الشروط).' },
  products: { title: 'المنتجات', eyebrow: 'الكتالوج', description: 'تابع القطع والمقاسات والمخزون في مكان واحد.' },
  brands: { title: 'العلامات التجارية', eyebrow: 'الكتالوج', description: 'العلامات المسجلة على المنتجات الحالية.' },
  categories: { title: 'التصنيفات', eyebrow: 'الكتالوج', description: 'توزيع المنتجات حسب نوع القطعة.' },
  offers: { title: 'العروض والخصومات', eyebrow: 'الكتالوج', description: 'أنشئ حملات خصم وحدد القطع والمدة وتابع الأسعار الترويجية.' },
  orders: { title: 'الطلبات', eyebrow: 'العمليات', description: 'من أول تأكيد الطلب لحد ما يوصل للعميل.' },
  suppliers: { title: 'الموردون', eyebrow: 'العمليات', description: 'بيانات التواصل وحالة التعامل مع كل مورد.' },
  customers: { title: 'العملاء', eyebrow: 'العلاقات', description: 'العملاء المسجلون وسجل تعاملاتهم.' },
  reviews: { title: 'التقييمات', eyebrow: 'العملاء والتفاعل', description: 'راجع آراء العملاء وحدد ما يظهر منها.' },
  notifications: { title: 'التنبيهات', eyebrow: 'العملاء والتفاعل', description: 'الأمور اللي محتاجة متابعة منك.' },
  shippingRates: { title: 'أسعار الشحن', eyebrow: 'الإعدادات', description: 'إدارة المناطق وتكلفة ومدة التوصيل.' },
  workshopSettings: { title: 'بيانات العلامة', eyebrow: 'الإعدادات', description: 'بيانات التواصل ووسائل التواصل الاجتماعي التي تظهر لزوار الموقع.' },
};

function BrandLogo({ size = 30, ghost = false }: { size?: number; ghost?: boolean }) {
  return <span className={`dash-logo${ghost ? ' dash-logo-ghost' : ''}`} style={{ '--dash-logo-size': `${size}px` } as React.CSSProperties}>
    <Image src="/logo.png" alt="R/ONE" width={size} height={size} className="dash-logo-img" draggable={false} />
  </span>;
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('');
}

function whatsappHref(value: string) {
  const digits = value.replace(/\D/g, '');
  const international = digits.startsWith('00') ? digits.slice(2) : digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

function formatDate(seconds?: number) {
  if (!seconds) return '—';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(new Date(seconds * 1000));
}

function Login({ message }: { message?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <main className="login-shell">
    <section className="login-aside"><div className="login-wordmark"><BrandLogo size={34} ghost /><span>ONE</span></div><div className="login-slogan"><span className="eyebrow">MADE TO MOVE</span><h2>كل قطعة<br />لها حكاية.</h2><div className="stitch-line" /></div><div className="login-caption">R/ONE · القاهرة</div></section>
    <section className="login-form-wrap"><div className="mobile-wordmark"><BrandLogo size={30} /><span>ONE</span></div><div className="login-form-inner"><span className="eyebrow">مساحة الفريق</span><h1>أهلاً بعودتك</h1><p className="muted">سجّل الدخول لمتابعة شغلك النهارده.</p><form className="login-form" onSubmit={submit}><label>البريد الإلكتروني<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@r-one.com" /></label><label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••" /></label>{(error || message) && <p className="form-error">{error || message}</p>}<button className="button button-dark button-full" type="submit" disabled={busy}>{busy ? 'جارٍ تسجيل الدخول...' : <>دخول إلى لوحة الإدارة <ArrowLeft size={17} /></>}</button></form><p className="login-security"><span className="secure-dot" /> دخول آمن عبر Firebase Authentication</p></div><div className="login-foot">R/ONE <span>الإدارة الداخلية</span></div></section>
  </main>;
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Package; title: string; body: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><strong>{title}</strong><p>{body}</p></div>;
}

function PageHeading({ page, trailing }: { page: Page; trailing?: ReactNode }) {
  const copy = pageCopy[page];
  return <div className="page-heading"><div><div className="eyebrow">{copy.eyebrow}</div><h1>{copy.title}</h1><p className="muted">{copy.description}</p></div>{trailing}</div>;
}

function useModalAccessibility(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeDialog = dialog;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () => Array.from(activeDialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.offsetParent !== null);

    const firstFocusable = getFocusable()[0] || dialog;
    firstFocusable.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === activeDialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return dialogRef;
}

type Confirmation = { title: string; message: string; confirmLabel: string; onConfirm: () => Promise<void> };

function ConfirmDialog({ confirmation, onClose }: { confirmation: Confirmation; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useModalAccessibility(onClose);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await confirmation.onConfirm();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" tabIndex={-1}><span className="confirm-mark"><Trash2 size={19} /></span><h2 id="confirm-title">{confirmation.title}</h2><p id="confirm-message">{confirmation.message}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" disabled={busy} onClick={onClose}>إلغاء</button><button className="button button-danger" type="button" disabled={busy} onClick={confirm}>{busy ? <><LoaderCircle className="spin-icon" size={15} /> جارٍ الحذف...</> : <><Trash2 size={15} /> {confirmation.confirmLabel}</>}</button></div></section></div>;
}

function GlobalSearchDialog({ query, onQueryChange, results, onSelect, onClose }: { query: string; onQueryChange: (value: string) => void; results: GlobalSearchResult[]; onSelect: (result: GlobalSearchResult) => void; onClose: () => void }) {
  const dialogRef = useModalAccessibility(onClose);
  return <div className="modal-backdrop search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title"><div className="global-search-input-row"><Search size={19} /><input id="global-search-title" autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="ابحث في المنتجات والطلبات والعملاء..." /><kbd>ESC</kbd><button className="icon-button" title="إغلاق البحث" onClick={onClose}><X size={17} /></button></div><div className="global-search-results">{query.trim().length < 2 ? <div className="global-search-hint"><span className="eyebrow">بحث شامل</span><p>اكتب حرفين على الأقل للبحث في كامل بيانات المتجر.</p><small>منتجات · تصنيفات · علامات · طلبات · عملاء · موردون · عروض</small></div> : results.length ? results.map((result) => <button className="global-search-result" type="button" key={`${result.type}:${result.id}`} onClick={() => onSelect(result)}><span className="global-search-result-icon"><Search size={15} /></span><span className="global-search-result-copy"><strong>{result.title}</strong><small>{result.detail}</small></span><span className="global-search-result-type">{result.type}</span></button>) : <div className="global-search-hint"><strong>مفيش نتائج مطابقة</strong><p>جرّب كلمة بحث أقصر أو رقم الطلب أو كود المنتج.</p></div>}</div><div className="global-search-footer"><span>تنقل مباشر إلى السجل</span><span><kbd>Ctrl</kbd> <kbd>K</kbd> لفتح البحث</span></div></section></div>;
}

function CatalogModal({ kind, entry, onClose, onSave }: { kind: CatalogKind; entry?: CatalogEntry; onClose: () => void; onSave: (value: Omit<CatalogEntry, 'id'>, id?: string) => Promise<void> }) {
  const dialogRef = useModalAccessibility(onClose);
  const [name, setName] = useState(entry?.name || '');
  const [description, setDescription] = useState(entry?.description || '');
  const [isActive, setIsActive] = useState(entry?.isActive ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = kind === 'categories' ? 'التصنيف' : 'العلامة التجارية';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ name: name.trim(), description: description.trim(), isActive }, entry?.id);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title"><div className="modal-head"><div><span className="eyebrow">إدارة الكتالوج</span><h2 id="catalog-modal-title">{entry ? `تعديل ${title}` : `إضافة ${title}`}</h2></div><button className="icon-button" title="إغلاق" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><div className="form-grid"><label className="span-two">اسم {title}<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === 'categories' ? 'مثال: تيشيرتات' : 'مثال: R/ONE'} /></label><label className="span-two">وصف مختصر <span className="field-optional">اختياري</span><textarea rows={3} maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="ملاحظات تساعد الفريق على تنظيم الكتالوج" /></label><label className="catalog-active-toggle"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /><span><strong>متاح للاستخدام</strong><small>العناصر المؤرشفة لا تظهر عند إضافة منتجات جديدة.</small></span></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin-icon" size={15} /> جارٍ الحفظ...</> : <><Check size={16} /> {entry ? 'حفظ التعديلات' : 'إضافة'}</>}</button></div></form></section></div>;
}

function CatalogTable({ kind, entries, products, query, onEdit, onToggle, onDelete }: { kind: CatalogKind; entries: CatalogEntry[]; products: Product[]; query: string; onEdit: (entry: CatalogEntry) => void; onToggle: (entry: CatalogEntry) => void; onDelete: (entry: CatalogEntry) => void }) {
  const categoryMode = kind === 'categories';
  const matches = (product: Product, entry: CatalogEntry) => categoryMode
    ? product.categoryId === entry.id || (!product.categoryId && normalizeLabel(product.category || '') === normalizeLabel(entry.name))
    : product.brandId === entry.id || (!product.brandId && normalizeLabel(product.brand || '') === normalizeLabel(entry.name));
  const filtered = entries.filter((entry) => !query || [entry.name, entry.description || ''].some((value) => normalizeLabel(value).includes(normalizeLabel(query))));
  if (!filtered.length) return <EmptyState icon={categoryMode ? Boxes : Tags} title={query ? 'مفيش نتائج مطابقة' : categoryMode ? 'لسه مفيش تصنيفات' : 'لسه مفيش علامات تجارية'} body={query ? 'جرّب كلمة بحث تانية.' : categoryMode ? 'أضف تصنيفات واضحة علشان الفريق يلاقي المنتجات بسرعة.' : 'سجّل العلامات التجارية المستخدمة في المنتجات الحالية.'} />;

  return <div className="table-scroll"><table className="catalog-table"><thead><tr><th>{categoryMode ? 'التصنيف' : 'العلامة التجارية'}</th><th>الوصف</th><th>المنتجات</th><th>الحالة</th><th><span className="sr-only">إجراءات</span></th></tr></thead><tbody>{filtered.map((entry) => {
    const usage = products.filter((product) => matches(product, entry)).length;
    return <tr key={entry.id}><td><div className="catalog-name-cell"><span className={`catalog-avatar ${categoryMode ? 'category-avatar' : 'brand-avatar'}`}>{categoryMode ? <Boxes size={17} /> : <Tags size={17} />}</span><span><strong>{entry.name}</strong><small>أضيفت {formatDate(entry.createdAt?.seconds)}</small></span></div></td><td className="catalog-description">{entry.description || <span className="muted">بدون وصف</span>}</td><td><span className="usage-count">{usage}<small> منتج</small></span></td><td><span className={`catalog-state ${entry.isActive ? 'catalog-enabled' : 'catalog-archived'}`}><i />{entry.isActive ? 'نشط' : 'مؤرشف'}</span></td><td><div className="row-actions"><button className="icon-button" title="تعديل" onClick={() => onEdit(entry)}><Pencil size={15} /></button><button className="icon-button" title={entry.isActive ? 'أرشفة' : 'إعادة تفعيل'} onClick={() => onToggle(entry)}>{entry.isActive ? <Archive size={15} /> : <ArchiveRestore size={15} />}</button><button className="icon-button delete-action" title={usage ? `لا يمكن الحذف: مستخدم في ${usage} منتج` : 'حذف'} disabled={usage > 0} onClick={() => onDelete(entry)}><Trash2 size={15} /></button></div></td></tr>;
  })}</tbody></table></div>;
}

function OfferModal({ offer, products, onClose, onSave }: { offer?: Offer; products: Product[]; onClose: () => void; onSave: (value: Omit<Offer, 'id'>, id?: string) => Promise<void> }) {
  const dialogRef = useModalAccessibility(onClose);
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [title, setTitle] = useState(offer?.title || '');
  const [description, setDescription] = useState(offer?.description || '');
  const [discountType, setDiscountType] = useState<Offer['discountType']>(offer?.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(offer?.discountValue?.toString() || '');
  const [productIds, setProductIds] = useState<string[]>(offer?.productIds || []);
  const [startsOn, setStartsOn] = useState(offer?.startsOn || today);
  const [endsOn, setEndsOn] = useState(offer?.endsOn || nextWeek);
  const [isActive, setIsActive] = useState(offer?.isActive ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productIds.length) { setError('اختر قطعة واحدة على الأقل ليطبق عليها العرض.'); return; }
    if (endsOn < startsOn) { setError('تاريخ نهاية العرض يجب أن يكون بعد تاريخ بدايته.'); return; }
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0 || (discountType === 'percentage' && value > 90)) { setError(discountType === 'percentage' ? 'أدخل خصماً بين 1% و90%.' : 'أدخل قيمة خصم أكبر من صفر.'); return; }
    if (discountType === 'fixed' && productIds.some((id) => value >= (Number(products.find((product) => product.id === id)?.price) || 0))) { setError('قيمة الخصم يجب أن تكون أقل من سعر كل قطعة مختارة.'); return; }
    setBusy(true);
    setError('');
    try { await onSave({ title: title.trim(), description: description.trim(), discountType, discountValue: value, productIds, startsOn, endsOn, isActive }, offer?.id); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : getErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  function toggleProduct(productId: string) {
    setProductIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="modal offer-modal" role="dialog" aria-modal="true" aria-labelledby="offer-modal-title"><div className="modal-head"><div><span className="eyebrow">حملة ترويجية</span><h2 id="offer-modal-title">{offer ? 'تعديل العرض' : 'إنشاء عرض جديد'}</h2></div><button className="icon-button" title="إغلاق" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><div className="form-grid"><label className="span-two">اسم العرض<input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: خصم نهاية الموسم" /></label><label>نوع الخصم<select value={discountType} onChange={(event) => setDiscountType(event.target.value as Offer['discountType'])}><option value="percentage">نسبة مئوية</option><option value="fixed">خصم مبلغ ثابت</option></select></label><label>{discountType === 'percentage' ? 'نسبة الخصم (%)' : 'قيمة الخصم بالجنيه'}<input type="number" required min="1" max={discountType === 'percentage' ? 90 : undefined} step={discountType === 'percentage' ? 1 : 0.01} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={discountType === 'percentage' ? '20' : '150'} /></label><label>يبدأ في<input type="date" required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label><label>ينتهي في<input type="date" required min={startsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label><label className="span-two">وصف العرض <span className="field-optional">اختياري</span><textarea rows={2} maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="تفاصيل مختصرة عن الحملة" /></label><div className="offer-products span-two"><div className="offer-products-heading"><strong>القطع المشمولة</strong><span>{productIds.length} قطعة محددة</span></div>{products.length ? <div className="offer-product-list">{products.map((product) => <label className="offer-product-option" key={product.id}><input type="checkbox" checked={productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span className="offer-product-copy"><strong>{product.name}</strong><small>{product.sku} · {money.format(Number(product.price) || 0)}</small></span><span className="offer-result-price">{money.format(discountType === 'percentage' ? product.price * (1 - (Number(discountValue) || 0) / 100) : Math.max(0, product.price - (Number(discountValue) || 0)))}</span></label>)}</div> : <p className="empty-inline">أضف منتجات إلى الكتالوج قبل إنشاء عرض.</p>}</div><label className="catalog-active-toggle"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /><span><strong>العرض مفعّل</strong><small>لن يطبق خارج تاريخ البداية والنهاية المحددين.</small></span></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button><button className="button button-dark" type="submit" disabled={busy || !products.length}>{busy ? <><LoaderCircle className="spin-icon" size={15} /> جارٍ الحفظ...</> : <><Check size={16} /> {offer ? 'حفظ التعديلات' : 'إنشاء العرض'}</>}</button></div></form></section></div>;
}

function getOfferState(offer: Offer, today = new Date().toISOString().slice(0, 10)) {
  if (!offer.isActive) return 'متوقف';
  if (today < offer.startsOn) return 'مجدول';
  if (today > offer.endsOn) return 'منتهي';
  return 'نشط';
}

function OfferTable({ offers, products, query, onEdit, onToggle, onDelete }: { offers: Offer[]; products: Product[]; query: string; onEdit: (offer: Offer) => void; onToggle: (offer: Offer) => void; onDelete: (offer: Offer) => void }) {
  const filtered = offers.filter((offer) => !query || [offer.title, offer.description || ''].some((value) => normalizeLabel(value).includes(normalizeLabel(query))));
  if (!filtered.length) return <EmptyState icon={Percent} title={query ? 'مفيش عروض مطابقة' : 'لسه مفيش عروض'} body={query ? 'جرّب كلمة بحث مختلفة.' : 'أنشئ حملة خصم وحدد القطع ومدتها، وسيظهر السعر بعد الخصم في الكتالوج.'} />;
  return <div className="table-scroll"><table className="catalog-table offer-table"><thead><tr><th>العرض</th><th>الخصم</th><th>القطع</th><th>المدة</th><th>الحالة</th><th><span className="sr-only">إجراءات</span></th></tr></thead><tbody>{filtered.map((offer) => {
    const state = getOfferState(offer);
    const selectedProducts = products.filter((product) => offer.productIds.includes(product.id));
    return <tr key={offer.id}><td><div className="catalog-name-cell"><span className="catalog-avatar offer-avatar"><Percent size={17} /></span><span><strong>{offer.title}</strong><small>{offer.description || 'حملة خصم على منتجات محددة'}</small></span></div></td><td><strong className="offer-discount">{offer.discountType === 'percentage' ? `${offer.discountValue}%` : money.format(offer.discountValue)}</strong><small className="offer-discount-kind">{offer.discountType === 'percentage' ? 'خصم نسبي' : 'من سعر القطعة'}</small></td><td><span className="usage-count">{offer.productIds.length}<small> قطعة</small></span>{selectedProducts.length < offer.productIds.length && <small className="missing-products">بعض المنتجات محذوفة</small>}</td><td><span className="offer-dates">{offer.startsOn}<small>حتى</small>{offer.endsOn}</span></td><td><span className={`catalog-state ${state === 'نشط' ? 'catalog-enabled' : 'catalog-archived'}`}><i />{state}</span></td><td><div className="row-actions"><button className="icon-button" title="تعديل العرض" onClick={() => onEdit(offer)}><Pencil size={15} /></button><button className="icon-button" title={offer.isActive ? 'إيقاف العرض' : 'تفعيل العرض'} onClick={() => onToggle(offer)}>{offer.isActive ? <Archive size={15} /> : <ArchiveRestore size={15} />}</button><button className="icon-button delete-action" title="حذف العرض" onClick={() => onDelete(offer)}><Trash2 size={15} /></button></div></td></tr>;
  })}</tbody></table></div>;
}

type RecordField = { key: string; label: string; type?: 'text' | 'email' | 'tel' | 'number' | 'textarea'; required?: boolean; placeholder?: string; min?: number };

function RecordModal({ title, fields, initial, onClose, onSave }: { title: string; fields: RecordField[]; initial?: Record<string, string>; onClose: () => void; onSave: (values: Record<string, string>) => Promise<void> }) {
  const dialogRef = useModalAccessibility(onClose);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, initial?.[field.key] || ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await onSave(values); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : getErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title"><div className="modal-head"><div><span className="eyebrow">إدارة البيانات</span><h2 id="record-modal-title">{title}</h2></div><button className="icon-button" title="إغلاق" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><div className="form-grid">{fields.map((field) => <label className={field.type === 'textarea' ? 'span-two' : ''} key={field.key}>{field.label}{field.type === 'textarea' ? <textarea rows={3} maxLength={400} value={values[field.key]} onChange={(event) => setValues((state) => ({ ...state, [field.key]: event.target.value }))} placeholder={field.placeholder} /> : <input type={field.type || 'text'} required={field.required} min={field.min} maxLength={field.type === 'number' ? undefined : 120} value={values[field.key]} onChange={(event) => setValues((state) => ({ ...state, [field.key]: event.target.value }))} placeholder={field.placeholder} />}</label>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin-icon" size={15} /> جارٍ الحفظ...</> : <><Check size={16} /> حفظ</>}</button></div></form></section></div>;
}

function PurchaseModal({ products, suppliers, onClose, onSave }: { products: Product[]; suppliers: Supplier[]; onClose: () => void; onSave: (supplierId: string, lines: PurchaseLine[]) => Promise<void> }) {
  const dialogRef = useModalAccessibility(onClose);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState([{ productId: '', quantity: '1', unitCost: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitCost) || 0), 0);
  function setLine(index: number, key: 'productId' | 'quantity' | 'unitCost', value: string) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = lines.map((line) => ({ product: products.find((product) => product.id === line.productId), quantity: Number(line.quantity), unitCost: Number(line.unitCost) }));
    if (selected.some((line) => !line.product || !Number.isInteger(line.quantity) || line.quantity < 1 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) { setError('اختر منتجاً وأدخل كمية وتكلفة صحيحتين لكل بند.'); return; }
    setBusy(true);
    setError('');
    try { await onSave(supplierId, selected.map(({ product, quantity, unitCost }) => ({ productId: product!.id, productName: product!.name, quantity, unitCost }))); onClose(); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="modal purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-modal-title"><div className="modal-head"><div><span className="eyebrow">حركة المخزون</span><h2 id="purchase-modal-title">تسجيل مشتريات واردة</h2></div><button className="icon-button" title="إغلاق" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><label className="purchase-supplier-field">المورد<select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">اختر المورد</option>{suppliers.filter((supplier) => supplier.isActive).map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label><div className="purchase-lines"><div className="purchase-lines-head"><span>الصنف</span><span>الكمية</span><span>تكلفة الوحدة</span><span /></div>{lines.map((line, index) => <div className="purchase-line" key={index}><select aria-label="المنتج" required value={line.productId} onChange={(event) => setLine(index, 'productId', event.target.value)}><option value="">اختر المنتج</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · مخزون {product.stock}</option>)}</select><input aria-label="الكمية" type="number" min="1" step="1" required value={line.quantity} onChange={(event) => setLine(index, 'quantity', event.target.value)} /><input aria-label="تكلفة الوحدة" type="number" min="0" step="0.01" required value={line.unitCost} onChange={(event) => setLine(index, 'unitCost', event.target.value)} placeholder="0" /><button className="icon-button" type="button" disabled={lines.length === 1} title="حذف البند" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><X size={15} /></button></div>)}</div><button className="field-action add-purchase-line" type="button" onClick={() => setLines((current) => [...current, { productId: '', quantity: '1', unitCost: '' }])}><Plus size={14} /> إضافة صنف</button><div className="purchase-total"><span>إجمالي الفاتورة</span><strong>{money.format(total)}</strong></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button><button className="button button-dark" type="submit" disabled={busy || !suppliers.some((supplier) => supplier.isActive) || !products.length}>{busy ? <><LoaderCircle className="spin-icon" size={15} /> جارٍ تسجيل الشراء...</> : <><Check size={16} /> اعتماد وإضافة للمخزون</>}</button></div></form></section></div>;
}

function StatusBadge({ status }: { status: string }) {
  const style = status === 'مكتمل' ? 'complete' : status === 'ملغي' ? 'cancelled' : status === 'تم الشحن' ? 'shipped' : status === 'قيد التجهيز' ? 'processing' : 'new';
  return <span className={`status-badge status-${style}`}><i />{status || 'جديد'}</span>;
}

function productSizes(product: Product) {
  const list = Array.isArray(product.sizes) ? product.sizes : [];
  return list
    .map((size) => (typeof size === 'string' ? { name: String(size) } : { name: String(size?.name ?? ''), stock: size?.stock }))
    .filter((size) => size.name.trim());
}

function productColors(product: Product) {
  const list = Array.isArray(product.colors) ? product.colors : [];
  return list.filter((color) => String(color?.name ?? '').trim());
}

function ProductTable({
  products,
  onEdit,
  onDelete,
  onDuplicate,
  onQuickSave,
  onNotify,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  mode,
  stats,
  highlighted,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onQuickSave: (productId: string, patch: Record<string, unknown>) => Promise<void>;
  onNotify: (message: string) => void;
  selectedIds: string[];
  onToggleSelect: (productId: string) => void;
  onSelectAll: () => void;
  mode: Page;
  stats?: Record<string, { views?: number; carts?: number }>;
  highlighted?: string | null;
}) {
  const [draft, setDraft] = useState<Record<string, { price: string; stock: string }>>({});
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    if (mode !== 'products') return;
    setDraft(Object.fromEntries(products.map((product) => [product.id, { price: String(product.price ?? ''), stock: String(product.stock ?? '') }])));
  }, [products, mode]);

  async function commitQuick(product: Product) {
    const entry = draft[product.id];
    if (!entry) return;
    const price = Number(entry.price);
    const stock = Number(entry.stock);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) return;
    if (price === Number(product.price) && stock === Number(product.stock)) return;
    setSavingId(product.id);
    try {
      await onQuickSave(product.id, { price, stock });
      onNotify(`تم تحديث «${product.name}».`);
    } catch (reason) {
      onNotify(getErrorMessage(reason));
      setDraft((current) => ({ ...current, [product.id]: { price: String(product.price ?? ''), stock: String(product.stock ?? '') } }));
    } finally {
      setSavingId('');
    }
  }

  if (!products.length) return <EmptyState icon={mode === 'offers' ? Sparkles : Package} title={mode === 'offers' ? 'مفيش عروض مسجلة حالياً' : 'الكتالوج لسه فاضي'} body={mode === 'offers' ? 'أضف سعر عرض لمنتجاتك لعرضها هنا.' : 'ابدأ بضافة أول منتج للمتجر.'} />;

  const allSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id));

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {mode === 'products' ? (
              <th className="select-cell">
                <input type="checkbox" aria-label="تحديد الكل" checked={allSelected} onChange={onSelectAll} />
              </th>
            ) : null}
            <th>المنتج</th>
            <th>التصنيف</th>
            <th>السعر</th>
            <th>المخزون</th>
            {mode === 'products' ? <><th>خيارات</th><th>الأداء</th></> : null}
            <th>الحالة</th>
            <th><span className="sr-only">الإجراءات</span></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => {
            const coverImage = product.images?.[0]?.url || product.imageUrl;
            const entry = draft[product.id];
            const sizes = productSizes(product);
            const colors = productColors(product);
            return (
              <tr key={product.id} data-product-row={product.id} className={`${selectedIds.includes(product.id) ? 'row-selected' : ''} ${highlighted === product.id ? 'row-highlight' : ''}`}>
                {mode === 'products' ? (
                  <td className="select-cell">
                    <input type="checkbox" aria-label={`تحديد ${product.name}`} checked={selectedIds.includes(product.id)} onChange={() => onToggleSelect(product.id)} />
                  </td>
                ) : null}
                <td>
                  <div className="product-cell">
                    {coverImage ? <img className="product-swatch product-thumbnail" src={coverImage} alt={product.name} loading="lazy" /> : <span className={`product-swatch swatch-${index % 5}`}><Shirt size={19} strokeWidth={1.6} /></span>}
                    <span className="product-name">
                      <strong>{product.name}</strong>
                      <small>{product.sku}{product.brand ? ` · ${product.brand}` : ''}</small>
                      {product.description ? <small className="product-desc-line">{product.description}</small> : null}
                    </span>
                  </div>
                </td>
                <td><span className="table-label">{product.category || '—'}</span></td>
                <td className="price-cell">
                  {mode === 'products' ? (
                    <div className="quick-edit">
                      <input
                        className="quick-edit-input"
                        type="number"
                        min="0"
                        step="1"
                        value={entry?.price ?? ''}
                        onChange={(event) => setDraft((current) => ({ ...current, [product.id]: { price: event.target.value, stock: current[product.id]?.stock ?? '' } }))}
                        onBlur={() => commitQuick(product)}
                        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
                        aria-label={`سعر ${product.name}`}
                      />
                      <small>ج.م</small>
                      {product.salePrice ? <del>{money.format(product.salePrice)}</del> : null}
                    </div>
                  ) : product.salePrice ? <span className="sale-price">{money.format(product.salePrice)} <del>{money.format(product.price)}</del></span> : money.format(Number(product.price) || 0)}
                </td>
                <td>
                  {mode === 'products' ? (
                    <div className="quick-edit">
                      <input
                        className="quick-edit-input quick-edit-stock"
                        type="number"
                        min="0"
                        step="1"
                        value={entry?.stock ?? ''}
                        onChange={(event) => setDraft((current) => ({ ...current, [product.id]: { price: current[product.id]?.price ?? '', stock: event.target.value } }))}
                        onBlur={() => commitQuick(product)}
                        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
                        aria-label={`مخزون ${product.name}`}
                      />
                      {savingId === product.id ? <span className="quick-edit-saving">…</span> : null}
                    </div>
                  ) : <span className={`stock-quantity ${Number(product.stock) <= 5 ? 'stock-low' : ''}`}>{product.stock ?? 0} <small>قطعة</small></span>}
                </td>
                {mode === 'products' ? (
                  <>
                    <td>
                      <span className="variant-summary">
                        {sizes.length ? <span title="المقاسات">{sizes.map((size) => size.name).slice(0, 4).join('، ')}{sizes.length > 4 ? '…' : ''}</span> : null}
                        {colors.length ? <span title="الألوان">{colors.length} لون</span> : null}
                        {!sizes.length && !colors.length ? <span className="muted">—</span> : null}
                      </span>
                    </td>
                    <td>
                      <span className="perf-cell">
                        <span title="مشاهدات"><Eye size={13} />{stats?.[product.id]?.views ?? 0}</span>
                        <span title="إضافات للسلة"><ShoppingBag size={13} />{stats?.[product.id]?.carts ?? 0}</span>
                      </span>
                    </td>
                  </>
                ) : null}
                <td><span className={`inventory-status ${Number(product.stock) > 5 ? 'inventory-in' : 'inventory-low'}`}><i />{Number(product.stock) > 5 ? 'متوفر' : 'مخزون منخفض'}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="button button-quiet edit-product-btn" onClick={() => onEdit(product)}><Pencil size={14} /> تعديل</button>
                    <button className="icon-button" title="تكرار المنتج" onClick={() => onDuplicate(product)}><Copy size={15} /></button>
                    <button className="icon-button delete-action" title="حذف المنتج" onClick={() => onDelete(product)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SuppliersTable({ suppliers, purchases, onEdit, onToggle, onDelete }: { suppliers: Supplier[]; purchases: Purchase[]; onEdit: (supplier: Supplier) => void; onToggle: (supplier: Supplier) => void; onDelete: (supplier: Supplier) => void }) {
  if (!suppliers.length) return <EmptyState icon={Truck} title="مفيش موردين مسجلين" body="أضف بيانات الموردين علشان تربط بهم فواتير التوريد." />;
  return <div className="table-scroll"><table><thead><tr><th>المورد</th><th>مسؤول التواصل</th><th>الهاتف</th><th>البريد</th><th>فواتير الشراء</th><th>الحالة</th><th /></tr></thead><tbody>{suppliers.map((supplier) => {
    const used = purchases.some((purchase) => purchase.supplierId === supplier.id);
    return <tr key={supplier.id}><td><div className="catalog-name-cell"><span className="catalog-avatar brand-avatar"><Building2 size={17} /></span><span><strong>{supplier.name}</strong><small>{supplier.address || 'بدون عنوان مسجل'}</small></span></div></td><td>{supplier.contactName || '—'}</td><td dir="ltr" className="ltr-cell">{supplier.phone || '—'}</td><td>{supplier.email || '—'}</td><td>{purchases.filter((purchase) => purchase.supplierId === supplier.id).length}</td><td><span className={`catalog-state ${supplier.isActive ? 'catalog-enabled' : 'catalog-archived'}`}><i />{supplier.isActive ? 'نشط' : 'مؤرشف'}</span></td><td><div className="row-actions"><button className="icon-button" title="تعديل بيانات المورد" onClick={() => onEdit(supplier)}><Pencil size={15} /></button><button className="icon-button" title={supplier.isActive ? 'أرشفة المورد' : 'إعادة تفعيل'} onClick={() => onToggle(supplier)}>{supplier.isActive ? <Archive size={15} /> : <ArchiveRestore size={15} />}</button><button className="icon-button delete-action" title={used ? 'المورد مرتبط بفواتير مشتريات' : 'حذف المورد'} disabled={used} onClick={() => onDelete(supplier)}><Trash2 size={15} /></button></div></td></tr>;
  })}</tbody></table></div>;
}

function PurchasesTable({ purchases }: { purchases: Purchase[] }) {
  if (!purchases.length) return <EmptyState icon={ClipboardList} title="لا توجد مشتريات مسجلة" body="سجّل أول فاتورة توريد، وسيتم تحديث مخزون المنتجات تلقائياً." />;
  return <div className="table-scroll"><table><thead><tr><th>رقم الفاتورة</th><th>المورد</th><th>الأصناف</th><th>الوحدات الواردة</th><th>الإجمالي</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>{[...purchases].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((purchase) => <tr key={purchase.id}><td><span className="order-id">PO-{purchase.id.slice(-6).toUpperCase()}</span></td><td><strong>{purchase.supplierName}</strong></td><td>{purchase.items?.length || 0} أصناف</td><td>{purchase.items?.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0) || 0} قطعة</td><td className="price-cell">{money.format(Number(purchase.total) || 0)}</td><td className="date-cell">{formatDate(purchase.createdAt?.seconds)}</td><td><span className={`catalog-state ${purchase.status === 'ملغاة' ? 'catalog-archived' : 'catalog-enabled'}`}><i />{purchase.status || 'مستلمة'}</span></td></tr>)}</tbody></table></div>;
}

function ShippingTable({ rates, onEdit, onToggle, onDelete }: { rates: ShippingRate[]; onEdit: (rate: ShippingRate) => void; onToggle: (rate: ShippingRate) => void; onDelete: (rate: ShippingRate) => void }) {
  if (!rates.length) return <EmptyState icon={MapPin} title="أضف مناطق التوصيل" body="حدد سعر ومدة التوصيل لكل محافظة أو منطقة تخدمها." />;
  return <div className="table-scroll"><table><thead><tr><th>المنطقة</th><th>تكلفة الشحن</th><th>المدة المتوقعة</th><th>الحالة</th><th /></tr></thead><tbody>{rates.map((rate) => <tr key={rate.id}><td><div className="catalog-name-cell"><span className="catalog-avatar category-avatar"><MapPin size={17} /></span><strong>{rate.area}</strong></div></td><td className="price-cell">{money.format(Number(rate.price) || 0)}</td><td>{rate.deliveryDays} أيام عمل</td><td><span className={`catalog-state ${rate.isActive ? 'catalog-enabled' : 'catalog-archived'}`}><i />{rate.isActive ? 'متاح' : 'موقوف'}</span></td><td><div className="row-actions"><button className="icon-button" title="تعديل السعر" onClick={() => onEdit(rate)}><Pencil size={15} /></button><button className="icon-button" title={rate.isActive ? 'إيقاف المنطقة' : 'تفعيل المنطقة'} onClick={() => onToggle(rate)}>{rate.isActive ? <Archive size={15} /> : <ArchiveRestore size={15} />}</button><button className="icon-button delete-action" title="حذف المنطقة" onClick={() => onDelete(rate)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>;
}

function ReviewsTable({ reviews, onStatusChange }: { reviews: Review[]; onStatusChange: (reviewId: string, status: Review['status']) => void }) {
  if (!reviews.length) return <EmptyState icon={Star} title="لا توجد تقييمات بعد" body="ستظهر تقييمات العملاء هنا لمراجعتها وإدارة ظهورها." />;
  return <div className="table-scroll"><table><thead><tr><th>العميل</th><th>المنتج</th><th>التقييم</th><th>التعليق</th><th>الحالة</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td><strong>{review.customerName || 'عميل'}</strong></td><td>{review.productName || '—'}</td><td><span className="rating-stars">{'★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}</span> <span className="muted">{review.rating}/5</span></td><td className="review-comment">{review.comment || '—'}</td><td><select className="review-status" aria-label="حالة التقييم" value={review.status || 'جديدة'} onChange={(event) => onStatusChange(review.id, event.target.value as Review['status'])}><option value="جديدة">جديدة</option><option value="معتمدة">معتمدة</option><option value="مخفية">مخفية</option></select></td></tr>)}</tbody></table></div>;
}

function NotificationsPanel({ orders, products, reviews, onNavigate }: { orders: Order[]; products: Product[]; reviews: Review[]; onNavigate: (page: Page) => void }) {
  const pending = orders.filter((order) => order.status !== 'مكتمل' && order.status !== 'ملغي').length;
  const lowStock = products.filter((product) => Number(product.stock) <= 5);
  const waitingReviews = reviews.filter((review) => !review.status || review.status === 'جديدة').length;
  const items = [
    ...(pending ? [{ title: `${pending} طلب بحاجة إلى متابعة`, detail: 'راجع الطلبات الجديدة أو قيد التجهيز.', icon: ShoppingBag, page: 'orders' as Page, tone: 'tone-blue' }] : []),
    ...(lowStock.length ? [{ title: `${lowStock.length} منتج بمخزون منخفض`, detail: lowStock.slice(0, 3).map((product) => product.name).join('، '), icon: Boxes, page: 'products' as Page, tone: 'tone-orange' }] : []),
    ...(waitingReviews ? [{ title: `${waitingReviews} تقييم بانتظار المراجعة`, detail: 'اعتمد التقييمات المناسبة أو أخفِ غير الملائم.', icon: Star, page: 'reviews' as Page, tone: 'tone-lime' }] : []),
  ];
  if (!items.length) return <EmptyState icon={BellRing} title="كل شيء تحت السيطرة" body="ستظهر هنا تنبيهات الطلبات والمخزون والتقييمات التي تحتاج متابعة." />;
  return <div className="notification-list">{items.map(({ title, detail, icon: Icon, page, tone }) => <button className="notification-row" key={title} onClick={() => onNavigate(page)}><span className={`notification-icon ${tone}`}><Icon size={18} /></span><span className="notification-copy"><strong>{title}</strong><small>{detail}</small></span><ArrowUpLeft size={16} /></button>)}</div>;
}

function OrderTable({ orders, busyOrder, onStatusChange }: { orders: Order[]; busyOrder: string; onStatusChange: (id: string, status: OrderStatus) => void }) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  if (!orders.length) return <EmptyState icon={ShoppingBag} title="مفيش طلبات لحد دلوقتي" body="أي طلب جديد هتلاقيه هنا وتقدر تتابع حالته خطوة بخطوة." />;
  return <><div className="table-scroll"><table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>التاريخ</th><th>القطع</th><th>الإجمالي</th><th>الحالة</th><th><span className="sr-only">التفاصيل</span></th></tr></thead><tbody>{orders.map((order, index) => <tr key={order.id}><td><span className="order-id">#{order.id.slice(-6).toUpperCase()}</span></td><td><div className="customer-cell"><span className={`customer-avatar customer-${index % 5}`}>{initials(order.customerName || 'ع')}</span><span><strong>{order.customerName || 'عميل جديد'}</strong><small>{order.customerPhone || '—'}</small></span></div></td><td className="date-cell">{formatDate(order.createdAt?.seconds)}</td><td>{order.itemsCount ?? 0} قطع</td><td className="price-cell">{money.format(Number(order.total) || 0)}{order.shippingPending && <small className="order-shipping-note"> قبل الشحن</small>}</td><td><div className="status-control"><StatusBadge status={order.status || 'جديد'} /><select aria-label={`تغيير حالة الطلب ${order.id}`} value={order.status || 'جديد'} disabled={busyOrder === order.id} onChange={(event) => onStatusChange(order.id, event.target.value as OrderStatus)}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown size={13} /></div></td><td><button className="icon-button" type="button" title="عرض تفاصيل الطلب" onClick={() => setSelectedOrder(order)}><Eye size={16} /></button></td></tr>)}</tbody></table></div>{selectedOrder && <OrderDetailsDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />}</>;
}

const ORDER_SOURCE_LABEL: Record<string, string> = { storefront: 'من الموقع', whatsapp: 'واتساب', 'quick-buy': 'شراء سريع' };

function OrderDetailsDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const dialogRef = useModalAccessibility(onClose);
  const items = order.items || [];
  const sourceLabel = ORDER_SOURCE_LABEL[order.source ?? 'storefront'];
  const subtotal = Number(order.subtotal) || items.reduce((sum, item) => sum + (Number(item.lineTotal) || (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)), 0);

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="modal order-details-modal" role="dialog" aria-modal="true" aria-labelledby="order-details-title">
    <div className="modal-head"><div><span className="eyebrow">تفاصيل الطلب</span><h2 id="order-details-title">#{order.id.slice(-6).toUpperCase()}</h2></div><button className="icon-button" type="button" title="إغلاق" onClick={onClose}><X size={19} /></button></div>
    <div className="order-detail-columns">
      <section className="order-detail-section"><h3>بيانات العميل</h3><strong>{order.customerName || 'عميل جديد'}</strong>{order.customerPhone && <a href={`tel:${order.customerPhone}`} dir="ltr"><Phone size={14} />{order.customerPhone}</a>}{order.customerEmail && <a href={`mailto:${order.customerEmail}`} dir="ltr"><Mail size={14} />{order.customerEmail}</a>}</section>
      <section className="order-detail-section"><h3>التوصيل</h3><strong>{[order.shippingArea, order.city].filter(Boolean).join('، ') || 'منطقة غير محددة'}</strong>{order.address && <p>{order.address}</p>}{order.customerPhone && <a href={whatsappHref(order.customerPhone)} target="_blank" rel="noreferrer"><Send size={14} />مراسلة العميل على واتساب</a>}{order.shippingPending && <div className="order-shipping-pending"><MapPin size={14} /> تكلفة وموعد الشحن بانتظار التأكيد</div>}</section>
    </div>
    <section className="order-detail-section order-lines-section"><div className="order-lines-heading"><h3>القطع المطلوبة</h3><span>{order.itemsCount || 0} قطعة</span></div>{items.length ? <div className="order-detail-items">{items.map((item, index) => <div className="order-detail-line" key={`${item.productId || item.sku || item.productName}-${index}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.productName || 'صورة المنتج'} /> : <span className="order-detail-placeholder"><Package size={18} /></span>}<span className="order-detail-product"><strong>{item.productName || 'منتج'}</strong><small>{item.sku || '—'} · كمية {item.quantity || 0}</small></span><strong className="order-detail-line-total">{money.format(Number(item.lineTotal) || (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))}</strong></div>)}</div> : <p className="muted">تفاصيل القطع غير متاحة لهذا الطلب القديم.</p>}</section>
    <div className="order-detail-totals"><div><span>قيمة المنتجات</span><strong>{money.format(subtotal || Number(order.total) || 0)}</strong></div><div><span>الشحن</span><strong>{order.shippingPending ? 'بانتظار التأكيد' : money.format(Number(order.shippingCost) || 0)}</strong></div><div className="order-detail-grand-total"><span>{order.shippingPending ? 'الإجمالي قبل الشحن' : 'الإجمالي'}</span><strong>{money.format(Number(order.total) || 0)}</strong></div></div>
  </section></div>;
}

function CustomersTable({ customers }: { customers: Customer[] }) {
  if (!customers.length) return <EmptyState icon={UsersRound} title="لسه مفيش عملاء مسجلين" body="العملاء الجدد هيظهروا هنا مع بيانات التواصل وسجل الطلبات." />;
  return <div className="table-scroll"><table><thead><tr><th>العميل</th><th>رقم الهاتف</th><th>البريد الإلكتروني</th><th>الطلبات</th><th>إجمالي المشتريات</th></tr></thead><tbody>{customers.map((customer, index) => <tr key={customer.id}><td><div className="customer-cell"><span className={`customer-avatar customer-${index % 5}`}>{initials(customer.name || 'ع')}</span><span><strong>{customer.name || 'عميل جديد'}</strong><small>عميل منذ {formatDate(customer.createdAt?.seconds)}</small></span></div></td><td>{customer.phone || '—'}</td><td className="muted">{customer.email || '—'}</td><td>{customer.ordersCount ?? 0}</td><td className="price-cell">{money.format(Number(customer.totalSpent) || 0)}</td></tr>)}</tbody></table></div>;
}

function OverviewChart({ orders }: { orders: Order[] }) {
  const days = useMemo(() => {
    const today = new Date();
    const result = Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() - 6 + index); return { date, total: 0 }; });
    orders.forEach((order) => { if (!order.createdAt?.seconds) return; const date = new Date(order.createdAt.seconds * 1000); const target = result.find((day) => day.date.toDateString() === date.toDateString()); if (target) target.total += Number(order.total) || 0; });
    const max = Math.max(...result.map((day) => day.total), 1);
    return result.map((day) => ({ ...day, height: Math.max((day.total / max) * 100, day.total ? 12 : 3) }));
  }, [orders]);
  return <div className="chart-wrap"><div className="chart-legend"><span><i /> قيمة الطلبات</span><span>آخر ٧ أيام</span></div><div className="bar-chart">{days.map((day, index) => <div className="bar-group" key={day.date.toISOString()}><span className="bar-value">{day.total ? new Intl.NumberFormat('ar-EG', { notation: 'compact', maximumFractionDigits: 1 }).format(day.total) : ''}</span><div className="bar-track"><i className={index === 6 ? 'bar-current' : ''} style={{ height: `${day.height}%` }} /></div><span className="bar-day">{new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(day.date)}</span></div>)}</div></div>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [page, setPage] = useState<Page>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CatalogEntry[]>([]);
  const [brands, setBrands] = useState<CatalogEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [infoPages, setInfoPages] = useState<InfoPage[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [workshopProfile, setWorkshopProfile] = useState<WorkshopProfile>(defaultWorkshopProfile);
  const [offerModal, setOfferModal] = useState<Offer | null | undefined>(undefined);
  const [catalogModal, setCatalogModal] = useState<{ kind: CatalogKind; entry?: CatalogEntry } | null>(null);
  const [dataError, setDataError] = useState('');
  const [query, setQuery] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productBrandFilter, setProductBrandFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [offerStatusFilter, setOfferStatusFilter] = useState('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [workshopMenuOpen, setWorkshopMenuOpen] = useState(false);
  const [busyOrder, setBusyOrder] = useState('');
  const [toast, setToast] = useState('');
  const [uidCopied, setUidCopied] = useState(false);
  const [supplierModal, setSupplierModal] = useState<Supplier | null | undefined>(undefined);
  const [shippingModal, setShippingModal] = useState<ShippingRate | null | undefined>(undefined);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(false);
      setUser(currentUser);
      setAuthorized(false);
      setAuthNotice('');
      if (!currentUser) { if (mounted) setAuthReady(true); return; }
      try {
        const admin = await getDoc(doc(db, 'admins', currentUser.uid));
        if (mounted) setAuthorized(admin.exists() && admin.data().active === true);
      } catch (error) { if (mounted) setAuthNotice(getErrorMessage(error)); }
      finally { if (mounted) setAuthReady(true); }
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('page') as Page | null;
    if (requested && requested in pageCopy) setPage(requested);
    const highlight = params.get('highlight');
    if (highlight) {
      setHighlightedProductId(highlight);
      window.setTimeout(() => setHighlightedProductId(null), 4000);
      document.querySelector(`[data-product-row="${highlight}"]`)?.scrollIntoView({ block: 'center' });
    }
  }, []);

  useEffect(() => {
    if (!user || !authorized) return;
    setDataError('');
    const onCollectionError = (name: string) => (error: Error) => {
      const code = 'code' in error ? String(error.code) : '';
      setDataError(code.includes('permission-denied')
        ? `Firebase رفض الوصول إلى مجموعة «${name}». انشر قواعد firestore.rules الحالية، وتأكد أن admins/${user.uid} يحتوي active من النوع Boolean بقيمة true.`
        : getErrorMessage(error));
    };
    const stopProducts = onSnapshot(collection(db, 'products'), (snapshot) => setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)), onCollectionError('products'));
    const stopOrders = onSnapshot(collection(db, 'orders'), (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Order)), onCollectionError('orders'));
    const stopCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => setCustomers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Customer)), onCollectionError('customers'));
    const stopCategories = onSnapshot(collection(db, 'categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), isActive: item.data().isActive !== false }) as CatalogEntry)), onCollectionError('categories'));
    const stopBrands = onSnapshot(collection(db, 'brands'), (snapshot) => setBrands(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), isActive: item.data().isActive !== false }) as CatalogEntry)), onCollectionError('brands'));
    const stopSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => setSuppliers(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), isActive: item.data().isActive !== false }) as Supplier)), onCollectionError('suppliers'));
    const stopPurchases = onSnapshot(collection(db, 'purchases'), (snapshot) => setPurchases(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Purchase)), onCollectionError('purchases'));
    const stopShippingRates = onSnapshot(collection(db, 'shippingRates'), (snapshot) => setShippingRates(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), isActive: item.data().isActive !== false }) as ShippingRate)), onCollectionError('shippingRates'));
    const stopReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => setReviews(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Review)), onCollectionError('reviews'));
    const stopOffers = onSnapshot(collection(db, 'offers'), (snapshot) => setOffers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Offer)), onCollectionError('offers'));
    const stopMessages = onSnapshot(fsQuery(collection(db, 'messages'), orderBy('createdAt', 'desc'), fbLimit(200)), (snapshot) => setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Message)), onCollectionError('messages'));
    const stopSubscribers = onSnapshot(fsQuery(collection(db, 'newsletter'), orderBy('createdAt', 'desc'), fbLimit(2000)), (snapshot) => setSubscribers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Subscriber)), onCollectionError('newsletter'));
    const stopSearchLogs = onSnapshot(fsQuery(collection(db, 'searchLogs'), orderBy('createdAt', 'desc'), fbLimit(500)), (snapshot) => setSearchLogs(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SearchLog)), onCollectionError('searchLogs'));
    const stopProductStats = onSnapshot(collection(db, 'productStats'), (snapshot) => setProductStats(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ProductStat)), onCollectionError('productStats'));
    const stopDailyStats = onSnapshot(fsQuery(collection(db, 'dailyStats'), orderBy('date', 'desc'), fbLimit(90)), (snapshot) => setDailyStats(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DailyStat)), onCollectionError('dailyStats'));
    const stopBlogPosts = onSnapshot(fsQuery(collection(db, 'blogPosts'), orderBy('publishedAt', 'desc'), fbLimit(100)), (snapshot) => setBlogPosts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BlogPost)), onCollectionError('blogPosts'));
    const stopInfoPages = onSnapshot(collection(db, 'pages'), (snapshot) => setInfoPages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as InfoPage)), onCollectionError('pages'));
    const stopWorkshopProfile = onSnapshot(doc(db, 'workshopSettings', 'main'), (snapshot) => setWorkshopProfile({ ...defaultWorkshopProfile, ...(snapshot.exists() ? snapshot.data() : {}) }), onCollectionError('workshopSettings'));
    return () => { stopProducts(); stopMessages(); stopSubscribers(); stopSearchLogs(); stopProductStats(); stopDailyStats(); stopBlogPosts(); stopInfoPages(); stopOrders(); stopCustomers(); stopCategories(); stopBrands(); stopSuppliers(); stopPurchases(); stopShippingRates(); stopReviews(); stopOffers(); stopWorkshopProfile(); };
  }, [user, authorized]);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'price-percent' | 'price-set' | 'stock-set' | ''>('');
  const [bulkValue, setBulkValue] = useState('');
  const productStatMap = useMemo(() => Object.fromEntries(productStats.map((stat) => [stat.productId ?? stat.id ?? '', { views: stat.views ?? 0, carts: stat.carts ?? 0 }])), [productStats]);
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('ar');
    return products.filter((product) => {
      const category = categories.find((entry) => entry.id === product.categoryId)?.name || product.category;
      const brand = brands.find((entry) => entry.id === product.brandId)?.name || product.brand;
      const categoryMatches = productCategoryFilter === 'all' || product.categoryId === productCategoryFilter || (!product.categoryId && category === categories.find((entry) => entry.id === productCategoryFilter)?.name);
      const brandMatches = productBrandFilter === 'all' || product.brandId === productBrandFilter || (!product.brandId && brand === brands.find((entry) => entry.id === productBrandFilter)?.name);
      const stock = Number(product.stock) || 0;
      const stockMatches = stockFilter === 'all' || (stockFilter === 'low' ? stock <= 5 : stock > 5);
      return categoryMatches && brandMatches && stockMatches && (!term || [product.name, product.sku, category, brand, product.offerTitle].some((value) => value?.toLocaleLowerCase('ar').includes(term)));
    });
  }, [products, page, query, categories, brands, productCategoryFilter, productBrandFilter, stockFilter]);
  const filteredOrders = useMemo(() => orders.filter((order) => (orderStatusFilter === 'all' || (order.status || 'جديد') === orderStatusFilter) && (!query || [order.id, order.customerName, order.customerPhone].some((value) => value?.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar'))))), [orders, query, orderStatusFilter]);
  const filteredCustomers = useMemo(() => customers.filter((customer) => !query || [customer.name, customer.email, customer.phone].some((value) => value?.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar')))), [customers, query]);
  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) => !query || [supplier.name, supplier.contactName, supplier.phone, supplier.email].some((value) => value?.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar')))), [suppliers, query]);
  const filteredPurchases = useMemo(() => purchases.filter((purchase) => !query || [purchase.id, purchase.supplierName].some((value) => value?.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar')))), [purchases, query]);
  const filteredShippingRates = useMemo(() => shippingRates.filter((rate) => !query || rate.area.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar'))), [shippingRates, query]);
  const filteredReviews = useMemo(() => reviews.filter((review) => !query || [review.customerName, review.productName, review.comment].some((value) => value?.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar')))), [reviews, query]);
  const filteredOffers = useMemo(() => offers.filter((offer) => {
    const matchesStatus = offerStatusFilter === 'all' || getOfferState(offer) === offerStatusFilter;
    const matchesQuery = !query || [offer.title, offer.description || ''].some((value) => value.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar')));
    return matchesStatus && matchesQuery;
  }), [offers, query, offerStatusFilter]);
  const globalSearchResults = useMemo(() => {
    const term = globalSearchQuery.trim().toLocaleLowerCase('ar');
    if (term.length < 2) return [];
    const includes = (...values: Array<string | number | undefined>) => values.some((value) => String(value ?? '').toLocaleLowerCase('ar').includes(term));
    const results: GlobalSearchResult[] = [
      ...products.filter((item) => includes(item.name, item.sku, item.brand, item.category)).map((item) => ({ id: item.id, title: item.name, detail: `${item.sku} · ${item.brand} · ${money.format(item.price)}`, type: 'منتج', page: 'products' as Page, query: item.name })),
      ...orders.filter((item) => includes(item.id, item.customerName, item.customerPhone)).map((item) => ({ id: item.id, title: `طلب #${item.id.slice(-6).toUpperCase()}`, detail: `${item.customerName || 'عميل'} · ${item.status || 'جديد'}`, type: 'طلب', page: 'orders' as Page, query: item.id.slice(-6) })),
      ...customers.filter((item) => includes(item.name, item.phone, item.email)).map((item) => ({ id: item.id, title: item.name || 'عميل', detail: item.phone || item.email || 'بيانات عميل', type: 'عميل', page: 'customers' as Page, query: item.name || item.phone || term })),
      ...suppliers.filter((item) => includes(item.name, item.contactName, item.phone, item.email)).map((item) => ({ id: item.id, title: item.name, detail: item.phone || item.contactName || 'مورد', type: 'مورد', page: 'suppliers' as Page, query: item.name })),
      ...categories.filter((item) => includes(item.name, item.description)).map((item) => ({ id: item.id, title: item.name, detail: 'تصنيف منتجات', type: 'تصنيف', page: 'categories' as Page, query: item.name })),
      ...brands.filter((item) => includes(item.name, item.description)).map((item) => ({ id: item.id, title: item.name, detail: 'علامة تجارية', type: 'علامة', page: 'brands' as Page, query: item.name })),
      ...offers.filter((item) => includes(item.title, item.description)).map((item) => ({ id: item.id, title: item.title, detail: `${item.discountType === 'percentage' ? `${item.discountValue}%` : money.format(item.discountValue)} · ${getOfferState(item)}`, type: 'عرض', page: 'offers' as Page, query: item.title })),
      ...reviews.filter((item) => includes(item.customerName, item.productName, item.comment)).map((item) => ({ id: item.id, title: item.productName || 'تقييم', detail: `${item.customerName || 'عميل'} · ${item.rating}/5`, type: 'تقييم', page: 'reviews' as Page, query: item.customerName || item.productName || term })),
      ...shippingRates.filter((item) => includes(item.area)).map((item) => ({ id: item.id, title: item.area, detail: `شحن ${money.format(item.price)}`, type: 'شحن', page: 'shippingRates' as Page, query: item.area })),
      ...([workshopProfile.name, workshopProfile.address, workshopProfile.city, workshopProfile.governorate].some((value) => includes(value)) ? [{ id: 'main', title: workshopProfile.name, detail: [workshopProfile.city, workshopProfile.governorate].filter(Boolean).join('، '), type: 'الورشة', page: 'workshopSettings' as Page, query: term }] : []),
    ];
    return results.slice(0, 30);
  }, [globalSearchQuery, products, orders, customers, suppliers, categories, brands, offers, reviews, shippingRates]);
  const pendingOrders = orders.filter((order) => order.status !== 'مكتمل' && order.status !== 'ملغي').length;
  const revenue = orders.filter((order) => order.status !== 'ملغي').reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const lowStock = products.filter((product) => Number(product.stock) <= 5).length;
  const brandCount = brands.length;
  const categoryCount = categories.length;

  function offerHasConflict(value: Pick<Offer, 'productIds' | 'startsOn' | 'endsOn'>, id?: string) {
    const productSet = new Set(value.productIds);
    return offers.some((existing) => {
      if (existing.id === id || !existing.isActive) return false;
      const datesOverlap = value.startsOn <= existing.endsOn && value.endsOn >= existing.startsOn;
      return datesOverlap && existing.productIds.some((productId) => productSet.has(productId));
    });
  }
  function toggleProductSelection(productId: string) {
    setSelectedProductIds((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]));
  }

  function toggleSelectAllProducts() {
    setSelectedProductIds((current) => (current.length === filteredProducts.length ? [] : filteredProducts.map((product) => product.id)));
  }

  async function quickSaveProduct(productId: string, patch: Record<string, unknown>) {
    await updateDoc(doc(db, 'products', productId), { ...patch, updatedAt: serverTimestamp() });
  }

  async function duplicateProduct(product: Product) {
    const { id, ...rest } = product;
    void id;
    await addDoc(collection(db, 'products'), {
      ...rest,
      name: `${product.name} (نسخة)`,
      sku: `${product.sku}-COPY${Math.floor(Math.random() * 90 + 10)}`,
      stock: 0,
      createdAt: serverTimestamp(),
    });
    setToast('تم تكرار المنتج.');
  }

  async function applyBulkAction() {
    const ids = selectedProductIds;
    const value = Number(bulkValue);
    if (!ids.length || !bulkAction || !Number.isFinite(value)) { setToast('اختر منتجات واكتب قيمة صحيحة.'); return; }
    setConfirmation({
      title: 'تعديل جماعي؟',
      message: `هيتعدّل ${ids.length} منتج: ${bulkAction === 'price-percent' ? `${value}% على السعر` : bulkAction === 'price-set' ? `سعر ${value}` : `مخزون ${value}`}.`,
      confirmLabel: 'تطبيق',
      onConfirm: async () => {
        const batch = writeBatch(db);
        for (const productId of ids) {
          const product = products.find((entry) => entry.id === productId);
          if (!product) continue;
          const patch: Record<string, unknown> = {};
          if (bulkAction === 'price-percent') patch.price = Math.max(0, Math.round((Number(product.price) || 0) * (1 + value / 100)));
          if (bulkAction === 'price-set') patch.price = value;
          if (bulkAction === 'stock-set') patch.stock = value;
          batch.update(doc(db, 'products', productId), { ...patch, updatedAt: serverTimestamp() });
        }
        await batch.commit();
        setSelectedProductIds([]);
        setBulkValue('');
        setToast('تم التعديل على المنتجات المختارة.');
      },
    });
  }

  async function saveOffer(value: Omit<Offer, 'id'>, id?: string) {
    if (value.isActive && offerHasConflict(value, id)) throw new Error('يوجد عرض مفعّل على قطعة مختارة خلال جزء من هذه المدة. أزل القطعة من العرض الآخر أو غيّر التواريخ.');
    if (id) await updateDoc(doc(db, 'offers', id), { ...value, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, 'offers'), { ...value, createdAt: serverTimestamp() });
    setToast(id ? 'تم تحديث حملة الخصم.' : 'تم إنشاء حملة الخصم.');
  }
  async function toggleOffer(offer: Offer) {
    if (!offer.isActive) {
      if (offerHasConflict(offer, offer.id)) { setDataError('لا يمكن تفعيل العرض: توجد حملة أخرى على قطعة مختارة خلال نفس المدة.'); return; }
      try { await updateDoc(doc(db, 'offers', offer.id), { isActive: true, updatedAt: serverTimestamp() }); setToast('تم تفعيل العرض.'); }
      catch (error) { setDataError(error instanceof Error ? error.message : getErrorMessage(error)); }
      return;
    }
    try { await updateDoc(doc(db, 'offers', offer.id), { isActive: false, updatedAt: serverTimestamp() }); setToast('تم إيقاف العرض.'); }
    catch (error) { setDataError(getErrorMessage(error)); }
  }
  async function deleteOffer(offer: Offer) {
    setConfirmation({ title: 'حذف العرض؟', message: `سيُحذف العرض «${offer.title}» نهائياً من الحملات. لا يمكن التراجع عن هذا الإجراء.`, confirmLabel: 'حذف العرض', onConfirm: async () => { await deleteDoc(doc(db, 'offers', offer.id)); setToast('تم حذف العرض.'); } });
  }
  async function saveCatalog(kind: CatalogKind, value: Omit<CatalogEntry, 'id'>, id?: string) {
    const entries = kind === 'categories' ? categories : brands;
    const duplicate = entries.some((entry) => entry.id !== id && normalizeLabel(entry.name) === normalizeLabel(value.name));
    if (duplicate) throw new Error(`الاسم «${value.name}» موجود بالفعل.`);

    const current = id ? entries.find((entry) => entry.id === id) : undefined;
    if (current && normalizeLabel(current.name) !== normalizeLabel(value.name)) {
      const legacyProducts = products.filter((product) => {
        const relationId = kind === 'categories' ? product.categoryId : product.brandId;
        const label = kind === 'categories' ? product.category : product.brand;
        return !relationId && normalizeLabel(label || '') === normalizeLabel(current.name);
      });
      for (let offset = 0; offset < legacyProducts.length; offset += 450) {
        const batch = writeBatch(db);
        legacyProducts.slice(offset, offset + 450).forEach((product) => {
          const field = kind === 'categories' ? 'categoryId' : 'brandId';
          batch.update(doc(db, 'products', product.id), { [field]: id });
        });
        await batch.commit();
      }
    }

    if (id) await updateDoc(doc(db, kind, id), { ...value, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, kind), { ...value, createdAt: serverTimestamp() });
    setToast(id ? 'تم تحديث بيانات السجل.' : 'تمت إضافة السجل للكتالوج.');
  }
  async function saveSupplier(values: Record<string, string>, id?: string) {
    const name = values.name.trim();
    if (suppliers.some((supplier) => supplier.id !== id && normalizeLabel(supplier.name) === normalizeLabel(name))) throw new Error('اسم المورد مسجل بالفعل.');
    const current = suppliers.find((supplier) => supplier.id === id);
    const payload = { name, contactName: values.contactName.trim(), phone: values.phone.trim(), email: values.email.trim(), address: values.address.trim(), notes: values.notes.trim(), isActive: current?.isActive ?? true };
    if (id) await updateDoc(doc(db, 'suppliers', id), { ...payload, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, 'suppliers'), { ...payload, createdAt: serverTimestamp() });
    setToast(id ? 'تم تحديث بيانات المورد.' : 'تمت إضافة المورد.');
  }
  async function toggleSupplier(supplier: Supplier) {
    try { await updateDoc(doc(db, 'suppliers', supplier.id), { isActive: !supplier.isActive, updatedAt: serverTimestamp() }); setToast(supplier.isActive ? 'تمت أرشفة المورد.' : 'تمت إعادة تفعيل المورد.'); }
    catch (error) { setDataError(getErrorMessage(error)); }
  }
  async function deleteSupplier(supplier: Supplier) {
    if (purchases.some((purchase) => purchase.supplierId === supplier.id)) { setDataError('المورد مرتبط بفواتير شراء؛ يمكنك أرشفته بدلاً من حذفه.'); return; }
    setConfirmation({ title: 'حذف المورد؟', message: `سيُحذف المورد «${supplier.name}» من قائمة الموردين.`, confirmLabel: 'حذف المورد', onConfirm: async () => { await deleteDoc(doc(db, 'suppliers', supplier.id)); setToast('تم حذف المورد.'); } });
  }
  async function savePurchase(supplierId: string, lines: PurchaseLine[]) {
    const supplier = suppliers.find((item) => item.id === supplierId && item.isActive);
    if (!supplier) throw new Error('المورد غير متاح. حدّث القائمة وحاول مرة أخرى.');
    if (lines.some((line) => !products.some((product) => product.id === line.productId))) throw new Error('أحد المنتجات لم يعد موجوداً. حدّث الصفحة وحاول مرة أخرى.');
    const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const purchaseRef = doc(collection(db, 'purchases'));
    const batch = writeBatch(db);
    batch.set(purchaseRef, { supplierId, supplierName: supplier.name, items: lines, total, status: 'مستلمة', createdAt: serverTimestamp() });
    const quantityByProduct = new Map<string, number>();
    lines.forEach((line) => quantityByProduct.set(line.productId, (quantityByProduct.get(line.productId) || 0) + line.quantity));
    quantityByProduct.forEach((quantity, productId) => batch.update(doc(db, 'products', productId), { stock: increment(quantity), updatedAt: serverTimestamp() }));
    await batch.commit();
    setToast('تم تسجيل الفاتورة وتحديث المخزون.');
  }
  async function saveShippingRate(values: Record<string, string>, id?: string) {
    const area = values.area.trim();
    if (shippingRates.some((rate) => rate.id !== id && normalizeLabel(rate.area) === normalizeLabel(area))) throw new Error('المنطقة مسجلة بالفعل.');
    const payload = { area, price: Number(values.price), deliveryDays: Number(values.deliveryDays), isActive: shippingRates.find((rate) => rate.id === id)?.isActive ?? true };
    if (!Number.isFinite(payload.price) || payload.price < 0 || !Number.isInteger(payload.deliveryDays) || payload.deliveryDays < 1) throw new Error('أدخل سعراً صحيحاً ومدة توصيل لا تقل عن يوم.');
    if (id) await updateDoc(doc(db, 'shippingRates', id), { ...payload, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, 'shippingRates'), { ...payload, createdAt: serverTimestamp() });
    setToast(id ? 'تم تحديث سعر الشحن.' : 'تمت إضافة منطقة الشحن.');
  }
  async function setMessageStatus(messageId: string, status: string) {
    try { await updateDoc(doc(db, 'messages', messageId), { status, readAt: serverTimestamp() }); setToast('تم تحديث حالة الرسالة.'); }
    catch (error) { setDataError(getErrorMessage(error)); }
  }
  async function deleteMessage(messageId: string) {
    setConfirmation({ title: 'حذف الرسالة؟', message: 'مش هينفع ترجعها بعد الحذف.', confirmLabel: 'حذف', onConfirm: async () => { await deleteDoc(doc(db, 'messages', messageId)); setToast('تم حذف الرسالة.'); } });
  }
  async function deleteSubscriber(subscriberId: string) {
    await deleteDoc(doc(db, 'newsletter', subscriberId)); setToast('تم حذف المشترك.');
  }
  async function saveBlogPost(postId: string | null, data: Record<string, unknown>) {
    const payload = { ...(data as Record<string, string | number | boolean>), updatedAt: serverTimestamp() };
    if (postId) await updateDoc(doc(db, 'blogPosts', postId), payload);
    else await addDoc(collection(db, 'blogPosts'), { ...payload, createdAt: serverTimestamp() });
    setToast(postId ? 'تم تحديث المقال.' : 'تم نشر المقال.');
  }
  async function deleteBlogPost(postId: string) {
    setConfirmation({ title: 'حذف المقال؟', message: 'المقال هيختفي من الموقع.', confirmLabel: 'حذف', onConfirm: async () => { await deleteDoc(doc(db, 'blogPosts', postId)); setToast('تم حذف المقال.'); } });
  }
  async function saveInfoPage(pageId: string | null, data: Record<string, unknown>) {
    const payload = { ...(data as Record<string, string | boolean>) };
    if (pageId) await updateDoc(doc(db, 'pages', pageId), payload);
    else await addDoc(collection(db, 'pages'), payload);
    setToast(pageId ? 'تم تحديث الصفحة.' : 'تمت إضافة الصفحة.');
  }
  async function deleteInfoPage(pageId: string) {
    setConfirmation({ title: 'حذف الصفحة؟', message: 'الصفحة هتختفي من الموقع.', confirmLabel: 'حذف', onConfirm: async () => { await deleteDoc(doc(db, 'pages', pageId)); setToast('تم حذف الصفحة.'); } });
  }
  async function saveWorkshopProfile(profile: WorkshopProfile) {
    const requiredName = profile.name.trim();
    if (!requiredName) throw new Error('اكتب اسم العلامة أولاً.');
    const publicUrls = [profile.websiteUrl, profile.mapUrl, profile.instagram, profile.facebook, profile.tiktok, profile.youtube, profile.x, profile.threads, profile.linkedin, profile.pinterest].filter(Boolean);
    if (publicUrls.some((value) => {
      try { return !['http:', 'https:'].includes(new URL(normalizePublicUrl(value)).protocol); }
      catch { return true; }
    })) throw new Error('تأكد من صحة رابط واجهة المتجر والخريطة وروابط التواصل.');
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) throw new Error('صيغة البريد الإلكتروني غير صحيحة.');
    const saved = { ...profile, name: requiredName, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'workshopSettings', 'main'), saved, { merge: true });
    setToast('تم حفظ بيانات العلامة، وأصبحت متاحة لواجهة الموقع.');
  }
  async function toggleShippingRate(rate: ShippingRate) {
    try { await updateDoc(doc(db, 'shippingRates', rate.id), { isActive: !rate.isActive, updatedAt: serverTimestamp() }); setToast(rate.isActive ? 'تم إيقاف منطقة الشحن.' : 'تم تفعيل منطقة الشحن.'); }
    catch (error) { setDataError(getErrorMessage(error)); }
  }
  async function deleteShippingRate(rate: ShippingRate) {
    setConfirmation({ title: 'حذف منطقة الشحن؟', message: `سيتم حذف سعر التوصيل لمنطقة «${rate.area}».`, confirmLabel: 'حذف المنطقة', onConfirm: async () => { await deleteDoc(doc(db, 'shippingRates', rate.id)); setToast('تم حذف منطقة الشحن.'); } });
  }
  async function setReviewStatus(reviewId: string, status: Review['status']) {
    try { await updateDoc(doc(db, 'reviews', reviewId), { status, moderatedAt: serverTimestamp() }); setToast('تم تحديث حالة التقييم.'); }
    catch (error) { setDataError(getErrorMessage(error)); }
  }
  function catalogUsage(kind: CatalogKind, entry: CatalogEntry) {
    return products.filter((product) => {
      const relationId = kind === 'categories' ? product.categoryId : product.brandId;
      const label = kind === 'categories' ? product.category : product.brand;
      return relationId === entry.id || (!relationId && normalizeLabel(label || '') === normalizeLabel(entry.name));
    }).length;
  }
  async function toggleCatalogEntry(kind: CatalogKind, entry: CatalogEntry) {
    try {
      await updateDoc(doc(db, kind, entry.id), { isActive: !entry.isActive, updatedAt: serverTimestamp() });
      setToast(entry.isActive ? 'تمت أرشفة السجل، وسيظل مرتبطاً بمنتجاته.' : 'تمت إعادة تفعيل السجل.');
    } catch (error) { setDataError(getErrorMessage(error)); }
  }
  async function deleteCatalogEntry(kind: CatalogKind, entry: CatalogEntry) {
    const usage = catalogUsage(kind, entry);
    if (usage) { setDataError(`لا يمكن حذف هذا السجل لأنه مرتبط بـ ${usage} منتج. يمكنك أرشفته بدلاً من ذلك.`); return; }
    setConfirmation({ title: `حذف ${kind === 'categories' ? 'التصنيف' : 'العلامة'}؟`, message: `سيُحذف «${entry.name}» نهائياً من الكتالوج.`, confirmLabel: 'حذف', onConfirm: async () => { await deleteDoc(doc(db, kind, entry.id)); setToast('تم حذف السجل.'); } });
  }
  async function deleteProduct(product: Product) {
    setConfirmation({ title: 'حذف المنتج؟', message: `سيُحذف «${product.name}» من الكتالوج. سيبقى أي عرض مرتبط به مسجلاً، لكن لن ينطبق على المنتج المحذوف.`, confirmLabel: 'حذف المنتج', onConfirm: async () => { await deleteDoc(doc(db, 'products', product.id)); setToast('تم حذف المنتج.'); } });
  }
  async function setOrderStatus(id: string, status: OrderStatus) {
    setBusyOrder(id);
    try { await updateDoc(doc(db, 'orders', id), { status, updatedAt: serverTimestamp() }); setToast('تم تحديث حالة الطلب.'); }
    catch (error) { setDataError(getErrorMessage(error)); }
    finally { setBusyOrder(''); }
  }
  async function exit() {
    await signOut(auth);
    setAuthorized(false);
    setProducts([]);
    setOrders([]);
    setCustomers([]);
  }
  function openGlobalSearch() {
    setGlobalSearchQuery('');
    setGlobalSearchOpen(true);
  }
  function selectGlobalSearchResult(result: GlobalSearchResult) {
    setPage(result.page);
    setQuery(result.query);
    setProductCategoryFilter('all');
    setProductBrandFilter('all');
    setStockFilter('all');
    setOrderStatusFilter('all');
    setOfferStatusFilter('all');
    setGlobalSearchOpen(false);
    setGlobalSearchQuery('');
  }

  if (!authReady) return <main className="loading-screen"><div className="loading-mark">R/</div><span>جارٍ تجهيز مساحة العمل...</span></main>;
  if (!user) return <Login message={authNotice} />;
  if (!authorized) return <main className="access-denied"><div className="denied-mark">R/</div><span className="eyebrow">حساب غير مصرّح</span><h1>هذه المساحة للفريق فقط</h1><p>{authNotice || 'تم تسجيل الدخول، لكن هذا الحساب غير مضاف إلى قائمة مديري المتجر.'}</p><div className="admin-identity"><span>{user.email}</span><code dir="ltr">{user.uid}</code><button className="button button-quiet" onClick={async () => { try { await navigator.clipboard.writeText(user.uid); setUidCopied(true); } catch { setUidCopied(false); } }}><Copy size={15} /> {uidCopied ? 'تم نسخ UID' : 'نسخ UID'}</button></div><button className="button button-dark" onClick={exit}><LogOut size={16} /> تسجيل الخروج</button></main>;

  const pageActions = page === 'products' ? <Link className="button button-lime" href="/products/new"><Plus size={17} /> منتج جديد</Link> : page === 'offers' ? <button className="button button-lime" onClick={() => setOfferModal(null)}><Plus size={17} /> عرض جديد</button> : page === 'categories' || page === 'brands' ? <button className="button button-lime" onClick={() => setCatalogModal({ kind: page })}><Plus size={17} /> {page === 'categories' ? 'تصنيف جديد' : 'علامة جديدة'}</button> : page === 'suppliers' ? <button className="button button-lime" onClick={() => setSupplierModal(null)}><Plus size={17} /> مورد جديد</button> : page === 'shippingRates' ? <button className="button button-lime" onClick={() => setShippingModal(null)}><Plus size={17} /> منطقة جديدة</button> : page === 'overview' ? <Link className="button button-dark" href="/products/new"><Plus size={17} /> إضافة منتج</Link> : undefined;
  const recentOrders = [...orders].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  const resolvedProducts = filteredProducts.map((product) => {
    const activeOffers = offers.filter((offer) => getOfferState(offer, today) === 'نشط' && offer.productIds.includes(product.id));
    const offerPrices = activeOffers.map((offer) => ({
      price: offer.discountType === 'percentage' ? product.price * (1 - offer.discountValue / 100) : product.price - offer.discountValue,
      title: offer.title,
    }));
    const candidates = [
      ...(product.salePrice && product.salePrice < product.price ? [{ price: product.salePrice, title: 'سعر خاص' }] : []),
      ...offerPrices,
    ].filter((candidate) => candidate.price > 0);
    const bestOffer = candidates.sort((left, right) => left.price - right.price)[0];
    return {
      ...product,
      category: categories.find((entry) => entry.id === product.categoryId)?.name || product.category,
      brand: brands.find((entry) => entry.id === product.brandId)?.name || product.brand,
      salePrice: bestOffer?.price,
      offerTitle: bestOffer?.title,
    };
  });

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup">{workshopProfile.websiteUrl ? <a className="brand-home-link" href={normalizePublicUrl(workshopProfile.websiteUrl)} target="_blank" rel="noreferrer" aria-label="فتح موقع R/ONE"><BrandLogo size={30} /><span className="brand-copy">ONE<small>R/ONE</small></span></a> : <button className="brand-home-link brand-home-button" type="button" onClick={() => setPage('overview')} aria-label="العودة إلى لوحة المتابعة"><BrandLogo size={30} /><span className="brand-copy">ONE<small>R/ONE</small></span></button>}<button className="mobile-close icon-button" onClick={() => setMobileNavOpen(false)} title="إغلاق القائمة"><X size={18} /></button></div>
      <div className="workspace-switcher" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setWorkshopMenuOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') setWorkshopMenuOpen(false); }}>
        <button className="workspace-picker" type="button" aria-expanded={workshopMenuOpen} aria-controls="workshop-menu" onClick={() => setWorkshopMenuOpen((open) => !open)}>
          <span className="workspace-avatar">{(workshopProfile.name || 'R').trim().slice(0, 1)}</span>
          <span className="workspace-label"><strong>{workshopProfile.name || 'R/ONE'}</strong><small>{[workshopProfile.city, workshopProfile.governorate].filter(Boolean).join('، ') || 'أضف موقع العلامة'}</small></span>
          <ChevronDown className={workshopMenuOpen ? 'workspace-chevron workspace-chevron-open' : 'workspace-chevron'} size={15} />
        </button>
        {workshopMenuOpen && <div className="workspace-menu" id="workshop-menu" role="region" aria-label="تفاصيل العلامة">
          <div className="workspace-menu-heading"><span className="workspace-live-dot" /> بيانات العلامة</div>
          {workshopProfile.description && <p className="workspace-menu-description">{workshopProfile.description}</p>}
          {[workshopProfile.address, [workshopProfile.city, workshopProfile.governorate].filter(Boolean).join('، ')].filter(Boolean).map((line) => <div className="workspace-detail" key={line}><MapPin size={14} /><span>{line}</span></div>)}
          {workshopProfile.phone && <a className="workspace-detail" href={`tel:${workshopProfile.phone}`}><Phone size={14} /><span dir="ltr">{workshopProfile.phone}</span></a>}
          {workshopProfile.whatsapp && <a className="workspace-detail" href={whatsappHref(workshopProfile.whatsapp)} target="_blank" rel="noreferrer"><Send size={14} /><span>تواصل واتساب</span><ArrowUpLeft size={12} /></a>}
          {workshopProfile.email && <a className="workspace-detail" href={`mailto:${workshopProfile.email}`}><Mail size={14} /><span>{workshopProfile.email}</span></a>}
          {workshopProfile.workingHours && <div className="workspace-detail"><Clock3 size={14} /><span>{workshopProfile.workingHours}</span></div>}
          {workshopProfile.mapUrl && <a className="workspace-map-link" href={normalizePublicUrl(workshopProfile.mapUrl)} target="_blank" rel="noreferrer"><MapPin size={14} /> افتح الموقع على الخريطة <ArrowUpLeft size={12} /></a>}
          <button className="workspace-edit-button" onClick={() => { setPage('workshopSettings'); setWorkshopMenuOpen(false); }}><Settings2 size={14} /> تعديل بيانات العلامة</button>
        </div>}
      </div>
      <nav className="side-navigation" aria-label="القائمة الرئيسية">{navGroups.map((group) => <div className="nav-group" key={group.title}><div className="nav-group-title">{group.title}</div>{group.items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'nav-active' : ''}`} onClick={() => { setPage(id); setQuery(''); setMobileNavOpen(false); setWorkshopMenuOpen(false); }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === 'orders' && pendingOrders > 0 && <b className="nav-count">{pendingOrders}</b>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><button className="nav-link" onClick={() => setToast('للمساعدة تواصل مع مسؤول النظام.')}><CircleHelp size={17} /><span>المساعدة والدعم</span></button><div className="profile-card"><span className="profile-avatar">{initials(user.displayName || user.email || 'R')}</span><span className="profile-info"><strong>{user.displayName || 'مدير المتجر'}</strong><small>{user.email}</small></span><button className="profile-logout" title="تسجيل الخروج" onClick={exit}><LogOut size={16} /></button></div></div>
    </aside>
    {mobileNavOpen && <button className="nav-scrim" aria-label="إغلاق القائمة" onClick={() => setMobileNavOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} title="فتح القائمة"><Menu size={20} /></button><div className="breadcrumbs"><span>R/ONE</span><ChevronLeft size={14} /><strong>{pageCopy[page].eyebrow}</strong></div><button className="global-search-trigger" type="button" onClick={() => setGlobalSearchOpen(true)} aria-label="بحث في كامل الموقع"><Search size={16} /><span>ابحث في كامل الموقع...</span><kbd>Ctrl K</kbd></button><div className="topbar-tools"><span className="top-date">{new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span><button className="icon-button notification-button" title="الطلبات التي تحتاج متابعة" onClick={() => setPage('orders')}><Bell size={18} />{pendingOrders > 0 && <i />}</button><span className="top-avatar">{initials(user.displayName || user.email || 'R')}</span></div></header>
      <div className="page-content">
        {dataError && <div className="notice notice-error"><span>{dataError}</span><button className="icon-button" onClick={() => setDataError('')} title="إغلاق"><X size={16} /></button></div>}
        <PageHeading page={page} trailing={pageActions} />
        {page === 'overview' && <>
          <section className="metric-grid"><Metric title="إجمالي المبيعات" value={money.format(revenue)} note="قيمة الطلبات غير الملغاة" icon={CreditCard} mood="lime" /><Metric title="طلبات تحتاج متابعة" value={String(pendingOrders).padStart(2, '0')} note="جديد أو قيد التجهيز" icon={ShoppingBag} mood="blue" /><Metric title="منتج في الكتالوج" value={String(products.length).padStart(2, '0')} note={`${brandCount} علامات · ${categoryCount} تصنيفات`} icon={Shirt} mood="orange" /><Metric title="مخزون منخفض" value={String(lowStock).padStart(2, '0')} note="٥ قطع أو أقل" icon={Boxes} mood="plain" /></section>
          <section className="overview-grid"><article className="panel sales-panel"><div className="panel-heading"><div><span className="eyebrow">حركة البيع</span><h2>الطلبات خلال الأسبوع</h2></div><span className="panel-icon"><Activity size={17} /></span></div><OverviewChart orders={orders} /></article><article className="panel status-panel"><div className="panel-heading"><div><span className="eyebrow">حالة التشغيل</span><h2>ملخص الطلبات</h2></div><button className="text-link" onClick={() => setPage('orders')}>كل الطلبات <ArrowUpLeft size={14} /></button></div><div className="status-summary"><div className="status-ring" style={{ '--ring-value': `${orders.length ? (orders.filter((order) => order.status === 'مكتمل').length / orders.length) * 100 : 0}%` } as React.CSSProperties}><div><strong>{orders.length}</strong><span>طلب</span></div></div><div className="status-legend"><div><i className="legend-lime" /><span>مكتمل</span><strong>{orders.filter((order) => order.status === 'مكتمل').length}</strong></div><div><i className="legend-blue" /><span>قيد التنفيذ</span><strong>{pendingOrders}</strong></div><div><i className="legend-gray" /><span>ملغي</span><strong>{orders.filter((order) => order.status === 'ملغي').length}</strong></div></div></div></article></section>
          <section className="panel table-panel"><div className="panel-heading table-heading"><div><span className="eyebrow">آخر حركة</span><h2>أحدث الطلبات</h2></div><button className="text-link" onClick={() => setPage('orders')}>عرض الكل <ArrowUpLeft size={14} /></button></div><OrderTable orders={recentOrders} busyOrder={busyOrder} onStatusChange={setOrderStatus} /><div className="panel-footer"><span>{orders.length} طلب مسجل</span><span>مزامنة مباشرة <i className="live-dot" /></span></div></section>
        </>}
        {page === 'analytics' && <AnalyticsPanel orders={orders} products={products} customers={customers} reviews={reviews} searchLogs={searchLogs} productStats={productStats} dailyStats={dailyStats} messages={messages} onNavigate={(next) => { setPage(next as Page); setQuery(''); }} />}
        {page === 'messages' && <MessagesPanel messages={messages} onStatus={setMessageStatus} onDelete={deleteMessage} />}
        {page === 'newsletter' && <NewsletterPanel subscribers={subscribers} onDelete={deleteSubscriber} />}
        {page === 'blog' && <BlogPanel posts={blogPosts} onSave={saveBlogPost} onDelete={deleteBlogPost} />}
        {page === 'pages' && <PagesPanel pages={infoPages} onSave={saveInfoPage} onDelete={deleteInfoPage} />}
        {(page === 'categories' || page === 'brands') && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{page === 'categories' ? `${categoryCount} تصنيف` : `${brandCount} علامة`}</span><span className="muted">السجلات النشطة والمؤرشفة</span></div><SearchBox value={query} onChange={setQuery} label="البحث في الكتالوج" placeholder={page === 'categories' ? 'ابحث عن تصنيف...' : 'ابحث عن علامة...'} /></div><CatalogTable kind={page} entries={page === 'categories' ? categories : brands} products={products} query={query} onEdit={(entry) => setCatalogModal({ kind: page, entry })} onToggle={(entry) => toggleCatalogEntry(page, entry)} onDelete={(entry) => deleteCatalogEntry(page, entry)} /><div className="panel-footer"><span>{page === 'categories' ? 'التصنيفات' : 'العلامات التجارية'} مرتبطة بالمنتجات</span><span>مزامنة مباشرة <i className="live-dot" /></span></div></section>}
        {page === 'products' && selectedProductIds.length ? (
          <section className="bulk-bar">
            <span className="bulk-count">محدد <b>{selectedProductIds.length}</b> منتج</span>
            <select aria-label="نوع التعديل الجماعي" value={bulkAction} onChange={(event) => setBulkAction(event.target.value as typeof bulkAction)}>
              <option value="">اختر التعديل</option>
              <option value="price-percent">تعديل السعر % (مثلاً -10)</option>
              <option value="price-set">تعيين سعر</option>
              <option value="stock-set">تعيين المخزون</option>
            </select>
            <input type="number" step="1" placeholder="القيمة" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} disabled={!bulkAction} />
            <button className="button button-dark" type="button" onClick={applyBulkAction} disabled={!bulkAction || !bulkValue}><Check size={15} /> تطبيق على المحدد</button>
            <button className="button button-quiet" type="button" onClick={() => setSelectedProductIds([])}><X size={15} /> إلغاء التحديد</button>
          </section>
        ) : null}
        {page === 'products' && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{filteredProducts.length} منتج</span><span className="muted">أسعار القطع الأساسية وأسعار العروض النشطة</span></div><div className="toolbar-controls"><SearchBox value={query} onChange={setQuery} label="البحث في المنتجات" placeholder="ابحث بالاسم أو الكود..." /><select className="filter-select" aria-label="تصفية حسب التصنيف" value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)}><option value="all">كل التصنيفات</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><select className="filter-select" aria-label="تصفية حسب العلامة التجارية" value={productBrandFilter} onChange={(event) => setProductBrandFilter(event.target.value)}><option value="all">كل العلامات</option>{brands.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><select className="filter-select" aria-label="تصفية حسب المخزون" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">كل المخزون</option><option value="available">متوفر</option><option value="low">مخزون منخفض</option></select></div></div><ProductTable onNotify={setToast} onQuickSave={quickSaveProduct} onDuplicate={duplicateProduct} selectedIds={[]} onToggleSelect={() => undefined} onSelectAll={() => undefined} products={resolvedProducts} onEdit={(product) => router.push(`/products/${product.id}`)} onDelete={deleteProduct} mode={page} highlighted={highlightedProductId} /><div className="panel-footer"><span>عرض {filteredProducts.length} من {products.length} منتج</span><button className="clear-filters" type="button" onClick={() => { setQuery(''); setProductCategoryFilter('all'); setProductBrandFilter('all'); setStockFilter('all'); }}>مسح البحث والفلاتر</button><span>الأسعار بالجنيه المصري</span></div></section>}
        {page === 'offers' && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{filteredOffers.length} حملة</span><span className="muted">{offers.filter((offer) => getOfferState(offer) === 'نشط').length} نشطة الآن · الخصم يطبق على القطع المحددة فقط</span></div><div className="toolbar-controls"><SearchBox value={query} onChange={setQuery} label="البحث في العروض" placeholder="ابحث باسم الحملة..." /><select className="filter-select" aria-label="تصفية العروض حسب الحالة" value={offerStatusFilter} onChange={(event) => setOfferStatusFilter(event.target.value)}><option value="all">كل الحالات</option><option value="نشط">نشط الآن</option><option value="مجدول">مجدول</option><option value="منتهي">منتهي</option><option value="متوقف">متوقف</option></select></div></div><OfferTable offers={filteredOffers} products={products} query={query} onEdit={setOfferModal} onToggle={toggleOffer} onDelete={deleteOffer} /><div className="panel-footer"><span>لا تتداخل حملتان نشطتان على القطعة نفسها</span><button className="clear-filters" type="button" onClick={() => { setQuery(''); setOfferStatusFilter('all'); }}>مسح البحث والفلاتر</button><span>تحديث مباشر <i className="live-dot" /></span></div></section>}
        {page === 'orders' && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{filteredOrders.length} طلب</span><span className="muted">{pendingOrders} بحاجة إلى متابعة</span></div><div className="toolbar-controls"><SearchBox value={query} onChange={setQuery} label="البحث في الطلبات" placeholder="ابحث برقم الطلب أو العميل..." /><select className="filter-select" aria-label="تصفية الطلبات حسب الحالة" value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}><option value="all">كل الحالات</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div><OrderTable orders={[...filteredOrders].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))} busyOrder={busyOrder} onStatusChange={setOrderStatus} /><div className="panel-footer"><span>تحديثات الحالة تحفظ مباشرة</span><button className="clear-filters" type="button" onClick={() => { setQuery(''); setOrderStatusFilter('all'); }}>مسح البحث والفلاتر</button><span><i className="live-dot" /> متصل بقاعدة البيانات</span></div></section>}
        {page === 'customers' && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{filteredCustomers.length} عميل</span><span className="muted">سجل العملاء</span></div><SearchBox value={query} onChange={setQuery} label="البحث في العملاء" placeholder="ابحث بالاسم أو رقم الهاتف..." /></div><CustomersTable customers={filteredCustomers} /><div className="panel-footer"><span>البيانات مرتبطة بسجل الطلبات</span><span>تحديث مباشر <i className="live-dot" /></span></div></section>}
        {page === 'suppliers' && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{filteredSuppliers.length} مورد</span><span className="muted">{suppliers.filter((supplier) => supplier.isActive).length} نشط · {purchases.length} فاتورة شراء</span></div><SearchBox value={query} onChange={setQuery} label="البحث في الموردين" placeholder="ابحث بالاسم أو الهاتف..." /></div><SuppliersTable suppliers={filteredSuppliers} purchases={purchases} onEdit={setSupplierModal} onToggle={toggleSupplier} onDelete={deleteSupplier} /><div className="panel-footer"><span>احفظ بيانات التواصل والفواتير المرتبطة</span><span>مزامنة مباشرة <i className="live-dot" /></span></div></section>}
        {page === 'shippingRates' && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{filteredShippingRates.length} منطقة</span><span className="muted">{shippingRates.filter((rate) => rate.isActive).length} منطقة مفعّلة</span></div><SearchBox value={query} onChange={setQuery} label="البحث في مناطق الشحن" placeholder="ابحث عن محافظة أو منطقة..." /></div><ShippingTable rates={filteredShippingRates} onEdit={setShippingModal} onToggle={toggleShippingRate} onDelete={deleteShippingRate} /><div className="panel-footer"><span>الأسعار بالجنيه المصري</span><span>تحديث مباشر <i className="live-dot" /></span></div></section>}
        {page === 'reviews' && <section className="panel data-panel"><div className="table-toolbar"><div className="toolbar-info"><span className="result-count">{filteredReviews.length} تقييم</span><span className="muted">{reviews.filter((review) => !review.status || review.status === 'جديدة').length} بانتظار المراجعة</span></div><SearchBox value={query} onChange={setQuery} label="البحث في التقييمات" placeholder="ابحث بالعميل أو المنتج..." /></div><ReviewsTable reviews={filteredReviews} onStatusChange={setReviewStatus} /><div className="panel-footer"><span>غيّر حالة التقييم من القائمة</span><span>مزامنة مباشرة <i className="live-dot" /></span></div></section>}
        {page === 'notifications' && <section className="panel data-panel notifications-panel"><NotificationsPanel orders={orders} products={products} reviews={reviews} onNavigate={(nextPage) => { setPage(nextPage); setQuery(''); }} /></section>}
        {page === 'workshopSettings' && <WorkshopSettingsForm profile={workshopProfile} onSave={saveWorkshopProfile} />}
        <footer className="page-footer"><span>R/ONE</span><span>تفاصيل معمولة علشان تعيش.</span><span>بياناتك محمية ومزامنة عبر Firebase</span></footer>
      </div>
    </main>
    {catalogModal && <CatalogModal kind={catalogModal.kind} entry={catalogModal.entry} onClose={() => setCatalogModal(null)} onSave={(value, id) => saveCatalog(catalogModal.kind, value, id)} />}
    {offerModal !== undefined && <OfferModal offer={offerModal || undefined} products={products} onClose={() => setOfferModal(undefined)} onSave={saveOffer} />}
    {supplierModal !== undefined && <RecordModal title={supplierModal ? 'تعديل بيانات المورد' : 'إضافة مورد'} initial={supplierModal ? { name: supplierModal.name, contactName: supplierModal.contactName || '', phone: supplierModal.phone || '', email: supplierModal.email || '', address: supplierModal.address || '', notes: supplierModal.notes || '' } : undefined} fields={[{ key: 'name', label: 'اسم المورد', required: true, placeholder: 'اسم الشركة أو المورد' }, { key: 'contactName', label: 'مسؤول التواصل', placeholder: 'الاسم' }, { key: 'phone', label: 'رقم الهاتف', type: 'tel', placeholder: '+20' }, { key: 'email', label: 'البريد الإلكتروني', type: 'email', placeholder: 'supplier@example.com' }, { key: 'address', label: 'العنوان', placeholder: 'المدينة أو العنوان' }, { key: 'notes', label: 'ملاحظات', type: 'textarea', placeholder: 'تفاصيل التعامل أو مواعيد التوريد' }]} onClose={() => setSupplierModal(undefined)} onSave={(values) => saveSupplier(values, supplierModal?.id)} />}
    {shippingModal !== undefined && <RecordModal title={shippingModal ? 'تعديل منطقة الشحن' : 'إضافة منطقة شحن'} initial={shippingModal ? { area: shippingModal.area, price: String(shippingModal.price), deliveryDays: String(shippingModal.deliveryDays) } : undefined} fields={[{ key: 'area', label: 'المحافظة أو المنطقة', required: true, placeholder: 'مثال: القاهرة' }, { key: 'price', label: 'تكلفة الشحن بالجنيه', type: 'number', min: 0, required: true, placeholder: '60' }, { key: 'deliveryDays', label: 'مدة التوصيل بالأيام', type: 'number', min: 1, required: true, placeholder: '2' }]} onClose={() => setShippingModal(undefined)} onSave={(values) => saveShippingRate(values, shippingModal?.id)} />}
    {purchaseModal && <PurchaseModal products={products} suppliers={suppliers} onClose={() => setPurchaseModal(false)} onSave={savePurchase} />}
    {confirmation && <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
    {globalSearchOpen && <GlobalSearchDialog query={globalSearchQuery} onQueryChange={setGlobalSearchQuery} results={globalSearchResults} onSelect={selectGlobalSearchResult} onClose={() => setGlobalSearchOpen(false)} />}
    {toast && <div className="toast"><span className="toast-check"><Check size={14} /></span>{toast}</div>}
  </div>;
}

function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  return <label className="search-field"><Search size={16} /><input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>/</kbd></label>;
}

function Metric({ title, value, note, icon: Icon, mood }: { title: string; value: string; note: string; icon: typeof Activity; mood: string }) {
  return <article className={`metric-card metric-${mood}`}><div className="metric-top"><span>{title}</span><span className="metric-icon"><Icon size={17} /></span></div><strong>{value}</strong><div className="metric-note">{note}</div></article>;
}