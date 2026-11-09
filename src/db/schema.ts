import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AttachmentMeta,
  QuoteItem,
  QuotationAnalysis,
  Supplier,
} from "@/lib/types";

/**
 * Histórico de arquivos PDF gerados pelo aplicativo (mapas e indicadores).
 * Guarda o nome do arquivo entregue no download, sem armazenar o binário.
 */
export const pdfExports = pgTable("pdf_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  kind: text("kind").notNull().default("mapa"),
  referenceId: uuid("reference_id"),
  protocol: text("protocol"),
  condominium: text("condominium"),
  periodStart: date("period_start", { mode: "string" }),
  periodEnd: date("period_end", { mode: "string" }),
  sizeBytes: integer("size_bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const condominiums = pgTable("condominiums", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  city: text("city"),
  manager: text("manager"),
  contactEmail: text("contact_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    protocol: text("protocol").notNull(),
    status: text("status").notNull().default("em_analise"),
    condominium: text("condominium").notNull().default(""),
    analysisDate: date("analysis_date", { mode: "string" }).notNull(),
    recipient: text("recipient").notNull().default(""),
    service: text("service").notNull().default(""),
    description: text("description").notNull().default(""),
    kind: text("kind").notNull().default("servico"),
    category: text("category").notNull().default("Manutenção predial"),
    suppliers: jsonb("suppliers").$type<Supplier[]>().notNull().default([]),
    items: jsonb("items").$type<QuoteItem[]>().notNull().default([]),
    analysis: jsonb("analysis").$type<QuotationAnalysis>().notNull().default({
      summary: "",
      recommendation: "",
      notes: "",
    }),
    attachments: jsonb("attachments").$type<AttachmentMeta[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("quotations_date_idx").on(table.analysisDate)],
);

// Configurações do aplicativo (ex.: chave da IA gratuita configurada pelo painel).
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuotationRow = typeof quotations.$inferSelect;
export type CondominiumRow = typeof condominiums.$inferSelect;
export type AppSettingRow = typeof appSettings.$inferSelect;
