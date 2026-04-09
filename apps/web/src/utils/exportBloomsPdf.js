import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format item numbers into compact ranges
 * e.g., [1, 2, 3, 5, 7, 8] -> "1-3, 5, 7-8"
 */
const formatItemRange = (items) => {
  if (!items.length) return "";
  const sorted = [...items].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
};

const BLOOM_KEY_MAP = {
  Remembering: "R",
  Understanding: "U",
  Applying: "Ap",
  Analyzing: "An",
  Evaluating: "E",
  Creating: "C",
};

const BLOOM_KEYS = ["R", "U", "Ap", "An", "E", "C"];

/**
 * Load an image as HTMLImageElement for embedding in PDF
 */
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });

/**
 * Generates and downloads a TOS (Table of Specifications) PDF report
 * matching the BUKSU school template format.
 */
/**
 * Derive semester from a date based on Philippine academic calendar.
 * June-October = 1st Semester, November-March = 2nd Semester, April-May = Summer/Midyear
 */
const deriveSemester = (date) => {
  const month = date.getMonth(); // 0-indexed
  if (month >= 5 && month <= 9) return "1st Semester";
  if (month >= 10 || month <= 2) return "2nd Semester";
  return "Summer";
};

/**
 * Derive school year from a date based on Philippine academic calendar.
 * June onwards = currentYear - (currentYear+1), before June = (currentYear-1) - currentYear
 */
const deriveSchoolYear = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 5) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
};

