import { body, guarded, json } from "@/lib/http";
import { addTest, listTests } from "@/lib/repo";
import { testSchema } from "@/lib/schemas";

export const GET = guarded({}, async () => json({ tests: await listTests() }));
export const POST = guarded({}, async (req) => {
  await addTest(await body(req, testSchema));
  return json({ tests: await listTests() }, 201);
});
