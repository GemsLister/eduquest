import jsPDF from "jspdf";

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
 * Derive semester from a date based on Philippine academic calendar.
 */
const deriveSemester = (date) => {
  const month = date.getMonth();
  if (month >= 5 && month <= 9) return "FIRST SEMESTER";
  if (month >= 10 || month <= 2) return "SECOND SEMESTER";
  return "SUMMER";
};

/**
 * Derive school year from a date based on Philippine academic calendar.
 */
const deriveSchoolYear = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 5) return `${year} \u2013 ${year + 1}`;
  return `${year - 1} \u2013 ${year}`;
};

/**
 * Strip revision/version markers from quiz title.
 */
const cleanQuizTitle = (title) => {
  if (!title) return "Quiz";
  return (
    title
      .replace(/\s*\(Revised(?:\s+\d+)?\)/gi, "")
      .replace(/\s*\(V\d+\)/gi, "")
      .replace(/\s*\(Version\s*\d+\)/gi, "")
      .trim() || "Quiz"
  );
};

/**
 * Generates and downloads a quiz paper PDF matching the BukSU Midterm template.
 * White background, Times New Roman font, centered layout.
 */
export const exportQuizPaperPdf = async ({
  quizTitle,
  quizDescription,
  instructorName,
  courseName,
  semesterOverride,
  schoolYearOverride,
  submittedAt,
  questions,
  questionFeedback = {},
  questionFeedbackByNumber = {},
}) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 25;
    const contentWidth = pageWidth - margin * 2;
    let y = 15;

    const cleanedTitle = cleanQuizTitle(quizTitle);
    const textCenterX = pageWidth / 2;

    // ── Helper: check if we need a new page (no header on subsequent pages) ──
    const ensureSpace = (needed) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        // White background explicitly
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        doc.setTextColor(0, 0, 0);
        y = 25;
      }
    };

    // ══════════════════════════════════════════════
    // HEADER — Logos + University Info
    // ══════════════════════════════════════════════
    const logoSize = 25;

    // Left logo — BukSU shield logo
    try {
      const leftLogo = await loadImage("/logo1.jpg");
      doc.addImage(leftLogo, "JPEG", margin, y - 5, logoSize, logoSize);
    } catch {
      // no logo
    }

    // Right logo — COT seal
    try {
      const rightLogo = await loadImage("/logo2.jpg");
      doc.addImage(
        rightLogo,
        "JPEG",
        pageWidth - margin - logoSize,
        y - 5,
        logoSize,
        logoSize,
      );
    } catch {
      // no logo
    }

    // University text — Times New Roman, centered
    doc.setTextColor(0, 0, 0);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("BUKIDNON STATE UNIVERSITY", textCenterX, y + 1, {
      align: "center",
    });

    doc.setFontSize(11);
    doc.text("COLLEGE OF TECHNOLOGIES", textCenterX, y + 6, {
      align: "center",
    });

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text("Malaybalay City, Bukidnon 8700", textCenterX, y + 11, {
      align: "center",
    });

    doc.setFontSize(7.5);
    doc.text(
      "Tel (088) 813-5661 to 5663; TeleFax (088) 813-2717, www.buksu.edu.ph",
      textCenterX,
      y + 15,
      { align: "center" },
    );

    y += 22;

    // College and Department sub-header
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("College of Technologies", textCenterX, y, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(11);
    doc.text("Information Technology Department", textCenterX, y + 6, {
      align: "center",
    });

    y += 15;

    // ══════════════════════════════════════════════
    // INFO SECTION — Subject, Quiz, Semester, Instructor
    // ══════════════════════════════════════════════
    const refDate = submittedAt ? new Date(submittedAt) : new Date();
    const semesterText = semesterOverride || deriveSemester(refDate);
    const schoolYearText = schoolYearOverride || deriveSchoolYear(refDate);
    const displayCourseName = courseName || "Subject";

    // Row 1: Subject name (left, bold) | Instructor name (right, underlined)
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(displayCourseName.toUpperCase(), margin, y);

    if (instructorName) {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      const instrNameWidth = doc.getTextWidth(instructorName);
      const instrCenterX = pageWidth - margin - instrNameWidth / 2;
      doc.text(instructorName, instrCenterX, y, { align: "center" });
      // Underline
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(
        instrCenterX - instrNameWidth / 2,
        y + 1,
        instrCenterX + instrNameWidth / 2,
        y + 1,
      );
      // "Instructor" centered below the name
      doc.setFont("times", "italic");
      doc.setFontSize(11);
      doc.text("Instructor", instrCenterX, y + 6, { align: "center" });
    }
    y += 6;

    // Row 2: Quiz title (left)
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(cleanedTitle, margin, y);
    y += 6;

    // Row 3: Semester + School Year
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(`${semesterText} S. Y. ${schoolYearText}`, margin, y);
    y += 10;

    // ── Name / Date / Section fields ──
    doc.setFont("times", "normal");
    doc.setFontSize(11);

    const nameFieldEnd = margin + 105;
    const dateLabelX = margin + 115;

    doc.text("Name:", margin, y);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin + doc.getTextWidth("Name: "), y + 1, nameFieldEnd, y + 1);

    doc.text("Date:", dateLabelX, y);
    doc.line(
      dateLabelX + doc.getTextWidth("Date: "),
      y + 1,
      pageWidth - margin,
      y + 1,
    );
    y += 7;

    doc.text("Subject and Section Code:", margin, y);
    doc.line(
      margin + doc.getTextWidth("Subject and Section Code: "),
      y + 1,
      nameFieldEnd,
      y + 1,
    );
    y += 14;

    // ══════════════════════════════════════════════
    // QUESTIONS — Centered layout with proper indentation
    // ══════════════════════════════════════════════
    const questionList = questions || [];

    // Separate MCQ from other types
    const mcqQuestions = questionList.filter(
      (q) =>
        q.type === "mcq" ||
        (Array.isArray(q.options) &&
          q.options.filter((o) => String(o || "").trim()).length > 0),
    );
    const tfQuestions = questionList.filter((q) => q.type === "true_false");
    const identQuestions = questionList.filter(
      (q) => q.type === "identification" || q.type === "short_answer",
    );

    // Question layout — keep number close to the first word of each question.
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    const maxQuestionNumber = Math.max(questionList.length, 9);
    const qNumberSlotWidth = doc.getTextWidth(`${maxQuestionNumber}.`) + 2;
    const qNumX = margin + 8; // question number position
    const qTextX = qNumX + qNumberSlotWidth; // question text starts right after number slot
    const optLetterX = qTextX + 10; // option letter position
    const optTextX = optLetterX + 8; // option text position
    const qTextWidth = pageWidth - margin - qTextX - 5;
    const optTextWidth = pageWidth - margin - optTextX - 5;

    let globalNum = 1;
    let sectionNum = 1;
    const romanNumerals = ["I", "II", "III", "IV", "V", "VI"];

    const getQuestionComment = (q, number) => {
      const byId = q?.questionId ? questionFeedback?.[q.questionId] : null;
      const byNum = questionFeedbackByNumber?.[number];
      const comment = byId || byNum || "";
      return String(comment || "").trim();
    };

    const renderQuestionComment = (q, number, x, width) => {
      const comment = getQuestionComment(q, number);
      if (!comment) return;

      doc.setFont("times", "italic");
      doc.setFontSize(10);
      doc.setTextColor(180, 40, 20);
      const commentLines = doc.splitTextToSize(
        `Senior Faculty Comment: ${comment}`,
        width,
      );
      ensureSpace(commentLines.length * 5 + 3);
      for (let li = 0; li < commentLines.length; li++) {
        doc.text(commentLines[li], x, y + li * 5);
      }
      y += commentLines.length * 5 + 3;
      doc.setTextColor(0, 0, 0);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
    };

    // ── Multiple Choice Section ──
    if (mcqQuestions.length > 0) {
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(`${romanNumerals[sectionNum - 1]}.`, margin + 2, y);
      doc.text("Multiple Choice", margin + 20, y);
      y += 6;

      // Instructions
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      const instrText =
        quizDescription ||
        "Instructions: Read and analyze each question carefully. Choose the letter of the correct answer.";
      const instrLines = doc.splitTextToSize(instrText, contentWidth);
      for (const line of instrLines) {
        ensureSpace(6);
        doc.text(line, margin, y);
        y += 5.5;
      }
      y += 6;

      for (let i = 0; i < mcqQuestions.length; i++) {
        const q = mcqQuestions[i];
        const qText = q.questionText || q.text || "";
        const qTextLines = doc.splitTextToSize(qText, qTextWidth);

        // Space check: question + options
        const options = Array.isArray(q.options)
          ? q.options.filter((opt) => String(opt || "").trim())
          : [];
        const neededHeight = qTextLines.length * 5.5 + options.length * 7 + 10;
        ensureSpace(neededHeight);

        // Question number (bold)
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text(`${globalNum}.`, qNumX, y);

        // Question text
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        for (let li = 0; li < qTextLines.length; li++) {
          doc.text(qTextLines[li], qTextX, y + li * 5.5);
        }
        y += qTextLines.length * 5.5 + 3;

        // Options (lowercase a, b, c, d)
        for (let oi = 0; oi < options.length; oi++) {
          const letter = String.fromCharCode(97 + oi);

          doc.setFont("times", "bold");
          doc.setFontSize(11);
          doc.text(`${letter}.`, optLetterX, y);

          doc.setFont("times", "normal");
          doc.setFontSize(11);
          const optLines = doc.splitTextToSize(options[oi], optTextWidth);
          ensureSpace(optLines.length * 5.5 + 2);
          for (let li = 0; li < optLines.length; li++) {
            doc.text(optLines[li], optTextX, y + li * 5.5);
          }
          y += optLines.length * 5.5 + 2;
        }

        renderQuestionComment(q, globalNum, qTextX, qTextWidth);

        y += 5;
        globalNum++;
      }
      sectionNum++;
    }

    // ── True or False Section ──
    if (tfQuestions.length > 0) {
      ensureSpace(20);
      y += 4;

      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(`${romanNumerals[sectionNum - 1]}.`, margin + 2, y);
      doc.text("True or False", margin + 20, y);
      y += 6;

      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text(
        "Instructions: Write TRUE if the statement is correct and FALSE if it is not.",
        margin,
        y,
      );
      y += 8;

      for (const q of tfQuestions) {
        const qText = q.questionText || q.text || "";
        const qTextLines = doc.splitTextToSize(qText, qTextWidth);
        ensureSpace(qTextLines.length * 5.5 + 8);

        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text(`${globalNum}.`, qNumX, y);

        doc.setFont("times", "normal");
        for (let li = 0; li < qTextLines.length; li++) {
          doc.text(qTextLines[li], qTextX, y + li * 5.5);
        }
        y += qTextLines.length * 5.5 + 2;
        renderQuestionComment(q, globalNum, qTextX, qTextWidth);
        y += 4;
        globalNum++;
      }
      sectionNum++;
    }

    // ── Identification Section ──
    if (identQuestions.length > 0) {
      ensureSpace(20);
      y += 4;

      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(`${romanNumerals[sectionNum - 1]}.`, margin + 2, y);
      doc.text("Identification", margin + 20, y);
      y += 6;

      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text(
        "Instructions: Write the correct answer on the blank provided.",
        margin,
        y,
      );
      y += 8;

      const identBlankX = margin + 2;
      const identNumX = margin + 34;
      const identTextX = identNumX + qNumberSlotWidth;
      const identTextWidth = pageWidth - margin - identTextX - 5;

      for (const q of identQuestions) {
        const qText = q.questionText || q.text || "";
        const qTextLines = doc.splitTextToSize(qText, identTextWidth);
        ensureSpace(qTextLines.length * 5.5 + 8);

        doc.setFont("times", "normal");
        doc.setFontSize(11);
        doc.text("__________________", identBlankX, y);

        doc.setFont("times", "bold");
        doc.text(`${globalNum}.`, identNumX, y);

        doc.setFont("times", "normal");
        for (let li = 0; li < qTextLines.length; li++) {
          doc.text(qTextLines[li], identTextX, y + li * 5.5);
        }
        y += qTextLines.length * 5.5 + 2;
        renderQuestionComment(q, globalNum, identTextX, identTextWidth);
        y += 4;
        globalNum++;
      }
      sectionNum++;
    }

    // ── Save ──
    const sanitizedTitle = cleanedTitle
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    doc.save(`quiz-${sanitizedTitle}.pdf`);
  } catch (err) {
    console.error("Failed to generate quiz paper PDF:", err);
  }
};
