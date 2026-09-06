import { updateBroadcast, deleteBroadcast } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext<T extends string> = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/broadcasts/[id]">) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = await request.json();
    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.message !== undefined) updateData.message = body.message;
    if (body.theme !== undefined) updateData.theme = body.theme;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.btn_text !== undefined) updateData.btn_text = body.btn_text;
    if (body.btn_url !== undefined) updateData.btn_url = body.btn_url;
    if (body.is_active !== undefined) updateData.is_active = body.is_active ? 1 : 0;
    if (body.dismissible !== undefined) updateData.dismissible = body.dismissible ? 1 : 0;

    updateBroadcast(id, updateData);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/broadcasts/[id]">) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  deleteBroadcast(id);
  return NextResponse.json({ success: true });
}
