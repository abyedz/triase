import { NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";
import { getSession } from "./auth";
import { Session } from "./triage";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (message: string, status = 400) => json({ message }, status);

type Handler<C> = (req: Request, ctx: C, session: Session) => Promise<Response>;

/** Bungkus handler: wajib login (opsional: wajib koordinator), tangkap error jadi JSON. */
export function guarded<C = unknown>(opts: { coordinator?: boolean }, h: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const s = await getSession();
      if (!s) return fail("Sesi berakhir. Silakan masuk kembali.", 401);
      if (opts.coordinator && s.role !== "Koordinator") return fail("Hanya koordinator yang dapat melakukan ini.", 403);
      return await h(req, ctx, s);
    } catch (e) {
      if (e instanceof ZodError) return fail("Data tidak valid.", 422);
      console.error(e);
      return fail("Terjadi kesalahan server.", 500);
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  return schema.parse(await req.json());
}
