import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { serializeTodo, type TodoDTO, type ErrorResponse } from "../route";

/* ---------- Shared API types (imported by the client with `import type`) ---------- */

/** PATCH /api/todos/[id] request body (at least one field required) */
export type UpdateTodoBody = {
  title?: string;
  isCompleted?: boolean;
};

// Re-exported so the client can pull the todo type from this route too.
export type { TodoDTO } from "../route";

/* -------------------------------------------------------------------------------- */

async function getUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

// Todo ids are Postgres `uuid` columns; a non-UUID segment makes the driver
// throw (22P02) instead of matching nothing, so reject it as a plain 404.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

// PATCH /api/todos/:id - update title and/or completion for the current user's todo
export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) {
    const body: ErrorResponse = { error: "Unauthorized" };
    return NextResponse.json(body, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    const body: ErrorResponse = { error: "Not found" };
    return NextResponse.json(body, { status: 404 });
  }

  const parsed = (await request.json().catch(() => null)) as {
    title?: unknown;
    isCompleted?: unknown;
  } | null;

  const data: { title?: string; isCompleted?: boolean } = {};
  if (typeof parsed?.title === "string") {
    const title = parsed.title.trim();
    if (!title) {
      const body: ErrorResponse = { error: "title cannot be empty" };
      return NextResponse.json(body, { status: 400 });
    }
    data.title = title;
  }
  if (typeof parsed?.isCompleted === "boolean") {
    data.isCompleted = parsed.isCompleted;
  }
  if (Object.keys(data).length === 0) {
    const body: ErrorResponse = { error: "nothing to update" };
    return NextResponse.json(body, { status: 400 });
  }

  // Scope the write to the owner so one user can't modify another's todo.
  const result = await prisma.todo.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) {
    const body: ErrorResponse = { error: "Not found" };
    return NextResponse.json(body, { status: 404 });
  }

  const todo = await prisma.todo.findUnique({ where: { id } });
  if (!todo) {
    const body: ErrorResponse = { error: "Not found" };
    return NextResponse.json(body, { status: 404 });
  }

  const body: TodoDTO = serializeTodo(todo);
  return NextResponse.json(body);
}

// DELETE /api/todos/:id - delete the current user's todo
export async function DELETE(_request: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) {
    const body: ErrorResponse = { error: "Unauthorized" };
    return NextResponse.json(body, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    const body: ErrorResponse = { error: "Not found" };
    return NextResponse.json(body, { status: 404 });
  }

  const result = await prisma.todo.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    const body: ErrorResponse = { error: "Not found" };
    return NextResponse.json(body, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
