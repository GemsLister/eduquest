import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format a date into a clean readable string
 */
const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

/**
 * Helper to get option letter A, B, C, D...
 */
const getOptionLetter = (idx) => String.fromCharCode(65 + idx);

/**
 * Format diff strings for answer options
 */
const formatOptionsList = (opts, correctKey) => {
  if (!opts || opts.length === 0) return "No options recorded";
  return opts
    .map((opt, idx) => {
      const letter = getOptionLetter(idx);
      const isKey =
        String(opt).trim() === String(correctKey).trim() ||
        String(letter).toLowerCase() === String(correctKey).toLowerCase() ||
        String(idx) === String(correctKey);
      return `${letter}. ${opt} ${isKey ? "  [✓ CORRECT KEY]" : ""}`;
    })
    .join("\n");
};

/**
 * Color Palette Constants
 */
const COLORS = {
  navy: [30, 41, 59], // #1e293b
  indigo: [67, 56, 202], // #4338ca
  gold: [234, 179, 8], // #eab308
  slateBg: [248, 250, 252], // #f8fafc
  darkText: [15, 23, 42],
  mutedText: [100, 116, 139],
  amberBg: [254, 243, 199],
  borderLine: [226, 232, 240],
};

/**
 * Helper to render side-by-side comparison table for two revisions
 */
