/**
 * Quick checks for src/utils/phone.js.  Run: node scripts/test-phone.mjs
 * Exits 1 on any failure.
 */
import {
  PHONE_ERRORS, validateNgPhone, normaliseNgPhone, formatNgPhone, samePhone, checkPhoneField,
} from "../src/utils/phone.js";

const valid = [
  ["08050854444", "08050854444"],
  ["8050854444", "08050854444"],
  ["+2348050854444", "08050854444"],
  ["2348050854444", "08050854444"],
  ["+234 805 085 4444", "08050854444"],
  ["0805-085-4444", "08050854444"],
  ["(0805) 085 4444", "08050854444"],
  ["+234 0805 085 4444", "08050854444"],
  ["+23408050854444", "08050854444"],
  ["002348050854444", "08050854444"],
  ["  0703 123 4567 ", "07031234567"],
  ["0813 123 4567", "08131234567"],
  ["09012345678", "09012345678"],
  ["0911 234 5678", "09112345678"],
];

const invalid = [
  ["", PHONE_ERRORS.required],
  ["0805085444", PHONE_ERRORS.length],        // 10 digits
  ["080508544444", PHONE_ERRORS.length],      // 12 digits
  ["+234 805 085", PHONE_ERRORS.length],
  ["+1 415 555 0100", PHONE_ERRORS.country],
  ["+44 7911 123456", PHONE_ERRORS.country],
  ["+233 24 123 4567", PHONE_ERRORS.country],
  ["00447911123456", PHONE_ERRORS.country],
  ["06012345678", PHONE_ERRORS.prefix],       // first digit 6
  ["08250854444", PHONE_ERRORS.prefix],       // second digit 2
  ["01234567890", PHONE_ERRORS.prefix],
];

let failed = 0;
const fail = (msg) => { failed++; console.error("FAIL", msg); };

for (const [input, want] of valid) {
  const r = validateNgPhone(input);
  if (!r.ok || r.phone !== want) fail(`${JSON.stringify(input)} → ${JSON.stringify(r)}, want ${want}`);
}
for (const [input, wantErr] of invalid) {
  const r = validateNgPhone(input);
  if (r.ok || r.error !== wantErr) fail(`${JSON.stringify(input)} → ${JSON.stringify(r)}, want error "${wantErr}"`);
}

if (formatNgPhone("08050854444") !== "0805 085 4444") fail("formatNgPhone");
if (validateNgPhone("+2348050854444").display !== "0805 085 4444") fail("display");
if (normaliseNgPhone("+1 415 555 0100") !== null) fail("normaliseNgPhone invalid → null");
if (!samePhone("+2348050854444", "0805 085 4444")) fail("samePhone across formats");
if (samePhone("08050854444", "08050854445")) fail("samePhone different numbers");
if (!checkPhoneField("", { required: false }).ok) fail("optional empty field");
if (checkPhoneField("", { required: true }).ok) fail("required empty field");

const total = valid.length + invalid.length + 7;
console.log(failed ? `${failed} of ${total} checks failed` : `All ${total} phone checks passed`);
process.exit(failed ? 1 : 0);
