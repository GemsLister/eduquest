/**
 * Gender and Development (GAD) & Gender-Fair Language Analysis Service
 * 
 * Automatically analyzes questions to determine:
 * 1. Gender-Fair Language Compliance (detects gender-biased terms like "policeman" and suggests "police officer"
 *    based on Philippine CSC MC No. 12, s. 2005 & PCW Guidelines).
 * 2. GAD Thematic & Legal Framework Compliance (RA 9710 Magna Carta of Women, RA 11313 Safe Spaces Act, CEDAW, etc.).
 */

/**
 * Standard Philippine Civil Service Commission (CSC) & PCW Gender-Fair Language Dictionary
 * Maps gender-biased terms to gender-neutral/gender-fair alternatives.
 */
export const GENDER_FAIR_DICTIONARY = [
  // Occupations & Roles
  { biased: "policeman", neutral: "police officer" },
  { biased: "policemen", neutral: "police officers" },
  { biased: "policewoman", neutral: "police officer" },
  { biased: "policewomen", neutral: "police officers" },
  { biased: "fireman", neutral: "firefighter" },
  { biased: "firemen", neutral: "firefighters" },
  { biased: "chairman", neutral: "chairperson" },
  { biased: "chairmen", neutral: "chairpersons" },
  { biased: "chairwoman", neutral: "chairperson" },
  { biased: "chairwomen", neutral: "chairpersons" },
  { biased: "businessman", neutral: "business owner" },
  { biased: "businessmen", neutral: "business owners" },
  { biased: "businesswoman", neutral: "business owner" },
  { biased: "businesswomen", neutral: "business owners" },
  { biased: "mailman", neutral: "postal worker" },
  { biased: "mailmen", neutral: "postal workers" },
  { biased: "postman", neutral: "postal worker" },
  { biased: "postmen", neutral: "postal workers" },
  { biased: "spokesman", neutral: "spokesperson" },
  { biased: "spokesmen", neutral: "spokespersons" },
  { biased: "spokeswoman", neutral: "spokesperson" },
  { biased: "spokeswomen", neutral: "spokespersons" },
  { biased: "salesman", neutral: "sales representative" },
  { biased: "salesmen", neutral: "sales representatives" },
  { biased: "saleswoman", neutral: "sales representative" },
  { biased: "saleswomen", neutral: "sales representatives" },
  { biased: "saleslady", neutral: "sales associate" },
  { biased: "salesladies", neutral: "sales associates" },
  { biased: "stewardess", neutral: "flight attendant" },
  { biased: "steward", neutral: "flight attendant" },
  { biased: "waitress", neutral: "server" },
  { biased: "waiter", neutral: "server" },
  { biased: "foreman", neutral: "supervisor" },
  { biased: "foremen", neutral: "supervisors" },
  { biased: "cameraman", neutral: "camera operator" },
  { biased: "cameramen", neutral: "camera operators" },
  { biased: "anchorman", neutral: "news anchor" },
  { biased: "anchorwoman", neutral: "news anchor" },
  { biased: "congressman", neutral: "member of congress" },
  { biased: "congressmen", neutral: "members of congress" },
  { biased: "councilman", neutral: "council member" },
  { biased: "councilmen", neutral: "council members" },
  { biased: "alderman", neutral: "city councilor" },
  { biased: "craftsman", neutral: "artisan" },
  { biased: "craftsmen", neutral: "artisans" },
  { biased: "fisherman", neutral: "fisherfolk" },
  { biased: "fishermen", neutral: "fisherfolk" },
  { biased: "cleaning lady", neutral: "custodian" },
  { biased: "cleaning woman", neutral: "cleaner" },
  { biased: "maid", neutral: "domestic worker" },
  { biased: "housewife", neutral: "homemaker" },
  { biased: "housewives", neutral: "homemakers" },
  { biased: "garbage man", neutral: "waste collector" },
  { biased: "barman", neutral: "bartender" },
  { biased: "barmaid", neutral: "bartender" },
  { biased: "headmistress", neutral: "principal" },
  { biased: "headmaster", neutral: "principal" },

  // General & Institutional Terms
  { biased: "mankind", neutral: "humankind" },
  { biased: "manpower", neutral: "workforce" },
  { biased: "man made", neutral: "synthetic" },
  { biased: "man-made", neutral: "synthetic" },
  { biased: "man hours", neutral: "working hours" },
  { biased: "man-hours", neutral: "working hours" },
  { biased: "freshman", neutral: "first-year student" },
  { biased: "freshmen", neutral: "first-year students" },
  { biased: "layman", neutral: "non-expert" },
  { biased: "laymen", neutral: "non-experts" },
  { biased: "statesman", neutral: "political leader" },
  { biased: "statesmen", neutral: "political leaders" },
  { biased: "sportsman", neutral: "athlete" },
  { biased: "sportsmen", neutral: "athletes" },
  { biased: "sportsmanship", neutral: "fair play" },
  { biased: "middleman", neutral: "intermediary" },
  { biased: "middlemen", neutral: "intermediaries" },
];

