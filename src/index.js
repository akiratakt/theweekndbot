import { Bot } from "grammy";
import songs from "./songs.json";
import covers from "./covers.json";   // { "After Hours": "https://…/after_hours.jpg", … }

// helper: generate album code from full name
function makeAlbumCode(name) {
  const cleaned = name.replace(/[^\w\s\d]/g, " ");
  const parts   = cleaned.trim().split(/\s+/);
  return parts.map(token => {
    if (/^[A-Z]{2,}$/.test(token)) return token;
    if (/^\d+$/.test(token))        return token;
    if (token.length > 1 && token.toLowerCase() !== token) return token;
    return token[0].toUpperCase();
  }).join("");
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("theweekndbot is running.", { status: 200 });
    }

    const update = await request.json();

    // instantiate bot
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN, {
      botInfo: {
        id: 7537190571,
        is_bot: true,
        first_name: "[103.5]dawn.fm",
        username: "dawnfm103_5Bot",
      }
    });

    // 1) grab every distinct album name
    const albumNames = Array.from(new Set(songs.map(s => s.album)));

    // 2) build a unique code→albumName map, collision-proofed
    const albumCodeMap = {};
    for (const full of albumNames) {
      const base = makeAlbumCode(full);
      let code  = base;
      let i     = 1;
      while (albumCodeMap[code]) {
        code = `${base}${i++}`;
      }
      albumCodeMap[code] = full;
    }

    // START: handle "/start" + deep-links
    bot.command("start", async ctx => {
      const incomingId = ctx.message?.message_id;
      const chatId     = ctx.chat.id;
      const payload    = ctx.startPayload || "";
      const param      = payload.startsWith("play_") || payload.startsWith("album_")
                        ? payload
                        : ((ctx.message?.text || "").split(" ").slice(1)[0] || "");

      // PLAY deep-link:  t.me/…?start=play_TRACKID
      if (param.startsWith("play_")) {
        const trackId = param.slice(5);
        const track   = songs.find(s => s.id === trackId);
        if (!track) {
          await ctx.reply("<b>Track not found!</b>", { parse_mode: "HTML" });
        } else {
          await ctx.replyWithAudio(track.file_id, {
            caption: [
              `<b>Song:</b> ${track.title}`,
              `<b>Album:</b> <i>${track.album}</i>`,
              `<b>Artist:</b> <i>${track.artist}</i>`,
            ].join("\n"),
            parse_mode: "HTML",
          });
        }
        // clean up deep-link message
        await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
        return;
      }

      // ALBUM deep-link: t.me/…?start=album_CODE
      if (param.startsWith("album_")) {
        const code   = param.slice(6);
        const full   = albumCodeMap[code];
        if (!full) {
          await ctx.reply("<b>Album not found!</b>", { parse_mode: "HTML" });
          await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
          return;
        }

        const coverUrl = covers[full];
        const tracks   = songs.filter(s => s.album === full);
        const botU     = bot.botInfo.username;

        // build tracklist with play-links
        const listLines = tracks.map((s, i) => {
          const p = `play_${encodeURIComponent(s.id)}`;
          const u = `https://t.me/${botU}?start=${p}`;
          return `${i+1}. <a href="${u}">${s.title} — ${s.artist}</a>`;
        });

        if (coverUrl) {
          // send album cover + tracklist
          await ctx.replyWithPhoto(coverUrl, {
            caption: [
              `<b>[${code}] ${full}</b>`,
              ...listLines
            ].join("\n"),
            parse_mode: "HTML",
            disable_web_page_preview: false,
          });
        } else {
          // fallback: text only
          await ctx.reply(
            `<b>[${code}] ${full}</b>\n` + listLines.join("\n"),
            { parse_mode: "HTML", disable_web_page_preview: true }
          );
        }

        await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
        return;
      }

      // default welcome
      await ctx.reply(
        [
			"<b><u>Welcome to [103.5]dawn.&#8203;fm!</u></b>",
			"<b><i>You’re about to hear The Weeknd like never before.</i></b>\n",
			"<b>From mixtapes and demos to rare early tracks that built the legend.</b>",
			"<b>Live sessions, arena anthems and Memento Mori exclusives.</b>",
			"<b>Hidden dawn.&#8203;fm cuts, instrumentals, remixes and collabs.</b>\n",
			"<b>Hit &lt;&lt; /help &gt;&gt; and get started...</b>",
			"<b>Tune in.</b>\n",
			"<b><i>“You are now listening to 103.5… DawnFM.”</i></b>"
		  ].join("\n"),
      { parse_mode: "HTML" });

      await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
    });

    // LIST: all albums with their deep-link
    bot.command("list", ctx => {
      if (!albumNames.length) {
        return ctx.reply("<b>No albums available.</b>", { parse_mode: "HTML" });
      }
      const botU = bot.botInfo.username;
      const lines = Object.entries(albumCodeMap).map(([code, full]) => {
        const u = `https://t.me/${botU}?start=album_${code}`;
        return `<b>[${code}]</b> <a href="${u}">${full}</a>`;
      });
      return ctx.reply(lines.join("\n"), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    });

    // SEARCH: song fuzzy
    bot.command("search", async ctx => {
      const parts = (ctx.message?.text || "").split(" ");
      const query = parts.slice(1).join(" ").toLowerCase();
      if (!query) {
        return ctx.reply("<b>Usage: /search &lt;song name&gt;</b>", { parse_mode: "HTML" });
      }
      const found = songs.filter(s =>
        s.id.toLowerCase().includes(query) ||
        s.title.toLowerCase().includes(query)
      );
      if (!found.length) {
        return ctx.reply("<b>No songs matched.</b>", { parse_mode: "HTML" });
      }
      const byAlb = {};
      found.forEach(s => {
        (byAlb[s.album] = byAlb[s.album]||[]).push(s);
      });
      const botU = bot.botInfo.username;
      let out = "";
      for (const album of Object.keys(byAlb)) {
        out += `<b>Album:</b> ${album}\n`;
        byAlb[album].forEach((s,i) => {
          const p = `play_${encodeURIComponent(s.id)}`;
          const u = `https://t.me/${botU}?start=${p}`;
          out += `${i+1}. <a href="${u}">${s.title}</a>\n`;
        });
        out += `\n`;
      }
      return ctx.reply(out.trim(), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    });

    // ALBUM: fuzzy album search
    bot.command("album", async ctx => {
      const query = (ctx.message?.text || "").split(" ").slice(1).join(" ").toLowerCase().trim();
      if (!query) {
        return ctx.reply("<b>Usage: /album &lt;album name&gt;</b>", { parse_mode: "HTML" });
      }
      const matches = albumNames.filter(a => a.toLowerCase().includes(query));
      const botU    = bot.botInfo.username;
      if (!matches.length) {
        return ctx.reply("<b>No albums matched.</b>", { parse_mode: "HTML" });
      }
      if (matches.length > 1) {
        const lines = matches.map(full => {
          const code = Object.entries(albumCodeMap).find(([c,f]) => f === full)[0];
          const u    = `https://t.me/${botU}?start=album_${code}`;
          return `<a href="${u}">${full}</a>`;
        });
        return ctx.reply(
          "<b>Multiple albums found:</b>\n" + lines.join("\n"),
          { parse_mode: "HTML", disable_web_page_preview: true }
        );
      }
      // exactly one
      const only     = matches[0];
      const codeOnly = Object.entries(albumCodeMap).find(([c,f]) => f === only)[0];
      const tracks   = songs.filter(s => s.album === only);
      const list     = tracks.map((s,i) => {
        const p = `play_${encodeURIComponent(s.id)}`;
        const u = `https://t.me/${botU}?start=${p}`;
        return `${i+1}. <a href="${u}">${s.title} — ${s.artist}</a>`;
      });
      const coverUrl = covers[only];
      if (coverUrl) {
        await ctx.replyWithPhoto(coverUrl, {
          caption: `<b>[${codeOnly}] ${only}</b>\n` + list.join("\n"),
          parse_mode: "HTML",
          disable_web_page_preview: false,
        });
      } else {
        await ctx.reply(
          `<b>[${codeOnly}] ${only}</b>\n` + list.join("\n"),
          { parse_mode: "HTML", disable_web_page_preview: true }
        );
      }
    });

    // PLAY: fuzzy play by id/title
    bot.command("play", async ctx => {
      const raw = (ctx.message?.text || "").split(" ").slice(1).join(" ").toLowerCase().trim();
      if (!raw) {
        return ctx.reply("<b>Usage: /play &lt;id or title&gt;</b>", { parse_mode: "HTML" });
      }
      const matches = songs.filter(s =>
        s.id.toLowerCase().includes(raw) ||
        s.title.toLowerCase().includes(raw)
      );
      if (!matches.length) {
        return ctx.reply("<b>No songs found.</b>", { parse_mode: "HTML" });
      }
      if (matches.length === 1) {
        const t = matches[0];
        return ctx.replyWithAudio(t.file_id, {
          caption: [
            `<b>Song:</b> ${t.title}`,
            `<b>Album:</b> <i>${t.album}</i>`,
            `<b>Artist:</b> <i>${t.artist}</i>`,
          ].join("\n"),
          parse_mode: "HTML",
        });
      }
      const botU = bot.botInfo.username;
      const lines = matches.map((s,i) => {
        const p = `play_${encodeURIComponent(s.id)}`;
        const u = `https://t.me/${botU}?start=${p}`;
        return `${i+1}. <a href="${u}">${s.title}</a> — ${s.album}`;
      });
      return ctx.reply(
        "<b>Multiple songs found:</b>\n" + lines.join("\n"),
        { parse_mode: "HTML", disable_web_page_preview: true }
      );
    });

    // HELP
    bot.command("help", ctx => {
      return ctx.reply(
        "<b>dawn.&#8203;fm [103.5] Commands</b>\n\n" +
        "<code>/start</code> – start dawn.&#8203;fm [103.5]\n" +
        "<code>/search</code> – search for your songs\n" +
        "<code>/list</code> – list all the albums\n" +
        "<code>/category</code> – \n" +
        "<code>/album</code> – search for an album\n" +
        "<code>/help</code> – help for using dawn.&#8203;fm",
        { parse_mode: "HTML" }
      );
    });

    await bot.handleUpdate(update);
    return new Response("ok", { status: 200 });
  },
};
