import { PDFDocument, rgb } from "pdf-lib";
import { type MonthData } from "./worshipData";

// ─── Column positions (PDF x-coordinates, left to right in the template) ─────
// The template is RTL - leftmost columns are "أعمال صالحة", rightmost are "الفروض"
// Item IDs mapped to their x-center in PDF coordinate space

const COLUMN_X: Record<string, number> = {
  // أعمال صالحة (from left)
  tongue: 34.8,
  no_tv: 88.5,
  parents: 142.6,
  sadaqa: 196.7,
  // القرآن
  tilawa: 250.9,
  hifz: 305.0,
  // الأذكار
  tahlil: 359.1,
  istighfar: 413.3,
  evening: 467.4,
  morning: 522.0,
  // النوافل
  tarawih: 564.7,
  witr: 595.0,
  duha: 625.4,
  siyam: 655.7,
  // الفروض
  isha: 688.8,
  maghrib: 704.3,
  asr: 719.8,
  dhuhr: 735.3,
  fajr: 751.7,
};

// ─── Row positions (PDF y-coordinates, y=0 is bottom) ────────────────────────
// Day 1 is at the top of the table (highest y), Day 30 at the bottom (lowest y)

const ROW_Y: Record<number, number> = {
  1: 451.2, 2: 436.4, 3: 421.4, 4: 406.2, 5: 391.1,
  6: 376.1, 7: 361.0, 8: 345.8, 9: 330.6, 10: 315.3,
  11: 300.0, 12: 285.1, 13: 270.2, 14: 255.0, 15: 239.8,
  16: 224.7, 17: 209.7, 18: 194.6, 19: 179.4, 20: 164.0,
  21: 148.7, 22: 133.7, 23: 118.6, 24: 103.5, 25: 88.4,
  26: 73.3, 27: 58.2, 28: 43.1, 29: 27.9, 30: 12.8,
};

// Circle radius
const CIRCLE_R = 5;

// Category colors for filled circles
const ITEM_COLORS: Record<string, [number, number, number]> = {
  // الفروض - purple
  fajr: [0.48, 0.18, 0.71],
  dhuhr: [0.48, 0.18, 0.71],
  asr: [0.48, 0.18, 0.71],
  maghrib: [0.48, 0.18, 0.71],
  isha: [0.48, 0.18, 0.71],
  // النوافل - blue
  siyam: [0.17, 0.48, 0.71],
  duha: [0.17, 0.48, 0.71],
  witr: [0.17, 0.48, 0.71],
  tarawih: [0.17, 0.48, 0.71],
  // الأذكار - green
  morning: [0.17, 0.55, 0.37],
  evening: [0.17, 0.55, 0.37],
  istighfar: [0.17, 0.55, 0.37],
  tahlil: [0.17, 0.55, 0.37],
  // القرآن - gold
  hifz: [0.71, 0.55, 0.17],
  tilawa: [0.71, 0.55, 0.17],
  // أعمال صالحة - pink
  sadaqa: [0.71, 0.17, 0.44],
  parents: [0.71, 0.17, 0.44],
  no_tv: [0.71, 0.17, 0.44],
  tongue: [0.71, 0.17, 0.44],
};

export const exportWorshipPdf = async (
  data: MonthData,
  _year: number,
  _month: number,
  childName: string,
  totalDays: number
) => {
  // Load the template PDF
  const templateUrl = "/worship-template.pdf";
  const templateBytes = await fetch(templateUrl).then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);

  const page = pdfDoc.getPages()[0];

  // Draw filled circles for completed items
  for (let day = 1; day <= Math.min(totalDays, 30); day++) {
    const dayData = data[day] || {};
    const y = ROW_Y[day];
    if (y === undefined) continue;

    for (const [itemId, done] of Object.entries(dayData)) {
      if (!done) continue;
      const x = COLUMN_X[itemId];
      if (x === undefined) continue;

      const color = ITEM_COLORS[itemId] || [0.4, 0.4, 0.4];

      // Draw filled circle
      page.drawCircle({
        x,
        y,
        size: CIRCLE_R,
        color: rgb(color[0], color[1], color[2]),
        opacity: 0.9,
      });

      // Draw checkmark (two small lines)
      page.drawLine({
        start: { x: x - 2.5, y },
        end: { x: x - 0.5, y: y - 2 },
        thickness: 1.2,
        color: rgb(1, 1, 1),
        opacity: 0.95,
      });
      page.drawLine({
        start: { x: x - 0.5, y: y - 2 },
        end: { x: x + 3, y: y + 2.5 },
        thickness: 1.2,
        color: rgb(1, 1, 1),
        opacity: 0.95,
      });
    }
  }

  // Save and download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `عبادات-${childName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
