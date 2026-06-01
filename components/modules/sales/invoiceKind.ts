/** Shared configuration that makes the invoice views generic across the two
 *  document kinds (sales = facture de vente, purchase = facture d'achat). */
export type InvoiceKind = "sales" | "purchase";

export type InvoiceKindConfig = {
  table: string;
  linesTable: string;
  fk: string;
  partnerTable: string;
  partnerCol: string;
  /** select-string for the embedded partner, aliased to `partner`. */
  partnerSelect: string;
  listHref: string;
  detailHref: (id: string) => string;
  newTitleKey: "newSalesInvoice" | "newPurchaseInvoice";
  partnerLabelKey: "customer" | "supplier";
  warehouseLabelKey: "warehouseFrom" | "warehouseInto";
};

export const INVOICE_KINDS: Record<InvoiceKind, InvoiceKindConfig> = {
  sales: {
    table: "sales_invoices",
    linesTable: "sales_invoice_lines",
    fk: "sales_invoice_id",
    partnerTable: "customers",
    partnerCol: "customer_id",
    partnerSelect: "partner:customers(name)",
    listHref: "/sales",
    detailHref: (id) => `/sales/${id}`,
    newTitleKey: "newSalesInvoice",
    partnerLabelKey: "customer",
    warehouseLabelKey: "warehouseFrom",
  },
  purchase: {
    table: "purchase_invoices",
    linesTable: "purchase_invoice_lines",
    fk: "purchase_invoice_id",
    partnerTable: "suppliers",
    partnerCol: "supplier_id",
    partnerSelect: "partner:suppliers(name)",
    listHref: "/sales/purchases",
    detailHref: (id) => `/sales/purchases/${id}`,
    newTitleKey: "newPurchaseInvoice",
    partnerLabelKey: "supplier",
    warehouseLabelKey: "warehouseInto",
  },
};
