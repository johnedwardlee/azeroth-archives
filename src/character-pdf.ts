export type CharacterPdfIcon =
  | "shield"
  | "heart"
  | "boot"
  | "star"
  | "book"
  | "blades"
  | "scroll"
  | "spark"
  | "satchel"
  | "quill";

export type CharacterPdfRow = {
  name: string;
  detail: string;
};

export type CharacterPdfSection = {
  title: string;
  icon: CharacterPdfIcon;
  rows: CharacterPdfRow[];
};

export type CharacterPdfModel = {
  name: string;
  playerName: string;
  identityLine: string;
  portraitDataUrl?: string;
  stats: Array<{ label: string; value: string; icon: CharacterPdfIcon }>;
  abilities: Array<{ label: string; score: number; modifier: string }>;
  overviewSections: CharacterPdfSection[];
  detailMeta: string;
  detailSections: CharacterPdfSection[];
};

type PdfColor = [number, number, number];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PARCHMENT: PdfColor = [247, 241, 225];
const PAPER: PdfColor = [252, 249, 239];
const NAVY: PdfColor = [22, 46, 69];
const NAVY_LIGHT: PdfColor = [39, 68, 92];
const BRASS: PdfColor = [164, 119, 50];
const BRASS_LIGHT: PdfColor = [205, 171, 105];
const INK: PdfColor = [31, 43, 51];
const MUTED: PdfColor = [94, 91, 82];
const MAP_LINE: PdfColor = [204, 190, 157];
const RUST: PdfColor = [126, 51, 30];

function safeText(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2022\u00b7]/g, "-")
    .replace(/[\u00d7]/g, "x")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

