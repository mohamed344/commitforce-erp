import PurchaseOrderListView from "@/components/modules/sales/PurchaseOrderListView";
import { getSalesAccess } from "@/lib/permissions";

export default async function PurchaseOrdersPage() {
  const { canCreate } = await getSalesAccess();
  return <PurchaseOrderListView canCreate={canCreate} />;
}