export const exportBloomsPdf = async ({
  quizTitle,
  results,
  instructorName,
  reviewerName,
  approverName,
  submittedAt,
  adminFeedback,
  status,
  subjectCode,
  courseName,
  semesterOverride,
  schoolYearOverride,
  reviewedAt,
  facultyHeadApprovedAt,
}) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 10;

    // ── Header: Logo on left, text centered (matching school template) ──
    const headerStartY = y;
    const logoSize = 22;
    const textCenterX = pageWidth / 2;

    // Load & draw BUKSU university seal on the left
    try {
      const logo = await loadImage("/buksu-seal.png");
      doc.addImage(logo, "PNG", margin, headerStartY, logoSize, logoSize);
    } catch {
      // Continue without logo if it fails
    }

    // University name and address — centered on page
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BUKIDNON STATE UNIVERSITY", textCenterX, headerStartY + 6, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Malaybalay City, Bukidnon 8700", textCenterX, headerStartY + 12, {
      align: "center",
    });

    doc.setFontSize(8);
    doc.text(
      "Tel (088) 813-5661 to 5663; Telefax: (088) 813-2717, www.buksu.edu.ph",
      textCenterX,
      headerStartY + 17,
      { align: "center" },
    );

    y = headerStartY + logoSize + 4;

    y += 4;

    // ── Info Section (bordered form rows) ──
    const rowH = 8;
    const labelW = 42;
    const ix = margin;

    doc.setLineWidth(0.3);
    doc.setDrawColor(0);
    doc.setFontSize(9);

    // Row 1: College
    doc.rect(ix, y, contentWidth, rowH);
    doc.rect(ix, y, labelW, rowH);
    doc.setFont("helvetica", "bold");
    doc.text("College", ix + 2, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.text("COLLEGE OF TECHNOLOGIES", ix + labelW + 3, y + 5.5);
    y += rowH;

    // Row 2: Department
    doc.rect(ix, y, contentWidth, rowH);
    doc.rect(ix, y, labelW, rowH);
    doc.setFont("helvetica", "bold");
    doc.text("Department", ix + 2, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.text("INFORMATION TECHNOLOGY", ix + labelW + 3, y + 5.5);
    y += rowH;

    // Row 3: Subject Code + Descriptive Title
    doc.rect(ix, y, contentWidth, rowH);
    doc.rect(ix, y, labelW, rowH);
    const midCol = ix + contentWidth * 0.38;
    doc.line(midCol, y, midCol, y + rowH);
    const descLabelW = 30;
    doc.line(midCol + descLabelW, y, midCol + descLabelW, y + rowH);
    doc.setFont("helvetica", "bold");
    doc.text("Subject Code", ix + 2, y + 5.5);
    doc.setFont("helvetica", "normal");
    if (subjectCode) {
      doc.text(subjectCode, ix + labelW + 3, y + 5.5);
    }
    doc.setFont("helvetica", "bold");
    doc.text("Descriptive Title", midCol + 2, y + 5.5);
    doc.setFont("helvetica", "normal");
    const maxTitleWidth = contentWidth - (midCol - ix) - descLabelW - 4;
    const displayTitle = courseName || quizTitle || "Untitled";
    const truncTitle =
      doc.getTextWidth(displayTitle) > maxTitleWidth
        ? displayTitle.substring(0, 35) + "..."
        : displayTitle;
    doc.text(truncTitle, midCol + descLabelW + 3, y + 5.5);
    y += rowH;

    // Row 4: Type of Examination (taller row to fit subtitle)
    const examRowH = 12;
    doc.rect(ix, y, contentWidth, examRowH);
    const examLabelW = 58;
    doc.rect(ix, y, examLabelW, examRowH);
    doc.setFont("helvetica", "bold");
    doc.text("Type of Examination", ix + 2, y + 5);
    doc.setFontSize(7);
    doc.text("(Please check the box)", ix + 2, y + 9);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    // Mid-Term checkbox
    const cbX = ix + examLabelW + 5;
    doc.rect(cbX, y + 3.5, 3.5, 3.5);
    doc.text("Mid-Term", cbX + 5, y + 7);
    // Final-Term checkbox
    const cbX2 = cbX + 32;
    doc.rect(cbX2, y + 3.5, 3.5, 3.5);
    doc.text("Final-Term", cbX2 + 5, y + 7);
    y += examRowH;

    // Row 5: Semester + School Year
    doc.rect(ix, y, contentWidth, rowH);
    doc.rect(ix, y, labelW, rowH);
    const semMid = ix + contentWidth * 0.38;
    doc.line(semMid, y, semMid, y + rowH);
    const syrLabelW = 25;
    doc.line(semMid + syrLabelW, y, semMid + syrLabelW, y + rowH);
    doc.setFont("helvetica", "bold");
    doc.text("Semester", ix + 2, y + 5.5);
    doc.text("School Year", semMid + 2, y + 5.5);
    doc.setFont("helvetica", "normal");
    const refDate = submittedAt ? new Date(submittedAt) : new Date();
    const semesterText = semesterOverride || deriveSemester(refDate);
    const schoolYearText = schoolYearOverride || deriveSchoolYear(refDate);
    doc.text(semesterText, ix + labelW + 3, y + 5.5);
    doc.text(schoolYearText, semMid + syrLabelW + 3, y + 5.5);
    y += rowH;
    y += 6;

    // ── Prepare TOS Table Data ──
    const analysis = results?.analysis || [];
    const summary = results?.summary || {};
    const totalItems = analysis.length;

    // Group item numbers by Bloom's level
    const bloomGroups = {};
    BLOOM_KEYS.forEach((k) => (bloomGroups[k] = []));

    analysis.forEach((item, idx) => {
      const key = BLOOM_KEY_MAP[item.bloomsLevel];
      if (key) bloomGroups[key].push(idx + 1);
    });

    // Counts per level
    const bloomCounts = {};
    BLOOM_KEYS.forEach((k) => (bloomCounts[k] = bloomGroups[k].length));

    // LOTS = R + U + Ap, HOTS = An + E + C
    const lotsCount = bloomCounts.R + bloomCounts.U + bloomCounts.Ap;
    const hotsCount = bloomCounts.An + bloomCounts.E + bloomCounts.C;
    const lotsPct = totalItems ? Math.round((lotsCount / totalItems) * 100) : 0;
    const hotsPct = totalItems ? Math.round((hotsCount / totalItems) * 100) : 0;

    // ── Main TOS Table ──
    const bodyRows = [
      // Data row: quiz questions summary
      [
        {
          content:
            "Quiz questions classified by\nBloom's Taxonomy cognitive levels",
          styles: { fontSize: 7.5, halign: "left" },
        },
        "Multiple\nChoice",
        String(totalItems),
        formatItemRange(bloomGroups.R),
        formatItemRange(bloomGroups.U),
        formatItemRange(bloomGroups.Ap),
        formatItemRange(bloomGroups.An),
        formatItemRange(bloomGroups.E),
        formatItemRange(bloomGroups.C),
      ],
      // Subtotal row
      [
        {
          content: "Subtotal Based on Taxonomy Marks",
          colSpan: 3,
          styles: { fontStyle: "bold", halign: "left", fontSize: 8 },
        },
        String(bloomCounts.R),
        String(bloomCounts.U),
        String(bloomCounts.Ap),
        String(bloomCounts.An),
        String(bloomCounts.E),
        String(bloomCounts.C),
      ],
      // Percentage (LOTS & HOTS) row
      [
        {
          content: "Percentage (LOTS & HOTS)",
          colSpan: 3,
          styles: { fontStyle: "bold", halign: "left", fontSize: 8 },
        },
        {
          content: `${lotsPct}%`,
          colSpan: 3,
          styles: { halign: "center", fontStyle: "bold" },
        },
        {
          content: `${hotsPct}%`,
          colSpan: 3,
          styles: { halign: "center", fontStyle: "bold" },
        },
      ],
    ];

    autoTable(doc, {
      startY: y,
      head: [
        // Header row 1: merged cells
        [
          {
            content: "Learning Outcomes",
            rowSpan: 2,
            styles: { halign: "center", valign: "middle" },
          },
          {
            content: "Test Types",
            rowSpan: 2,
            styles: { halign: "center", valign: "middle" },
          },
          {
            content: "N",
            rowSpan: 2,
            styles: { halign: "center", valign: "middle" },
          },
          {
            content: "Levels of Thinking",
            colSpan: 6,
            styles: { halign: "center" },
          },
        ],
        // Header row 2: Bloom's level abbreviations
        [
          { content: "R", styles: { halign: "center" } },
          { content: "U", styles: { halign: "center" } },
          { content: "Ap", styles: { halign: "center" } },
          { content: "An", styles: { halign: "center" } },
          { content: "E", styles: { halign: "center" } },
          { content: "C", styles: { halign: "center" } },
        ],
      ],
      body: bodyRows,
      theme: "grid",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        halign: "center",
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 50, halign: "left" },
        1: { cellWidth: 24, halign: "center" },
        2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 16 },
        4: { cellWidth: 16 },
        5: { cellWidth: 16 },
        6: { cellWidth: 16 },
        7: { cellWidth: 16 },
        8: { cellWidth: 16 },
      },
      margin: { left: margin, right: margin },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.3,
    });

    y = doc.lastAutoTable.finalY + 20;

    // ── Signature Section ──
    if (y > pageHeight - 65) {
      doc.addPage();
      y = 20;
    }

    const formatSigDate = (dateStr) => {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const sigColWidth = contentWidth / 3;
    const sigStartY = y;
    const nameY = sigStartY + 12;
    const sigLineY = nameY + 2;
    const subtitleY = sigLineY + 4;
    const dateY = subtitleY + 8;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.3);

    // Prepared by
    doc.setFont("helvetica", "bold");
    doc.text("Prepared by:", ix + 2, sigStartY);
    const prepName = instructorName
      ? instructorName.toUpperCase()
      : "____________________";
    doc.text(prepName, ix + 2, nameY);
    doc.line(ix + 2, sigLineY, ix + sigColWidth - 6, sigLineY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text("Signature over printed name of faculty", ix + 2, subtitleY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const prepDate = formatSigDate(submittedAt);
    if (prepDate) {
      doc.text(`Date: ${prepDate}`, ix + 2, dateY);
    }

    // Reviewed by
    const revX = ix + sigColWidth;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Reviewed by:", revX + 2, sigStartY);
    doc.text(reviewerName ? reviewerName.toUpperCase() : "____________________", revX + 2, nameY);
    doc.line(revX + 2, sigLineY, revX + sigColWidth - 6, sigLineY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text(
      "Signature over Printed name of\nSenior Faculty",
      revX + 2,
      subtitleY,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const revDate = formatSigDate(reviewedAt);
    if (revDate) {
      doc.text(`Date: ${revDate}`, revX + 2, dateY);
    }

    // Approved by
    const appX = ix + sigColWidth * 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Approved by:", appX + 2, sigStartY);
    doc.text(approverName ? approverName.toUpperCase() : "____________________", appX + 2, nameY);
    doc.line(appX + 2, sigLineY, appX + sigColWidth - 6, sigLineY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text(
      "Signature over printed name of\nDepartment Head",
      appX + 2,
      subtitleY,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const appDate = formatSigDate(facultyHeadApprovedAt);
    if (appDate) {
      doc.text(`Date: ${appDate}`, appX + 2, dateY);
    }

    // ── Document Footer ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    const issueDate = submittedAt
      ? new Date(submittedAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
    const footerY = pageHeight - 8;
    doc.text(`Issue Date: ${issueDate}`, margin, footerY);
    doc.text("Page 1 of 1", pageWidth - margin, footerY, { align: "right" });

    // ── Save ──
    const sanitizedTitle = (quizTitle || "quiz-tos")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    doc.save(`tos-${sanitizedTitle}.pdf`);
  } catch (err) {
    console.error("Failed to generate TOS PDF:", err);
  }
};
