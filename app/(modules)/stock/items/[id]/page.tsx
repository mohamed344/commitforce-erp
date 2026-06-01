import ItemForm from "@/components/modules/stock/ItemForm";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemForm itemId={id} />;
}
