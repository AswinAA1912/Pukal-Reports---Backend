import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportToPDF = (
  title: string,
  headers: string[],
  rows: any[][]
) => {
  const doc = new jsPDF("l", "mm", "a4");

  doc.text(title, 14, 15);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 25,
    styles: { fontSize: 8 },
  });

  doc.save(`${title}.pdf`);
};
