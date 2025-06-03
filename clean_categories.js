const fs = require('fs');
const path = './src/songs.json';
const categoryMap = require('./src/categoryMap');

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.forEach(song => {
  if (song.category) {
    song.category = song.category
      .split(",")
      .map(c => {
        const key = c.trim().toLowerCase();
        return categoryMap[key] || c.trim();
      })
      .filter(Boolean)
      .join(", ");
  }
});

fs.writeFileSync('songs.cleaned.json', JSON.stringify(data, null, 2));
console.log('songs.cleaned.json written!');