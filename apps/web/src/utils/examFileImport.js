/**
 * Reads multiple-choice exam questions out of a Word (.docx) or PDF file.
 *
 * Questions can use Word's automatic numbering (1. / a.) or typed numbering
 * ("1." / "a." / "a)" / "(a)"), with choices on their own lines or several on
 * one line. A choice is taken as the correct answer when it is the only bold
 * or underlined choice, is marked with "*", is named in an "Answer: B" line
 * under the question, or is listed in an answer key at the end of the file.
 *
 * The file readers load mammoth / pdf.js on demand so the editor bundle stays small.
 */

export const MAX_EXAM_FILE_MB = 15;
export const EXAM_FILE_ACCEPT = ".docx,.pdf";

export class ExamImportError extends Error {}

// "1. Which...", "1) Which...", "Q1. Which...", "Question 1: Which..."
const QUESTION_RE =
  /^(?:(?:q|question|no\.?)\s*(\d{1,3})\s*[.):-]?|(\d{1,3})\s*[.)])\s*(?=[^\s\d])(.+)$/is;
// "a. ", "a) ", "(a) ", "A. "
const CHOICE_MARKER_RE = /(^|\s)\(?([a-h])[.)]\s+/gi;
const LEADING_CHOICE_MARKER_RE = /^\(?[a-h][.)]\s+/i;
// "Answer: B", "Ans. b", "Correct answer - Android"
const ANSWER_LINE_RE = /^(?:correct\s+)?(?:answer|ans)\s*[:.\-–]\s*(.+)$/i;
const ANSWER_KEY_HEADING_RE =
  /^(?:answer\s*key|key\s*(?:to|of)\s*(?:correction|answers?))\b.*$|^answers?\s*:?$/i;
// "1. B", "1-b", "1) (c)" inside an answer key
const KEY_TOKEN_RE = /(\d{1,3})\s*[.):-]?\s*\(?([a-h])\)?(?![a-z])/gi;
const KEY_LETTER_ONLY_RE = /^\(?([a-h])\)?[.)]?$/i;
const PAGE_NUMBER_RE = /^(?:page\s*)?\d{1,3}(?:\s*(?:of|\/)\s*\d{1,3})?$/i;

const letterIndex = (letter) => letter.toLowerCase().charCodeAt(0) - 97;
const toLetter = (index) => String.fromCharCode(97 + index);

const cleanText = (text) =>
  String(text || "")
    // Any whitespace but line breaks, including non-breaking spaces
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

const sameText = (a, b) => cleanText(a).toLowerCase() === cleanText(b).toLowerCase();

const looksLikeQuestion = (text) => /[?:]$/.test(text) || /_{3,}/.test(text);

// Splits "a. TCP  b. UDP  c. IP" into its choices. The line must start with the
// expected letter and later markers must follow in order (b, c, d...).
const splitChoices = (text, firstIndex) => {
  const markers = [];
  let expected = firstIndex;
  for (const m of text.matchAll(CHOICE_MARKER_RE)) {
    if (letterIndex(m[2]) !== expected) continue;
    if (markers.length === 0 && m.index !== 0) return null;
    markers.push({ start: m.index + m[1].length, contentStart: m.index + m[0].length });
    expected += 1;
  }
  if (!markers.length) return null;
  return markers
    .map((mk, i) => text.slice(mk.contentStart, markers[i + 1]?.start).trim())
    .filter(Boolean);
};

const keyTokens = (text) => [...text.matchAll(KEY_TOKEN_RE)].map((m) => ({
  number: Number(m[1]),
  index: letterIndex(m[2]),
}));

// A line made only of answer-key entries, e.g. "1. B  2. C  3. A"
const isAnswerKeyLine = (text) =>
  keyTokens(text).length >= 2 && text.replace(KEY_TOKEN_RE, "").replace(/[\s,;|]/g, "") === "";

/**
 * Turns extracted lines into questions.
 *
 * Each line is { text, role?, boldText?, x?, hasImage? }:
 * - role "question" / "choice" come from Word's list structure,
 *   "item" is a list item whose role is unclear, anything else is plain text
 * - boldText is the bold/underlined part of the line
 * - x is the PDF indentation, used to tell a wrapped choice from a new heading
 */
