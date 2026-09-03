import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

type Params = { params: Promise<{ id: string }> };

// PATCH /api/todos/:id - update title and/or completion for the current user's todo
export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    isCompleted?: unknown;
  } | null;

  const data: { title?: string; isCompleted?: boolean } = {};
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }
    data.title = title;
  }
  if (typeof body?.isCompleted === "boolean") {
    data.isCompleted = body.isCompleted;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // Scope the write to the owner so one user can't modify another's todo.
  const result = await prisma.todo.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const todo = await prisma.todo.findUnique({ where: { id } });
  return NextResponse.json(todo);
}

// DELETE /api/todos/:id - delete the current user's todo
export async function DELETE(_request: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.todo.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
