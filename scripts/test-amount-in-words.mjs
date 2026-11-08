/**
 * Checks for src/utils/amountInWords.js.  Run: node scripts/test-amount-in-words.mjs
 * Exits 1 on any failure.
 */
import { amountInWords } from "../src/utils/amountInWords.js";

const cases = [
  [64350, "Sixty-four thousand, three hundred and fifty naira only"],
  [0, "Zero naira only"],
  [1, "One naira only"],
  [15, "Fifteen naira only"],
  [100, "One hundred naira only"],
  [105, "One hundred and five naira only"],
  [1000, "One thousand naira only"],
  [1005, "One thousand and five naira only"],
  [1050, "One thousand and fifty naira only"],
  [1500, "One thousand, five hundred naira only"],
  [21000, "Twenty-one thousand naira only"],
  [60450, "Sixty thousand, four hundred and fifty naira only"],
  [450000, "Four hundred and fifty thousand naira only"],
  [999999, "Nine hundred and ninety-nine thousand, nine hundred and ninety-nine naira only"],
  [1000000, "One million naira only"],
  [1000050, "One million and fifty naira only"],
  [1250000, "One million, two hundred and fifty thousand naira only"],
  [2000005, "Two million and five naira only"],
  [3208206, "Three million, two hundred and eight thousand, two hundred and six naira only"],
  [12345678, "Twelve million, three hundred and forty-five thousand, six hundred and seventy-eight naira only"],
  [1000000000, "One billion naira only"],
  [64350.5, "Sixty-four thousand, three hundred and fifty naira and fifty kobo only"],
  ["64350", "Sixty-four thousand, three hundred and fifty naira only"],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = amountInWords(input);
  if (got !== expected) {
    failed++;
    console.log(`FAIL ${input}\n  got:      ${got}\n  expected: ${expected}`);
  } else {
    console.log(`ok   ${String(input).padEnd(11)} ${got}`);
  }
}
console.log(failed ? `\n${failed} failed` : `\nall ${cases.length} passed`);
process.exit(failed ? 1 : 0);
