import { ProductEditorScreen } from '../product-editor';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditorScreen productId={id} />;
}