// Core GAD keywords and concepts
const GAD_KEYWORDS = [
  // Legal & Policy Framework
  "magna carta of women", "ra 9710", "republic act 9710", "safe spaces act",
  "ra 11313", "anti-sexual harassment", "ra 7877", "anti-vawc", "ra 9262",
  "cedaw", "convention on the elimination of all forms of discrimination against women",
  "gender mainstreaming", "gender equality", "gender equity", "gender responsiveness",
  "gender sensitivity", "gender development", "gad",

  // Gender Identity & Roles
  "gender role", "gender roles", "gender stereotype", "gender stereotyping",
  "gender bias", "gender discrimination", "gender disparity", "gender parity",
  "gender gap", "gender fair", "gender-neutral", "gender-inclusive", "sogiesc", "sogie",
  "sexual orientation", "gender identity", "gender expression", "sex characteristics",
  "inclusivity", "inclusive education", "gender-based",

  // Women's Empowerment & Rights
  "women empowerment", "empowerment of women", "women's rights", "maternal health",
  "maternity leave", "paternity leave", "reproductive health", "family planning",
  "maternal mortality", "women in stem", "women in leadership", "female leadership",
  "patriarchy", "patriarchal", "matriarchy", "matriarchal", "feminism", "feminist",
  "glass ceiling", "equal pay", "wage gap", "unpaid domestic labor", "care economy",

  // Violence Against Women & Vulnerable Sectors
  "violence against women", "domestic violence", "sexual harassment", "victim-blaming",
  "human trafficking", "trafficking in women", "child marriage", "female genital mutilation",

  // Gender Representation & Data
  "sex-disaggregated data", "sex disaggregated", "gender audit", "gender analysis",
  "harmonized gad guidelines", "hgdg"
];

// Contextual pairs / regex patterns for subtle GAD indicators
const GAD_PATTERNS = [
  /\b(men|women|male|female|boys|girls)\s+and\s+(men|women|male|female|boys|girls)\s+(equality|equity|rights|representation|roles)\b/i,
  /\b(break(ing)?|challenge(ing)?)\s+(gender\s+)?stereotypes?\b/i,
  /\b(women|females?)\s+in\s+(politics|governance|science|technology|engineering|math|stem|leadership|executive)\b/i,
  /\bgender(-|\s+)sensitive\b/i,
  /\bgender(-|\s+)responsive\b/i,
  /\bgender(-|\s+)differentiated\b/i,
  /\bgender(-|\s+)neutral\b/i,
  /\bgender(-|\s+)fair\b/i,
  /\bgender(-|\s+)inclusive\b/i,
  /\bviolence\s+against\s+(women|children|mothers|girls)\b/i,
  /\bequal\s+(opportunities|rights|access|pay|compensation)\s+(for|between)\s+(men\s+and\s+women|both\s+genders|all\s+genders)\b/i,
];

/**
 * Scans text in real-time for any gender-biased terms.
 * 
 * @param {string} text - The question text or option string to scan
 * @returns {Array<{ biased: string, neutral: string, matchedText: string, index: number }>}
 */
