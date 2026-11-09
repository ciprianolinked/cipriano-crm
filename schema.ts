import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ProposalItem, ProposalSection } from "@/lib/proposal/types";

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
    // Variação mensal em milésimos de ponto percentual (0,123% = 123).
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
  tagline: text("tagline").notNull().default("Segurança eletrônica IP · Projetos, instalação e monitoramento"),
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
  hours: text("hours").notNull().default("NOC 24h · Comercial seg–sex 8h–18h"),
  defaultValidityDays: integer("default_validity_days").notNull().default(15),
  defaultPaymentTerms: text("default_payment_terms")
    .notNull()
    .default("40% de entrada na assinatura · 60% na entrega técnica (ou 12× no cartão corporativo)"),
  defaultDeliveryTime: text("default_delivery_time").notNull().default("12 dias úteis após aceite e liberação da obra"),
  defaultWarranty: text("default_warranty").notNull().default("24 meses equipamentos · 12 meses mão de obra"),
  proposalCounter: integer("proposal_counter").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ClientRow = typeof clients.$inferSelect;
export type ProposalRow = typeof proposals.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
export type CatalogRow = typeof catalogItems.$inferSelect;
export type SettingsRow = typeof appSettings.$inferSelect;
export type MaintenanceContractRow = typeof maintenanceContracts.$inferSelect;
export type MaintenanceReadjustRow = typeof maintenanceReadjusts.$inferSelect;
export type IpcaRowDb = typeof ipcaHistory.$inferSelect;
