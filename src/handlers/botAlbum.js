import { splitByLines, slugify } from "../utils.js";

export async function handleAlbum(ctx, bot, songs, covers, albumNames, albumCodeMap) {
  try {
    const query = (ctx.message?.text || "")
      .split(" ")
      .slice(1)
      .join(" ")
      .trim()
      .toLowerCase();
    
    if (!query) {
      return await handleAllAlbums(ctx, bot, albumCodeMap);
    }

    const matches = albumNames.filter(a => a.toLowerCase().includes(query));
    
    if (!matches.length) {
      return await ctx.reply("<b>No albums matched.</b>", { parse_mode: "HTML" });
    }

    if (matches.length > 1) {
      return await handleMultipleAlbums(ctx, bot, matches);
    }

    return await handleSingleAlbum(ctx, bot, matches[0], songs, covers);
  } catch (error) {
    console.error('Error in album command:', error);
    await ctx.reply("Sorry, something went wrong. Please try again.", {
      parse_mode: "HTML"
    });
  }
}

export async function handleAllAlbums(ctx, bot, albumCodeMap) {
  const botU = bot.botInfo.username;
  const lines = Object.entries(albumCodeMap).map(([code, full]) => {
    const u = `https://t.me/${botU}?start=album_${code}`;
    return `<a href="${u}">${full}</a>`;
  });

  const header = "<b>All albums:</b>";
  const fullText = header + "\n" + lines.join("\n");

  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}

export async function handleMultipleAlbums(ctx, bot, matches) {
  const botU = bot.botInfo.username;
  const pieceSet = new Set();

  // Build unique pieces set
  for (const full of matches) {
    full
      .split(",")
      .map(piece => piece.trim())
      .filter(piece => piece.length)
      .forEach(piece => pieceSet.add(piece));
  }

  // Create links for each piece
  const lines = [];
  for (const piece of pieceSet) {
    const payload = slugify(piece);
    const u = `https://t.me/${botU}?start=piece_${payload}`;
    lines.push(`<a href="${u}">${piece}</a>`);
  }

  const header = "<b>Multiple albums found:</b>";
  const fullText = header + "\n" + lines.join("\n");

  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}

export async function handleSingleAlbum(ctx, bot, albumName, songs, covers) {
  const tracks = songs.filter(s => s.album === albumName);
  const botU = bot.botInfo.username;
  
  // Send album header with cover if available
  const coverUrl = covers[albumName.trim()];
  const headerText = `<b>[${albumName}]</b>`;

  if (coverUrl) {
    await ctx.replyWithPhoto(coverUrl, {
      caption: headerText,
      parse_mode: "HTML",
    });
  } else {
    await ctx.reply(headerText, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  // Build track list
  const lines = tracks.map((s, idx) => {
    const p = `play_${encodeURIComponent(s.id)}`;
    const u = `https://t.me/${botU}?start=${p}`;
    return `${idx + 1}. <a href="${u}">${s.title}</a> — <i>${s.artist}</i>`;
  });

  const fullText = lines.join("\n");
  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}