import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format date string for PDF display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    return String(dateStr);
  }
};

/**
 * Color Palette Constants matching EduQuest Theme
 */
const COLORS = {
  navy: [30, 41, 59], // #1e293b
  indigo: [67, 56, 202], // #4338ca
  gold: [234, 179, 8], // #eab308
  slateBg: [248, 250, 252], // #f8fafc
  darkText: [15, 23, 42],
  mutedText: [100, 116, 139],
  emerald: [16, 185, 129],
  amberBg: [254, 243, 199],
  borderLine: [226, 232, 240],
};

/**
 * Generates and downloads a clean, professional PDF report of Item Analysis results
 */
export const exportItemAnalysisPdf = async ({
  selectedQuiz,
  analysis = [],
  testStats = null,
  totalAttempts = 0,
  allTakers = [],
  selectedCohortFilter = "all",
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 14;

  const quizTitle = typeof selectedQuiz === "string" ? selectedQuiz : (selectedQuiz?.title || "Item Analysis Report");
  const subjectName = selectedQuiz?.subject_name || selectedQuiz?.subjects?.name || selectedQuiz?.sections?.name || "";
  const sampleSize = testStats?.sampleSize || totalAttempts || allTakers?.length || 0;

  // ---------------- HEADER BANNER ----------------
  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Accent Line
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 28, pageWidth, 2, "F");

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("EduQuest • Item Analysis Report", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text("Bukidnon State University • Psychometric & Item Evaluation Report", margin, 21);

  currentY = 36;

  // ---------------- METADATA BOX ----------------
  doc.setFillColor(...COLORS.slateBg);
  doc.setDrawColor(...COLORS.borderLine);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 26, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.darkText);
  doc.text(quizTitle, margin + 4, currentY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.mutedText);
  if (subjectName) {
    doc.text(`Subject/Section: ${subjectName}`, margin + 4, currentY + 13);
  }
  doc.text(`Generated: ${formatDate(new Date())}`, margin + 4, currentY + (subjectName ? 18 : 13));

  // Right side meta stats
  const rightMetaX = pageWidth - margin - 65;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.navy);
  doc.text(`Total Questions: ${analysis.length}`, rightMetaX, currentY + 7);
  doc.text(`Total Examinees (N): ${sampleSize}`, rightMetaX, currentY + 13);
  if (selectedCohortFilter && selectedCohortFilter !== "all") {
    doc.text(`Cohort Filter: ${selectedCohortFilter}`, rightMetaX, currentY + 18);
  }

  currentY += 32;

  // ---------------- PSYCHOMETRIC OVERVIEW SUMMARY ----------------
  if (testStats) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text("Test Psychometric Overview & Statistics", margin, currentY);
    currentY += 4;

    const statsData = [
      [
        "Sample Size (N)",
        String(testStats.sampleSize || sampleSize),
        "Mean Score (x̄)",
        String(testStats.meanScore || "N/A"),
        "Std Dev (s)",
        String(testStats.stdDev || "N/A"),
      ],
      [
        "KR-20 Reliability (r_xx)",
        String(testStats.kr20Reliability || "N/A"),
        "SEM (S_e)",
        `±${testStats.sem || "N/A"}`,
        "SE Mean",
        `±${testStats.semMean || "N/A"}`,
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      body: statsData,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        textColor: COLORS.darkText,
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: COLORS.navy },
        1: { fontStyle: "normal" },
        2: { fontStyle: "bold", textColor: COLORS.navy },
        3: { fontStyle: "normal" },
        4: { fontStyle: "bold", textColor: COLORS.navy },
        5: { fontStyle: "normal" },
      },
      didParseCell: (data) => {
        data.cell.styles.fillColor = COLORS.slateBg;
      },
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  // ---------------- SECTION 1: QUESTION ITEM ANALYSIS SUMMARY ----------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text("Item Analysis Results Summary", margin, currentY);
  currentY += 4;

  const itemTableHead = [
    [
      "#",
      "Question Snippet",
      "Difficulty Index (P)",
      "Difficulty Level",
      "Discrimination Index (D)",
      "Discrimination Level",
      "Recommendation",
    ],
  ];

  const itemTableRows = analysis.map((item, idx) => {
    const qNum = idx + 1;
    const rawText = item.text || item.question || `Question ${qNum}`;
    const qSnippet = rawText.replace(/<[^>]*>?/gm, "").slice(0, 60);

    const fiVal = item.difficulty !== undefined && item.difficulty !== null ? item.difficulty : (item.facility_index !== undefined ? item.facility_index : (item.fi !== undefined ? item.fi : item.difficulty_index));
    const fiNum = parseFloat(fiVal);
    const fiStr = !isNaN(fiNum) ? fiNum.toFixed(2) : (fiVal ? String(fiVal) : "N/A");

    const diffLevel = item.status || item.level || item.difficulty_category || item.difficulty_status || "N/A";

    const discVal = item.discrimination !== undefined && item.discrimination !== null ? item.discrimination : item.discrimination_index;
    const discNum = parseFloat(discVal);
    const discStr = !isNaN(discNum) ? discNum.toFixed(2) : (discVal ? String(discVal) : "N/A");

    const discLevel = item.discStatus || item.discrimination_category || item.discrimination_status || "N/A";

    const rawFlag = item.autoFlag || item.flag || item.auto_flag;
    const autoFlag = rawFlag ? String(rawFlag).toUpperCase() : (diffLevel === "Difficult" ? "REVISE" : diffLevel === "Easy" ? "REVIEW" : "RETAIN");

    return [
      String(qNum),
      qSnippet,
      fiStr,
      diffLevel,
      discStr,
      discLevel,
      autoFlag,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: itemTableHead,
    body: itemTableRows,
    theme: "striped",
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      alignment: "left",
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 10, fontStyle: "bold", alignment: "center" },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, alignment: "center" },
      3: { cellWidth: 25, alignment: "center" },
      4: { cellWidth: 25, alignment: "center" },
      5: { cellWidth: 25, alignment: "center" },
      6: { cellWidth: 22, fontStyle: "bold", alignment: "center" },
    },
  });

  currentY = doc.lastAutoTable.finalY + 10;

  // ---------------- SECTION 2: EXAMINEES / STUDENTS TABLE (IF AVAILABLE) ----------------
  if (allTakers && allTakers.length > 0) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text(`Examinee Performance Roster (${allTakers.length} Students)`, margin, currentY);
    currentY += 4;

    const takersHead = [["#", "Student Name", "Raw Score", "Status"]];
    const takersRows = allTakers.map((t, idx) => [
      String(idx + 1),
      t.name || t.student_name || `Student ${idx + 1}`,
      String(t.score ?? t.raw_score ?? 0),
      t.status || "Completed",
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: takersHead,
      body: takersRows,
      theme: "grid",
      headStyles: {
        fillColor: COLORS.indigo,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 12, alignment: "center" },
        1: { cellWidth: 100 },
        2: { cellWidth: 35, alignment: "center", fontStyle: "bold" },
        3: { cellWidth: 35, alignment: "center" },
      },
    });

    currentY = doc.lastAutoTable.finalY + 10;
  }

  // ---------------- FOOTERS ACROSS ALL PAGES ----------------
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(...COLORS.borderLine);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mutedText);
    doc.text(
      "EduQuest System • Bukidnon State University • Item Analysis PDF Export",
      margin,
      pageHeight - 6
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: "right" }
    );
  }

  // Generate safe filename and trigger download
  const sanitizedTitle = quizTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const fileName = `Item_Analysis_${sanitizedTitle}.pdf`;
  doc.save(fileName);
};
