import { PDFDocument, rgb } from "pdf-lib";
import { type MonthData } from "./worshipData";

// ─── Column positions (PDF x-coordinates, left to right in the template) ─────
// The template is RTL - leftmost columns are "أعمال صالحة", rightmost are "الفروض"
// Item IDs mapped to their x-center in PDF coordinate space

const COLUMN_X: Record<string, number> = {
  // أعمال صالحة (from left)
  tongue: 34.5,
  no_tv: 73.6,
  parents: 112.6,
  sadaqa: 151.7,
  // القرآن
  tilawa: 190.7,
  hifz: 229.8,
  // الأذكار
  tahlil: 268.8,
  istighfar: 307.9,
  evening: 346.9,
  morning: 386.0,
  // النوافل
  tarawih: 425.1,
  witr: 464.1,
  duha: 503.2,
  siyam: 542.2,
  // الفروض
  isha: 581.3,
  maghrib: 620.3,
  asr: 659.4,
  dhuhr: 698.4,
  fajr: 737.5,
};

// ─── Row positions (PDF y-coordinates, y=0 is bottom) ────────────────────────
// Day 1 is at the top of the table (highest y), Day 30 at the bottom (lowest y)

const ROW_Y: Record<number, number> = {
  1: 437.1, 2: 422.3, 3: 407.5, 4: 392.7, 5: 377.9,
  6: 363.1, 7: 348.3, 8: 333.5, 9: 318.7, 10: 303.9,
  11: 289.1, 12: 274.3, 13: 259.5, 14: 244.7, 15: 229.9,
  16: 215.1, 17: 200.3, 18: 185.5, 19: 170.7, 20: 155.9,
  21: 141.1, 22: 126.3, 23: 111.5, 24: 96.7, 25: 81.9,
  26: 67.1, 27: 52.3, 28: 37.5, 29: 22.7, 30: 7.9,
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
  const blob = new Blob([pdfBytes.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `عبادات-${childName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
