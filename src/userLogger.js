// userLogger.js

/**
 * Logs all available fields from Telegram ctx.from safely into KV.
 * 
 * @param {import("grammy").Context} ctx 
 * @param {KVNamespace} userLogKV 
 */
export async function logUserDetails(ctx, userLogKV) {
  try {
    const from = ctx.from;
    if (!from) return;

    const userIdStr = String(from.id);

    // Skip if already logged
    const existing = await userLogKV.get(userIdStr);
    if (existing) return;

    // Extract full user object with safe defaults
    const record = {
      id: from.id ?? null,
      is_bot: from.is_bot === true,
      first_name: from.first_name || "",
      last_name: from.last_name || "",
      username: from.username || "",
      language_code: from.language_code || "",
      is_premium: from.is_premium === true,
      added_to_attachment_menu: from.added_to_attachment_menu === true,
      supports_inline_queries: from.supports_inline_queries === true,
      can_join_groups: from.can_join_groups === true,
      can_read_all_group_messages: from.can_read_all_group_messages === true,
      can_connect_to_business: from.can_connect_to_business === true,
      has_main_web_app: from.has_main_web_app === true,
      started_at: ctx.message?.date
        ? new Date(ctx.message.date * 1000).toISOString()  // FIX for Unix timestamp
        : new Date().toISOString(),
    };

    await userLogKV.put(userIdStr, JSON.stringify(record));

    console.log(`Logged user ${userIdStr}:`, JSON.stringify(record));
  } catch (err) {
    console.error("ERROR in logUserDetails:", err);
  }
}