export const parseExamLines = (lines) => {
  const questions = [];
  const keyEntries = [];
  let current = null;
  let inAnswerKey = false;

  const startQuestion = (text, number = null, line = {}) => {
    closeQuestion();
    current = {
      number,
      stem: [cleanText(text)],
      choices: [],
      choiceSource: null,
      explicitAnswer: null,
      hasImage: Boolean(line.hasImage),
      lastChoiceX: null,
      joiner: line.x === undefined ? "\n" : " ",
    };
  };

  const addChoice = (text, line, source) => {
    let choiceText = cleanText(text);
    let starred = false;
    if (/^\*\s*|\s*\*$/.test(choiceText)) {
      starred = true;
      choiceText = choiceText.replace(/^\*\s*|\s*\*$/g, "").trim();
    }
    if (!choiceText) return;
    const boldText = cleanText(line.boldText).toLowerCase();
    current.choices.push({
      text: choiceText,
      starred,
      marked: Boolean(boldText) && boldText.includes(choiceText.toLowerCase()),
    });
    current.choiceSource = current.choiceSource || source;
    current.lastChoiceX = line.x ?? null;
    if (line.hasImage) current.hasImage = true;
  };

  const closeQuestion = () => {
    if (!current) return;
    // Headings and instructions also look like an unanswered question; a
    // multiple-choice question always has choices
    if (current.choices.length > 0) questions.push(current);
    current = null;
  };

  // A PDF line under a choice continues that choice when it is indented like
  // the choice text, starts mid-sentence, or is followed by the next choice
  const continuesChoice = (line, text, nextText) => {
    if (line.x > current.lastChoiceX + 2 || /^[a-z]/.test(text)) return true;
    return Boolean(
      nextText && (splitChoices(nextText, current.choices.length) || ANSWER_LINE_RE.test(nextText)),
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = cleanText(line.text);
    if (!text) continue;

    if (inAnswerKey) {
      const tokens = keyTokens(text);
      if (tokens.length) keyEntries.push(...tokens);
      else if (KEY_LETTER_ONLY_RE.test(text)) {
        keyEntries.push({ number: null, index: letterIndex(text.match(KEY_LETTER_ONLY_RE)[1]) });
      }
      continue;
    }
    if (ANSWER_KEY_HEADING_RE.test(text)) {
      closeQuestion();
      inAnswerKey = true;
      // "Answer key: 1. B 2. C" on the heading line itself
      keyEntries.push(...keyTokens(text));
      continue;
    }
    if (isAnswerKeyLine(text)) {
      closeQuestion();
      inAnswerKey = true;
      keyEntries.push(...keyTokens(text));
      continue;
    }

    if (line.role === "question") {
      const typed = text.match(QUESTION_RE);
      startQuestion(typed ? typed[3] : text, typed ? Number(typed[1] || typed[2]) : null, line);
      continue;
    }
    if (line.role === "choice") {
      if (current) addChoice(text.replace(LEADING_CHOICE_MARKER_RE, ""), line, "list");
      continue;
    }

    const answer = current && current.choices.length > 0 && text.match(ANSWER_LINE_RE);
    if (answer) {
      current.explicitAnswer = cleanText(answer[1]);
      closeQuestion();
      continue;
    }

    const typedQuestion = text.match(QUESTION_RE);
    if (typedQuestion) {
      startQuestion(typedQuestion[3], Number(typedQuestion[1] || typedQuestion[2]), line);
      continue;
    }

    if (current) {
      const choices = splitChoices(text, current.choices.length);
      if (choices) {
        choices.forEach((choice) => addChoice(choice, line, "typed"));
        continue;
      }
    }

    if (line.role === "item") {
      // Flat Word list: questions and choices share one numbering level
      const isChoice =
        current &&
        (current.choices.length === 0 || current.choiceSource === "item") &&
        !looksLikeQuestion(text);
      if (isChoice) addChoice(text, line, "item");
      else startQuestion(text, null, line);
      continue;
    }

    if (!current) continue;
    if (current.choices.length === 0) {
      // Question text that runs over several lines
      current.stem.push(text);
      if (line.hasImage) current.hasImage = true;
    } else if (
      line.x !== undefined &&
      current.lastChoiceX !== null &&
      continuesChoice(line, text, cleanText(lines.slice(i + 1).find((l) => cleanText(l.text))?.text))
    ) {
      const last = current.choices[current.choices.length - 1];
      last.text = `${last.text} ${text}`;
    } else {
      closeQuestion();
    }
  }
  closeQuestion();

  return finishQuestions(questions, keyEntries);
};

const resolveAnswer = (q) => {
  if (q.explicitAnswer) {
    const byLetter = q.explicitAnswer.match(/^\(?([a-h])\)?(?:[.)]\s*.*)?$/i);
    const index = byLetter
      ? letterIndex(byLetter[1])
      : q.choices.findIndex((c) => sameText(c.text, q.explicitAnswer));
    if (index >= 0 && index < q.choices.length) return index;
  }
  const starred = q.choices.flatMap((c, i) => (c.starred ? [i] : []));
  if (starred.length === 1) return starred[0];
  const marked = q.choices.flatMap((c, i) => (c.marked ? [i] : []));
  if (marked.length === 1 && q.choices.length > 1) return marked[0];
  return null;
};

