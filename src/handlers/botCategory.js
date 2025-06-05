import { splitByLines } from "../utils.js";

export async function handleCategory(ctx, bot, songs, categoryCodeMap) {
  try {
    const args = (ctx.message?.text || "")
      .split(" ")
      .slice(1)
      .join(" ")
      .trim()
      .toLowerCase();

    const botU = bot.botInfo.username;

    if (!args) {
      return await handleAllCategories(ctx, bot, categoryCodeMap);
    }

    const matches = Object.entries(categoryCodeMap)
      .filter(([, full]) => full.toLowerCase().includes(args));

    if (!matches.length) {
      return await ctx.reply(`<b>No categories matched [${args}].</b>`, { parse_mode: "HTML" });
    }

    if (matches.length > 1) {
      return await handleMultipleCategories(ctx, bot, matches);
    }

    return await handleSingleCategory(ctx, bot, matches[0], songs);
  } catch (error) {
    console.error('Error in category command:', error);
    await ctx.reply("Sorry, something went wrong. Please try again.", {
      parse_mode: "HTML"
    });
  }
}

export async function handleAllCategories(ctx, bot, categoryCodeMap) {
  const botU = bot.botInfo.username;
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
}

export async function handleMultipleCategories(ctx, bot, matches) {
  const botU = bot.botInfo.username;
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
}

export async function handleSingleCategory(ctx, bot, [catCode, chosenTag], songs) {
  const botU = bot.botInfo.username;
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
    return await ctx.reply(`<b>No albums in [${chosenTag}].</b>`, {
      parse_mode: "HTML",
    });
  }

  let linesArray = [];
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

  const fullText = linesArray.join("\n").trim();
  const chunks = splitByLines(fullText, 4000);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}