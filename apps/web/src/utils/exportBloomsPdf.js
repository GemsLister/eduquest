import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BLOOM_COLORS = {
  Remembering: [59, 130, 246],
  Understanding: [6, 182, 212],
  Applying: [34, 197, 94],
  Analyzing: [234, 179, 8],
  Evaluating: [249, 115, 22],
  Creating: [168, 85, 247],
};

const BLOOM_ORDER = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

/**
 * Generates and downloads a Bloom's Taxonomy Analysis PDF report
 */
export const exportBloomsPdf = ({ quizTitle, results, instructorName, submittedAt, adminFeedback, status }) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Header ──
  doc.setFillColor(55, 48, 107); // indigo-900
  doc.rect(0, 0, pageWidth, 44, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("BUKSU CITL", 14, 12);
  doc.setFontSize(22);
  doc.text("Bloom's Taxonomy Analysis", 14, 24);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("AI-Powered Cognitive Level Classification Report", 14, 32);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 14, 39);
  y = 54;

  // ── Quiz Info ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Quiz Details", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const infoItems = [
    ["Quiz Title", quizTitle || "Untitled Quiz"],
  ];
  if (instructorName) infoItems.push(["Instructor", instructorName]);
  if (submittedAt) {
    infoItems.push(["Submitted", new Date(submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })]);
  }
  if (status) {
    const statusLabels = { pending: "Pending Review", approved: "Approved", revision_requested: "Revision Requested", rejected: "Rejected", faculty_head_review: "Awaiting Faculty Head Approval", faculty_head_approved: "Approved by Faculty Head" };
    infoItems.push(["Status", statusLabels[status] || status]);
  }

  infoItems.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}: `, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 14 + doc.getTextWidth(`${label}: `), y);
    y += 6;
  });

  y += 4;

  // ── Summary Stats ──
  const summary = results?.summary;
  if (summary) {
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(14, y - 4, pageWidth - 28, 30, 3, 3, "F");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Analysis Summary", 18, y + 2);
    y += 10;

    const statsX = [18, 60, 102, 148];
    const stats = [
      { label: "Total Questions", value: String(summary.totalQuestions || 0) },
      { label: "LOTS", value: `${summary.lotsCount || 0} (${summary.lotsPercentage || 0}%)` },
      { label: "HOTS", value: `${summary.hotsCount || 0} (${summary.hotsPercentage || 0}%)` },
      { label: "Flagged", value: String(summary.flaggedCount || 0) },
    ];

    stats.forEach((stat, i) => {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(55, 48, 107);
      doc.text(stat.value, statsX[i], y + 2);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(stat.label, statsX[i], y + 8);
    });

    y += 20;
  }

  // ── LOTS vs HOTS Bar ──
  if (summary) {
    y += 6;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("LOTS vs HOTS Distribution", 14, y);
    y += 6;

    const barWidth = pageWidth - 28;
    const barHeight = 10;
    const lotsPct = (summary.lotsPercentage || 0) / 100;
    const hotsPct = (summary.hotsPercentage || 0) / 100;

    // LOTS bar
    if (lotsPct > 0) {
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(14, y, barWidth * lotsPct, barHeight, 2, 2, "F");
    }
    // HOTS bar
    if (hotsPct > 0) {
      doc.setFillColor(245, 158, 11);
      doc.roundedRect(14 + barWidth * lotsPct, y, barWidth * hotsPct, barHeight, 2, 2, "F");
    }

    // Labels on bar
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    if (lotsPct >= 0.15) {
      doc.text(`LOTS ${summary.lotsPercentage}%`, 16, y + 7);
    }
    if (hotsPct >= 0.15) {
      doc.text(`HOTS ${summary.hotsPercentage}%`, 14 + barWidth * lotsPct + 3, y + 7);
    }

    y += barHeight + 4;
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Remembering, Understanding, Applying", 14, y);
    doc.text("Analyzing, Evaluating, Creating", pageWidth - 14, y, { align: "right" });
    y += 8;
  }

  // ── Distribution Table ──
  if (summary?.distribution) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Bloom's Level Distribution", 14, y);
    y += 4;

    const total = summary.totalQuestions || 1;
    const distRows = BLOOM_ORDER.map((level) => {
      const count = summary.distribution[level] || 0;
      const pct = Math.round((count / total) * 100);
      const isHots = ["Analyzing", "Evaluating", "Creating"].includes(level);
      return [level, isHots ? "HOTS" : "LOTS", String(count), `${pct}%`];
    });

    autoTable(doc, {
      startY: y,
      head: [["Bloom's Level", "Thinking Order", "Count", "Percentage"]],
      body: distRows,
      theme: "grid",
      headStyles: { fillColor: [55, 48, 107], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const level = data.cell.raw;
          const color = BLOOM_COLORS[level];
          if (color) data.cell.styles.textColor = color;
        }
        if (data.section === "body" && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === "HOTS" ? [245, 158, 11] : [34, 197, 94];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Per-Question Analysis ──
  if (results?.analysis && results.analysis.length > 0) {
    // Check if we need a new page
    if (y > 230) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Question-by-Question Analysis", 14, y);
    y += 4;

    const questionRows = results.analysis.map((item, idx) => [
      `Q${idx + 1}`,
      item.questionText?.length > 60
        ? item.questionText.substring(0, 57) + "..."
        : item.questionText || "",
      item.bloomsLevel || "",
      item.thinkingOrder || "",
      `${(item.confidence * 100).toFixed(1)}%`,
      item.needsReview ? "Yes" : "No",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Question", "Bloom's Level", "Order", "Confidence", "Flagged"]],
      body: questionRows,
      theme: "striped",
      headStyles: { fillColor: [55, 48, 107], textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 75 },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 15, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          // Color Bloom's level
          if (data.column.index === 2) {
            const color = BLOOM_COLORS[data.cell.raw];
            if (color) data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = "bold";
          }
          // Color thinking order
          if (data.column.index === 3) {
            data.cell.styles.textColor = data.cell.raw === "HOTS" ? [245, 158, 11] : [34, 197, 94];
            data.cell.styles.fontStyle = "bold";
          }
          // Color confidence
          if (data.column.index === 4) {
            const pct = parseFloat(data.cell.raw);
            if (pct >= 90) data.cell.styles.textColor = [34, 197, 94];
            else if (pct >= 75) data.cell.styles.textColor = [234, 179, 8];
            else data.cell.styles.textColor = [239, 68, 68];
          }
          // Color flagged
          if (data.column.index === 5 && data.cell.raw === "Yes") {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Admin Feedback (if any) ──
  if (adminFeedback) {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Admin Feedback", 14, y);
    y += 6;

    doc.setFillColor(255, 250, 240);
    const feedbackLines = doc.splitTextToSize(adminFeedback, pageWidth - 36);
    const feedbackHeight = feedbackLines.length * 5 + 8;
    doc.roundedRect(14, y - 4, pageWidth - 28, feedbackHeight, 3, 3, "F");
    doc.setDrawColor(249, 115, 22);
    doc.roundedRect(14, y - 4, pageWidth - 28, feedbackHeight, 3, 3, "S");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 60, 20);
    doc.text(feedbackLines, 18, y + 2);
    y += feedbackHeight + 6;
  }

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(
      `BUKSU CITL - Bloom's Taxonomy Analysis Report | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  // ── Save ──
  const sanitizedTitle = (quizTitle || "quiz-analysis")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();
  doc.save(`blooms-analysis-${sanitizedTitle}.pdf`);
};
