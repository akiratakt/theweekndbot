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
  const isPrivate = ctx.chat.type === "private";

  let lines;
  if (isPrivate) {
    // Private: deep links
    lines = Object.entries(albumCodeMap).map(([code, full]) => {
      const u = `https://t.me/${botU}?start=album_${code}`;
      return `<a href="${u}">${full}</a>`;
    });
  } else {
    // Group: show as "Album Name\n<code>/album@BotUsername Album Name</code>"
    lines = Object.values(albumCodeMap).map(full => {
      return `${full}\n<code>/album@${botU} ${full}</code>`;
    });
  }

  const header = "<b>All albums:</b>";
  const fullText = header + "\n" + lines.join("\n\n");

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
  const isPrivate = ctx.chat.type === "private";

  let lines;
  if (isPrivate) {
    lines = matches.map(full => {
      const payload = slugify(full);
      const u = `https://t.me/${botU}?start=album_${payload}`;
      return `<a href="${u}">${full}</a>`;
    });
  } else {
    lines = matches.map(full => {
      return `<b>${full}</b>\n<code>/album@${botU} ${full}</code>`;
    });
  }

  const header = "<b>Multiple albums found:</b>";
  const fullText = header + "\n" + lines.join("\n\n");

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
    if (coverUrl.toLowerCase().endsWith(".gif")) {
      // Send as animation so Telegram will actually loop it
      await ctx.replyWithAnimation(coverUrl, {
        caption: headerText,
        parse_mode: "HTML",
      });
    } else {
      // Non‐GIF covers stay as static photos
      await ctx.replyWithPhoto(coverUrl, {
        caption: headerText,
        parse_mode: "HTML",
      });
    }
  } else {
    await ctx.reply(headerText, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  // Build track list
  const lines = tracks.map((s, idx) => {
    if (ctx.chat.type === "private") {
      const p = `play_${encodeURIComponent(s.id)}`;
      const u = `https://t.me/${botU}?start=${p}`;
      return `${idx + 1}. <a href="${u}">•${s.title}</a> — <i>${s.artist}</i>`;
    } else {
      return `<b>•${s.title} — ${s.artist}</b>\n<code>/play@${botU} ${s.id}</code>`;
    }
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