import * as XLSX from 'xlsx';
import { ExcelImportRow, ExcelImportSummary, Product } from '../types';

/**
 * Extracts raw string preserving leading zeros and whitespace integrity
 */
function getCellString(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';

  // If cell has formatted text representation (w), prefer it to preserve "001204"
  if (cell.w !== undefined && cell.w !== null) {
    return String(cell.w).trim();
  }

  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v).trim();
  }

  return '';
}

export async function parseExcelFile(
  file: File | ArrayBuffer,
  fileName = 'file.xlsx',
  existingCodes: Set<string> = new Set()
): Promise<ExcelImportSummary> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const workbook = XLSX.read(data, {
    type: 'array',
    raw: false,
    cellText: true,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Il file Excel non contiene alcun foglio di lavoro.');
  }

  // Look for the best sheet: preferably named 'ARTICOLI', 'CATALOGO', 'PRODOTTI', or the first non-empty sheet
  let targetSheetName = workbook.SheetNames[0];
  const preferredSheetNames = ['articoli', 'catalogo', 'prodotti', 'magazzino', 'sheet1', 'foglio1'];

  for (const name of workbook.SheetNames) {
    if (preferredSheetNames.some(p => name.toLowerCase().includes(p))) {
      targetSheetName = name;
      break;
    }
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet || !sheet['!ref']) {
    throw new Error(`Il foglio "${targetSheetName}" è vuoto.`);
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);

  // Scan top 30 rows to locate header row
  let headerRowIndex = -1;
  let colIndexCode = -1;
  let colIndexDesc = -1;
  let colIndexUM = -1;
  let colIndexAlt = -1;

  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 30); ++R) {
    let rowTexts: { c: number; text: string }[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[cellAddress];
      const text = getCellString(cell).toLowerCase();
      if (text) {
        rowTexts.push({ c: C, text });
      }
    }

    // Check if this row looks like an article catalog header
    const hasCode = rowTexts.some(rt => rt.text.includes('codic') || rt.text === 'cod' || rt.text === 'code' || rt.text === 'art' || rt.text === 'articolo');
    const hasDesc = rowTexts.some(rt => rt.text.includes('descr') || rt.text.includes('prodotto') || rt.text === 'articolo' || rt.text.includes('materiale'));
    const hasUM = rowTexts.some(rt => rt.text === 'um' || rt.text === 'u.m.' || rt.text.includes('misura') || rt.text.includes('unita'));

    if ((hasCode && hasDesc) || (hasCode && hasUM) || (hasDesc && hasUM)) {
      headerRowIndex = R;

      // Map detected columns
      for (const rt of rowTexts) {
        if (colIndexCode === -1 && (rt.text.includes('codic') || rt.text === 'cod' || rt.text === 'code' || rt.text === 'art')) {
          if (!rt.text.includes('alternat')) {
            colIndexCode = rt.c;
          }
        }
        if (colIndexDesc === -1 && (rt.text.includes('descr') || rt.text.includes('prodotto') || rt.text.includes('materiale'))) {
          colIndexDesc = rt.c;
        }
        if (colIndexUM === -1 && (rt.text === 'um' || rt.text === 'u.m.' || rt.text.includes('misura') || rt.text.includes('unita'))) {
          colIndexUM = rt.c;
        }
        if (colIndexAlt === -1 && (rt.text.includes('alternat') || rt.text.includes('barcode') || rt.text.includes('fornitor') || rt.text.includes('ean'))) {
          colIndexAlt = rt.c;
        }
      }
      break;
    }
  }

  // Fallback to strict column positional rules if header row wasn't automatically found
  // User spec: Colonna A (0) = Codice, Colonna B (1) = Descrizione, Colonna UM = Unità di misura, Colonna N (13) = Codice alternativo
  if (colIndexCode === -1) colIndexCode = 0; // Colonna A
  if (colIndexDesc === -1) colIndexDesc = 1; // Colonna B

  // If UM column not located, look for a column with header or column index
  if (colIndexUM === -1) {
    // Try to find any cell with UM header anywhere in first 5 rows
    for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 5); ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const txt = getCellString(sheet[XLSX.utils.encode_cell({ r: R, c: C })]).toLowerCase();
        if (txt === 'um' || txt === 'u.m.' || txt === 'unita di misura' || txt === 'u.m') {
          colIndexUM = C;
          break;
        }
      }
      if (colIndexUM !== -1) break;
    }
    // If still not found, check Colonna C (2) or Colonna D (3)
    if (colIndexUM === -1) {
      colIndexUM = range.e.c >= 2 ? 2 : 1;
    }
  }

  // Column N is index 13 in 0-based A=0, B=1, ... N=13
  if (colIndexAlt === -1) {
    if (range.e.c >= 13) {
      colIndexAlt = 13; // Colonna N
    } else {
      // Look for any alternative code column
      for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 5); ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const txt = getCellString(sheet[XLSX.utils.encode_cell({ r: R, c: C })]).toLowerCase();
          if (txt.includes('alt') || txt.includes('barcode') || txt.includes('ean')) {
            colIndexAlt = C;
            break;
          }
        }
        if (colIndexAlt !== -1) break;
      }
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : range.s.r;
  const parsedRows: ExcelImportRow[] = [];
  const seenCodesInFile = new Set<string>();

  let duplicateCount = 0;
  let missingUmCount = 0;

  for (let R = startRow; R <= range.e.r; ++R) {
    const codeCell = sheet[XLSX.utils.encode_cell({ r: R, c: colIndexCode })];
    const descCell = sheet[XLSX.utils.encode_cell({ r: R, c: colIndexDesc })];
    const umCell = colIndexUM >= 0 ? sheet[XLSX.utils.encode_cell({ r: R, c: colIndexUM })] : undefined;
    const altCell = colIndexAlt >= 0 ? sheet[XLSX.utils.encode_cell({ r: R, c: colIndexAlt })] : undefined;

    const rawCode = getCellString(codeCell);
    const rawDesc = getCellString(descCell);
    const rawUM = getCellString(umCell);
    const rawAlt = getCellString(altCell);

    // Skip totally empty rows
    if (!rawCode && !rawDesc && !rawUM) {
      continue;
    }

    // Skip repeated header rows
    if (
      rawCode.toLowerCase().includes('codic') ||
      rawDesc.toLowerCase().includes('descr')
    ) {
      continue;
    }

    const errors: string[] = [];

    if (!rawCode) {
      errors.push('Codice articolo mancante');
    }

    if (!rawDesc) {
      errors.push('Descrizione articolo mancante');
    }

    if (!rawUM) {
      errors.push('Unità di misura (UM) vuota');
      missingUmCount++;
    }

    if (rawCode) {
      if (seenCodesInFile.has(rawCode)) {
        errors.push(`Codice duplicato all'interno del file (${rawCode})`);
        duplicateCount++;
      } else {
        seenCodesInFile.add(rawCode);
      }

      if (existingCodes.has(rawCode)) {
        // Not a blocking error, but will update existing
      }
    }

    parsedRows.push({
      code: rawCode,
      description: rawDesc,
      unit_of_measure: rawUM,
      alternative_code: rawAlt || null,
      isValid: errors.length === 0, // UM is required to preserve the source unit exactly
      errors,
    });
  }

  const validRowsCount = parsedRows.filter(r => r.isValid).length;

  return {
    fileName,
    sheetName: targetSheetName,
    headerRowIndex,
    totalRowsDetected: parsedRows.length,
    validRowsCount,
    invalidRowsCount: parsedRows.length - validRowsCount,
    duplicateCodesCount: duplicateCount,
    missingUmCount,
    rows: parsedRows,
  };
}

