import PurchaseOrderDetailView from "@/components/modules/sales/PurchaseOrderDetailView";
import { getSalesAccess } from "@/lib/permissions";

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { canCreate, canReview } = await getSalesAccess();
  return <PurchaseOrderDetailView orderId={id} canCreate={canCreate} canReview={canReview} />;
}
