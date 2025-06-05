import { splitByLines } from "../utils.js";

export async function handleSearch(ctx, bot, songs) {
  try {
    const parts = (ctx.message?.text || "").split(" ");
    const query = parts.slice(1).join(" ").toLowerCase();
    
    if (!query) {
      return await ctx.reply("<b>Usage: /search &lt;song name&gt;</b>", {
        parse_mode: "HTML",
      });
    }

    const found = songs.filter(s =>
      s.id.toLowerCase().includes(query) ||
      s.title.toLowerCase().includes(query)
    );

    if (!found.length) {
      return await ctx.reply("<b>No songs matched.</b>", { 
        parse_mode: "HTML" 
      });
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

    const chunks = splitByLines(out.trim(), 4000);
    for (const chunk of chunks) {
      await ctx.reply(chunk, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }
  } catch (error) {
    console.error('Error in search command:', error);
    await ctx.reply("Sorry, something went wrong. Please try again.", {
      parse_mode: "HTML"
    });
  }
}