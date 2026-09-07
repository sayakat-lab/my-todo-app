import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/* ---------- Shared API types (imported by the client with `import type`) ---------- */

/** A todo as returned over the wire (JSON: dates are ISO strings, no user_id). */
export type TodoDTO = {
  id: string;
  title: string;
  isCompleted: boolean;
  /** Due date as `YYYY-MM-DD`, or `null` if unset. */
  dueDate: string | null;
  createdAt: string;
};

/** GET /api/todos response body */
export type TodoListResponse = TodoDTO[];

/** POST /api/todos request body */
export type CreateTodoBody = {
  title: string;
  /** `YYYY-MM-DD`, or omitted/null for no due date. */
  dueDate?: string | null;
};

/** Error response body for every endpoint under /api/todos */
export type ErrorResponse = {
  error: string;
};

/** Date-only string matcher for `dueDate` fields (`YYYY-MM-DD`). */
export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a raw `dueDate` request value. `undefined`/`null`/`""` all mean
 * "no due date"; anything else must match `DATE_ONLY_RE`. Shared by the
 * POST (create) and PATCH (`[id]/route.ts`, update) handlers.
 */
export function parseDueDate(
  raw: unknown,
): { ok: true; value: Date | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw === "string" && DATE_ONLY_RE.test(raw)) {
    return { ok: true, value: new Date(`${raw}T00:00:00.000Z`) };
  }
  return { ok: false };
}

/** Maps a Prisma `todo` row to the wire shape. Also used by `[id]/route.ts`. */
export function serializeTodo(row: {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: Date | null;
  createdAt: Date;
}): TodoDTO {
  return {
    id: row.id,
    title: row.title,
    isCompleted: row.isCompleted,
    // `dueDate` is a `@db.Date` column (UTC midnight), so slicing the ISO
    // string yields the intended calendar date regardless of server TZ.
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/* -------------------------------------------------------------------------------- */

// Returns the signed-in user's id, or null if there is no valid session.
async function getUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

// GET /api/todos - list the current user's todos
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    const body: ErrorResponse = { error: "Unauthorized" };
    return NextResponse.json(body, { status: 401 });
  }

  const todos = await prisma.todo.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const body: TodoListResponse = todos.map(serializeTodo);
  return NextResponse.json(body);
}

// POST /api/todos - create a todo for the current user
export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    const body: ErrorResponse = { error: "Unauthorized" };
    return NextResponse.json(body, { status: 401 });
  }

  const parsed = (await request.json().catch(() => null)) as {
    title?: unknown;
    dueDate?: unknown;
  } | null;
  const title = typeof parsed?.title === "string" ? parsed.title.trim() : "";
  if (!title) {
    const body: ErrorResponse = { error: "title is required" };
    return NextResponse.json(body, { status: 400 });
  }

  const dueDateResult = parseDueDate(parsed?.dueDate);
  if (!dueDateResult.ok) {
    const body: ErrorResponse = { error: "dueDate must be YYYY-MM-DD" };
    return NextResponse.json(body, { status: 400 });
  }

  const todo = await prisma.todo.create({
    data: { userId, title, dueDate: dueDateResult.value },
  });

  const body: TodoDTO = serializeTodo(todo);
  return NextResponse.json(body, { status: 201 });
}
