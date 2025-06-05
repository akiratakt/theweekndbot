import { InlineKeyboard } from "grammy";

// Function to split long messages
export function splitByLines(text, maxLen = 4000) {
  const lines = text.split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

// Generate album code from name
export function makeAlbumCode(name) {
  const cleaned = name.replace(/[^\w\s\d]/g, " ");
  const parts = cleaned.trim().split(/\s+/);
  return parts
    .filter(token => token && typeof token === "string")
    .map(token => {
      if (!token || typeof token !== "string" || !token[0]) return "";
      if (/^[A-Z]{2,}$/.test(token)) return token;
      if (/^\d+$/.test(token)) return token;
      if (token.length > 1 && token.toLowerCase() !== token) return token;
      return token[0].toUpperCase();
    })
    .join("");
}

// URL-friendly slug generator
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

// Safe property access helper
export function safeAccess(obj, ...keys) {
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}