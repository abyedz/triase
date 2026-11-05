import { body, guarded, json } from "@/lib/http";
import { setSetting } from "@/lib/repo";
import { settingsSchema } from "@/lib/schemas";

export const PUT = guarded({}, async (req) => {
  const b = await body(req, settingsSchema);
  await setSetting("retri", String(b.retri));
  return json({ retri: b.retri });
});
