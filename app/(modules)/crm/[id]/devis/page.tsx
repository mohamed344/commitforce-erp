import PrintDevisView from "@/components/modules/crm/PrintDevisView";

export default async function DevisPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estimate?: string }>;
}) {
  const { id } = await params;
  const { estimate } = await searchParams;
  return <PrintDevisView projectId={id} estimateId={estimate} />;
}