export function generateSampleExcel(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Create columns headers matching the exact spec:
  // A: Codice, B: Descrizione, C: UM, D-M: (Empty/Reserved), N: Codice alternativo
  const sampleData: (string | null)[][] = [
    [
      'Codice',
      'Descrizione',
      'UM',
      '', '', '', '', '', '', '', '', '', '', // Columns D to M
      'Codice alternativo' // Column N
    ],
    ['001001', 'Cemento Portland Tipo 32.5 R - Sacco 25 kg', 'KG', '', '', '', '', '', '', '', '', '', '', 'CEM325-25'],
    ['001002', 'Cemento Portland Tipo 42.5 R Alta Resistenza - Sacco 25 kg', 'KG', '', '', '', '', '', '', '', '', '', '', 'CEM425-25'],
    ['001003', 'Calce Idraulica Naturale NHL 3.5 - Sacco 25 kg', 'PZ', '', '', '', '', '', '', '', '', '', '', 'CALCE-NHL35'],
    ['001004', 'Sabbia di Fiume Lavata 0-4 mm', 'MC', '', '', '', '', '', '', '', '', '', '', 'SABB-LAV-04'],
    ['002001', 'Blocco Forato in Laterizio 8x25x25 cm', 'PZ', '', '', '', '', '', '', '', '', '', '', 'LAT-FOR-08'],
    ['002002', 'Blocco Forato in Laterizio 12x25x25 cm 6 fori', 'PZ', '', '', '', '', '', '', '', '', '', '', 'LAT-FOR-12'],
    ['003001', 'Lastra Cartongesso Standard GKB Sp. 12.5 mm 120x200 cm', 'MQ', '', '', '', '', '', '', '', '', '', '', 'KNAUF-GKB-125'],
    ['003004', 'Montante a C 50x50 mm Acciaio Zincato L=300 cm', 'ML', '', '', '', '', '', '', '', '', '', '', 'MONT-C50-300'],
    ['003006', 'Viti Autofilettanti per Cartongesso 3.5x25 mm - Conf. 1000 pz', 'CF', '', '', '', '', '', '', '', '', '', '', 'VITI-CG-3525'],
    ['004001', 'Colla Adesiva Kerakoll H40 No Limits Grigio - Sacco 25 kg', 'KG', '', '', '', '', '', '', '', '', '', '', 'KER-H40-GR'],
    ['006001', 'Guaina Bituminosa Ardesiata Grigia 4.5 kg/m² - Rotolo 10 m', 'MQ', '', '', '', '', '', '', '', '', '', '', 'GUA-ARD-45'],
    ['007001', 'Rete Elettrosaldata B450C Ø 6 mm Maglia 20x20 cm 2x3 m', 'PZ', '', '', '', '', '', '', '', '', '', '', 'RETE-ELE-6-20'],
    ['008001', 'Tubo Corrugato per Drenaggio Ø 110 mm - Rotolo 50 m', 'ML', '', '', '', '', '', '', '', '', '', '', 'DREN-110-50'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);

  // Set explicit column widths
  ws['!cols'] = [
    { wch: 14 }, // A: Codice
    { wch: 55 }, // B: Descrizione
    { wch: 8 },  // C: UM
    { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, // D-M
    { wch: 22 }, // N: Codice alternativo
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'ARTICOLI');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

export function downloadSampleExcel(fileName = 'ARTICOLI.xlsx'): void {
  const bytes = generateSampleExcel();
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCatalogToExcel(products: Product[], fileName = 'CATALOGO_MAGAZZINO.xlsx'): void {
  const wb = XLSX.utils.book_new();

  const data: (string | null)[][] = [
    ['Codice', 'Descrizione', 'UM', '', '', '', '', '', '', '', '', '', '', 'Codice alternativo']
  ];

  for (const p of products) {
    const row = [p.code, p.description, p.unit_of_measure, '', '', '', '', '', '', '', '', '', '', p.alternative_code || ''];
    data.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 55 },
    { wch: 8 },
    { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 },
    { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'ARTICOLI');
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
