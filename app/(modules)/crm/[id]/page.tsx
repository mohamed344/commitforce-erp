import CrmProjectDetailView from "@/components/modules/CrmProjectDetailView";

export default async function CrmProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrmProjectDetailView projectId={id} />;
}
