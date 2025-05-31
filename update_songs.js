// update_songs.js

// ─────────────────────────────────────────────────────────────────────────────
// 1) Replace all ESM 'import' lines with CommonJS 'require' statements.
//    In particular, music-metadata has no default export, so we grab it via require.
// ─────────────────────────────────────────────────────────────────────────────

const { Bot } = require("grammy");
const fs        = require("fs");
const axios     = require("axios");
const mm        = require("music-metadata");

// ─────────────────────────────────────────────────────────────────────────────
// 2) Your bot token – replace this with your actual token:
const BOT_TOKEN = "7537190571:AAGGikNChQnzBvBUwxYH6HqTCBz7Ps2Ar3o";

// 3) Initialize the bot
const bot = new Bot(BOT_TOKEN);

// 4) Path to the JSON file where songs are stored
const SONGS_FILE = "./updated_songs.json";


// ─────────────────────────────────────────────────────────────────────────────
// 5) Helper: load or initialize the songs array
function loadSongs() {
  if (fs.existsSync(SONGS_FILE)) {
    return JSON.parse(fs.readFileSync(SONGS_FILE, "utf8"));
  }
  return [];
}

// 6) Helper: save songs array back to disk
function saveSongs(songs) {
  fs.writeFileSync(SONGS_FILE, JSON.stringify(songs, null, 2), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) Helper: parse a “Title | Artist | Album | Cat1, Cat2” caption
function parseCaption(caption) {
  if (!caption) return {};
  const parts = caption.split("|").map((s) => s.trim());

  let categoryArray;
  if (parts[3]) {
    categoryArray = parts[3]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return {
    title: parts[0] || undefined,
    artist: parts[1] || undefined,
    album: parts[2] || undefined,
    category: categoryArray, // either an array or undefined
  };
}

// 8) Helper: strip parenthetical text from a title
function stripParentheses(str) {
  return str.replace(/\s*\(.*?\)\s*/g, "").trim();
}

// 9) Helper: build the “album code” for the ID
//    - Words that are exactly 4 digits stay as-is (year).
//    - Other words contribute their first uppercase letter.
function makeAlbumCode(albumName) {
  if (!albumName) return "";
  const words = albumName.split(/\s+/).filter((w) => w.length > 0);
  const codeParts = words.map((word) => {
    if (/^\d{4}$/.test(word)) {
      return word; // keep 4-digit years intact
    }
    return word.charAt(0).toUpperCase();
  });
  return codeParts.join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// 10) When an audio message arrives:
bot.on("message:audio", async (ctx) => {
  const audio   = ctx.message.audio;
  const caption = ctx.message.caption || "";
  const details = parseCaption(caption);

  // ────────────────────────────────────────────────────────────────────────────
  // 11) Attempt to download & parse ID3 tags only if needed
  let tagTitle, tagArtist, tagAlbum;
  try {
    // 11a) Get the File info from Telegram
    const fileObj = await ctx.api.getFile(audio.file_id);
    const filePathOnTelegram = fileObj.file_path; // e.g. "voice/file_12345.ogg"

    // 11b) Build the download URL
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePathOnTelegram}`;

    // 11c) Download as a stream
    const response = await axios.get(fileUrl, { responseType: "stream" });

    // 11d) Parse metadata from the stream, skipping cover art to save memory
    const metadata = await mm.parseStream(response.data, null, {
      skipCovers: true,
    });
    tagTitle  = metadata.common.title;   // might be undefined
    tagArtist = metadata.common.artist;  // might be undefined
    tagAlbum  = metadata.common.album;   // might be undefined

    // 11e) Close the stream if not already closed by parseStream
    if (response.data && typeof response.data.destroy === "function") {
      response.data.destroy();
    }
  } catch (err) {
    // If metadata parsing fails (no tags, network error, etc.), we’ll just fall back later.
    console.warn("⚠️  Could not parse audio metadata:", err.message);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 12) Decide which “title / artist / album” to use:
  const rawTitle  = details.title  || tagTitle  || audio.title     || "Unknown Title";
  const rawArtist = details.artist || tagArtist || audio.performer || "Unknown Artist";
  const rawAlbum  = details.album  || tagAlbum  || "Unknown Album";

  // 13) Category is only from caption; if user didn’t supply it, default to ["Uncategorized"]
  const rawCategoryArray = Array.isArray(details.category)
    ? details.category
    : ["Uncategorized"];

  // ────────────────────────────────────────────────────────────────────────────
  // 14) Strip parentheses from title and convert spaces to underscores
  const mainTitle   = stripParentheses(rawTitle);
  const titleForId  = mainTitle.split(/\s+/).join("_"); // e.g. "I Can't Wait" → "I_Can't_Wait"

  // 15) Build album code (e.g. "Mod Club 2011" → "MC2011", "House Of Balloons" → "HOB")
  const albumCode = makeAlbumCode(rawAlbum);

  // 16) Final ID is either "Title_AlbumCode" or just "Title" if no albumCode
  let finalId = titleForId;
  if (albumCode) {
    finalId = `${titleForId}_${albumCode}`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 17) Build the song object
  const song = {
    id:       finalId,
    title:    rawTitle,
    artist:   rawArtist,
    album:    rawAlbum,
    category: rawCategoryArray,  // this is an array of strings
    file_id:  audio.file_id,
  };

  // 18) Upsert into our JSON‐backed datastore
  let songs = loadSongs();
  const idx = songs.findIndex(
    (s) => s.file_id === song.file_id || s.id === song.id
  );
  if (idx >= 0) {
    songs[idx] = song;
  } else {
    songs.push(song);
  }
  saveSongs(songs);

  // ────────────────────────────────────────────────────────────────────────────
  // 19) Reply back with all fields (join category by commas for readability)
  await ctx.reply(
    `Saved:\n` +
    `• ID: ${song.id}\n` +
    `• Title: ${song.title}\n` +
    `• Artist: ${song.artist}\n` +
    `• Album: ${song.album}\n` +
    `• Category: ${song.category.join(", ")}`
  );
});

bot.start();
