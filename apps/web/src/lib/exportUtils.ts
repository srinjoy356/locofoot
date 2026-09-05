export function exportToCSV(filename: string, data: any[], columns: { key: string; label: string; formatter?: (val: any, row: any) => string }[]) {
  if (!data || !data.length) return;

  const header = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');

  const rows = data.map(row => 
    columns.map(col => {
      let val = col.formatter ? col.formatter(row[col.key], row) : row[col.key];
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
