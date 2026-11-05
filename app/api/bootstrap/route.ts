import { getSession } from "@/lib/auth";
import { json } from "@/lib/http";
import { getRetri, listReports, listTests, listVictims } from "@/lib/repo";

export async function GET() {
  try {
    const me = await getSession();
    if (!me) return json({ me: null });
    const [victims, reports, tests, retri] = await Promise.all([listVictims(), listReports(), listTests(), getRetri()]);
    return json({ me, victims, reports, tests, retri });
  } catch (e) {
    console.error(e);
    return json({ message: "Database tidak dapat dijangkau." }, 500);
  }
}