const finishQuestions = (parsed, keyEntries) => {
  const warnings = [];
  const questions = parsed.map((q) => ({
    text: q.stem.filter(Boolean).join(q.joiner),
    options: q.choices.map((c) => c.text),
    correctAnswer: resolveAnswer(q),
    number: q.number,
    hasImage: q.hasImage,
  }));

  // Typed numbers are used to match the answer key when they are unique. When
  // numbering restarts per section, a key with one entry per question is
  // matched in order; otherwise a key number is the question's position.
  const typedNumbers = questions.map((q) => q.number);
  const useTypedNumbers =
    typedNumbers.every((n) => n !== null) && new Set(typedNumbers).size === typedNumbers.length;
  const matchInOrder = !useTypedNumbers && keyEntries.length === questions.length;
  if (keyEntries.length) {
    let unmatched = 0;
    keyEntries.forEach((entry, order) => {
      const target =
        entry.number === null || matchInOrder
          ? questions[order]
          : useTypedNumbers
            ? questions.find((q) => q.number === entry.number)
            : questions[entry.number - 1];
      if (!target || entry.index >= target.options.length) {
        unmatched += 1;
        return;
      }
      if (target.correctAnswer === null) target.correctAnswer = entry.index;
    });
    if (unmatched) {
      warnings.push(
        `${unmatched} answer key entr${unmatched === 1 ? "y" : "ies"} didn't match a question. Check the correct answers.`,
      );
    }
  }

  // Typed numbering that skips (1, 2, 4) means a question couldn't be read
  for (let i = 1; i < questions.length; i++) {
    const prev = questions[i - 1].number;
    const next = questions[i].number;
    if (prev !== null && next !== null && next > prev + 1) {
      const missing = next - prev === 2 ? `${prev + 1}` : `${prev + 1}–${next - 1}`;
      warnings.push(`Question ${missing} couldn't be read. Add it manually if it's needed.`);
    }
  }

  return {
    questions: questions.map((q) => {
      const issues = [];
      if (q.options.length < 2) issues.push(`Only ${q.options.length} choice found`);
      if (q.options.length > 6) issues.push(`${q.options.length} choices found; some may belong to another question`);
      if (q.correctAnswer === null) issues.push("No correct answer marked");
      if (q.hasImage) issues.push("Has a picture that wasn't imported");
      return { text: q.text, options: q.options, correctAnswer: q.correctAnswer, warnings: issues };
    }),
    warnings,
  };
};

// ---- Word (.docx) ----

const ownContent = (el) => {
  const clone = el.cloneNode(true);
  clone.querySelectorAll("ol, ul").forEach((list) => list.remove());
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return clone;
};

const toLine = (el, role) => {
  const own = ownContent(el);
  return {
    text: own.textContent,
    role,
    boldText: [...own.querySelectorAll("strong, b, u")].map((b) => b.textContent).join(" "),
    hasImage: Boolean(own.querySelector("img")),
  };
};

const listItems = (list) => [...list.children].filter((c) => c.tagName === "LI");
const childLists = (li) => [...li.children].filter((c) => c.tagName === "OL" || c.tagName === "UL");

const walkList = (list, lines) => {
  for (const li of listItems(list)) {
    const children = childLists(li).flatMap(listItems);
    // A list item whose sub-items have no sub-items of their own is a
    // question with its choices; deeper nesting is a section heading
    const isQuestion = children.length > 0 && children.every((c) => childLists(c).length === 0);
    if (isQuestion) {
      lines.push(toLine(li, "question"));
      children.forEach((c) => lines.push(toLine(c, "choice")));
    } else if (children.length) {
      lines.push(toLine(li, null));
      childLists(li).forEach((sub) => walkList(sub, lines));
    } else {
      lines.push(toLine(li, "item"));
    }
  }
};

const walkBlocks = (parent, lines) => {
  for (const el of parent.children) {
    const tag = el.tagName;
    if (tag === "OL" || tag === "UL") walkList(el, lines);
    else if (tag === "TABLE" || tag === "TBODY" || tag === "THEAD" || tag === "TR" || tag === "TD" || tag === "TH" || tag === "DIV") {
      walkBlocks(el, lines);
    } else lines.push(toLine(el, null));
  }
};

/** Lines from mammoth's HTML (needs a DOMParser; pass one in outside the browser). */
export const docxHtmlToLines = (html, parser = new DOMParser()) => {
  const doc = parser.parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
  const lines = [];
  walkBlocks(doc.body, lines);
  return lines;
};

