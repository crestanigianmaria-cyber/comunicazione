export type UnitOfMeasure = 'PZ' | 'KG' | 'ML' | 'MQ' | 'MC' | 'NR' | 'CF' | string;

export type OrderStatus = 'NUOVO' | 'PRESO IN CARICO' | 'COMPLETATO';

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
  product_id: string;
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
  status: OrderStatus;
  created_at: string;
  updated_at: string;
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
