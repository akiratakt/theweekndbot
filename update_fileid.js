const fs = require("fs");
const stringSimilarity = require("string-similarity");

// Load songs and updated_songs
const songs = JSON.parse(fs.readFileSync("src/songs.json", "utf8"));
const updated = JSON.parse(fs.readFileSync("updated_songs.json", "utf8"));

// Build a list of updated songs with title and file_id
const updatedList = updated
  .filter(song => song.title && song.file_id)
  .map(song => ({ title: song.title.trim(), file_id: song.file_id }));

let updatedCount = 0;
let notFound = [];

for (const song of songs) {
  if (!song.title) {
    notFound.push(song);
    continue;
  }
  // Fuzzy match by title
  const titles = updatedList.map(s => s.title);
  const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(
    song.title.trim(),
    titles
  );
  // Update if similarity is high enough
  if (bestMatch.rating > 0.85) {
    const newFileId = updatedList[bestMatchIndex].file_id;
    if (song.file_id !== newFileId) updatedCount++;
    song.file_id = newFileId;
  } else {
    notFound.push(song);
  }
}

fs.copyFileSync("src/songs.json", "src/songs.json.bak");
fs.writeFileSync("src/songs.json", JSON.stringify(songs, null, 2), "utf8");

console.log(`Updated file_id for ${updatedCount} songs.`);

if (notFound.length > 0) {
  console.log("Songs not found in updated_songs.json:");
  notFound.forEach(song => {
    console.log(`- ${song.title || "Unknown Title"}`);
  });
} else {
  console.log("All songs matched!");
}