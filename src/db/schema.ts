import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ProposalItem, ProposalSection } from "@/lib/proposal/types";
import type { ReferenceAnalysis } from "@/lib/references";

/** PostgreSQL bytea — driver node-postgres already converts Buffer to/from bytea. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  company: text("company"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  document: text("document"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  segment: text("segment"),
  source: text("source"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull(),
  type: text("type").notNull().default("completa"),
  status: text("status").notNull().default("novo"),
  archived: boolean("archived").notNull().default(false),
  revision: integer("revision").notNull().default(1),
  parentProposalId: uuid("parent_proposal_id"),
  revisionGroupId: uuid("revision_group_id"),
  clientId: uuid("client_id"),
  clientName: text("client_name").notNull(),
  contact: text("contact"),
  clientEmail: text("client_email"),
  site: text("site"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  validityDays: integer("validity_days").notNull().default(15),
  discountPct: integer("discount_pct").notNull().default(0),
  items: jsonb("items").$type<ProposalItem[]>().notNull().default([]),
  sections: jsonb("sections").$type<ProposalSection[]>().notNull().default([]),
  paymentTerms: text("payment_terms"),
  deliveryTime: text("delivery_time"),
  warranty: text("warranty"),
  artIncluded: boolean("art_included").notNull().default(false),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  briefing: jsonb("briefing").$type<Record<string, unknown>>(),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  nextActionNote: text("next_action_note"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  lossReason: text("loss_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  proposalId: uuid("proposal_id").notNull(),
  kind: text("kind").notNull().default("nota"),
  content: text("content").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const catalogItems = pgTable("catalog_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull().default("equipamento"),
  category: text("category").notNull().default("CFTV"),
  description: text("description").notNull(),
  spec: text("spec"),
  unit: text("unit").notNull().default("un"),
  supplierPriceCents: integer("supplier_price_cents").notNull().default(0),
  marginPct: integer("margin_pct").notNull().default(30),
  priceCents: integer("price_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Histórico de revisão de preços do fornecedor (para justificar reajustes ao cliente). */
