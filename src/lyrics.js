// ─── lyrics.js ───

import he from "he";    // npm install he

const GENIUS_BASE = "https://api.genius.com";
const GENIUS_SITE = "https://genius.com";

// A helper to split any long string into ≤ maxLen-character chunks (preserving line breaks)
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
  if (current) chunks.push(current);
  return chunks;
}

// 1) Search Genius for a given artist + title; return { songId, songPath } or null.
export async function searchGenius(artist, title, geniusToken) {
  const query = encodeURIComponent(`${artist} ${title}`);
  const url = `${GENIUS_BASE}/search?q=${query}`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${geniusToken}` },
    });
    console.log("Genius /search URL:", url, "Status:", resp.status);
    const json = await resp.json();
    console.log("Genius /search response:", JSON.stringify(json));

    if (
      json.response &&
      Array.isArray(json.response.hits) &&
      json.response.hits.length > 0
    ) {
      const hit = json.response.hits[0].result;
      return {
        songId: hit.id,
        songPath: hit.path, // e.g. "/the-weeknd-cure-lyrics"
      };
    }
    return null;
  } catch (err) {
    console.error("searchGenius error:", err);
    return null;
  }
}

// 2) Fetch song info (metadata + description_annotation) from /songs/:id
export async function fetchGeniusSongInfo(songId, geniusToken) {
  const url = `${GENIUS_BASE}/songs/${songId}?text_format=plain`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${geniusToken}` },
    });
    console.log("Genius /songs/:id URL:", url, "Status:", resp.status);
    const json = await resp.json();
    console.log("Genius /songs/:id response:", JSON.stringify(json));

    if (json.response && json.response.song) {
      return json.response.song;
    }
    return null;
  } catch (err) {
    console.error("fetchGeniusSongInfo error:", err);
    return null;
  }
}

// 3) Scrape raw lyrics from the Genius HTML page.
//    First try <div data-lyrics-container="true">…</div> blocks.
//    If that fails, fall back to <div class="lyrics">…</div>.
export async function scrapeLyricsFromGenius(songPath) {
  const url = `${GENIUS_SITE}${songPath}`;
  try {
    const resp = await fetch(url);
    console.log("Fetching Genius page:", url, "Status:", resp.status);
    const html = await resp.text();
    console.log("Genius page HTML snippet:", html.slice(0, 500));

    // 3a) Modern: <div data-lyrics-container="true">…</div>
    const regexModern = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
    const matches = [];
    let m;
    while ((m = regexModern.exec(html)) !== null) {
      matches.push(m[1]);
    }
    if (matches.length > 0) {
      // Replace <br/> with newline, strip other HTML tags:
      const stripTags = (str) =>
        str.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
      const lyricBlocks = matches.map((blk) => stripTags(blk));
      return lyricBlocks.join("\n\n");
    }

    // 3b) Fallback: <div class="lyrics">…</div>
    const legacyMatch = html.match(/<div class="lyrics">([\s\S]*?)<\/div>/i);
    if (legacyMatch && legacyMatch[1]) {
      const rawLyrics = legacyMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "");
      return rawLyrics.trim();
    }

    // 3c) If neither pattern matched, return null
    console.log("No lyric containers found on page:", url);
    return null;
  } catch (err) {
    console.error("scrapeLyricsFromGenius error:", err);
    return null;
  }
}

// 4) Given (artist, title), return an array of cleaned + bolded lyric-chunks (or null).
export async function getLyricsChunks(artist, title, geniusToken) {
  // 1) Find the song ID + path via the Genius API
  const found = await searchGenius(artist, title, geniusToken);
  if (!found) {
    console.log("searchGenius returned null for:", artist, title);
    return null;
  }

  // 2) Scrape the raw lyrics HTML/text from genius.com
  const lyricsText = await scrapeLyricsFromGenius(found.songPath);
  if (!lyricsText) {
    console.log("scrapeLyricsFromGenius returned null for path:", found.songPath);
    return null;
  }

  // ─── BEGIN CLEANUP ─────────────────────────────────────────────────────────

  // A) Split into lines, drop first line if it contains “Contributors” or “Translations”
  {
    const lines = lyricsText.split("\n");
    if (lines.length > 0 && /contributors|translations/i.test(lines[0])) {
      lines.shift();
    }
    // Rejoin so we continue with everything else
    // (this also automatically drops any blank line that was the “header”)
    var cleaned = lines.join("\n");
  }

  // B) Decode HTML entities (e.g. “I&#x27;d” → “I’d”, “&amp;” → “&”)
  cleaned = he.decode(cleaned);

  // C) Remove any remaining HTML tags (optional; strip <i>, <b>, etc.)
  cleaned = cleaned.replace(/<\/?[^>]+>/g, "");

  // D) Trim leading/trailing whitespace and collapse 3+ newlines into exactly 2 newlines
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // ─── END CLEANUP ───────────────────────────────────────────────────────────

  // 3) Split the fully cleaned text into ≤4000-character chunks
  const rawChunks = splitByLines(cleaned, 4000);

  // 4) Wrap each chunk in <b>…</b> so it renders bold in Telegram
  const boldChunks = rawChunks.map((c) => `<b>${c}</b>`);

  return boldChunks;
}

// 5) (Optional) If you want a fallback info card when no description_annotation is present.
//    Not modified here. You can leave this as-is, or remove if you never use it.
export async function getFallbackInfo(artist, title, geniusToken) {
  const found = await searchGenius(artist, title, geniusToken);
  if (!found) {
    console.log("searchGenius returned null for fallback-info:", artist, title);
    return null;
  }

  const info = await fetchGeniusSongInfo(found.songId, geniusToken);
  if (!info) {
    console.log("fetchGeniusSongInfo returned null for fallback-info:", found.songId);
    return null;
  }

  // Build a short “info card” using just song-related fields:
  const parts = [];
  if (info.full_title) {
    parts.push(`**${info.full_title}**`);
  }
  if (info.primary_artist_names) {
    parts.push(`• *Artist:* ${info.primary_artist_names}`);
  }
  const rd = info.release_date_for_display || "—";
  parts.push(`• *Release date:* ${rd}`);

  // Return as a single-chunk array (split further if >4000 chars)
  const msg = parts.join("\n");
  return splitByLines(msg, 4000);
}

// 6) (Optional) Annotation chunks logic—unchanged from before.
export async function getAnnotationChunks(artist, title, geniusToken) {
  const found = await searchGenius(artist, title, geniusToken);
  if (!found) {
    console.log("searchGenius returned null for getAnnotationChunks:", artist, title);
    return null;
  }

  const info = await fetchGeniusSongInfo(found.songId, geniusToken);
  if (!info) {
    console.log(
      "fetchGeniusSongInfo returned null for getAnnotationChunks, songId:",
      found.songId
    );
    return null;
  }

  // 6a) Try the “About this song” (description_annotation)
  const annotationBody = info?.description_annotation?.body?.plain || "";
  if (annotationBody) {
    // Split into ≤4000-character chunks:
    return splitByLines(annotationBody, 4000).map((c) => `<b>${he.decode(c)}</b>`);
  }

  // 6b) Otherwise, fall back to the “info card” fields if available:
  return getFallbackInfo(artist, title, geniusToken);
}
