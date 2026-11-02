/**
 * Export utilities supporting CSV and JSON with proper UTF-8 BOM encoding for Vietnamese text
 */

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  // \uFEFF is the UTF-8 Byte Order Mark (BOM) ensuring Microsoft Excel decodes Vietnamese accents correctly
  const bom = '\uFEFF';
  const csvContent = bom + [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => 
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    )
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
