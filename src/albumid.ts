// src/albumid.ts
import songs from "./songs.json";

interface Song {
  id:       string;
  title:    string;
  artist:   string;
  album:    string;
  category: string;
  file_id:  string;
  // album_cover?: string; // if you add that later
}

// “songs” came in as `any[]`, so assert it:
const allSongs = songs as Song[];

// extract unique album names:
const albumNames = Array.from(new Set(allSongs.map(s => s.album)));

function makeAlbumCode(name: string) {
  // however you generate the 6-char code
  return name
    .split(/\s+/)              // split on whitespace
    .map(w => w[0].toUpperCase())
    .join("")
    .slice(0, 6);
}

for (const album of albumNames) {
  console.log(`${makeAlbumCode(album).padEnd(6)} → ${album}`);
}
