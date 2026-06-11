import PrintConsultationView from "@/components/modules/crm/PrintConsultationView";

export default async function ConsultationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintConsultationView projectId={id} />;
}
