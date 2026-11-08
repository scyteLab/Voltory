/**
 * amountInWords(64350) → "Sixty-four thousand, three hundred and fifty naira only"
 *
 * Nigerian / British style for receipts:
 *   · groups (billion, million, thousand) separated by commas
 *   · "and" after hundreds ("three hundred and fifty"), and before a
 *     final group under 100 ("one thousand and five")
 *   · hyphenated tens ("sixty-four")
 *   · whole naira; any kobo is added as "… naira and fifty kobo only"
 *
 * Plain function, no browser APIs. Tests: node scripts/test-amount-in-words.mjs
 */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = [
  [1_000_000_000_000, "trillion"],
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];

/** 0–99 → "sixty-four" */
function tens(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

/** 1–999 → "three hundred and fifty" */
function hundreds(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return tens(rest);
  return `${ONES[h]} hundred${rest ? ` and ${tens(rest)}` : ""}`;
}

/** Whole number → words (no currency). */
export function numberToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "zero";
  const parts = [];
  for (const [size, name] of SCALES) {
    if (n >= size) {
      const group = Math.floor(n / size);
      parts.push(`${group < 1000 ? hundreds(group) : numberToWords(group)} ${name}`);
      n %= size;
    }
  }
  if (n > 0) {
    // "one thousand and five", but "one thousand, three hundred and five"
    parts.push(parts.length && n < 100 ? `and ${tens(n)}` : hundreds(n));
  }
  // Join groups with commas, except before a trailing "and …".
  return parts.reduce((out, part, i) => {
    if (i === 0) return part;
    return part.startsWith("and ") ? `${out} ${part}` : `${out}, ${part}`;
  }, "");
}

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Naira amount → "Sixty-four thousand, three hundred and fifty naira only". */
export function amountInWords(amount) {
  const total = Math.round(Math.abs(Number(amount) || 0) * 100);
  const naira = Math.floor(total / 100);
  const kobo = total % 100;
  const words = `${numberToWords(naira)} naira${kobo ? ` and ${numberToWords(kobo)} kobo` : ""} only`;
  return capitalise(words);
}
