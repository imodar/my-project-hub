import jsPDF from "jspdf";
import { categories, allItems, type MonthData, getMonthLabel } from "./worshipData";

// Category colors matching the PDF design
const CAT_COLORS: Record<string, { header: string; headerText: string }> = {
  salah: { header: "#E8D5F5", headerText: "#7B2FB5" },
  nawafil: { header: "#D5E8F5", headerText: "#2B7CB5" },
  athkar: { header: "#D5F0E5", headerText: "#2B8B60" },
  quran: { header: "#F5ECD5", headerText: "#B58B2B" },
  good_deeds: { header: "#F5D5E5", headerText: "#B52B70" },
};

export const exportWorshipPdf = (
  data: MonthData,
  year: number,
  month: number,
  childName: string,
  totalDays: number
) => {
  // Landscape A4
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const pageH = 210;
  
  // Register and embed a basic font that supports Arabic
  // jsPDF doesn't natively support Arabic well, so we'll use canvas rendering
  
  const marginX = 5;
  const marginY = 5;
  const tableW = pageW - marginX * 2;
  const headerH = 22;
  const subHeaderH = 14;
  const rowH = 5.2;
  const dayColW = 22;
  const itemCount = allItems.length;
  const cellW = (tableW - dayColW) / itemCount;

  // Background
  doc.setFillColor(255, 240, 248);
  doc.rect(0, 0, pageW, pageH, "F");

  // Title bar
  doc.setFillColor(236, 143, 186);
  doc.roundedRect(marginX, marginY, tableW, headerH, 4, 4, "F");
  
  // Title text - use built-in font with manual positioning
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  const title = `${childName} - ${getMonthLabel(year, month)}`;
  // Draw from right side (RTL)
  doc.text(title, pageW - marginX - 8, marginY + 14, { align: "right" });
  
  doc.setFontSize(10);
  doc.text("Worship Tracker", marginX + 8, marginY + 14);

  const tableTop = marginY + headerH + 2;

  // Category headers
  let colX = marginX;
  // Day column header
  doc.setFillColor(240, 240, 245);
  doc.rect(colX, tableTop, dayColW, subHeaderH * 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Day", colX + dayColW / 2, tableTop + subHeaderH, { align: "center" });
  
  colX = marginX + dayColW;

  // Draw category group headers
  categories.forEach((cat) => {
    const catW = cellW * cat.items.length;
    const colors = CAT_COLORS[cat.id] || { header: "#E0E0E0", headerText: "#333" };
    
    // Category header
    const [hr, hg, hb] = hexToRgb(colors.header);
    doc.setFillColor(hr, hg, hb);
    doc.rect(colX, tableTop, catW, subHeaderH, "F");
    
    const [tr, tg, tb] = hexToRgb(colors.headerText);
    doc.setTextColor(tr, tg, tb);
    doc.setFontSize(8);
    doc.text(cat.label, colX + catW / 2, tableTop + 9, { align: "center" });
    
    // Sub-headers (item names)
    cat.items.forEach((item, idx) => {
      const ix = colX + idx * cellW;
      doc.setFillColor(hr, hg, hb);
      doc.setGlobalAlpha?.(0.5);
      doc.rect(ix, tableTop + subHeaderH, cellW, subHeaderH, "F");
      doc.setTextColor(tr, tg, tb);
      doc.setFontSize(5.5);
      doc.text(item.label, ix + cellW / 2, tableTop + subHeaderH + 9, { align: "center" });
    });
    
    colX += catW;
  });

  // Grid rows
  const gridTop = tableTop + subHeaderH * 2;
  
  for (let d = 1; d <= totalDays; d++) {
    const y = gridTop + (d - 1) * rowH;
    
    if (y + rowH > pageH - 5) break; // don't overflow page
    
    // Alternating row background
    if (d % 10 === 0) {
      doc.setFillColor(255, 230, 240);
    } else if (d % 2 === 0) {
      doc.setFillColor(252, 248, 255);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(marginX, y, tableW, rowH, "F");
    
    // Day label
    doc.setFontSize(6);
    doc.setTextColor(120, 80, 140);
    doc.text(`${d}`, marginX + dayColW / 2, y + rowH * 0.7, { align: "center" });
    
    // Circles for each item
    const dd = data[d] || {};
    let ix = marginX + dayColW;
    
    allItems.forEach((item) => {
      const cx = ix + cellW / 2;
      const cy = y + rowH / 2;
      const r = Math.min(cellW, rowH) * 0.3;
      
      const catId = categories.find(c => c.items.some(i => i.id === item.id))?.id || "";
      const colors = CAT_COLORS[catId] || { header: "#E0E0E0", headerText: "#333" };
      
      if (dd[item.id]) {
        // Filled circle
        const [fr, fg, fb] = hexToRgb(colors.headerText);
        doc.setFillColor(fr, fg, fb);
        doc.circle(cx, cy, r, "F");
        // Checkmark
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.line(cx - r * 0.4, cy, cx - r * 0.1, cy + r * 0.35);
        doc.line(cx - r * 0.1, cy + r * 0.35, cx + r * 0.4, cy - r * 0.3);
      } else {
        // Empty circle
        const [er, eg, eb] = hexToRgb(colors.header);
        doc.setDrawColor(er, eg, eb);
        doc.setLineWidth(0.3);
        doc.circle(cx, cy, r, "S");
      }
      
      ix += cellW;
    });
    
    // Row border
    doc.setDrawColor(230, 220, 235);
    doc.setLineWidth(0.1);
    doc.line(marginX, y + rowH, marginX + tableW, y + rowH);
  }

  // Grid column lines
  doc.setDrawColor(230, 220, 235);
  doc.setLineWidth(0.1);
  let lx = marginX + dayColW;
  for (let i = 0; i <= itemCount; i++) {
    doc.line(lx, tableTop, lx, gridTop + totalDays * rowH);
    lx += cellW;
  }
  
  // Outer border
  doc.setDrawColor(200, 180, 210);
  doc.setLineWidth(0.3);
  doc.rect(marginX, tableTop, tableW, subHeaderH * 2 + totalDays * rowH);

  // Save
  const monthLabel = getMonthLabel(year, month);
  doc.save(`${childName}-${monthLabel}.pdf`);
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
