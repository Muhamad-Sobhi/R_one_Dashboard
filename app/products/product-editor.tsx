'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowRight, Check, ImagePlus, Info, LoaderCircle, Package, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { db } from '../../firebase';
import { AccessGate, useAdminAccess } from '../use-admin';
import { alphaSizePresets, buildProductDraft, getErrorMessage, normalizeLabel, numericSizePresets, productImageList, uploadProductImages, type CatalogEntry, type CatalogKind, type Product, type ProductColor, type ProductImage, type ProductSize } from '../product-shared';

type EditorImage = { url: string; publicId: string; file?: File };
type EditorForm = { name: string; sku: string; categoryId: string; brandId: string; category: string; brand: string; description: string; price: string; stock: string };

function emptyForm(): EditorForm {
  return { name: '', sku: '', categoryId: '', brandId: '', category: '', brand: '', description: '', price: '', stock: '0' };
}

export function ProductEditorScreen({ productId }: { productId?: string }) {
  const { authorized } = useAdminAccess();
  return <AccessGate authorized={authorized}><ProductEditorBody productId={productId} /></AccessGate>;
}

function ProductEditorBody({ productId }: { productId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(productId);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [categories, setCategories] = useState<CatalogEntry[]>([]);
  const [brands, setBrands] = useState<CatalogEntry[]>([]);
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [colors, setColors] = useState<ProductColor[]>([]);
  const [images, setImages] = useState<EditorImage[]>([]);
  const [sizeInput, setSizeInput] = useState('');
  const [colorDraft, setColorDraft] = useState<{ name: string; hex: string; imageUrl: string }>({ name: '', hex: '#E46A29', imageUrl: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const previewUrls = useRef<string[]>([]);
  const hydrated = useRef(false);

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  useEffect(() => {
    const stopCategories = onSnapshot(collection(db, 'categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CatalogEntry))), () => setCategories([]));
    const stopBrands = onSnapshot(collection(db, 'brands'), (snapshot) => setBrands(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CatalogEntry))), () => setBrands([]));
    return () => { stopCategories(); stopBrands(); };
  }, []);

  useEffect(() => {
    if (!productId) { hydrated.current = true; return; }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const snapshot = await getDoc(doc(db, 'products', productId));
        if (cancelled) return;
        if (!snapshot.exists()) { setLoadError('المنتج ده مش موجود أو اتمسح.'); return; }
        const value = { id: snapshot.id, ...snapshot.data() } as Product;
        setProduct(value);
        const categoryMatch = categories.find((entry) => entry.id === value.categoryId || normalizeLabel(entry.name) === normalizeLabel(value.category || ''));
        const brandMatch = brands.find((entry) => entry.id === value.brandId || normalizeLabel(entry.name) === normalizeLabel(value.brand || ''));
        setForm({
          name: value.name || '',
          sku: value.sku || '',
          categoryId: value.categoryId || categoryMatch?.id || '',
          brandId: value.brandId || brandMatch?.id || '',
          category: value.category || '',
          brand: value.brand || '',
          description: value.description || '',
          price: value.price?.toString() || '',
          stock: value.stock?.toString() || '0',
        });
        setSizes((value.sizes ?? []).filter(Boolean).map((size) => ({ ...size })));
        setColors((value.colors ?? []).filter(Boolean).map((color) => ({ ...color })));
        setImages(productImageList(value));
      } catch (reason) {
        if (!cancelled) setLoadError(getErrorMessage(reason));
      } finally {
        if (!cancelled) { setLoading(false); hydrated.current = true; }
      }
    })();
    return () => { cancelled = true; };
    // الفئات والعلامات تُقرأ مرة واحدة عند الفتح؛ أي تعديل عليها لاحقاً لا يعيد بناء النموذج.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const totalStock = useMemo(() => sizes.reduce((sum, size) => sum + (Number(size.stock) || 0), 0), [sizes]);
  const setField = (field: keyof EditorForm, value: string) => { setForm((current) => ({ ...current, [field]: value })); setDirty(true); };

  function addSize(value: string) {
    const name = value.trim();
    if (!name) return;
    if (sizes.some((size) => size.name.toLowerCase() === name.toLowerCase())) { setSizeInput(''); return; }
    setSizes((current) => [...current, { name }]);
    setSizeInput('');
    setDirty(true);
  }

  function addColor() {
    const name = colorDraft.name.trim();
    if (!name) { setError('اكتب اسم اللون الأول.'); return; }
    if (colors.some((color) => color.name.toLowerCase() === name.toLowerCase())) { setError('اللون ده مضاف بالفعل.'); return; }
    const match = images.find((image) => image.url === colorDraft.imageUrl);
    setColors((current) => [...current, { name, hex: colorDraft.hex, imageUrl: colorDraft.imageUrl, publicId: match?.publicId || '' }]);
    setColorDraft({ name: '', hex: '#E46A29', imageUrl: '' });
    setError('');
    setDirty(true);
  }

  function addImages(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (images.length + selected.length > 8) { setError('يمكن إضافة 8 صور كحد أقصى لكل منتج.'); return; }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (selected.some((file) => !allowedTypes.includes(file.type))) { setError('اختر صوراً بصيغة JPG أو PNG أو WEBP أو AVIF فقط.'); return; }
    if (selected.some((file) => file.size > 8 * 1024 * 1024)) { setError('يجب ألا يتجاوز حجم كل صورة 8 ميجابايت.'); return; }
    const newImages = selected.map((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.current.push(url);
      return { url, publicId: '', file };
    });
    setError('');
    setImages((current) => [...current, ...newImages]);
    setDirty(true);
  }

  function removeImage(index: number) {
    setImages((current) => {
      const removed = current[index];
      if (removed?.file) {
        URL.revokeObjectURL(removed.url);
        previewUrls.current = previewUrls.current.filter((url) => url !== removed.url);
      }
      return current.filter((_, imageIndex) => imageIndex !== index);
    });
    setDirty(true);
  }

  function makePrimary(index: number) {
    setImages((current) => current.map((image, imageIndex) => imageIndex === index ? current[0] : imageIndex === 0 ? current[index] : image));
    setDirty(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const uploadedImages = await uploadProductImages(images.flatMap((image) => image.file ? [image.file] : []));
      let uploadedIndex = 0;
      const savedImages: ProductImage[] = images.map((image) => image.file ? uploadedImages[uploadedIndex++] : { url: image.url, publicId: image.publicId });
      const draft = buildProductDraft({ form, categories, brands, sizes, colors, images: savedImages });
      if (!draft.name) throw new Error('اسم المنتج مطلوب.');
      if (!Number.isFinite(draft.price) || draft.price < 0) throw new Error('السعر لازم يكون رقم صحيح.');
      if (!draft.categoryId && !draft.category) throw new Error('اختر تصنيفاً للمنتج.');
      if (!draft.brandId && !draft.brand) throw new Error('اختر علامة تجارية للمنتج.');

      if (productId) {
        await updateDoc(doc(db, 'products', productId), { ...draft, updatedAt: serverTimestamp() });
        setSaved(true);
        setDirty(false);
        window.setTimeout(() => router.push('/?page=products'), 700);
      } else {
        const reference = await addDoc(collection(db, 'products'), { ...draft, createdAt: serverTimestamp() });
        setSaved(true);
        setDirty(false);
        window.setTimeout(() => router.push(`/?page=products&highlight=${reference.id}`), 700);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    if (dirty && !window.confirm('فيه تعديلات مش متسجلة. تخرج من غير حفظ؟')) return;
    router.push('/?page=products');
  }

  if (loading) return <div className="editor-state"><LoaderCircle className="spin-icon" size={20} /> جارٍ فتح المنتج...</div>;
  if (loadError) {
    return (
      <div className="editor-state">
        <Package size={22} />
        <strong>{loadError}</strong>
        <Link className="button button-dark" href="/?page=products">رجوع للمنتجات</Link>
      </div>
    );
  }

  const activeCategories = categories.filter((entry) => entry.isActive || entry.id === form.categoryId);
  const activeBrands = brands.filter((entry) => entry.isActive || entry.id === form.brandId);
  const title = isEdit ? (product?.name || 'تعديل المنتج') : 'منتج جديد';

  return (
    <form className="editor-page" onSubmit={submit}>
      <header className="editor-header">
        <div className="editor-header-start">
          <button className="icon-button" type="button" onClick={goBack} title="رجوع"><ArrowRight size={18} /></button>
          <div>
            <span className="eyebrow">الكتالوج</span>
            <h1>{isEdit ? 'تعديل منتج' : 'إضافة منتج'}</h1>
          </div>
        </div>
        <div className="editor-header-end">
          {dirty && <span className="editor-dirty">تعديلات غير محفوظة</span>}
          {saved && <span className="editor-saved"><Check size={14} /> تم الحفظ</span>}
          <button className="button button-quiet editor-cancel" type="button" onClick={goBack}>إلغاء</button>
          <button className="button button-dark" type="submit" disabled={busy || saved}>
            {busy ? <><LoaderCircle className="spin-icon" size={15} /> جارٍ الحفظ...</> : saved ? <><Check size={15} /> اتحفظ</> : <><Save size={15} /> {isEdit ? 'حفظ التعديلات' : 'إضافة للمنكتالوج'}</>}
          </button>
        </div>
      </header>

      <div className="editor-body">
        <div className="editor-main">
          <section className="editor-card">
            <div className="editor-card-head"><div><h2>صور المنتج</h2><p>أول صورة هي الرئيسية اللي بتظهر في الكروت.</p></div><span className="editor-counter">{images.length} / 8</span></div>
            <div className="product-image-gallery-preview editor-gallery">
              {images.map((image, index) => (
                <div className={`product-image-item ${index === 0 ? 'product-image-primary' : ''}`} key={image.file ? `${image.file.name}-${image.url}` : `${image.publicId}-${image.url}-${index}`}>
                  <img src={image.url} alt={`${form.name || 'صورة المنتج'} ${index + 1}`} />
                  <span className="product-image-index">{index === 0 ? 'رئيسية' : index + 1}</span>
                  <div className="product-image-item-actions">
                    <button type="button" title="جعلها الصورة الرئيسية" disabled={index === 0} onClick={() => makePrimary(index)}><Check size={12} /></button>
                    <button type="button" title="إزالة الصورة" onClick={() => removeImage(index)}><X size={12} /></button>
                  </div>
                </div>
              ))}
              {images.length < 8 && <label className="product-image-add"><ImagePlus size={22} /><span>إضافة صور</span><input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { addImages(event.target.files); event.currentTarget.value = ''; }} /></label>}
              {!images.length && <span className="product-image-hint">اختر حتى 8 صور للقطعة</span>}
            </div>
            <p className="product-image-help"><Info size={13} /> JPG أو PNG أو WEBP أو AVIF · حد أقصى 8MB للصورة · حافظ على خلفية بسيطة عشان الألوان تظهر صح.</p>
          </section>

          <section className="editor-card">
            <div className="editor-card-head"><div><h2>البيانات الأساسية</h2><p>الاسم والكود والسعر اللي هيظهر في الكتالوج وصفحة المنتج.</p></div></div>
            <div className="form-grid">
              <label className="span-two">اسم المنتج<input required maxLength={90} value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="مثال: هودي أوفرسايز" /></label>
              <label>كود المنتج<input required maxLength={24} value={form.sku} onChange={(event) => setField('sku', event.target.value)} placeholder="R1-H-024" /></label>
              <label>السعر الأساسي بالجنيه<input type="number" required min="0" step="1" value={form.price} onChange={(event) => setField('price', event.target.value)} placeholder="850" /></label>
              <label>
                التصنيف
                <select required value={form.categoryId} onChange={(event) => setField('categoryId', event.target.value)}>
                  <option value="">اختر تصنيفاً</option>
                  {activeCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.isActive ? '' : ' · مؤرشف'}</option>)}
                </select>
                {!activeCategories.length && <Link className="field-action" href="/?page=categories">أضف تصنيفاً أولاً</Link>}
              </label>
              <label>
                العلامة التجارية
                <select required value={form.brandId} onChange={(event) => setField('brandId', event.target.value)}>
                  <option value="">اختر علامة تجارية</option>
                  {activeBrands.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.isActive ? '' : ' · مؤرشفة'}</option>)}
                </select>
                {!activeBrands.length && <Link className="field-action" href="/?page=brands">أضف علامة تجارية أولاً</Link>}
              </label>
              <label className="span-two">
                الكمية العامة في المخزون
                <input type="number" required min="0" step="1" value={form.stock} onChange={(event) => setField('stock', event.target.value)} placeholder="24" />
                <span className="field-hint">{sizes.length ? `مجموع كميات المقاسات: ${totalStock} قطعة` : 'لو بتستخدم مقاسات، الكميات تتحسب من المقاسات.'}</span>
              </label>
              <label className="span-two">وصف المنتج<textarea rows={5} maxLength={1200} value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="خامة القطعة، المقاسات المتاحة، تعليمات العناية، أو أي تفاصيل تساعد العميل." /><span className="field-hint">{form.description.length} / 1200 حرف</span></label>
            </div>
          </section>

          <section className="editor-card">
            <div className="editor-card-head"><div><h2>المقاسات</h2><p>تظهر للعميل كاختيار إلزامي قبل الإضافة للسلة.</p></div><span className="editor-counter">{sizes.length} مقاس</span></div>
            <div className="variant-chips">
              {sizes.map((size, index) => (
                <span className="variant-chip" key={`${size.name}-${index}`}>
                  <input className="variant-chip-name" value={size.name} onChange={(event) => { setSizes((current) => current.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry)); setDirty(true); }} />
                  <input className="variant-chip-stock" type="number" min="0" step="1" placeholder="الكمية" value={size.stock ?? ''} onChange={(event) => { setSizes((current) => current.map((entry, position) => position === index ? { ...entry, stock: event.target.value === '' ? undefined : Number(event.target.value) } : entry)); setDirty(true); }} />
                  <button className="icon-button" type="button" title="حذف المقاس" onClick={() => { setSizes((current) => current.filter((_, position) => position !== index)); setDirty(true); }}><X size={14} /></button>
                </span>
              ))}
              {!sizes.length && <small className="variant-empty">مفيش مقاسات — سيب الخانة فاضية لو القطعة بمقاس واحد.</small>}
            </div>
            <div className="variant-presets">
              <span>مقاسات جاهزة</span>
              {[...alphaSizePresets, ...numericSizePresets].map((preset) => {
                const added = sizes.some((size) => size.name.toLowerCase() === preset.toLowerCase());
                return (
                  <button className={`preset-chip ${added ? 'preset-chip-added' : ''}`} key={preset} type="button" disabled={added} onClick={() => addSize(preset)} title={added ? `${preset} مضاف بالفعل` : `إضافة ${preset}`}>
                    {added ? <Check size={12} /> : <Plus size={12} />} {preset}
                  </button>
                );
              })}
            </div>
            <div className="variant-add">
              <input value={sizeInput} onChange={(event) => setSizeInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSize(sizeInput); } }} placeholder="أو اكتب مقاس مخصص: 3XL أو 38" maxLength={12} />
              <button className="button button-quiet" type="button" onClick={() => addSize(sizeInput)}><Plus size={14} /> إضافة مقاس</button>
            </div>
          </section>

          <section className="editor-card">
            <div className="editor-card-head"><div><h2>الألوان</h2><p>كل لون بياخد صورته — الصورة بتتغير في صفحة المنتج لما العميل يختار اللون.</p></div><span className="editor-counter">{colors.length} لون</span></div>
            <ul className="color-editor-list">
              {colors.map((color, index) => (
                <li className="color-editor-row" key={`${color.name}-${index}`}>
                  <input type="color" value={color.hex || '#E46A29'} onChange={(event) => { setColors((current) => current.map((entry, position) => position === index ? { ...entry, hex: event.target.value } : entry)); setDirty(true); }} aria-label="لون العينات" />
                  <input value={color.name} placeholder="اسم اللون" maxLength={24} onChange={(event) => { setColors((current) => current.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry)); setDirty(true); }} />
                  <select value={color.imageUrl || ''} onChange={(event) => { setColors((current) => current.map((entry, position) => position === index ? { ...entry, imageUrl: event.target.value } : entry)); setDirty(true); }}>
                    <option value="">بدون صورة خاصة</option>
                    {images.map((image, imageIndex) => <option key={`${image.url}-${imageIndex}`} value={image.url}>صورة {imageIndex + 1}</option>)}
                  </select>
                  <button className="icon-button delete-action" type="button" title="حذف اللون" onClick={() => { setColors((current) => current.filter((_, position) => position !== index)); setDirty(true); }}><X size={14} /></button>
                </li>
              ))}
              {!colors.length && <small className="variant-empty">مفيش ألوان — أضف لون واختارله الصورة المناسبة من صور المنتج.</small>}
            </ul>
            <div className="color-editor-add">
              <input type="color" value={colorDraft.hex} onChange={(event) => setColorDraft((current) => ({ ...current, hex: event.target.value }))} aria-label="اختيار اللون" />
              <input value={colorDraft.name} onChange={(event) => setColorDraft((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addColor(); } }} placeholder="اسم اللون" maxLength={24} />
              <select value={colorDraft.imageUrl} onChange={(event) => setColorDraft((current) => ({ ...current, imageUrl: event.target.value }))}>
                <option value="">بدون صورة خاصة</option>
                {images.map((image, index) => <option key={`${image.url}-${index}`} value={image.url}>صورة {index + 1}</option>)}
              </select>
              <button className="button button-quiet" type="button" onClick={addColor}><Plus size={14} /> إضافة لون</button>
            </div>
          </section>

          {error && <p className="form-error editor-error" role="alert">{error}</p>}
        </div>

        <aside className="editor-side">
          <section className="editor-card editor-summary">
            <div className="editor-card-head"><div><h2>ملخص سريع</h2><p>الشكل النهائي قبل الحفظ.</p></div></div>
            <div className="editor-preview">
              {images[0] ? <img src={images[0].url} alt={form.name || 'صورة المنتج'} /> : <div className="editor-preview-empty"><ImagePlus size={22} /> مفيش صور لسه</div>}
            </div>
            <h3 className="editor-preview-title">{form.name || 'اسم المنتج'}</h3>
            <p className="editor-preview-meta">
              <span>{form.price ? `${form.price} ج.م` : 'السعر غير محدد'}</span>
              <span>{sizes.length ? `${sizes.length} مقاس` : 'بدون مقاسات'}</span>
              <span>{colors.length ? `${colors.length} لون` : 'بدون ألوان'}</span>
            </p>
            {form.description && <p className="editor-preview-description">{form.description}</p>}
          </section>

          <section className="editor-card editor-tips">
            <div className="editor-card-head"><div><h2><Sparkles size={16} /> نصايح سريعة</h2></div></div>
            <ul>
              <li>الصورة الرئيسية بتظهر في كروت الكتالوج، فاختارها بوضوح.</li>
              <li>لو القطعة فيها مقاسات، سيب الكمية العامة صفر ووزّع الكمية على المقاسات.</li>
              <li>الألوان من غير صورة بتستخدم الصورة الرئيسية، وده كافي للقطعة البسيطة.</li>
              <li>الوصف القصير بيساعد العميل يفهم الخامة والمقاس المتاح.</li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="editor-bottombar">
        <span className={dirty ? 'editor-dirty' : 'muted'}>{dirty ? 'فيه تعديلات غير محفوظة' : 'كل التغييرات محفوظة'}</span>
        <div>
          <button className="button button-quiet" type="button" onClick={goBack}>إلغاء</button>
          <button className="button button-dark" type="submit" disabled={busy || saved}>{busy ? 'جارٍ الحفظ...' : saved ? 'اتحفظ' : isEdit ? 'حفظ التعديلات' : 'إضافة للمنكتالوج'}</button>
        </div>
      </div>
    </form>
  );
}