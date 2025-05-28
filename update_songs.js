import { Bot } from "grammy";
import fs from "fs";

const SONGS_FILE = "./updated_songs.json";
const bot = new Bot("7537190571:AAGGikNChQnzBvBUwxYH6HqTCBz7Ps2Ar3o");

// Helper: Load or initialize songs array
function loadSongs() {
  if (fs.existsSync(SONGS_FILE)) {
    return JSON.parse(fs.readFileSync(SONGS_FILE, "utf8"));
  }
  return [];
}

// Helper: Save songs array
function saveSongs(songs) {
  fs.writeFileSync(SONGS_FILE, JSON.stringify(songs, null, 2), "utf8");
}

// Helper: Try to parse details from caption (format: title | artist | album | category)
function parseCaption(caption) {
  if (!caption) return {};
  const parts = caption.split("|").map(s => s.trim());
  return {
    title: parts[0] || undefined,
    artist: parts[1] || undefined,
    album: parts[2] || undefined,
    category: parts[3] || undefined,
  };
}

bot.on("message:audio", async ctx => {
  const audio = ctx.message.audio;
  const caption = ctx.message.caption || "";
  const details = parseCaption(caption);

  // Compose song object
  const song = {
    id: audio.file_unique_id || audio.file_id,
    title: details.title || audio.title || "Unknown Title",
    artist: details.artist || audio.performer || "Unknown Artist",
    album: details.album || "Unknown Album",
    category: details.category || "Uncategorized",
    file_id: audio.file_id,
  };

  // Load, update or add, and save
  let songs = loadSongs();
  const idx = songs.findIndex(s => s.file_id === song.file_id || s.id === song.id);
  if (idx >= 0) {
    songs[idx] = song;
  } else {
    songs.push(song);
  }
  saveSongs(songs);

  await ctx.reply(
    `Saved: ${song.title} by ${song.artist}\nAlbum: ${song.album}\nCategory: ${song.category}`
  );
});

bot.start();