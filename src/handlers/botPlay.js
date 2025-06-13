import { InlineKeyboard } from "grammy";
import { splitByLines } from "../utils.js";

export async function handlePlay(ctx, bot, songs) {
  try {
    const raw = (ctx.message?.text || "")
      .split(" ")
      .slice(1)
      .join(" ")
      .toLowerCase()
      .trim();

    if (!raw) {
      return await handleRandomPlay(ctx, bot, songs);
    }

    const matches = songs.filter(s =>
      s.id.toLowerCase().includes(raw) ||
      s.title.toLowerCase().includes(raw)
    );

    if (!matches.length) {
      return await ctx.reply("<b>No songs found.</b>", { parse_mode: "HTML" });
    }

    if (matches.length > 1) {
      return await handleMultipleMatches(ctx, bot, matches);
    }

    return await handleSingleMatch(ctx, bot, matches[0]);
  } catch (error) {
    console.error('Error in play command:', error);
    await ctx.reply("Sorry, something went wrong. Please try again.", {
      parse_mode: "HTML"
    });
  }
}

export async function handleRandomPlay(ctx, bot, songs) {
  const randomSong = songs[Math.floor(Math.random() * songs.length)];

  await ctx.replyWithAudio(randomSong.file_id, {
    caption: [
      `<b>Song:</b> ${randomSong.title}`,
      `<b>Album:</b> <i>${randomSong.album}</i>`,
      `<b>Artist:</b> <i>${randomSong.artist}</i>`,
    ].join("\n"),
    parse_mode: "HTML",
  });

  // Only show Lyrics button in private chat
  if (ctx.chat.type === "private") {
    const botU = bot.botInfo.username;
    const deepLink = `https://t.me/${botU}?start=lyrics_${randomSong.id}`;
    const keyboard = new InlineKeyboard().url("Lyrics?", deepLink);

    const sent = await ctx.reply("...", {
      reply_markup: keyboard,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    setTimeout(() => {
      ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(console.error);
    }, 2000);
  }
}

async function handleMultipleMatches(ctx, bot, matches) {
  const botU = bot.botInfo.username;
  const header = "<b>Multiple songs found:</b>\n";
  const lines = matches.map((s) => {
    if (ctx.chat.type === "private") {
      const payload = `play_${encodeURIComponent(s.id)}`;
      const u = `https://t.me/${botU}?start=${payload}`;
      return `<a href="${u}">•${s.title}</a> — <i>${s.artist}</i>`;
    } else {
      return `<b>•${s.title} — ${s.artist}</b>\n<code>/play@${botU} ${s.id}</code>`;
    }
  });

  const fullText = header + lines.join("\n\n");
  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}

async function handleSingleMatch(ctx, bot, selected) {
  await ctx.replyWithAudio(selected.file_id, {
    caption: [
      `<b>Song:</b> ${selected.title}`,
      `<b>Album:</b> <i>${selected.album}</i>`,
      `<b>Artist:</b> <i>${selected.artist}</i>`,
    ].join("\n"),
    parse_mode: "HTML",
  });

  // Only show Lyrics button in private chat
  if (ctx.chat.type === "private") {
    const botU = bot.botInfo.username;
    const deepLink = `https://t.me/${botU}?start=lyrics_${selected.id}`;
    const keyboard = new InlineKeyboard().url("Lyrics?", deepLink);

    const sent = await ctx.reply("...", {
      reply_markup: keyboard,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    setTimeout(() => {
      ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(console.error);
    }, 2000);
  }
}