export const detectGenderBias = (text = "") => {
  if (!text || typeof text !== "string") return [];

  const foundBiases = [];

  for (const item of GENDER_FAIR_DICTIONARY) {
    const escaped = item.biased.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match;
    while ((match = regex.exec(text)) !== null) {
      foundBiases.push({
        biased: item.biased,
        neutral: item.neutral,
        matchedText: match[0],
        index: match.index,
      });
    }
  }

  return foundBiases;
};

/**
 * Replaces a gender-biased term with its gender-fair alternative, preserving capitalization.
 * 
 * @param {string} text - Original question text
 * @param {string} biasedTerm - The word to replace (e.g. "policeman")
 * @param {string} neutralTerm - The replacement (e.g. "police officer")
 * @returns {string} The corrected text
 */
export const replaceGenderBiasedTerm = (text = "", biasedTerm = "", neutralTerm = "") => {
  if (!text || !biasedTerm || !neutralTerm) return text;

  const escaped = biasedTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");

  return text.replace(regex, (match) => {
    // Preserve Title Case if original was capitalized
    if (match.charAt(0) === match.charAt(0).toUpperCase() && match.charAt(0) !== match.charAt(0).toLowerCase()) {
      return neutralTerm.charAt(0).toUpperCase() + neutralTerm.slice(1);
    }
    return neutralTerm;
  });
};

/**
 * Evaluates a question text and its options to determine if it is GAD-related
 * and whether it has gender-fair language issues.
 * 
 * @param {string} text - The question text
 * @param {Array<string>} [options] - Optional array of answer options
 * @returns {{
 *   isGad: boolean,
 *   confidence: number,
 *   matchReason: string | null,
 *   matchedKeywords: string[],
 *   hasGenderBias: boolean,
 *   biasMatches: Array<{ biased: string, neutral: string, matchedText: string }>,
 *   isGenderFair: boolean
 * }}
 */
export const analyzeGADQuestion = (text = "", options = []) => {
  const fullContent = [text, ...(Array.isArray(options) ? options : [])]
    .filter(Boolean)
    .join(" ");

  if (!fullContent.trim()) {
    return {
      isGad: false,
      confidence: 0,
      matchReason: null,
      matchedKeywords: [],
      hasGenderBias: false,
      biasMatches: [],
      isGenderFair: true,
    };
  }

  // 1. Detect gender bias terms
  const biasMatches = detectGenderBias(fullContent);
  const hasGenderBias = biasMatches.length > 0;

  // 2. Check direct keyword matches
  const lowerContent = fullContent.toLowerCase();
  const matchedKeywords = GAD_KEYWORDS.filter((kw) => {
    const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    return regex.test(lowerContent);
  });

  // 3. Check pattern matches
  const matchedPatterns = GAD_PATTERNS.filter((pattern) => pattern.test(lowerContent));

  const totalMatches = matchedKeywords.length + matchedPatterns.length;
  const isGadThematic = totalMatches > 0;

  let primaryReason = null;
  if (isGadThematic) {
    primaryReason = matchedKeywords[0]
      ? `Contains GAD concept: "${matchedKeywords[0]}"`
      : "Matches GAD gender-responsiveness pattern";
  } else if (hasGenderBias) {
    primaryReason = `Contains gender-biased terminology (e.g. "${biasMatches[0].matchedText}")`;
  }

  const confidence = isGadThematic
    ? Math.min(0.99, 0.8 + totalMatches * 0.05)
    : hasGenderBias ? 0.9 : 0;

  return {
    isGad: isGadThematic || hasGenderBias,
    isGadThematic,
    confidence: Math.round(confidence * 100) / 100,
    matchReason: primaryReason,
    matchedKeywords,
    hasGenderBias,
    biasMatches,
    isGenderFair: !hasGenderBias,
  };
};

/**
 * Batch analyzes an array of questions for GAD and Gender-Fair Language.
 * 
 * @param {Array<{ id: string|number, text: string, options?: Array<string> }>} questions
 * @returns {Array<{ id: string|number, isGad: boolean, hasGenderBias: boolean, biasMatches: Array, isGenderFair: boolean }>}
 */
export const batchAnalyzeGAD = (questions = []) => {
  return (questions || []).map((q) => {
    const result = analyzeGADQuestion(q.text, q.options);
    return {
      id: q.id,
      ...result,
    };
  });
};

