const fs = require('fs');
const path = './src/songs.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));
data.forEach(song => {
  if (song.id) {
    song.id = song.id.replace(/[\(\)\-]/g, '');
  }
});
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('All song ids cleaned!');