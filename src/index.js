import { Bot } from "grammy";
import songs from "./songs.json";
import covers from "./covers.json";

// ——— UTILITY to split a long newline-separated string into sub-messages ———
function splitByLines(text, maxLen = 4000) {
  const lines = text.split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}
// { "After Hours": "https://…/after_hours.jpg", … }
// helper: generate album code from full name
function makeAlbumCode(name) {
  const cleaned = name.replace(/[^\w\s\d]/g, " ");
  const parts = cleaned.trim().split(/\s+/);
  return parts
    .map(token => {
      if (/^[A-Z]{2,}$/.test(token)) return token;
      if (/^\d+$/.test(token)) return token;
      if (token.length > 1 && token.toLowerCase() !== token) return token;
      return token[0].toUpperCase();
    })
    .join("");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove anything that isn’t a letter/number/space/hyphen
    .trim()
    .replace(/[\s-]+/g, "-");     // collapse spaces (or existing hyphens) into single “-”
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
      },
    });

    // 1) grab every distinct album name
    const albumNames = Array.from(new Set(songs.map(s => s.album)));

    // 2) build a unique code→albumName map, collision-proofed
    const albumCodeMap = {};
    for (const full of albumNames) {
      const base = makeAlbumCode(full);
      let code = base;
      let i = 1;
      while (albumCodeMap[code]) {
        code = `${base}${i++}`;
      }
      albumCodeMap[code] = full;
    }

    // -- CATEGORY setup --
    const tagSet = songs.reduce((set, song) => {
      song.category
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length)
        .forEach(t => set.add(t));
      return set;
    }, new Set());

    const categoryNames = Array.from(tagSet);

    // generate a unique code (alphanumeric) for each tag
    const categoryCodeMap = {};
    for (const full of categoryNames) {
      const base = makeAlbumCode(full);
      let code = base, i = 1;
      while (categoryCodeMap[code]) {
        code = `${base}${i++}`;
      }
      categoryCodeMap[code] = full;
    }

    // START: handle "/start" + deep-links
    bot.command("start", async ctx => {
      const incomingId = ctx.message?.message_id;
      const chatId = ctx.chat.id;
      const payload = ctx.startPayload || "";
      const param =
        payload.startsWith("play_") ||
        payload.startsWith("album_") ||
        payload.startsWith("category_")
          ? payload
          : (ctx.message?.text || "").split(" ").slice(1)[0] || "";

      // PLAY deep-link:  t.me/…?start=play_TRACKID
      if (param.startsWith("play_")) {
        const trackId = param.slice(5);
        const track = songs.find(s => s.id === trackId);
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
        await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
        return;
      }
        // PIECE deep-link: t.me/…?start=piece_<URL-ENCODED-PieceName>
// (e.g. “Live At SoFi Stadium” or “Kiss Land”)
    // ─── PIECE deep-link: t.me/…?start=piece_<slug> ──────
    // (e.g. “After Hours (Deluxe)” → slugify → “after-hours-deluxe”)
    if (param.startsWith("piece_")) {
      // 1) Grab the slug (everything after "piece_")
      const slug = param.slice(6); // e.g. "after-hours-deluxe"

      // 2) Find all songs whose album, when slugified, matches our slug
      const tracks = songs.filter((s) => slugify(s.album) === slug);

      if (!tracks.length) {
        // If nothing matches, tell user
        const humanName = slug.replace(/-/g, " ");
        await ctx.reply(`<b>No tracks found for [${humanName}].</b>`, {
          parse_mode: "HTML",
        });
        await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
        return;
      }

      // 3) We have at least one track: pull the “real” album name from the first match
      const humanAlbum = tracks[0].album;           // e.g. "After Hours (Deluxe)"
      const coverUrl = covers[humanAlbum];           // lookup by the real album string
      const headerText = `<b>[${humanAlbum}]</b>`;

      // 4) Send cover + header (if cover exists), else just header
      if (coverUrl) {
        await ctx.replyWithPhoto(coverUrl, {
          caption: headerText,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        });
      } else {
        await ctx.reply(headerText, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }

      // 5) Build & send the track‐list in a second message (chunked if needed)
      const botU = bot.botInfo.username;
      const lines = tracks.map((s, idx) => {
        const payload = `play_${encodeURIComponent(s.id)}`;
        const u = `https://t.me/${botU}?start=${payload}`;
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

      await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
      return;
    }

      // ALBUM deep-link: t.me/…?start=album_CODE
      if (param.startsWith("album_")) {
        const code = param.slice(6);
        const full = albumCodeMap[code];
        if (!full) {
          // Optionally handle not found
        }

        const coverUrl = covers[full];
        const tracks = songs.filter(s => s.album === full);
        const botU = bot.botInfo.username;

        const listLines = tracks.map((s, i) => {
          const p = `play_${encodeURIComponent(s.id)}`;
          const u = `https://t.me/${botU}?start=${p}`;
          return `${i + 1}. <a href="${u}">${s.title} — ${s.artist}</a>`;
        });
        const albumHeader = `<b>[${full}]</b>`;
        const albumText = [albumHeader, ...listLines].join("\n");

if (coverUrl) {
    await ctx.replyWithPhoto(coverUrl, {
      caption: albumHeader,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
  } else {
    await ctx.reply(albumHeader, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  // 2) Split the full track-list into ≤4,000-char chunks
  const chunks = splitByLines(listLines.join("\n"), 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
  return;
}
      // CATEGORY deep-link: t.me/…?start=category_CODE
      if (param.startsWith("category_")) {
        const code = param.slice(9);
        const tagName = categoryCodeMap[code];

        if (!tagName) {
          await ctx.reply("<b>Category not found!</b>", { parse_mode: "HTML" });
          await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
          return;
        }

        // 1) collect unique album names carrying this tag
        const albums = Array.from(
          new Set(
            songs
              .filter(s =>
                s.category.split(",").map(t => t.trim()).includes(tagName)
              )
              .map(s => s.album)
          )
        );

        // 2) if only one album, immediately show its cover & tracklist
// 2) if only one album, immediately show its cover & tracklist
if (albums.length === 1) {
  const albumFull = albums[0];
  const albumCode = Object.entries(albumCodeMap).find(
    ([c, f]) => f === albumFull
  )[0];

  // build the same tracklist you use in /album
  const tracks = songs.filter(s => s.album === albumFull);
  const linesArray = tracks.map((t, idx) => {
    const p = `play_${encodeURIComponent(t.id)}`;
    const u = `https://t.me/${bot.botInfo.username}?start=${p}`;
    return `${idx + 1}. <a href="${u}">${t.title} — ${t.artist}</a>`;
  });
  const listLines = linesArray.join("\n");
  const coverUrl = covers[albumFull];
  const categoryHeader = `<b>[${albumFull}]</b>`;

  // 1) Send cover (if any) with only header as caption
  if (coverUrl) {
    await ctx.replyWithPhoto(coverUrl, {
      caption: categoryHeader,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
  } else {
    await ctx.reply(categoryHeader, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  // 2) Split the track-list into ≤4,000-char chunks
  const chunks = splitByLines(listLines, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
  return;
}

        // 3) otherwise, show a list of albums as deep-links for this category
// 3) otherwise, show a (possibly large) list of albums as deep-links for this category
const botU = bot.botInfo.username;
const lines = albums.map((albumFull, idx) => {
  const albumCode = Object.entries(albumCodeMap).find(
    ([, full]) => full === albumFull
  )[0];
  const link = `https://t.me/${botU}?start=album_${albumCode}`;
  return `${idx + 1}. <a href="${link}">${albumFull}</a>`;
});
const categoryListHeader = `<b>Albums in [${tagName}]:</b>`;

// 1) send header by itself
await ctx.reply(categoryListHeader, {
  parse_mode: "HTML",
  disable_web_page_preview: true,
});

// 2) split the rest into ≤4,000-char chunks
const chunks = splitByLines(lines.join("\n"), 4000);
for (const chunk of chunks) {
  await ctx.reply(chunk, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

await ctx.api.deleteMessage(chatId, incomingId).catch(() => {});
return;
      }

      // default welcome
      await ctx.replyWithPhoto(
        "https://raw.githubusercontent.com/akiratakt/theweekndbot/refs/heads/main/covers/default/def.jpeg",
        {
          caption: [
            "<b><u>Welcome to [103.5]dawn.&#8203;fm!</u></b>",
            "<b><i>You’re about to hear The Weeknd like never before.</i></b>\n",
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
    });

    // SEARCH: song fuzzy
    bot.command("search", async ctx => {
      const parts = (ctx.message?.text || "").split(" ");
      const query = parts.slice(1).join(" ").toLowerCase();
      if (!query) {
        return ctx.reply("<b>Usage: /search &lt;song name&gt;</b>", {
          parse_mode: "HTML",
        });
      }
      const found = songs.filter(
        s =>
          s.id.toLowerCase().includes(query) ||
          s.title.toLowerCase().includes(query)
      );
      if (!found.length) {
        return ctx.reply("<b>No songs matched.</b>", { parse_mode: "HTML" });
      }
      const byAlb = {};
      found.forEach(s => {
        (byAlb[s.album] = byAlb[s.album] || []).push(s);
      });
      const botU = bot.botInfo.username;
      let out = "";
      for (const album of Object.keys(byAlb)) {
        out += `<b>Album:</b> <b>[${album}]</b>\n`;
        byAlb[album].forEach((s, i) => {
          const p = `play_${encodeURIComponent(s.id)}`;
          const u = `https://t.me/${botU}?start=${p}`;
          out += `${i + 1}. <a href="${u}">${s.title}</a>\n`;
        });
        out += "\n";
      }
const textToSend = out.trim();
const chunks = splitByLines(textToSend, 4000);
for (const chunk of chunks) {
  await ctx.reply(chunk, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
return;
    });

    // ALBUM: fuzzy album search
    bot.command("album", async ctx => {
      const query = (ctx.message?.text || "")
        .split(" ")
        .slice(1)
        .join(" ")
        .trim()
        .toLowerCase();
      const botU = bot.botInfo.username;

    // **NO QUERY** → list *all* albums (split if too long)
    if (!query) {
      const lines = Object.entries(albumCodeMap).map(([code, full]) => {
        const u = `https://t.me/${botU}?start=album_${code}`;
        return `<a href="${u}">${full}</a>`;
      });
      const header = "<b>All albums:</b>";
      const fullText = header + "\n" + lines.join("\n");

      // Split into ~4,000-char chunks
      const chunks = splitByLines(fullText, 4000);
      for (const chunk of chunks) {
        await ctx.reply(chunk, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }
      return;
    }

      // **WITH QUERY** → your existing fuzzy search on albums
      const matches = albumNames.filter(a => a.toLowerCase().includes(query));
      if (!matches.length) {
        return ctx.reply("<b>No albums matched.</b>", { parse_mode: "HTML" });
      }
if (matches.length > 1) {
  // 1) Build a Set of unique “pieces”
  const pieceSet = new Set();
  for (const full of matches) {
    full
      .split(",")
      .map(piece => piece.trim())
      .filter(piece => piece.length)
      .forEach(piece => pieceSet.add(piece));
  }

  // 2) For each piece, convert spaces → underscores in the payload
  const lines = [];
  for (const piece of pieceSet) {
    // Replace spaces with underscores so Telegram doesn’t choke on spaces
    const payload = slugify(piece);

    const u = `https://t.me/${botU}?start=piece_${payload}`;
    lines.push(`<a href="${u}">${piece}</a>`);
  }

  // 3) Chunk and send as before
  const header = "<b>Multiple albums found:</b>";
  const fullText = header + "\n" + lines.join("\n");
  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
  return;
}

      // **EXACTLY ONE** → show cover + tracks (same as you already have)
      const only = matches[0];
      //const codeOnly = Object.entries(albumCodeMap).find(([c, f]) => f === only)[0];
      const tracks = songs.filter(s => s.album === only);
      const list = tracks
        .map((s, i) => {
          const p = `play_${encodeURIComponent(s.id)}`;
          const u = `https://t.me/${botU}?start=${p}`;
          return `${i + 1}. <a href="${u}">${s.title} — ${s.artist}</a>`;
        })
        .join("\n");
      const coverUrl = covers[only];
      const headerSingle = `<b>[${only}]</b>`;
      const listLines = list; // this is your "joined" string of track lines

      // 1) Send cover (if any) with only the header as caption
      if (coverUrl) {
        await ctx.replyWithPhoto(coverUrl, {
          caption: headerSingle,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        });
      } else {
        // If no cover, send just the header
        await ctx.reply(headerSingle, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }

// 2) Build the track‐list lines, each line wrapped in <a href> for play_ key
const lines = tracks.map((s, idx) => {
  const p = `play_${encodeURIComponent(s.id)}`; 
  const u = `https://t.me/${botU}?start=${p}`;
  return `${idx + 1}. <a href="${u}">${s.title}</a> — <i>${s.artist}</i>`;
});

// 3) Chunk & send the tracklist
const fullText = lines.join("\n");
const chunks = splitByLines(fullText, 4000);
for (const chunk of chunks) {
  await ctx.reply(chunk, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

return;
    });

    // CATEGORY: list or deep-link by fuzzy match
    bot.command("category", async ctx => {
      const args = (ctx.message?.text || "")
        .split(" ")
        .slice(1)
        .join(" ")
        .trim()
        .toLowerCase();
      const botU = bot.botInfo.username;

      // No args → list all categories
if (!args) {
  const lines = Object.entries(categoryCodeMap).map(
    ([code, full]) =>
      `<a href="https://t.me/${botU}?start=category_${code}">${full}</a>`
  );
  const header = "<b>Available categories:</b>";
  const fullText = header + "\n" + lines.join("\n");

  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
  return;
}

      // Fuzzy-match tags
      const matches = Object.entries(categoryCodeMap).filter(([, full]) =>
        full.toLowerCase().includes(args)
      );

      if (!matches.length) {
        return ctx.reply(
          `<b>No categories matched [${args}].</b>`,
          { parse_mode: "HTML" }
        );
      }

      // Multiple tags matched → show each as a link
if (matches.length > 1) {
  const lines = matches.map(([code, full]) => {
    const u = `https://t.me/${botU}?start=category_${code}`;
    return `<a href="${u}">${full}</a>`;
  });

  const header = "<b>Multiple categories found:</b>";
  const fullText = header + "\n" + lines.join("\n");

  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
  return;
}
      // Exactly one tag matched → list all tracks in all albums for this category
      const [catCode, chosenTag] = matches[0];
      const albums = Array.from(
        new Set(
          songs
            .filter(s =>
              s.category
                .split(",")
                .map(t => t.trim())
                .includes(chosenTag)
            )
            .map(s => s.album)
        )
      );

if (!albums.length) {
  return ctx.reply(`<b>No albums in [${chosenTag}].</b>`, {
    parse_mode: "HTML",
  });
}

let linesArray = []; // accumulate each line in an array
linesArray.push(`<b>Tracks in [${chosenTag}]:</b>`);
albums.forEach(albumFull => {
  linesArray.push(`<b>${albumFull}</b>`);
  const tracks = songs.filter(
    s =>
      s.album === albumFull &&
      s.category.split(",").map(t => t.trim()).includes(chosenTag)
  );
  tracks.forEach((t, idx) => {
    const p = `play_${encodeURIComponent(t.id)}`;
    const u = `https://t.me/${botU}?start=${p}`;
    linesArray.push(`${idx + 1}. <a href="${u}">${t.title} — ${t.artist}</a>`);
  });
  linesArray.push(""); // blank line between albums
});

// Now split the combined lines into ≤4,000-char chunks
const fullText = linesArray.join("\n").trim();
const chunks = splitByLines(fullText, 4000);
for (const chunk of chunks) {
  await ctx.reply(chunk, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
return;
    });

    // PLAY: fuzzy play by id/title
    bot.command("play", async ctx => {
      const raw = (ctx.message?.text || "")
        .split(" ")
        .slice(1)
        .join(" ")
        .toLowerCase()
        .trim();
      if (!raw) {
        // no argument → send a random song
        const randomSong = songs[Math.floor(Math.random() * songs.length)];
        return ctx.replyWithAudio(randomSong.file_id, {
          caption: [
            `<b>Song:</b> ${randomSong.title}`,
            `<b>Album:</b> <i>${randomSong.album}</i>`,
            `<b>Artist:</b> <i>${randomSong.artist}</i>`,
          ].join("\n"),
          parse_mode: "HTML",
        });
      }
      const matches = songs.filter(
        s =>
          s.id.toLowerCase().includes(raw) ||
          s.title.toLowerCase().includes(raw)
      );
      if (!matches.length) {
        return ctx.reply("<b>No songs found.</b>", { parse_mode: "HTML" });
      }
if (matches.length > 1) {
  const botU = bot.botInfo.username;
  const lines = matches.map((s, i) => {
    // build the deep‐link exactly as before:
    const p = `play_${encodeURIComponent(s.id)}`;
    const u = `https://t.me/${botU}?start=${p}`;

    // wrap the *song title* in an <a>…</a> tag
    // so that Telegram draws it as a clickable link:
    return `${i + 1}. <a href="${u}">${s.title}</a> — ${s.album}`;
  });

  // now send everything with parse_mode: "HTML"
  const fullText = "<b>Multiple songs found:</b>\n" + lines.join("\n");
  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true, // it’s safe to keep this on
    });
  }
  return;
}
    });

    // HELP
    bot.command("help", ctx => {
      return ctx.reply(
        [
          "<b>dawn.&#8203;fm [103.5] Commands</b>\n\n" +
        "<b>/start</b> – start dawn.&#8203;fm [103.5]\n" +
        "<b>/search</b> – <code>/search</code> song name\n" +
        "<b>/album</b> – list all the albums\n" +
        "<b>/category</b> – <code>/category</code> category name\n" +
        "<b>/play</b> – play a random song\n" +
        "<b>/help</b> – help for using dawn.&#8203;fm",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    });

    await bot.handleUpdate(update);
    return new Response("ok", { status: 200 });
  },
};