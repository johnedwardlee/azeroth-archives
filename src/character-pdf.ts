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
const PARCHMENT: PdfColor = [244, 235, 213];
const PAPER: PdfColor = [255, 250, 238];
const NAVY: PdfColor = [16, 38, 61];
const NAVY_LIGHT: PdfColor = [31, 61, 89];
const BRASS: PdfColor = [172, 121, 42];
const BRASS_LIGHT: PdfColor = [226, 185, 99];
const INK: PdfColor = [28, 40, 49];
const MUTED: PdfColor = [92, 85, 73];
const MAP_LINE: PdfColor = [205, 186, 145];
const RUST: PdfColor = [132, 53, 32];

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

  function drawRuneSeal(cx: number, cy: number, radius: number) {
    setFill(PARCHMENT);
    setDraw(BRASS);
    doc.setLineWidth(1.3);
    doc.lines([[radius, radius], [-radius, radius], [-radius, -radius], [radius, -radius]], cx, cy - radius, [1, 1], "FD", true);
    setDraw(NAVY_LIGHT);
    doc.setLineWidth(0.75);
    doc.lines([[0, radius * 0.72], [radius * 0.54, radius * 0.44], [-radius * 0.2, radius * 0.12], [radius * 0.46, radius * 0.72]], cx - radius * 0.38, cy - radius * 0.76, [1, 1], "S");
    setFill(RUST);
    doc.circle(cx, cy, Math.max(1.6, radius * 0.11), "F");
  }

  function drawCornerOrnament(x: number, y: number, horizontal: 1 | -1, vertical: 1 | -1) {
    setDraw(BRASS);
    doc.setLineWidth(1.05);
    doc.line(x, y, x + 24 * horizontal, y);
    doc.line(x, y, x, y + 24 * vertical);
    doc.line(x + 5 * horizontal, y + 5 * vertical, x + 17 * horizontal, y + 5 * vertical);
    doc.line(x + 5 * horizontal, y + 5 * vertical, x + 5 * horizontal, y + 17 * vertical);
    setFill(RUST);
    doc.circle(x + 5 * horizontal, y + 5 * vertical, 1.7, "F");
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

  function drawParchmentTexture() {
    setDraw(MAP_LINE);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([2, 3], 0);
    doc.lines([[15, -5], [10, 9], [16, -4], [11, 11], [17, -5]], 22, 128, [1, 1], "S");
    doc.lines([[-13, 8], [-9, 13], [-15, 8], [-10, 14], [-16, 7]], 590, 476, [1, 1], "S");
    doc.setLineDashPattern([], 0);
    doc.lines([[8, -8], [8, 8], [-8, 8], [-8, -8]], 34, 650, [1, 1], "S", true);
    doc.line(34, 638, 34, 662);
    doc.line(22, 650, 46, 650);
    doc.lines([[10, -8], [8, 12], [12, -9], [9, 8]], 516, 716, [1, 1], "S");
  }

  function drawFrame(withSeal: boolean) {
    setFill(PARCHMENT);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
    setDraw(NAVY);
    doc.setLineWidth(9);
    doc.rect(9, 9, PAGE_WIDTH - 18, PAGE_HEIGHT - 18, "S");
    setDraw(BRASS);
    doc.setLineWidth(1.8);
    doc.rect(16, 16, PAGE_WIDTH - 32, PAGE_HEIGHT - 32, "S");
    setDraw(NAVY_LIGHT);
    doc.setLineWidth(0.65);
    doc.rect(21, 21, PAGE_WIDTH - 42, PAGE_HEIGHT - 42, "S");
    drawCornerOrnament(26, 26, 1, 1);
    drawCornerOrnament(PAGE_WIDTH - 26, 26, -1, 1);
    drawCornerOrnament(26, PAGE_HEIGHT - 26, 1, -1);
    drawCornerOrnament(PAGE_WIDTH - 26, PAGE_HEIGHT - 26, -1, -1);
    drawParchmentTexture();
    if (withSeal) drawRuneSeal(PAGE_WIDTH / 2, 19, 13);
  }

  function writeWrapped(text: string, x: number, y: number, width: number, maxLines: number, fontSize: number, lineHeight: number) {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(safeText(text), width) as string[];
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) {
      const last = visible.length - 1;
      visible[last] = `${visible[last].replace(/[.\s]+$/, "")}...`;
    }
    doc.text(visible, x, y, { lineHeightFactor: lineHeight / fontSize });
    return visible.length;
  }

  function drawSectionCard(section: CharacterPdfSection, x: number, y: number, width: number, height: number, maxRows: number) {
    setFill(PAPER);
    setDraw(NAVY_LIGHT);
    doc.setLineWidth(0.9);
    doc.roundedRect(x, y, width, height, 4, 4, "FD");
    setFill(NAVY);
    doc.roundedRect(x, y, width, 24, 4, 4, "F");
    doc.rect(x, y + 11, width, 13, "F");
    setFill(BRASS);
    doc.rect(x, y, 4, height, "F");
    doc.rect(x + 4, y + 23, width - 4, 1.2, "F");
    setDraw(BRASS_LIGHT);
    doc.setLineWidth(0.9);
    doc.circle(x + 17, y + 12, 7, "S");
    drawIcon(section.icon, x + 17, y + 12, 9);
    setText(BRASS_LIGHT);
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text(safeText(section.title), x + 30, y + 16);
    const rows = section.rows.slice(0, maxRows);
    if (!rows.length) {
      setText(MUTED);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.text("None recorded", x + 13, y + 42);
      return;
    }
    const available = height - 32;
    const rowHeight = Math.max(13, available / rows.length);
    rows.forEach((row, index) => {
      const rowY = y + 36 + index * rowHeight;
      setText(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      const name = safeText(row.name);
      doc.text(name.length > 31 ? `${name.slice(0, 29)}...` : name, x + 13, rowY);
      if (row.detail) {
        setText(MUTED);
        doc.setFont("helvetica", "normal");
        const detailX = section.title === "SAVING THROWS" || section.title === "SKILLS" ? x + width - 11 : x + 13;
        if (detailX === x + width - 10) {
          doc.setFontSize(7);
          doc.text(safeText(row.detail), detailX, rowY, { align: "right" });
        } else if (rowHeight >= 23) {
          writeWrapped(row.detail, detailX, rowY + 9, width - 26, 1, 6.5, 7.5);
        }
      }
      if (index < rows.length - 1) {
        setDraw(MAP_LINE);
        doc.setLineWidth(0.25);
        doc.line(x + 12, rowY + rowHeight - 7, x + width - 10, rowY + rowHeight - 7);
      }
    });
  }

  drawFrame(true);
  setText(NAVY);
  doc.setFont("times", "bold");
  doc.setFontSize(25);
  doc.text("AZEROTH ARCHIVES", PAGE_WIDTH / 2, 49, { align: "center", charSpace: 0.65 });
  setText(BRASS);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("WARCRAFT 5E CHARACTER RECORD", PAGE_WIDTH / 2, 62, { align: "center", charSpace: 1.05 });
  setDraw(BRASS);
  doc.setLineWidth(0.75);
  doc.line(168, 68, 444, 68);

  const portraitX = 42;
  const portraitY = 82;
  const portraitSize = 132;
  setFill(NAVY);
  setDraw(BRASS);
  doc.setLineWidth(2.1);
  doc.roundedRect(portraitX, portraitY, portraitSize, portraitSize, 6, 6, "FD");
  setDraw(BRASS_LIGHT);
  doc.setLineWidth(0.8);
  doc.roundedRect(portraitX + 5, portraitY + 5, portraitSize - 10, portraitSize - 10, 4, 4, "S");
  if (model.portraitDataUrl) {
    try {
      doc.addImage(model.portraitDataUrl, "JPEG", portraitX + 7, portraitY + 7, portraitSize - 14, portraitSize - 14);
    } catch {
      // A corrupt legacy portrait should never block exporting the rest of the sheet.
    }
  }
  if (!model.portraitDataUrl) {
    setText(BRASS_LIGHT);
    doc.setFont("times", "bold");
    doc.setFontSize(36);
    const initials = safeText(model.name).split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "AA";
    doc.text(initials, portraitX + portraitSize / 2, portraitY + 78, { align: "center" });
    drawRuneSeal(portraitX + portraitSize / 2, portraitY + 105, 8);
  }

  const identityX = 188;
  const identityY = 82;
  const identityWidth = 382;
  setFill(NAVY);
  setDraw(BRASS);
  doc.setLineWidth(1.2);
  doc.roundedRect(identityX, identityY, identityWidth, 132, 6, 6, "FD");
  setFill(NAVY_LIGHT);
  doc.roundedRect(identityX + 6, identityY + 6, identityWidth - 12, 48, 3, 3, "F");
  setDraw(BRASS_LIGHT);
  doc.setLineWidth(0.65);
  doc.line(identityX + 15, identityY + 56, identityX + identityWidth - 15, identityY + 56);
  setText(BRASS_LIGHT);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  const heroName = safeText(model.name || "Unnamed Hero");
  doc.text(heroName.length > 29 ? `${heroName.slice(0, 27)}...` : heroName, identityX + 18, identityY + 27);
  setText(PAPER);
  doc.setFont("helvetica", "normal");
  writeWrapped(model.identityLine, identityX + 18, identityY + 42, identityWidth - 36, 1, 7.5, 9);
  setText(BRASS_LIGHT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.text(`PLAYER  ${safeText(model.playerName || "NOT RECORDED")}`, identityX + 18, identityY + 68);

  const statY = identityY + 77;
  const statWidth = 91;
  model.stats.slice(0, 4).forEach((stat, index) => {
    const x = identityX + 9 + index * statWidth;
    setFill(PAPER);
    setDraw(BRASS);
    doc.setLineWidth(0.55);
    doc.roundedRect(x, statY, statWidth - 4, 45, 3, 3, "FD");
    drawIcon(stat.icon, x + 14, statY + 12, 9);
    setText(MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.text(safeText(stat.label), x + 25, statY + 14);
    setText(index === 1 ? RUST : NAVY);
    doc.setFont("times", "bold");
    doc.setFontSize(stat.value.length > 9 ? 12.5 : 16);
    doc.text(safeText(stat.value), x + (statWidth - 4) / 2, statY + 35, { align: "center" });
  });

  const abilityY = 230;
  const abilityWidth = 82;
  model.abilities.slice(0, 6).forEach((ability, index) => {
    const x = 42 + index * 88;
    setFill(PAPER);
    setDraw(BRASS);
    doc.setLineWidth(0.9);
    doc.roundedRect(x, abilityY, abilityWidth, 74, 4, 4, "FD");
    setFill(NAVY);
    doc.roundedRect(x + 5, abilityY + 5, abilityWidth - 10, 18, 3, 3, "F");
    setText(NAVY);
    doc.setFont("times", "bold");
    setText(BRASS_LIGHT);
    doc.setFontSize(7.1);
    doc.text(safeText(ability.label).toUpperCase(), x + abilityWidth / 2, abilityY + 17, { align: "center" });
    setText(INK);
    doc.setFont("times", "bold");
    doc.setFontSize(24);
    doc.text(String(ability.score), x + abilityWidth / 2, abilityY + 50, { align: "center" });
    setFill(NAVY);
    doc.circle(x + abilityWidth / 2, abilityY + 64, 9, "F");
    setText(RUST);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(BRASS_LIGHT);
    doc.text(safeText(ability.modifier), x + abilityWidth / 2, abilityY + 66.8, { align: "center" });
  });

  const overview = model.overviewSections;
  drawSectionCard(overview[0] ?? { title: "SAVING THROWS", icon: "shield", rows: [] }, 42, 319, 166, 142, 6);
  drawSectionCard(overview[1] ?? { title: "SKILLS", icon: "book", rows: [] }, 223, 319, 166, 142, 7);
  drawSectionCard(overview[2] ?? { title: "ATTACKS", icon: "blades", rows: [] }, 404, 319, 166, 142, 5);
  drawSectionCard(overview[3] ?? { title: "FEATURES", icon: "scroll", rows: [] }, 42, 475, 250, 162, 6);
  drawSectionCard(overview[4] ?? { title: "SPELLS", icon: "spark", rows: [] }, 306, 475, 264, 162, 7);
  drawSectionCard(overview[5] ?? { title: "EQUIPMENT", icon: "satchel", rows: [] }, 42, 651, 250, 94, 4);
  drawSectionCard(overview[6] ?? { title: "NOTES", icon: "quill", rows: [] }, 306, 651, 264, 94, 2);

  let detailY = 101;
  function addDetailPage() {
    doc.addPage();
    drawFrame(false);
    setFill(NAVY);
    doc.roundedRect(29, 28, 554, 57, 5, 5, "F");
    setFill(NAVY_LIGHT);
    doc.roundedRect(36, 35, 540, 43, 3, 3, "F");
    setDraw(BRASS);
    doc.setLineWidth(0.9);
    doc.line(80, 72, 530, 72);
    drawRuneSeal(55, 56.5, 12);
    setText(BRASS_LIGHT);
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    const pageTitle = safeText(model.name || "Hero");
    doc.text(pageTitle.length > 31 ? `${pageTitle.slice(0, 29)}...` : pageTitle, 78, 53);
    setText(PAPER);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.text("LIVING CHARACTER RECORD", 79, 66, { charSpace: 0.7 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    const meta = safeText(model.detailMeta);
    doc.text(meta.length > 68 ? `${meta.slice(0, 66)}...` : meta, 530, 55, { align: "right" });
    detailY = 101;
  }

  function drawDetailHeader(section: CharacterPdfSection, continued = false) {
    setFill(NAVY);
    doc.roundedRect(34, detailY, 544, 27, 4, 4, "F");
    setFill(BRASS);
    doc.rect(34, detailY, 5, 27, "F");
    setDraw(BRASS_LIGHT);
    doc.setLineWidth(0.75);
    doc.circle(52, detailY + 13.5, 7, "S");
    drawIcon(section.icon, 52, detailY + 13.5, 9);
    setText(BRASS_LIGHT);
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text(`${safeText(section.title)}${continued ? " - CONTINUED" : ""}`, 67, detailY + 17);
    detailY += 32;
  }

  function ensureDetailSpace(height: number, section?: CharacterPdfSection) {
    if (detailY + height <= 757) return false;
    addDetailPage();
    if (section) drawDetailHeader(section, true);
    return true;
  }

  function detailRowHeight(row: CharacterPdfRow) {
    const detailLines = doc.splitTextToSize(safeText(row.detail).slice(0, 1600), 506) as string[];
    return Math.max(20, 15 + Math.min(detailLines.length, 14) * 7.5);
  }

  addDetailPage();
  model.detailSections.forEach((section) => {
    const rows = section.rows.length ? section.rows : [{ name: "None recorded", detail: "" }];
    const completeSectionHeight = 41 + rows.reduce((total, row) => total + detailRowHeight(row), 0);
    if (completeSectionHeight <= 645 && detailY + completeSectionHeight > 757) addDetailPage();
    else ensureDetailSpace(32 + detailRowHeight(rows[0]));
    drawDetailHeader(section);
    rows.forEach((row, index) => {
      const detailLines = doc.splitTextToSize(safeText(row.detail).slice(0, 1600), 506) as string[];
      const visibleDetail = detailLines.slice(0, 14);
      const rowHeight = detailRowHeight(row);
      ensureDetailSpace(rowHeight + 4, section);
      if (index % 2 === 0) {
        setFill(PAPER);
        doc.roundedRect(34, detailY - 1, 544, rowHeight, 2, 2, "F");
      }
      setFill(BRASS);
      doc.circle(46, detailY + 8, 1.5, "F");
      setText(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(safeText(row.name), 54, detailY + 10);
      if (visibleDetail.length) {
        setText(MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(visibleDetail, 54, detailY + 19, { lineHeightFactor: 1.08 });
      }
      setDraw(MAP_LINE);
      doc.setLineWidth(0.25);
      doc.line(46, detailY + rowHeight - 2, 566, detailY + rowHeight - 2);
      detailY += rowHeight;
    });
    detailY += 9;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 2; page <= pageCount; page += 1) {
    doc.setPage(page);
    setFill(PARCHMENT);
    setDraw(BRASS);
    doc.setLineWidth(0.8);
    doc.lines([[10, 10], [-10, 10], [-10, -10], [10, -10]], 555, 36, [1, 1], "FD", true);
    setText(NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(`${page} / ${pageCount}`, 555, 48.5, { align: "center" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
