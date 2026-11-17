import { OrderItem } from '../types';

function cleanField(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

/**
 * Formats order lines separated by TAB (\t) and NEWLINE (\n).
 * Compatible with Excel AND with the Saggin Windows ERP macro.
 */
export function formatOrderRowsTabSeparated(items: OrderItem[]): string {
  return items
    .map((item) => {
      if (item.line_type === 'DESCRIPTION') {
        const note = cleanField(item.manual_description || item.product_description_snapshot);
        return `NOTA\t${note}\t\t`;
      }
      return [
        cleanField(item.product_code_snapshot),
        cleanField(item.product_description_snapshot),
        cleanField(item.unit_of_measure_snapshot),
        cleanField(item.quantity),
      ].join('\t');
    })
    .join('\n');
}

/**
 * Formats order lines using NEWLINE (\n) between fields (Enter-style).
 */
export function formatOrderRowsEnterSeparated(items: OrderItem[]): string {
  return items
    .map((item) => {
      if (item.line_type === 'DESCRIPTION') {
        return cleanField(item.manual_description || item.product_description_snapshot);
      }
      return [
        cleanField(item.product_code_snapshot),
        cleanField(item.product_description_snapshot),
        cleanField(item.unit_of_measure_snapshot),
        cleanField(item.quantity),
      ].join('\n');
    })
    .join('\n');
}

/**
 * Generates a self-contained Windows .bat macro (uses built-in Windows PowerShell + SendKeys,
 * zero external software needed). Reads the TAB-separated rows from the clipboard and fills
 * the desktop ERP row by row:
 *   Codice -> Invio -> Descrizione -> Invio -> Unita di misura -> Invio -> Quantita -> Freccia giu
 */
export function buildWindowsErpMacroBat(): string {
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    'title Saggin - Incolla Ordine su Gestionale',
    'color 0F',
    'echo ============================================================',
    'echo   SAGGIN GUGLIELMO S.R.L. - AUTO-COMPILAZIONE GESTIONALE',
    'echo ============================================================',
    'echo.',
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$parts = (Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8) -split '###POWERSHELL_START###'; if ($parts.Length -ge 2) { Invoke-Expression $parts[1] }"`,
    'echo.',
    'pause',
    'exit /b',
    '',
    '###POWERSHELL_START###',
    'Add-Type -AssemblyName System.Windows.Forms',
    '',
    '$raw = Get-Clipboard -Raw',
    'if ([string]::IsNullOrWhiteSpace($raw)) {',
    '  Write-Host "ERRORE: Gli appunti sono vuoti!" -ForegroundColor Red',
    '  Write-Host "1) Apri l ordine sul Portale Ufficio"',
    '  Write-Host "2) Clicca su Copia Righe"',
    '  Write-Host "3) Riapri questo file"',
    '  return',
    '}',
    '',
    '$rows = @($raw -split "\\r?\\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })',
    'if ($rows.Count -eq 0) {',
    '  Write-Host "Nessuna riga valida trovata negli appunti." -ForegroundColor Red',
    '  return',
    '}',
    '',
    'Write-Host ("Trovate " + $rows.Count + " righe pronte per il gestionale.") -ForegroundColor Green',
    'Write-Host ""',
    'Write-Host "Clicca ORA nella casella CODICE della prima riga del gestionale!" -ForegroundColor Yellow',
    'Write-Host ""',
    'for ($s = 4; $s -ge 1; $s--) {',
    '  Write-Host ("Partenza tra " + $s + " secondi...")',
    '  Start-Sleep -Seconds 1',
    '}',
    '',
    'function Paste-Field([string]$val) {',
    '  if (-not [string]::IsNullOrEmpty($val)) {',
    '    Set-Clipboard -Value $val',
    '    Start-Sleep -Milliseconds 40',
    '    [System.Windows.Forms.SendKeys]::SendWait("^v")',
    '    Start-Sleep -Milliseconds 70',
    '  }',
    '}',
    '',
    'foreach ($row in $rows) {',
    '  $cols = $row -split "`t"',
    '  $code = if ($cols.Length -ge 1) { $cols[0].Trim() } else { "" }',
    '  $desc = if ($cols.Length -ge 2) { $cols[1].Trim() } else { "" }',
    '  $uom  = if ($cols.Length -ge 3) { $cols[2].Trim() } else { "" }',
    '  $qty  = if ($cols.Length -ge 4) { $cols[3].Trim() } else { "" }',
    '',
    '  if ($code -eq "NOTA") {',
    '    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
    '    Start-Sleep -Milliseconds 70',
    '    Paste-Field $desc',
    '    [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")',
    '    Start-Sleep -Milliseconds 120',
    '    continue',
    '  }',
    '',
    '  # 1. Codice -> Invio',
    '  Paste-Field $code',
    '  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
    '  Start-Sleep -Milliseconds 90',
    '',
    '  # 2. Descrizione articolo -> Invio',
    '  Paste-Field $desc',
    '  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
    '  Start-Sleep -Milliseconds 90',
    '',
    '  # 3. Unita di misura -> Invio',
    '  Paste-Field $uom',
    '  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
    '  Start-Sleep -Milliseconds 90',
    '',
    '  # 4. Quantita -> Freccia in giu',
    '  Paste-Field $qty',
    '  [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")',
    '  Start-Sleep -Milliseconds 130',
    '}',
    '',
    '# Ripristina negli appunti l ordine originale',
    'Set-Clipboard -Value $raw',
    'Write-Host ""',
    'Write-Host "COMPLETATO! Tutte le righe sono state inserite." -ForegroundColor Green',
  ];

  return lines.join('\r\n') + '\r\n';
}

export function downloadWindowsErpMacroScript(): void {
  const content = buildWindowsErpMacroBat();
  const blob = new Blob([content], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Saggin_Incolla_Gestionale.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
