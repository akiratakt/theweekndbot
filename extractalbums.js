const fs = require('fs');

// Read the songs.json file
const data = JSON.parse(fs.readFileSync('./src/songs.json', 'utf8'));

// Extract unique album names, filter out undefined/null
const albums = Array.from(
  new Set(
    data
      .map(song => song.album)
      .filter(Boolean)
  )
);

// Write to albums.json
fs.writeFileSync('albums.json', JSON.stringify(albums, null, 2));

console.log('Extracted album names:', albums.length);