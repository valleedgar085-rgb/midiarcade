import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const marker = "export function evaluateRepairAcceptance(";
const first = source.indexOf(marker);
if (first < 0) throw new Error("repair acceptance function is missing");

function declarationEnd(start) {
  const open = source.indexOf("{", start);
  if (open < 0) throw new Error("repair acceptance function has no opening brace");
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] === "\n" || source[end] === "\r") end += 1;
        return end;
      }
    }
  }
  throw new Error("repair acceptance function has unmatched braces");
}

let removed = 0;
let duplicate = source.indexOf(marker, first + marker.length);
while (duplicate >= 0) {
  const end = declarationEnd(duplicate);
  source = source.slice(0, duplicate) + source.slice(end);
  removed += 1;
  duplicate = source.indexOf(marker, first + marker.length);
}

const remaining = source.split(marker).length - 1;
if (remaining !== 1) throw new Error(`expected one repair acceptance function, found ${remaining}`);
if (!removed) {
  console.log("Repair acceptance function already unique.");
  process.exit(0);
}
fs.writeFileSync(path, source);
console.log(`Removed ${removed} duplicate repair acceptance declaration(s).`);
