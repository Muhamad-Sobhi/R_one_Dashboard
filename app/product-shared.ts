import { auth } from '../firebase';

export type CatalogKind = 'brands' | 'categories';
export type ProductImage = { url: string; publicId: string };
export type ProductSize = { name: string; stock?: number };
export type ProductColor = { name: string; hex?: string; imageUrl?: string; publicId?: string; stock?: number };
export type Product = { id: string; name: string; sku: string; category: string; categoryId?: string; brand: string; brandId?: string; description?: string; price: number; salePrice?: number; offerTitle?: string; images?: ProductImage[]; imageUrl?: string; imagePublicId?: string; stock: number; sizes?: ProductSize[]; colors?: ProductColor[] };
export type CatalogEntry = { id: string; name: string; description?: string; isActive: boolean; createdAt?: { seconds: number } };
export type ProductDraft = Omit<Product, 'id'>;

export const alphaSizePresets = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];
export const numericSizePresets = ['30', '32', '34', '36', '38', '40', '42', '44'];

export function getErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('wrong-password') || code.includes('invalid-credential') || code.includes('user-not-found')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (code.includes('network-request-failed')) return 'تعذّر الاتصال. تحقّق من الإنترنت وحاول مرة أخرى.';
  if (code.includes('permission-denied')) return 'لا توجد صلاحية للوصول. راجع إعدادات المدير وقواعد Firebase.';
  if (error instanceof Error) return error.message;
  return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
}

export function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase('ar');
}

export function productImageList(product?: Partial<Product>): ProductImage[] {
  if (product?.images?.length) return product.images;
  if (product?.imageUrl) return [{ url: product.imageUrl, publicId: product.imagePublicId || '' }];
  return [];
}

export async function uploadProductImages(files: File[]): Promise<ProductImage[]> {
  if (!files.length) return [];
  if (files.length > 8) throw new Error('يمكن إضافة 8 صور كحد أقصى لكل منتج.');
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (files.some((file) => !allowedTypes.includes(file.type))) throw new Error('اختر صوراً بصيغة JPG أو PNG أو WEBP أو AVIF فقط.');
  if (files.some((file) => file.size > 8 * 1024 * 1024)) throw new Error('يجب ألا يتجاوز حجم كل صورة 8 ميجابايت.');

  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.');

  const signatureResponse = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const signature = await signatureResponse.json() as {
    error?: string;
    cloudName?: string;
    apiKey?: string;
    timestamp?: number;
    folder?: string;
    signature?: string;
  };
  if (!signatureResponse.ok || !signature.cloudName || !signature.apiKey || !signature.signature || !signature.folder || !signature.timestamp) {
    throw new Error(signature.error || 'تعذر تجهيز رفع الصورة.');
  }

  return Promise.all(files.map(async (file) => {
    const payload = new FormData();
    payload.append('file', file);
    payload.append('api_key', signature.apiKey!);
    payload.append('timestamp', String(signature.timestamp));
    // لازم نبعت folder مع الطلب، لأن السيرفر حسب التوقيع وهو جزء من string-to-sign.
    // لو متبعتهاش، Cloudinary هيحسب توقيع تاني مختلف ويرفض الطلب بـ Invalid Signature.
    if (signature.folder) payload.append('folder', signature.folder);
    payload.append('signature', signature.signature!);

    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, {
      method: 'POST',
      body: payload,
    });
    const uploaded = await uploadResponse.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
    if (!uploadResponse.ok || !uploaded.secure_url || !uploaded.public_id) {
      throw new Error(uploaded.error?.message || 'فشل رفع صورة إلى Cloudinary.');
    }
    return { url: uploaded.secure_url, publicId: uploaded.public_id };
  }));
}

export function buildProductDraft(payload: {
  form: { name: string; sku: string; category: string; categoryId: string; brand: string; brandId: string; description: string; price: string; stock: string };
  categories: CatalogEntry[];
  brands: CatalogEntry[];
  sizes: ProductSize[];
  colors: ProductColor[];
  images: Array<{ url: string; publicId: string }>;
}): ProductDraft {
  const { form, categories, brands, sizes, colors, images } = payload;
  const category = categories.find((entry) => entry.id === form.categoryId);
  const brand = brands.find((entry) => entry.id === form.brandId);
  const primaryImage = images[0];
  return {
    name: form.name.trim(),
    sku: form.sku.trim().toUpperCase(),
    description: form.description.trim(),
    category: category?.name || form.category,
    categoryId: category?.id,
    brand: brand?.name || form.brand,
    brandId: brand?.id,
    price: Number(form.price),
    stock: Number(form.stock),
    sizes: sizes
      .filter((size) => size.name.trim())
      .map((size) => (size.stock === undefined || !Number.isFinite(Number(size.stock)) ? { name: size.name.trim() } : { name: size.name.trim(), stock: Number(size.stock) })),
    colors: colors
      .filter((color) => color.name.trim())
      .map((color) => {
        const match = images.find((image) => image.url === color.imageUrl);
        return {
          name: color.name.trim(),
          ...(color.hex ? { hex: color.hex } : {}),
          ...(color.imageUrl ? { imageUrl: color.imageUrl, publicId: match?.publicId || '' } : {}),
          ...(color.stock === undefined || !Number.isFinite(Number(color.stock)) ? {} : { stock: Number(color.stock) }),
        };
      }),
    images,
    imageUrl: primaryImage?.url || '',
    imagePublicId: primaryImage?.publicId || '',
  };
}