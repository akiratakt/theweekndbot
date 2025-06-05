import { InlineKeyboard } from "grammy";
import { splitByLines, slugify } from "../utils.js";
import { getLyricsChunks } from "../lyrics.js";
import { logUserDetails } from "../userLogger.js";
import { handleSingleCategory } from "./botCategory.js"; 




export async function handleStart(ctx, bot, songs, covers, albumCodeMap, categoryCodeMap, env) {
  try {
    await logUserDetails(ctx, env.DAWN_LOG);
    const incomingId = ctx.message?.message_id;
    const chatId = ctx.chat.id;
    const payload = ctx.startPayload || "";
    
    const param = payload.startsWith("play_") ||
                 payload.startsWith("album_") ||
                 payload.startsWith("category_") ||
                 payload.startsWith("lyrics_")
      ? payload
      : (ctx.message?.text || "").split(" ").slice(1)[0] || "";

    if (param.startsWith("play_")) {
      return await handlePlayStart(ctx, bot, songs, incomingId, chatId, param);
    }
    if (param.startsWith("lyrics_")) {
      return await handleLyricsStart(ctx, bot, songs, env, incomingId, chatId, param);
    }
    if (param.startsWith("piece_")) {
      return await handlePieceStart(ctx, bot, songs, covers, incomingId, chatId, param);
    }
    if (param.startsWith("album_")) {
      return await handleAlbumStart(ctx, bot, songs, covers, albumCodeMap, incomingId, chatId, param);
    }
// Modify this section in handleStart:
        if (param.startsWith("category_")) {
        const code = param.slice(9);
        const matches = [[code, categoryCodeMap[code]]];
        return await handleSingleCategory(ctx, bot, matches[0], songs);
        }

    return await handleDefaultWelcome(ctx, incomingId, chatId);
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply("Sorry, something went wrong. Please try again.", {
      parse_mode: "HTML"
    });
  }
}

export async function handlePlayStart(ctx, bot, songs, incomingId, chatId, param) {
  const trackId = param.slice(5);
  const track = songs.find(s => s.id === trackId);
  
  if (!track) {
    await ctx.reply("<b>Track not found!</b>", { parse_mode: "HTML" });
    await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
    return;
  }

  await ctx.replyWithAudio(track.file_id, {
    caption: [
      `<b>Song:</b> ${track.title}`,
      `<b>Album:</b> <i>${track.album}</i>`,
      `<b>Artist:</b> <i>${track.artist}</i>`,
    ].join("\n"),
    parse_mode: "HTML",
  });

  const botU = bot.botInfo.username;
  const deepLink = `https://t.me/${botU}?start=lyrics_${track.id}`;
  const keyboard = new InlineKeyboard().url("Lyrics?", deepLink);
  
  await ctx.reply("...", {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });

  await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
}

export async function handleLyricsStart(ctx, bot, songs, env, incomingId, chatId, param) {
  const trackId = param.slice(7);
  const track = songs.find(s => s.id === trackId);
  
  if (!track) {
    await ctx.reply("<b>Track not found!</b>", { parse_mode: "HTML" });
    await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
    return;
  }

  const lyricsChunks = await getLyricsChunks(track.artist, track.title, env.GENIUS_API_TOKEN);

  if (!lyricsChunks) {
    await ctx.reply(
      `<b>No lyrics found for [${track.title}] by ${track.artist}</b>`,
      { parse_mode: "HTML" }
    );
    await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
    return;
  }

  await ctx.reply(`<b>Lyrics for [${track.title}]</b>`, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  for (const chunk of lyricsChunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
}

export async function handlePieceStart(ctx, bot, songs, covers, incomingId, chatId, param) {
  const slug = param.slice(6);
  const tracks = songs.filter(s => slugify(s.album) === slug);

  if (!tracks.length) {
    const humanName = slug.replace(/-/g, " ");
    await ctx.reply(`<b>No tracks found for [${humanName}].</b>`, {
      parse_mode: "HTML",
    });
    await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
    return;
  }

  const humanAlbum = tracks[0].album;
  const coverUrl = covers[humanAlbum.trim()];
  const headerText = `<b>[${humanAlbum}]</b>`;

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

  const botU = bot.botInfo.username;
  const lines = tracks.map((s, idx) => {
    const payload = `play_${encodeURIComponent(s.id)}`;
    const u = `https://t.me/${botU}?start=${payload}`;
    return `${idx + 1}. <a href="${u}">${s.title}</a> — <i>${s.artist}</i>`;
  });

  const chunks = splitByLines(lines.join("\n"), 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
}

export async function handleAlbumStart(ctx, bot, songs, covers, albumCodeMap, incomingId, chatId, param) {
  const code = param.slice(6);
  const full = albumCodeMap[code];
  
  if (!full) {
    await ctx.reply("<b>Album not found!</b>", { parse_mode: "HTML" });
    await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
    return;
  }

  const coverUrl = covers[full.trim()];
  const tracks = songs.filter(s => 
    s.album.split(",").map(a => a.trim()).includes(full)
  );

  const botU = bot.botInfo.username;
  const albumHeader = `<b>[${full}]</b>`;

  if (coverUrl) {
    await ctx.replyWithPhoto(coverUrl, {
      caption: albumHeader,
      parse_mode: "HTML",
    });
  } else {
    await ctx.reply(albumHeader, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  const lines = tracks.map((s, idx) => {
    const p = `play_${encodeURIComponent(s.id)}`;
    const u = `https://t.me/${botU}?start=${p}`;
    return `${idx + 1}. <a href="${u}">${s.title} — ${s.artist}</a>`;
  });

  const chunks = splitByLines(lines.join("\n"), 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
}

async function handleDefaultWelcome(ctx, incomingId, chatId) {
  await ctx.replyWithPhoto(
    "https://raw.githubusercontent.com/akiratakt/theweekndbot/refs/heads/main/covers/default/def.jpeg",
    {
      caption: [
        "<b><u>Welcome to [103.5]dawn.&#8203;fm!</u></b>",
        "<b><i>You're about to hear The Weeknd like never before.</i></b>\n",
        "<b>From mixtapes and demos to rare early tracks that built the legend.</b>",
        "<b>Live sessions, arena anthems and Memento Mori exclusives.</b>",
        "<b>Hidden cuts, instrumentals, remixes and collabs.</b>\n",
        "<b>Hit &lt;&lt; /category &gt;&gt; and get started...</b>",
        "<b>Tune in.</b>\n",
        "<b><i>“You are now listening to 103.5… DawnFM.”</i></b>",
      ].join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }
  );
  await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
}