export async function buildCharacterPdf(model: CharacterPdfModel) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const setFill = (color: PdfColor) => doc.setFillColor(...color);
  const setDraw = (color: PdfColor) => doc.setDrawColor(...color);
  const setText = (color: PdfColor) => doc.setTextColor(...color);

  function drawCompass(cx: number, cy: number, radius: number) {
    setDraw(BRASS);
    setFill(PARCHMENT);
    doc.setLineWidth(1.2);
    doc.circle(cx, cy, radius, "FD");
    doc.setLineWidth(0.7);
    doc.circle(cx, cy, radius * 0.52, "S");
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * index) / 4;
      const inner = index % 2 === 0 ? radius * 0.22 : radius * 0.36;
      const outer = index % 2 === 0 ? radius * 0.92 : radius * 0.7;
      doc.line(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner, cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    }
    setFill(NAVY);
    doc.circle(cx, cy, Math.max(1.8, radius * 0.12), "F");
  }

  function drawIcon(icon: CharacterPdfIcon, x: number, y: number, size = 11) {
    const left = x - size / 2;
    const top = y - size / 2;
    setDraw(BRASS_LIGHT);
    doc.setLineWidth(1);
    if (icon === "shield") {
      doc.lines([[size, 0], [0, size * 0.62], [-size / 2, size * 0.38], [-size / 2, -size * 0.38]], left, top, [1, 1], "S", true);
    } else if (icon === "heart") {
      doc.setFillColor(...RUST);
      doc.circle(x - size * 0.2, y - size * 0.15, size * 0.24, "F");
      doc.circle(x + size * 0.2, y - size * 0.15, size * 0.24, "F");
      doc.triangle(x - size * 0.42, y - size * 0.05, x + size * 0.42, y - size * 0.05, x, y + size * 0.48, "F");
    } else if (icon === "boot") {
      doc.line(left + size * 0.32, top, left + size * 0.2, top + size * 0.65);
      doc.line(left + size * 0.2, top + size * 0.65, left + size * 0.8, top + size);
      doc.line(left + size * 0.8, top + size, left + size, top + size * 0.78);
      doc.line(left + size, top + size * 0.78, left + size * 0.55, top + size * 0.48);
    } else if (icon === "star" || icon === "spark") {
      const spokes = icon === "star" ? 8 : 6;
      for (let index = 0; index < spokes; index += 1) {
        const angle = (Math.PI * index) / (spokes / 2);
        doc.line(x - Math.cos(angle) * size * 0.45, y - Math.sin(angle) * size * 0.45, x + Math.cos(angle) * size * 0.45, y + Math.sin(angle) * size * 0.45);
      }
      doc.circle(x, y, 1.2, "F");
    } else if (icon === "book") {
      doc.lines([[size * 0.42, size * 0.08], [0, size * 0.82], [-size * 0.42, -size * 0.08]], left, top + 1, [1, 1], "S");
      doc.lines([[size * 0.42, -size * 0.08], [0, -size * 0.82], [-size * 0.42, size * 0.08]], x, top + 1, [1, 1], "S");
      doc.line(x, top + 1, x, top + size);
    } else if (icon === "blades") {
      doc.line(left, top, left + size, top + size);
      doc.line(left + size, top, left, top + size);
      doc.line(left + size * 0.05, top + size * 0.28, left + size * 0.28, top + size * 0.05);
      doc.line(left + size * 0.72, top + size * 0.05, left + size * 0.95, top + size * 0.28);
    } else if (icon === "scroll") {
      doc.roundedRect(left + size * 0.15, top + size * 0.05, size * 0.7, size * 0.9, 2, 2, "S");
      doc.line(left + size * 0.28, top + size * 0.35, left + size * 0.72, top + size * 0.35);
      doc.line(left + size * 0.28, top + size * 0.58, left + size * 0.65, top + size * 0.58);
    } else if (icon === "satchel") {
      doc.roundedRect(left + size * 0.08, top + size * 0.35, size * 0.84, size * 0.6, 2, 2, "S");
      doc.roundedRect(x - size * 0.24, top + size * 0.12, size * 0.48, size * 0.38, 2, 2, "S");
      doc.line(left + size * 0.08, top + size * 0.55, left + size * 0.92, top + size * 0.55);
    } else if (icon === "quill") {
      doc.line(left + size * 0.15, top + size, left + size * 0.88, top + size * 0.05);
      doc.line(left + size * 0.42, top + size * 0.65, left + size * 0.22, top + size * 0.38);
      doc.line(left + size * 0.58, top + size * 0.48, left + size * 0.4, top + size * 0.2);
      doc.line(left + size * 0.7, top + size * 0.33, left + size * 0.58, top + size * 0.08);
    }
  }

  function drawMapTexture() {
    setDraw(MAP_LINE);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([2, 3], 0);
    doc.lines([[14, -4], [11, 8], [16, -3], [10, 10], [18, -4]], 23, 126, [1, 1], "S");
    doc.lines([[-12, 8], [-10, 13], [-16, 7], [-9, 14], [-15, 8]], 589, 474, [1, 1], "S");
    doc.setLineDashPattern([], 0);
    doc.circle(38, 632, 16, "S");
    doc.line(22, 632, 54, 632);
    doc.line(38, 616, 38, 648);
    doc.lines([[10, -8], [8, 12], [12, -9], [9, 8]], 510, 716, [1, 1], "S");
  }

  function drawFrame(withCompasses: boolean) {
    setFill(PARCHMENT);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
    setDraw(NAVY);
    doc.setLineWidth(8);
    doc.rect(8, 8, PAGE_WIDTH - 16, PAGE_HEIGHT - 16, "S");
    setDraw(BRASS);
    doc.setLineWidth(1.6);
    doc.rect(14, 14, PAGE_WIDTH - 28, PAGE_HEIGHT - 28, "S");
    setDraw(NAVY_LIGHT);
    doc.setLineWidth(0.7);
    doc.rect(18, 18, PAGE_WIDTH - 36, PAGE_HEIGHT - 36, "S");
    drawMapTexture();
    if (withCompasses) {
      drawCompass(PAGE_WIDTH / 2, 18, 14);
      drawCompass(PAGE_WIDTH / 2, 773, 15);
    }
  }

  function writeWrapped(text: string, x: number, y: number, width: number, maxLines: number, fontSize: number, lineHeight: number) {
    const lines = doc.splitTextToSize(safeText(text), width) as string[];
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) {
      const last = visible.length - 1;
      visible[last] = `${visible[last].replace(/[.\s]+$/, "")}...`;
    }
    doc.setFontSize(fontSize);
    doc.text(visible, x, y, { lineHeightFactor: lineHeight / fontSize });
    return visible.length;
  }

  function drawSectionCard(section: CharacterPdfSection, x: number, y: number, width: number, height: number, maxRows: number) {
    setFill(PAPER);
    setDraw(NAVY_LIGHT);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, width, height, 3, 3, "FD");
    setFill(NAVY);
    doc.roundedRect(x, y, width, 22, 3, 3, "F");
    doc.rect(x, y + 10, width, 12, "F");
    setText(BRASS_LIGHT);
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text(safeText(section.title), x + width / 2, y + 15, { align: "center" });
    drawIcon(section.icon, x + width - 13, y + 11, 10);
    const rows = section.rows.slice(0, maxRows);
    if (!rows.length) {
      setText(MUTED);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.text("None recorded", x + 10, y + 39);
      return;
    }
    const available = height - 30;
    const rowHeight = Math.max(13, available / rows.length);
    rows.forEach((row, index) => {
      const rowY = y + 34 + index * rowHeight;
      setText(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      const name = safeText(row.name);
      doc.text(name.length > 31 ? `${name.slice(0, 29)}...` : name, x + 9, rowY);
      if (row.detail) {
        setText(MUTED);
        doc.setFont("helvetica", "normal");
        const detailX = section.title === "SAVING THROWS" || section.title === "SKILLS" ? x + width - 10 : x + 9;
        if (detailX === x + width - 10) {
          doc.setFontSize(7);
          doc.text(safeText(row.detail), detailX, rowY, { align: "right" });
        } else if (rowHeight >= 23) {
          writeWrapped(row.detail, detailX, rowY + 9, width - 18, 1, 6.5, 7.5);
        }
      }
      if (index < rows.length - 1) {
        setDraw(MAP_LINE);
        doc.setLineWidth(0.25);
        doc.line(x + 8, rowY + rowHeight - 7, x + width - 8, rowY + rowHeight - 7);
      }
    });
  }

  drawFrame(true);
  setText(NAVY);
  doc.setFont("times", "bold");
  doc.setFontSize(27);
  doc.text("AZEROTH ARCHIVES", PAGE_WIDTH / 2, 48, { align: "center", charSpace: 0.5 });
  setText(MUTED);
  doc.setFont("times", "normal");
  doc.setFontSize(6.8);
  doc.text("AN EXPLORER'S LEDGER - CHRONICLES OF HEROES ACROSS AZEROTH", PAGE_WIDTH / 2, 62, { align: "center", charSpace: 0.45 });

  const portraitX = 44;
  const portraitY = 82;
  const portraitSize = 145;
  setFill(PAPER);
  setDraw(BRASS);
  doc.setLineWidth(2.2);
  doc.circle(portraitX + portraitSize / 2, portraitY + portraitSize / 2, portraitSize / 2, "FD");
  if (model.portraitDataUrl) {
    try {
      doc.saveGraphicsState();
      doc.circle(portraitX + portraitSize / 2, portraitY + portraitSize / 2, portraitSize / 2 - 4, "S");
      doc.clip();
      doc.addImage(model.portraitDataUrl, "JPEG", portraitX + 4, portraitY + 4, portraitSize - 8, portraitSize - 8);
      doc.restoreGraphicsState();
    } catch {
      // A corrupt legacy portrait should never block exporting the rest of the sheet.
    }
  }
  if (!model.portraitDataUrl) {
    setText(NAVY);
    doc.setFont("times", "bold");
    doc.setFontSize(40);
    const initials = safeText(model.name).split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "AA";
    doc.text(initials, portraitX + portraitSize / 2, portraitY + 87, { align: "center" });
  }

  setText(NAVY);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  const heroName = safeText(model.name || "Unnamed Hero");
  doc.text(heroName.length > 28 ? `${heroName.slice(0, 26)}...` : heroName, 211, 104);
  setText(MUTED);
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  writeWrapped(model.identityLine, 212, 121, 355, 1, 8.5, 10);
  doc.setFontSize(7.5);
  doc.text(`PLAYER: ${safeText(model.playerName || "Not recorded")}`, 212, 134);

  const statY = 145;
  const statWidth = 87.5;
  model.stats.slice(0, 4).forEach((stat, index) => {
    const x = 211 + index * statWidth;
    setFill(PAPER);
    setDraw(MAP_LINE);
    doc.setLineWidth(0.6);
    doc.rect(x, statY, statWidth, 68, "FD");
    drawIcon(stat.icon, x + statWidth / 2, statY + 16, 12);
    setText(MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.text(safeText(stat.label), x + statWidth / 2, statY + 32, { align: "center" });
    setText(index === 1 ? RUST : NAVY);
    doc.setFont("times", "bold");
    doc.setFontSize(stat.value.length > 9 ? 14 : 18);
    doc.text(safeText(stat.value), x + statWidth / 2, statY + 55, { align: "center" });
  });

  const abilityY = 239;
  const abilityWidth = 82;
  model.abilities.slice(0, 6).forEach((ability, index) => {
    const x = 42 + index * 88;
    setFill(PAPER);
    setDraw(BRASS);
    doc.setLineWidth(0.75);
    doc.roundedRect(x, abilityY, abilityWidth, 68, 3, 3, "FD");
    setText(NAVY);
    doc.setFont("times", "bold");
    doc.setFontSize(7.3);
    doc.text(safeText(ability.label).toUpperCase(), x + abilityWidth / 2, abilityY + 14, { align: "center" });
    setFill(NAVY);
    doc.circle(x + abilityWidth / 2, abilityY + 34, 12, "F");
    setText(BRASS_LIGHT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(safeText(ability.label).slice(0, 3).toUpperCase(), x + abilityWidth / 2, abilityY + 36.5, { align: "center" });
    setText(INK);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text(String(ability.score), x + 29, abilityY + 59, { align: "center" });
    setText(RUST);
    doc.setFontSize(10);
    doc.text(safeText(ability.modifier), x + 57, abilityY + 58, { align: "center" });
  });

  const overview = model.overviewSections;
  drawSectionCard(overview[0] ?? { title: "SAVING THROWS", icon: "shield", rows: [] }, 42, 323, 166, 142, 6);
  drawSectionCard(overview[1] ?? { title: "SKILLS", icon: "book", rows: [] }, 223, 323, 166, 142, 7);
  drawSectionCard(overview[2] ?? { title: "ATTACKS", icon: "blades", rows: [] }, 404, 323, 166, 142, 5);
  drawSectionCard(overview[3] ?? { title: "FEATURES", icon: "scroll", rows: [] }, 42, 479, 250, 162, 6);
  drawSectionCard(overview[4] ?? { title: "SPELLS", icon: "spark", rows: [] }, 306, 479, 264, 162, 7);
  drawSectionCard(overview[5] ?? { title: "EQUIPMENT", icon: "satchel", rows: [] }, 42, 655, 250, 88, 4);
  drawSectionCard(overview[6] ?? { title: "NOTES", icon: "quill", rows: [] }, 306, 655, 264, 88, 2);

  let detailY = 92;
  function addDetailPage() {
    doc.addPage();
    drawFrame(false);
    setFill(NAVY);
    doc.roundedRect(24, 22, 564, 48, 4, 4, "F");
    setDraw(BRASS);
    doc.setLineWidth(1);
    doc.line(34, 65, 578, 65);
    setText(BRASS_LIGHT);
    doc.setFont("times", "bold");
    doc.setFontSize(17);
    doc.text(`${safeText(model.name || "Hero")} - LIVING RECORD`, 38, 48);
    setText(PAPER);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const meta = safeText(model.detailMeta);
    doc.text(meta.length > 90 ? `${meta.slice(0, 88)}...` : meta, 574, 48, { align: "right" });
    detailY = 88;
  }

  function drawDetailHeader(section: CharacterPdfSection, continued = false) {
    setFill(NAVY);
    doc.roundedRect(30, detailY, 552, 23, 3, 3, "F");
    setText(BRASS_LIGHT);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(`${safeText(section.title)}${continued ? " - CONTINUED" : ""}`, 43, detailY + 15);
    drawIcon(section.icon, 566, detailY + 11.5, 10);
    detailY += 27;
  }

  function ensureDetailSpace(height: number, section?: CharacterPdfSection) {
    if (detailY + height <= 748) return false;
    addDetailPage();
    if (section) drawDetailHeader(section, true);
    return true;
  }

  function detailRowHeight(row: CharacterPdfRow) {
    const detailLines = doc.splitTextToSize(safeText(row.detail).slice(0, 1200), 522) as string[];
    return Math.max(23, 17 + Math.min(detailLines.length, 12) * 8);
  }

  addDetailPage();
  model.detailSections.forEach((section) => {
    const firstRow = section.rows[0] ?? { name: "None recorded", detail: "" };
    ensureDetailSpace(31 + detailRowHeight(firstRow));
    drawDetailHeader(section);
    const rows = section.rows.length ? section.rows : [{ name: "None recorded", detail: "" }];
    rows.forEach((row, index) => {
      const detailLines = doc.splitTextToSize(safeText(row.detail).slice(0, 1200), 522) as string[];
      const visibleDetail = detailLines.slice(0, 12);
      const rowHeight = detailRowHeight(row);
      ensureDetailSpace(rowHeight + 4, section);
      if (index % 2 === 0) {
        setFill(PAPER);
        doc.rect(30, detailY - 1, 552, rowHeight, "F");
      }
      setText(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.text(safeText(row.name), 40, detailY + 10);
      if (visibleDetail.length) {
        setText(MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        doc.text(visibleDetail, 40, detailY + 20, { lineHeightFactor: 1.1 });
      }
      setDraw(MAP_LINE);
      doc.setLineWidth(0.25);
      doc.line(38, detailY + rowHeight - 2, 574, detailY + rowHeight - 2);
      detailY += rowHeight;
    });
    detailY += 9;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setText(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("Generated with Azeroth Archives", 30, 770);
    doc.text(`PAGE ${page} OF ${pageCount}`, 582, 770, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
