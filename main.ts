// The Long Roast: Lawmakers and the File They Cannot Convert
// Writes one satirical sentence to $MAKEFUN_OUTPUT_DIR/entry.txt
// (default /output). Node 22 runs this TypeScript directly.
//
// Reviser rewrite: same entry text as the original build, but the program
// now validates the text against the house gate BEFORE writing anything,
// and re-verifies the file it just wrote. If any gate check would fail,
// it exits non-zero with the failure on stderr instead of silently
// writing an entry the scorer would mark Valid 0.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The entry: one sentence, 155 characters, no trailing newline.
const ENTRY =
  "The senator who wants to ban your encryption once asked IT whether converting a file to PDF would 'use up the internet,' and then voted on the bill anyway.";

// The house gate (competition.yaml / RULES.txt): UTF-8 text, 1–320
// characters, not only white space. The judge brief also requires one
// sentence on a single line, so those are checked here too.
const GATE = {
  minChars: 1,
  maxChars: 320,
} as const;

function fail(reason: string): never {
  console.error(`gate check failed: ${reason}`);
  process.exit(1);
}

function validateGate(text: string): void {
  // 1. Length: 1–320 characters, counted as code points (what the
  // scorer counts), not UTF-16 code units.
  const chars = [...text].length;
  if (chars < GATE.minChars || chars > GATE.maxChars) {
    fail(`length ${chars} chars outside ${GATE.minChars}–${GATE.maxChars}`);
  }

  // 2. Not only white space.
  if (text.trim().length === 0) {
    fail("text is only white space");
  }

  // 3. Single line: no newline or carriage return anywhere.
  if (/[\r\n]/.test(text)) {
    fail("text spans more than one line");
  }

  // 4. No leading or trailing white space (would be invisible bytes the
  // judge reads as part of the entry).
  if (text !== text.trim()) {
    fail("text has leading or trailing white space");
  }

  // 5. UTF-8 round-trip: encode and decode; the result must be identical,
  // which rules out lone surrogates and other non-encodable content.
  const encoded = new TextEncoder().encode(text);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
  if (decoded !== text) {
    fail("text does not round-trip through UTF-8");
  }

  // 6. One sentence: exactly one sentence-terminating period, at the end.
  const periods = (text.match(/\./g) ?? []).length;
  if (periods !== 1 || !text.endsWith(".")) {
    fail(`expected exactly one sentence (one final period), found ${periods} periods`);
  }

  // 7. No control characters: the gate wants plain UTF-8 text, and a
  // stray control byte (e.g. from a copy-paste) would be invisible in
  // the entry but visible to the scorer.
  if (/[\u0000-\u001f\u007f]/.test(text)) {
    fail("text contains a control character");
  }
}

validateGate(ENTRY);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.txt");
writeFileSync(outPath, ENTRY, "utf8");

// Verify what was actually written: read the file back and confirm it is
// byte-identical to the validated text. A silent write failure or an
// encoding surprise must not reach the grader.
const written = readFileSync(outPath, "utf8");
if (written !== ENTRY) {
  fail("written file differs from validated entry text");
}
