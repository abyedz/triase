import { guarded, json } from "@/lib/http";
import { deleteTest, listTests } from "@/lib/repo";

export const DELETE = guarded<{ params: Promise<{ id: string }> }>({ coordinator: true }, async (_r, ctx) => {
  await deleteTest((await ctx.params).id);
  return json({ tests: await listTests() });
});
