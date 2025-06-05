import { makeAlbumCode } from "./utils.js";

export function setupAlbums(songs) {
  const albumMap = new Set();
  songs.forEach(song => {
    song.album
      .split(",")
      .map(a => a.trim())
      .filter(a => a.length)
      .forEach(albumName => albumMap.add(albumName));
  });

  const albumNames = Array.from(albumMap).sort((a, b) => a.localeCompare(b));
  
  const albumCodeMap = {};
  for (const fullAlbumName of albumNames) {
    const base = makeAlbumCode(fullAlbumName);
    let code = base;
    let i = 1;
    while (albumCodeMap[code]) {
      code = `${base}${i++}`;
    }
    albumCodeMap[code] = fullAlbumName;
  }

  return { albumMap, albumNames, albumCodeMap };
}

export function setupCategories(songs, categoryMap) {
  const tagSet = new Set();
  songs.forEach(song => {
    song.category
      .split(",")
      .map(t => {
        const key = t.trim().toLowerCase();
        return categoryMap[key] || t.trim();
      })
      .filter(t => t.length)
      .forEach(t => tagSet.add(t));
  });

  const categoryNames = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  
  const categoryCodeMap = {};
  for (const full of categoryNames) {
    const base = makeAlbumCode(full);
    let code = base;
    let i = 1;
    while (categoryCodeMap[code]) {
      code = `${base}${i++}`;
    }
    categoryCodeMap[code] = full;
  }

  return { tagSet, categoryNames, categoryCodeMap };
}