export const catalogPriceRevisions = pgTable("catalog_price_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull(),
  itemDescription: text("item_description").notNull(),
  oldSupplierCents: integer("old_supplier_cents").notNull().default(0),
  newSupplierCents: integer("new_supplier_cents").notNull().default(0),
  oldSaleCents: integer("old_sale_cents").notNull().default(0),
  newSaleCents: integer("new_sale_cents").notNull().default(0),
  marginPct: integer("margin_pct").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Contrato de manutenção mensal com reajuste anual por índice (IPCA). */
export const maintenanceContracts = pgTable("maintenance_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id"),
  clientName: text("client_name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  contractKind: text("contract_kind").notNull().default("manutencao"),
  contractValueCents: integer("contract_value_cents").notNull().default(0),
  proposalId: uuid("proposal_id"),
  proposalNumber: text("proposal_number"),
  proposalRevision: integer("proposal_revision"),
  proposalSnapshot: jsonb("proposal_snapshot").$type<Record<string, unknown>>(),
  contractText: text("contract_text").notNull().default(""),
  documentRevision: integer("document_revision").notNull().default(1),
  generationSource: text("generation_source").notNull().default("modelo"),
  monthlyCents: integer("monthly_cents").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  cycleMonths: integer("cycle_months").notNull().default(12),
  indexName: text("index_name").notNull().default("IPCA"),
  status: text("status").notNull().default("ativo"),
  lastReadjustAt: timestamp("last_readjust_at", { withTimezone: true }),
  nextReadjustAt: timestamp("next_readjust_at", { withTimezone: true }),
  lastReadjustPct: integer("last_readjust_pct").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const maintenanceReadjusts = pgTable("maintenance_readjusts", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").notNull(),
  readjustAt: timestamp("readjust_at", { withTimezone: true }).notNull().defaultNow(),
  oldMonthlyCents: integer("old_monthly_cents").notNull().default(0),
  newMonthlyCents: integer("new_monthly_cents").notNull().default(0),
  ipcaPct: integer("ipca_pct").notNull().default(0),
  percentMilli: integer("percent_milli"),
  indexName: text("index_name").notNull().default("IPCA"),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  source: text("source").notNull().default("ipca"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ipcaHistory = pgTable("ipca_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  month: text("month").notNull().unique(),
  pct: integer("pct").notNull().default(0),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const economicIndexValues = pgTable(
  "economic_index_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    indexName: text("index_name").notNull(),
    month: text("month").notNull(),
    percentMilli: integer("percent_milli").notNull(),
    source: text("source").notNull().default("bcb"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("economic_index_month_unique").on(t.indexName, t.month)],
);

export const maintenanceDocumentRevisions = pgTable("maintenance_document_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").notNull(),
  revision: integer("revision").notNull(),
  body: text("body").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("default"),
  companyName: text("company_name").notNull().default("Cipriano Tech & Security"),
  legalName: text("legal_name").notNull().default("Cipriano Tecnologia e Segurança Eletrônica LTDA"),
  tagline: text("tagline").notNull().default("Segurança eletrônica IP · Projetos, instalação e manutenção"),
  director: text("director").notNull().default("Gabriel Cipriano"),
  role: text("role").notNull().default("Diretor Técnico"),
  phone: text("phone").notNull().default("+55 (12) 99701-1890"),
  landline: text("landline").notNull().default("+55 (12) 99701-1890"),
  email: text("email").notNull().default("gabriel.ciprianotech@gmail.com"),
  site: text("site").notNull().default("ciprianotech.com.br"),
  address: text("address").notNull().default(
    "Alameda Raul Roldão da Costa, 183 - Vila Betania, São José dos Campos - SP, 12245-484",
  ),
  cnpj: text("cnpj").notNull().default("69.978.603/0001-69"),
  crea: text("crea").notNull().default("CREA-SP 5071138295-SP"),
  hours: text("hours").notNull().default("Comercial seg–sex 8h–18h · Suporte técnico sob contrato"),
  defaultValidityDays: integer("default_validity_days").notNull().default(15),
  defaultPaymentTerms: text("default_payment_terms")
    .notNull()
    .default("40% de entrada na assinatura · 60% na entrega técnica (ou 12× no cartão corporativo)"),
  defaultDeliveryTime: text("default_delivery_time").notNull().default("12 dias úteis após aceite e liberação da obra"),
  defaultWarranty: text("default_warranty").notNull().default("24 meses equipamentos · 12 meses mão de obra"),
  proposalCounter: integer("proposal_counter").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Propostas de concorrentes enviadas como referência de equalização (máx. 6). */
export const referenceFiles = pgTable("reference_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  data: bytea("data").notNull(),
  extractedText: text("extracted_text"),
  manualText: text("manual_text"),
  layoutRows: jsonb("layout_rows").$type<string[][]>(),
  analysis: jsonb("analysis").$type<ReferenceAnalysis>(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ReferenceFileRow = typeof referenceFiles.$inferSelect;

/** Termo de entrega e comissionamento gerado a partir de uma proposta ganha. */
export const deliveryTerms = pgTable("delivery_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  proposalId: uuid("proposal_id"),
  termNumber: text("term_number").notNull(),
  clientName: text("client_name").notNull(),
  site: text("site"),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }),
  technician: text("technician").notNull().default(""),
  receiverName: text("receiver_name").notNull().default(""),
  receiverDoc: text("receiver_doc").notNull().default(""),
  items: jsonb("items").$type<DeliveryTermItem[]>().notNull().default([]),
  intro: text("intro").notNull().default(""),
  scopeSummary: text("scope_summary").notNull().default(""),
  tests: text("tests").notNull().default(""),
  pendencies: text("pendencies").notNull().default(""),
  warranty: text("warranty").notNull().default(""),
  observations: text("observations").notNull().default(""),
  status: text("status").notNull().default("rascunho"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DeliveryTermItem = {
  id: string;
  desc: string;
  spec: string;
  unit: string;
  qty: number;
  checked: boolean;
  serial: string;
  obs: string;
};

/** Ordem de serviço: execução em campo e, quando necessário, orçamento vinculado. */
export const serviceOrders = pgTable("service_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull(),
  kind: text("kind").notNull().default("corretiva"),
  status: text("status").notNull().default("aberta"),
  priority: text("priority").notNull().default("normal"),
  clientId: uuid("client_id"),
  clientName: text("client_name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  email: text("email"),
  site: text("site"),
  description: text("description").notNull().default(""),
  diagnosis: text("diagnosis").notNull().default(""),
  solution: text("solution").notNull().default(""),
  technician: text("technician").notNull().default(""),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  laborCents: integer("labor_cents").notNull().default(0),
  items: jsonb("items").$type<ServiceOrderItem[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  clientSignature: text("client_signature").notNull().default(""),
  /** Proposta de origem (ex.: manutenção vendida) e orçamento gerado pela OS. */
  originProposalId: uuid("origin_proposal_id"),
  originProposalNumber: text("origin_proposal_number"),
  budgetProposalId: uuid("budget_proposal_id"),
  budgetProposalNumber: text("budget_proposal_number"),
  budgetTotalCents: integer("budget_total_cents").notNull().default(0),
  budgetIssuedAt: timestamp("budget_issued_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ServiceOrderItem = {
  id: string;
  desc: string;
  spec: string;
  unit: string;
  qty: number;
  priceCents: number;
  scope: string;
  /** false = item apenas de conferência, não entra no orçamento. */
  billable: boolean;
  checked: boolean;
  obs: string;
};

export type ServiceOrderRow = typeof serviceOrders.$inferSelect;

export type ClientRow = typeof clients.$inferSelect;
export type ProposalRow = typeof proposals.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
export type CatalogRow = typeof catalogItems.$inferSelect;
export type SettingsRow = typeof appSettings.$inferSelect;
export type MaintenanceContractRow = typeof maintenanceContracts.$inferSelect;
export type MaintenanceReadjustRow = typeof maintenanceReadjusts.$inferSelect;
export type IpcaRowDb = typeof ipcaHistory.$inferSelect;
