import InvoiceDetailView from "@/components/modules/sales/InvoiceDetailView";

export default async function SalesInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetailView kind="sales" invoiceId={id} />;
}
