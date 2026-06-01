import InvoiceDetailView from "@/components/modules/sales/InvoiceDetailView";

export default async function PurchaseInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetailView kind="purchase" invoiceId={id} />;
}