const readDocxLines = async (file) => {
  const mod = await import("mammoth");
  const mammoth = mod.default || mod;
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      styleMap: ["u => u"],
      // Pictures aren't imported; skip embedding them as large data URLs
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    },
  );
  return docxHtmlToLines(value);
};

// ---- PDF ----

const BOLD_FONT_RE = /bold|black|heavy|semibold|demi/i;

/** Lines from a loaded pdf.js document, top to bottom, with headers/footers removed. */
export const pdfToLines = async (pdf) => {
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const boldFonts = new Set();
    try {
      // Font names are only available once the page has been parsed
      await page.getOperatorList();
      for (const fontName of Object.keys(content.styles)) {
        const font = page.commonObjs.has(fontName) ? page.commonObjs.get(fontName) : null;
        if (BOLD_FONT_RE.test(font?.name || "")) boldFonts.add(fontName);
      }
    } catch {
      // Bold detection is optional
    }

    const items = content.items
      .filter((it) => typeof it.str === "string" && it.str.trim())
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10,
        bold: boldFonts.has(it.fontName),
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const rows = [];
    for (const item of items) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row.y - item.y) <= item.size * 0.4) row.items.push(item);
      else rows.push({ y: item.y, items: [item] });
    }

    pages.push(
      rows.map((row) => {
        const sorted = row.items.sort((a, b) => a.x - b.x);
        let text = "";
        let end = null;
        for (const it of sorted) {
          if (end !== null && it.x - end > it.size * 0.15) text += " ";
          text += it.str;
          end = it.x + it.width;
        }
        return {
          text,
          x: sorted[0].x,
          boldText: sorted.filter((it) => it.bold).map((it) => it.str).join(" "),
          // Header/footer zone: top or bottom 10% of the page
          edge: row.y > height * 0.9 || row.y < height * 0.1,
        };
      }),
    );
  }

  // Drop page numbers and header/footer lines repeated on several pages
  const edgeKey = (line) => cleanText(line.text).toLowerCase().replace(/\d+/g, "#");
  const pagesWithKey = new Map();
  pages.forEach((lines) => {
    new Set(lines.filter((l) => l.edge).map(edgeKey)).forEach((key) => {
      pagesWithKey.set(key, (pagesWithKey.get(key) || 0) + 1);
    });
  });
  const repeated = (line) =>
    pages.length > 1 && (pagesWithKey.get(edgeKey(line)) || 0) >= Math.max(2, pages.length / 2);

  return pages.flatMap((lines) =>
    lines
      .filter((line) => !(line.edge && (PAGE_NUMBER_RE.test(cleanText(line.text)) || repeated(line))))
      .map(({ text, x, boldText }) => ({ text, x, boldText })),
  );
};

const readPdfLines = async (file) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerSrc } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    fontExtraProperties: true,
  });
  try {
    let pdf;
    try {
      pdf = await loadingTask.promise;
    } catch (err) {
      if (err?.name === "PasswordException") {
        throw new ExamImportError("This PDF is password-protected. Remove the password and try again.");
      }
      throw err;
    }
    const lines = await pdfToLines(pdf);
    if (lines.reduce((n, l) => n + l.text.trim().length, 0) < 20) {
      throw new ExamImportError(
        "This PDF has no selectable text. It looks like a scanned image. Use the original Word file, or a PDF saved from Word.",
      );
    }
    return lines;
  } finally {
    loadingTask.destroy();
  }
};

/** Reads a .docx or .pdf exam file and returns the questions found in it. */
export const readExamFile = async (file) => {
  const name = (file?.name || "").toLowerCase();
  if (file.size > MAX_EXAM_FILE_MB * 1024 * 1024) {
    throw new ExamImportError(`This file is larger than ${MAX_EXAM_FILE_MB} MB.`);
  }

  let lines;
  try {
    if (name.endsWith(".docx")) lines = await readDocxLines(file);
    else if (name.endsWith(".pdf")) lines = await readPdfLines(file);
    else if (name.endsWith(".doc")) {
      throw new ExamImportError(
        "Older Word (.doc) files can't be read. Open the file in Word, save it as .docx, and try again.",
      );
    } else {
      throw new ExamImportError("Choose a Word (.docx) or PDF file.");
    }
  } catch (err) {
    if (err instanceof ExamImportError) throw err;
    console.error("Exam file import failed:", err);
    throw new ExamImportError("This file couldn't be read. Check that it opens in Word or a PDF viewer.");
  }

  const result = parseExamLines(lines);
  if (!result.questions.length) {
    throw new ExamImportError(
      "No multiple-choice questions were found. Questions should be numbered (1., 2., ...) with lettered choices (a., b., ...).",
    );
  }
  return result;
};

export const choiceLetter = toLetter;