const renderSideBySideTable = (doc, oldRev, newRev, currentY, margin) => {
  const textDiff = oldRev.text.trim() !== newRev.text.trim();
  const typeDiff = oldRev.type !== newRev.type;
  const optionsDiff =
    JSON.stringify(oldRev.options) !== JSON.stringify(newRev.options);
  const keyDiff =
    String(oldRev.correct_answer).trim() !==
    String(newRev.correct_answer).trim();
  const pointsDiff =
    Number(oldRev.points) !== Number(newRev.points);
  const expDiff =
    (oldRev.explanation || "").trim() !== (newRev.explanation || "").trim();

  const compHeaders = [
    [
      "Field / Property",
      `LEFT: ${oldRev.title || "Older Revision"}`,
      `RIGHT: ${newRev.title || "Newer Revision"}`,
      "Change Status",
    ],
  ];

  const compRows = [
    [
      "Question Text",
      oldRev.text,
      newRev.text,
      textDiff ? "[CHANGED]" : "[MATCH]",
    ],
    [
      "Question Type",
      String(oldRev.type || "mcq").toUpperCase(),
      String(newRev.type || "mcq").toUpperCase(),
      typeDiff ? "[CHANGED]" : "[MATCH]",
    ],
    [
      "Points Value",
      `${oldRev.points || 1} pt(s)`,
      `${newRev.points || 1} pt(s)`,
      pointsDiff ? "[CHANGED]" : "[MATCH]",
    ],
    [
      "Answer Options",
      formatOptionsList(oldRev.options, oldRev.correct_answer),
      formatOptionsList(newRev.options, newRev.correct_answer),
      optionsDiff ? "[OPTIONS MODIFIED]" : "[MATCH]",
    ],
    [
      "Correct Answer Key",
      `Key: ${oldRev.correct_answer}`,
      `Key: ${newRev.correct_answer}`,
      keyDiff
        ? `[KEY CHANGED: ${oldRev.correct_answer} -> ${newRev.correct_answer}]`
        : "[MATCH]",
    ],
  ];

  if (oldRev.explanation || newRev.explanation) {
    compRows.push([
      "Explanation",
      oldRev.explanation || "N/A",
      newRev.explanation || "N/A",
      expDiff ? "[CHANGED]" : "[MATCH]",
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: compHeaders,
    body: compRows,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: {
      fillColor: COLORS.indigo,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.darkText,
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 68 },
      2: { cellWidth: 68 },
      3: { cellWidth: 24, fontStyle: "bold", halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const val = String(data.cell.raw);
        if (
          val.includes("[CHANGED]") ||
          val.includes("KEY CHANGED") ||
          val.includes("MODIFIED")
        ) {
          data.cell.styles.textColor = [180, 83, 9];
        } else {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    },
  });

  return doc.lastAutoTable.finalY;
};

/**
 * Generates and downloads a professional PDF report for Item Revision History
 * Supports both "selected" mode and "all" (complete evolution) mode.
 */
export const exportItemRevisionPdf = ({
  item,
  itemIndex,
  activeOldRevision,
  currentVersion,
  revisionsList = [],
  exportMode = "selected", // "selected" | "all"
}) => {
  if (!item || !activeOldRevision || !currentVersion) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const itemDisplayNumber =
    itemIndex !== undefined ? `Q${itemIndex + 1}` : item.question_id || "Item";

  const statusText = (
    item.autoFlag === "reject"
      ? "REJECT"
      : item.autoFlag === "revise"
      ? "REVISE"
      : item.autoFlag || item.status || "REVISE"
  ).toUpperCase();

  // Header Banner Background
  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Gold accent bar
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 28, pageWidth, 2, "F");

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(
    exportMode === "all"
      ? "ITEM REVISION HISTORY REPORT (ALL REVISIONS)"
      : "ITEM REVISION HISTORY REPORT",
    margin,
    13
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(
    `EduQuest Item Analysis Engine • Exported: ${formatDate(new Date())}`,
    margin,
    21
  );

  let currentY = 36;

  // Metadata Card Box
  doc.setFillColor(...COLORS.slateBg);
  doc.setDrawColor(...COLORS.borderLine);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.navy);
  doc.text(`ITEM: ${itemDisplayNumber}`, margin + 4, currentY + 7);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.mutedText);
  doc.text(
    `Question ID: ${item.question_id || item.id || "N/A"}`,
    margin + 4,
    currentY + 13
  );
  doc.text(
    `Flagged Status: ${statusText}`,
    margin + 4,
    currentY + 19
  );

  doc.text(
    exportMode === "all"
      ? `Export Scope: All Revisions (${revisionsList.length} total)`
      : `Selected Comparison: ${activeOldRevision.title} → Current`,
    pageWidth - margin - 4,
    currentY + 7,
    { align: "right" }
  );

  if (item.quiz_title || item.subject_name) {
    doc.text(
      `Quiz/Subject: ${item.quiz_title || item.subject_name}`,
      pageWidth - margin - 4,
      currentY + 13,
      { align: "right" }
    );
  }

  currentY += 29;

  // SECTION 1: FULL REVISION TIMELINE SUMMARY TABLE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text("1. FULL REVISION TIMELINE SUMMARY", margin, currentY);

  currentY += 4;

  const timelineHeaders = [
    ["Revision #", "Date & Time", "Author / Instructor", "Status", "Revision / Flag Reason"],
  ];

  const timelineRows = revisionsList.map((rev) => {
    const isSelected =
      exportMode === "selected" && rev.title === activeOldRevision.title;
    const revNumStr = isSelected ? `${rev.title} (Selected)` : rev.title;

    return [
      revNumStr,
      formatDate(rev.timestamp),
      rev.modified_by || "Instructor",
      rev.status || "Revision",
      rev.reason || "Item Analysis Revision",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: timelineHeaders,
    body: timelineRows,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.darkText,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 35 },
      2: { cellWidth: 32 },
      3: { cellWidth: 24, fontStyle: "bold" },
      4: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (
        data.section === "body" &&
        data.row.raw[0] &&
        data.row.raw[0].includes("(Selected)")
      ) {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  currentY = doc.lastAutoTable.finalY + 10;

  // MODE A: SELECTED REVISION COMPARISON
  if (exportMode === "selected") {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text("2. SIDE-BY-SIDE REVISION COMPARISON", margin, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.mutedText);
    doc.text(
      "Comparing historical snapshot (LEFT) against active live question (RIGHT). Differences are marked with [CHANGED].",
      margin,
      currentY + 5
    );

    currentY += 9;
    renderSideBySideTable(
      doc,
      activeOldRevision,
      currentVersion,
      currentY,
      margin
    );
  } else {
    // MODE B: ALL REVISIONS — DETAILED CONTENT & SEQUENTIAL EVOLUTION
    // Section 2: Full Content of Every Revision
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text("2. DETAILED CONTENT OF ALL REVISIONS", margin, currentY);

    currentY += 6;

    // Combine historical list with current version for full sequence
    const fullSequence = [...revisionsList];
    const lastRev = fullSequence[fullSequence.length - 1];
    if (!lastRev || lastRev.title !== currentVersion.title) {
      fullSequence.push(currentVersion);
    }

    fullSequence.forEach((rev, revIdx) => {
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 20;
      }

      const revTitle = rev.title || `Version ${revIdx + 1}`;
      const revHeaders = [
        [`${revTitle} Details`, `Value / Content`],
      ];

      const revRows = [
        ["Date & Time", formatDate(rev.timestamp)],
        ["Author / Instructor", rev.modified_by || "Instructor"],
        ["Status", rev.status || "Revision"],
        ["Question Text", rev.text || "N/A"],
        ["Question Type", String(rev.type || "mcq").toUpperCase()],
        ["Points Value", `${rev.points || 1} pt(s)`],
        [
          "Answer Choices",
          formatOptionsList(rev.options, rev.correct_answer),
        ],
        ["Correct Answer Key", `Key: ${rev.correct_answer}`],
      ];

      if (rev.explanation) {
        revRows.push(["Explanation", rev.explanation]);
      }

      autoTable(doc, {
        startY: currentY,
        head: revHeaders,
        body: revRows,
        margin: { left: margin, right: margin },
        theme: "grid",
        headStyles: {
          fillColor: revTitle.includes("Current") ? COLORS.navy : COLORS.indigo,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: COLORS.darkText,
          valign: "top",
        },
        columnStyles: {
          0: { cellWidth: 42, fontStyle: "bold" },
          1: { cellWidth: "auto" },
        },
      });

      currentY = doc.lastAutoTable.finalY + 8;
    });

    // Section 3: Sequential Evolution Comparisons
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text(
      "3. SEQUENTIAL STEP-BY-STEP EVOLUTION COMPARISONS",
      margin,
      currentY
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.mutedText);
    doc.text(
      "Chronological side-by-side progression showing how the question evolved across consecutive versions.",
      margin,
      currentY + 5
    );

    currentY += 9;

    for (let i = 0; i < fullSequence.length - 1; i++) {
      if (currentY > pageHeight - 65) {
        doc.addPage();
        currentY = 20;
      }

      const olderRev = fullSequence[i];
      const newerRev = fullSequence[i + 1];

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.indigo);
      doc.text(
        `Comparison Step ${i + 1}: ${olderRev.title}  →  ${newerRev.title}`,
        margin,
        currentY
      );

      currentY += 4;
      currentY = renderSideBySideTable(
        doc,
        olderRev,
        newerRev,
        currentY,
        margin
      );
      currentY += 8;
    }
  }

  // Footer page numbering across all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mutedText);
    doc.text(
      `EduQuest Item Revision History Report • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  // Generate safe filename and save
  const cleanId = (itemDisplayNumber || "Item").replace(/[^a-zA-Z0-9_-]/g, "_");
  const scopeSuffix = exportMode === "all" ? "_All_Revisions" : "_Revision_History";
  const filename = `${cleanId}${scopeSuffix}.pdf`;
  doc.save(filename);
};
