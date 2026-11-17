export type UnitOfMeasure = 'PZ' | 'KG' | 'ML' | 'MQ' | 'MC' | 'NR' | 'CF' | string;

export type WarehouseLocation = 'MAGAZZINO' | 'DEPOSITO';

export type OrderStatus = 'NUOVO' | 'PRESO IN CARICO' | 'COMPLETATO';

export type OrderDocumentType = 'SCONTRINO' | 'DDT' | 'FATTURA' | 'NOTA_PRELIEVO';

export const ORDER_DOCUMENT_LABELS: Record<OrderDocumentType, string> = {
  SCONTRINO: 'Scontrino',
  DDT: 'DDT',
  FATTURA: 'Fattura',
  NOTA_PRELIEVO: 'Nota di prelievo',
};

export interface Product {
  id: string;
  code: string; // Preserves leading zeros as string (e.g. "001204")
  description: string;
  unit_of_measure: string; // Original UM (e.g. PZ, KG, ML, MQ, MC, etc.)
  alternative_code: string | null; // e.g. barcode or manufacturer reference
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  line_type?: 'PRODUCT' | 'DESCRIPTION';
  manual_description?: string | null;
  product_code_snapshot: string;
  product_description_snapshot: string;
  unit_of_measure_snapshot: string;
  alternative_code_snapshot: string | null;
  quantity: number; // Supports decimal values (e.g. 2.5 ML, 12.75 MQ)
}

export interface Order {
  id: string;
  order_number: string; // e.g. "ORD-000001"
  customer_reference: string | null; // Optional customer name, truck plate, jobsite
  document_type?: OrderDocumentType | null; // Document requested for this warehouse order
  warehouse_location?: WarehouseLocation | null; // Selected loading site
  status: OrderStatus;
  completed_by?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  items: OrderItem[];
}

export type UserRole = 'magazzino' | 'ufficio';

export interface UserSession {
  role: UserRole;
  name: string;
  authenticatedAt: string;
}

export interface ExcelImportRow {
  code: string;
  description: string;
  unit_of_measure: string;
  alternative_code: string | null;
  isValid: boolean;
  errors: string[];
}

export interface ExcelImportSummary {
  fileName: string;
  sheetName: string;
  headerRowIndex: number;
  totalRowsDetected: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicateCodesCount: number;
  missingUmCount: number;
  rows: ExcelImportRow[];
}

export interface CompanySettings {
  companyName: string;
  legalName: string;
  address: string;
  vatNumber: string;
  phone: string;
  email: string;
  notes: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export type CommitmentCategory = 'STANDARD' | 'VELUX';

export type CommitmentStatus = 'ATTIVO' | 'CARICATO';

export interface CommitmentItem {
  id: string;
  product_id: string | null;
  product_code: string;
  product_description: string;
  unit_of_measure: string;
  alternative_code?: string | null;
  quantity: number;
}

export interface CustomerCommitment {
  id: string;
  commitment_number: string;
  customer_name: string;
  category: CommitmentCategory;
  installer_name: string | null;
  notes?: string | null;
  status: CommitmentStatus;
  created_at: string;
  updated_at: string;
  items: CommitmentItem[];
}

export type ReminderCategory = 'ATTIVITA' | 'ORDINE_DA_PREPARARE';

export type ReminderPriority = 'NORMALE' | 'URGENTE';

export type ReminderStatus = 'DA_FARE' | 'COMPLETATO';

export type ReminderLocationScope = 'MAGAZZINO' | 'DEPOSITO' | 'ENTRAMBI';

export interface WarehouseReminder {
  id: string;
  title: string;
  description?: string | null;
  category: ReminderCategory;
  due_date: string; // Local calendar date YYYY-MM-DD
  due_time?: string | null; // Optional HH:mm
  priority: ReminderPriority;
  warehouse_location: ReminderLocationScope;
  customer_reference?: string | null;
  status: ReminderStatus;
  created_by?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  completion_note?: string | null;
  created_at: string;
  updated_at: string;
}

export type AppView =
  | 'magazzino'
  | 'magazzino_promemoria'
  | 'magazzino_impegni'
  | 'magazzino_storico'
  | 'ufficio_dashboard'
  | 'ufficio_promemoria'
  | 'ufficio_impegni'
  | 'ufficio_storico'
  | 'ufficio_cestino'
  | 'ufficio_catalogo'
  | 'ufficio_impostazioni';
