import { Bot } from "grammy";
import songs from "./songs.json";
import covers from "./covers.json";
import categoryMap from "./categoryMap.js";
import { handleStart } from "./handlers/botStart.js";
import { handlePlay } from "./handlers/botPlay.js";
import { handleAlbum } from "./handlers/botAlbum.js";
import { handleCategory } from "./handlers/botCategory.js";
import { handleSearch } from "./handlers/botSearch.js";
import { handleExport } from "./handlers/botExport.js";
import { setupAlbums, setupCategories } from "./setup.js";

export default {
  async fetch(request, env, ctx) {
    // Handle export endpoint
    const exportResponse = await handleExport(request, env);
    if (exportResponse) return exportResponse;

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
      },
    });

        bot.use(async (ctx, next) => {
  if (ctx.chat?.type === "channel") {
    await ctx.reply("DawnFM currently doesn't support channels.");
    return;   // stop here in channels
  }
  await next();  // non‑channels continue normally
});


    const { albumMap, albumNames, albumCodeMap } = setupAlbums(songs);
    const { tagSet, categoryNames, categoryCodeMap } = setupCategories(songs, categoryMap);

    // Register command handlers
    bot.command("start", ctx => handleStart(ctx, bot, songs, covers, albumCodeMap, categoryCodeMap, env));
    bot.command("play", ctx => handlePlay(ctx, bot, songs));
    bot.command("album", ctx => handleAlbum(ctx, bot, songs, covers, albumNames, albumCodeMap));
    bot.command("category", ctx => handleCategory(ctx, bot, songs, categoryCodeMap));
    bot.command("search", ctx => handleSearch(ctx, bot, songs));
    bot.command("help", ctx => {
      return ctx.reply([
        "<b>dawn.&#8203;fm [103.5] Commands</b>\n",
        "<b>/start</b> – start dawn.&#8203;fm [103.5]",
        "<b>/search</b> – <code>/search</code> song name",
        "<b>/album</b> – list all the albums",
        "<b>/category</b> – <code>/category</code> category name",
        "<b>/play</b> – play a random song",
        "<b>/help</b> – help for using dawn.&#8203;fm"
      ].join("\n"), {
        parse_mode: "HTML"
      });
    });

    await bot.handleUpdate(update);
    return new Response("ok", { status: 200 });
  },
};