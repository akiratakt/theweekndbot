import { Bot } from "grammy";
import songs from "./songs.json";

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
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN, {
      botInfo: {
        id: 7537190571,
        is_bot: true,
        first_name: "[103.5]dawn.fm",
        username: "dawnfm103_5Bot",
      }
    });

    // build albumName list + code map
    const albumNames  = Array.from(new Set(songs.map(s => s.album)));
    const albumCodeMap = {};
    albumNames.forEach(a => {
      albumCodeMap[makeAlbumCode(a)] = a;
    });

    // START: handle deep-links
    bot.command("start", async ctx => {
      const incomingId = ctx.message?.message_id;
      const chatId     = ctx.chat.id;
      const payload    = ctx.startPayload;
      const param      = payload != null
                        ? payload
                        : (ctx.message?.text || "").split(" ").slice(1)[0] || "";

      // PLAY deep-link
      if (param.startsWith("play_")) {
        const id    = param.slice(5);
        const track = songs.find(s => s.id === id);
        if (!track) {
          await ctx.reply("<b>Track not found!</b>", { parse_mode: "HTML" });
        } else {
          await ctx.replyWithAudio(track.file_id, {
            caption: [
              `<b>Song: ${track.title}</b>`,
              `<b>Album: <i>${track.album}</i></b>`,
              `<b>Artist: <i>${track.artist}</i></b>`
            ].join("\n"),
            parse_mode: "HTML"
          });
        }
        await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
        return;
      }

      // ALBUM deep-link
      if (param.startsWith("album_")) {
        const code = param.slice(6);
        const full = albumCodeMap[code];
        if (!full) {
          await ctx.reply("<b>Album not found!</b>", { parse_mode: "HTML" });
          await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
          return;
        }
        const matches     = songs.filter(s => s.album === full);
        const botUsername = bot.botInfo.username;
        const trackLines  = matches.map((s, i) => {
          const p = `play_${encodeURIComponent(s.id)}`;
          const u = `https://t.me/${botUsername}?start=${p}`;
          return `${i+1}. <b><a href="${u}">${s.title} — ${s.artist}</a></b>`;
        }).join("\n");
        await ctx.reply(`<b>${full}</b>\n${trackLines}`, {
          parse_mode: "HTML",
          disable_web_page_preview: true
        });
        await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
        return;
      }

      // Default
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
        { parse_mode: "HTML" }
      );
      await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
    });

    // LIST: all albums
    bot.command("list", ctx => {
      if (!albumNames.length) {
        return ctx.reply("<b>No albums available.</b>", { parse_mode: "HTML" });
      }
      const botUsername = bot.botInfo.username;
      const lines = albumNames.map(full => {
        const code = makeAlbumCode(full);
        const u    = `https://t.me/${botUsername}?start=album_${code}`;
        return `<b>Album – <a href="${u}">${full}</a></b>`;
      }).join("\n");
      return ctx.reply(lines, {
        parse_mode: "HTML",
        disable_web_page_preview: true
      });
    });

    // SEARCH: song-only fuzzy search, always list tracks by album
    bot.command("search", async ctx => {
      const raw   = ctx.message?.text || "";
      const query = raw.split(" ").slice(1).join(" ").toLowerCase();
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
      // group by album
      const byAlb = {};
      found.forEach(s => {
        (byAlb[s.album] = byAlb[s.album]||[]).push(s);
      });
      const botUsername = bot.botInfo.username;
      let result = "";
      Object.keys(byAlb).forEach(album => {
        result += `<b>Album: ${album}</b>\n`;
        byAlb[album].forEach((s, i) => {
          const p = `play_${encodeURIComponent(s.id)}`;
          const u = `https://t.me/${botUsername}?start=${p}`;
          result += `${i+1}. <b><a href="${u}">${s.title}</a></b>\n`;
        });
        result += "\n";
      });
      return ctx.reply(result.trim(), {
        parse_mode: "HTML",
        disable_web_page_preview: true
      });
    });

    // ALBUM: fuzzy album search with album-only command
    bot.command("album", ctx => {
      const query = (ctx.message?.text || "").split(" ").slice(1).join(" ").toLowerCase().trim();
      if (!query) {
        return ctx.reply("<b>Usage: /album &lt;album name&gt;</b>", { parse_mode: "HTML" });
      }
      // find all album names containing the query
      const matchesAlb = albumNames.filter(a => a.toLowerCase().includes(query));
      const botUsername = bot.botInfo.username;

      if (!matchesAlb.length) {
        return ctx.reply("<b>No albums matched.</b>", { parse_mode: "HTML" });
      }
      // multiple matches → list album links only
      if (matchesAlb.length > 1) {
        const lines = matchesAlb.map(full => {
          const code = makeAlbumCode(full);
          const u    = `https://t.me/${botUsername}?start=album_${code}`;
          return `<b>Album: <a href="${u}">${full}</a></b>`;
        }).join("\n");
        return ctx.reply(lines, {
          parse_mode: "HTML",
          disable_web_page_preview: true
        });
      }
      // exactly one → show tracklist
      const only = matchesAlb[0];
      const tracks = songs.filter(s => s.album === only);
      let resp = `<b>Album: ${only}</b>\n`;
      tracks.forEach((s, i) => {
        const p = `play_${encodeURIComponent(s.id)}`;
        const u = `https://t.me/${botUsername}?start=${p}`;
        resp += `${i+1}. <b><a href="${u}">${s.title} — ${s.artist}</a></b>\n`;
      });
      return ctx.reply(resp.trim(), {
        parse_mode: "HTML",
        disable_web_page_preview: true
      });
    });

// PLAY: fuzzy by id/title
bot.command("play", async ctx => {
	const raw = (ctx.message?.text || "").split(" ").slice(1).join(" ").toLowerCase().trim();
	if (!raw) {
	  return ctx.reply("<b>Usage: /play &lt;id or title&gt;</b>", { parse_mode: "HTML" });
	}
  
	// find all songs whose id or title includes the query
	const matches = songs.filter(s =>
	  s.id.toLowerCase().includes(raw) ||
	  s.title.toLowerCase().includes(raw)
	);
  
	// no match
	if (matches.length === 0) {
	  return ctx.reply("<b>No songs found.</b>", { parse_mode: "HTML" });
	}
  
	// exactly one match → send it
	if (matches.length === 1) {
	  const track = matches[0];
	  return ctx.replyWithAudio(track.file_id, {
		caption: [
		  `<b>Song: ${track.title}</b>`,
		  `<b>Album: <i>${track.album}</i></b>`,
		  `<b>Artist: <i>${track.artist}</i></b>`
		].join("\n"),
		parse_mode: "HTML"
	  });
	}
  
	// multiple matches → list them with deep-links
	const botUsername = bot.botInfo.username;
	const lines = matches.map((s, i) => {
	  const payload = `play_${encodeURIComponent(s.id)}`;
	  const url     = `https://t.me/${botUsername}?start=${payload}`;
	  return `${i+1}. <b><a href="${url}">${s.title}</a></b> — ${s.album}`;
	}).join("\n");
  
	return ctx.reply(
	  `<b>Multiple songs found:</b>\n${lines}`,
	  { parse_mode: "HTML", disable_web_page_preview: true }
	);
  });
  
    // HELP: minimalist command guide
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
