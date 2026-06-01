/**
 * Domain option lists (CRM stages, project statuses, stock entry types, item
 * types). These used to be hardcoded arrays + TONE maps in each view; now they
 * are configurable per company via the `domain_options` table (migration 24).
 *
 * The values here are the CODE DEFAULTS — used when a company has no rows for a
 * set (mirrors the env-fallback pattern in lib/settings.ts). Default labels are
 * i18n keys so the built-in options stay translated until an admin customizes
 * them; custom options carry their own literal label.
 */

export type OptionSetKey =
  | "crm_stage"
  | "project_status"
  | "stock_entry_type"
  | "item_type"
  | "invoice_status"
  | "employee_status";

/** Badge tones available in the color picker (mirrors components/data/Badge.tsx). */
export const TONES = ["gray", "green", "blue", "amber", "red", "violet"] as const;
export type Tone = (typeof TONES)[number];

export type OptionDefault = {
  /** Stable machine value stored on the domain row (leads.stage, …). */
  key: string;
  /** i18n message key for the built-in label. */
  labelKey: string;
  tone: Tone;
};

export type OptionSetDef = {
  /**
   * `open` sets allow adding/removing/renaming options freely (pure labels).
   * Non-open sets are structural (their keys drive business logic): only the
   * label / color / order of the built-in keys can change.
   */
  open: boolean;
  /** Which key new records start on. */
  defaultKey: string;
  options: OptionDefault[];
};

export const OPTION_DEFAULTS: Record<OptionSetKey, OptionSetDef> = {
  crm_stage: {
    open: true,
    defaultKey: "new",
    options: [
      { key: "new", labelKey: "lead.stages.new", tone: "gray" },
      { key: "contacted", labelKey: "lead.stages.contacted", tone: "blue" },
      { key: "qualified", labelKey: "lead.stages.qualified", tone: "violet" },
      { key: "won", labelKey: "lead.stages.won", tone: "green" },
      { key: "lost", labelKey: "lead.stages.lost", tone: "red" },
    ],
  },
  project_status: {
    open: true,
    defaultKey: "planning",
    options: [
      { key: "planning", labelKey: "project.statuses.planning", tone: "blue" },
      { key: "active", labelKey: "project.statuses.active", tone: "green" },
      { key: "on_hold", labelKey: "project.statuses.on_hold", tone: "amber" },
      { key: "completed", labelKey: "project.statuses.completed", tone: "gray" },
      { key: "cancelled", labelKey: "project.statuses.cancelled", tone: "red" },
    ],
  },
  stock_entry_type: {
    open: false,
    defaultKey: "receipt",
    options: [
      { key: "receipt", labelKey: "stock.entryTypes.receipt", tone: "green" },
      { key: "issue", labelKey: "stock.entryTypes.issue", tone: "red" },
      { key: "transfer", labelKey: "stock.entryTypes.transfer", tone: "blue" },
      { key: "adjustment", labelKey: "stock.entryTypes.adjustment", tone: "amber" },
    ],
  },
  item_type: {
    open: false,
    defaultKey: "template",
    options: [
      { key: "template", labelKey: "item.types.template", tone: "blue" },
      { key: "variant", labelKey: "item.types.variant", tone: "gray" },
    ],
  },
  invoice_status: {
    // Structural: the keys drive the stock-posting trigger (migration 26).
    open: false,
    defaultKey: "draft",
    options: [
      { key: "draft", labelKey: "sales.invoiceStatuses.draft", tone: "gray" },
      { key: "validated", labelKey: "sales.invoiceStatuses.validated", tone: "green" },
      { key: "cancelled", labelKey: "sales.invoiceStatuses.cancelled", tone: "red" },
    ],
  },
  employee_status: {
    open: false,
    defaultKey: "active",
    options: [
      { key: "active", labelKey: "hr.employeeStatuses.active", tone: "green" },
      { key: "on_leave", labelKey: "hr.employeeStatuses.on_leave", tone: "amber" },
      { key: "terminated", labelKey: "hr.employeeStatuses.terminated", tone: "red" },
    ],
  },
};

/** Turn a free-text label into a stable slug key for a new custom option. */
export function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** The owning table + column a set's `key` is stored in (for the delete guard). */
export const SET_USAGE: Partial<Record<OptionSetKey, { table: string; column: string }>> = {
  crm_stage: { table: "leads", column: "stage" },
  project_status: { table: "projects", column: "status" },
  stock_entry_type: { table: "stock_entries", column: "entry_type" },
  item_type: { table: "items", column: "item_type" },
};
