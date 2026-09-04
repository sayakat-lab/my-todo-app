"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TodoDTO, CreateTodoBody } from "@/app/api/todos/route";
import type { UpdateTodoBody } from "@/app/api/todos/[id]/route";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoDTO[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setError("TODO の取得に失敗しました");
        return;
      }
      setTodos((await res.json()) as TodoDTO[]);
    } catch {
      setError("TODO の取得に失敗しました");
    }
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        setEmail(user.email ?? null);
        await loadTodos();
      } catch {
        setError("読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadTodos]);

  async function addTodo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setError(null);

    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value } satisfies CreateTodoBody),
      });
      if (!res.ok) {
        setError("追加に失敗しました");
        return;
      }
      const created = (await res.json()) as TodoDTO;
      setTodos((prev) => [created, ...prev]);
      setTitle("");
    } catch {
      setError("追加に失敗しました");
    }
  }

  async function toggleTodo(todo: TodoDTO) {
    setError(null);
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCompleted: !todo.isCompleted,
        } satisfies UpdateTodoBody),
      });
      if (!res.ok) {
        setError("更新に失敗しました");
        return;
      }
      const updated = (await res.json()) as TodoDTO;
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setError("更新に失敗しました");
    }
  }

  async function deleteTodo(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("削除に失敗しました");
        return;
      }
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("削除に失敗しました");
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="font-semibold whitespace-nowrap">My TODO App</span>
          <div className="flex min-w-0 items-center gap-3">
            {email && (
              <span className="truncate text-xs text-zinc-400 sm:text-sm">
                {email}
              </span>
            )}
            <button
              onClick={logout}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:p-8">
          <h1 className="mb-4 text-lg font-semibold">TODO 一覧</h1>

          <form onSubmit={addTodo} className="mb-4 flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="新しいタスク"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              追加
            </button>
          </form>

          {error && (
            <p className="mb-4 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-500">読み込み中...</p>
          ) : (
            <ul className="space-y-2">
              {todos.length === 0 && (
                <li className="py-8 text-center text-sm text-zinc-500">
                  タスクはありません
                </li>
              )}
              {todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={todo.isCompleted}
                    onChange={() => toggleTodo(todo)}
                    className="size-4 shrink-0 accent-indigo-500"
                  />
                  <span
                    className={`min-w-0 flex-1 break-words text-sm ${
                      todo.isCompleted
                        ? "text-zinc-500 line-through"
                        : "text-zinc-100"
                    }`}
                  >
                    {todo.title}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="shrink-0 text-xs text-zinc-500 transition-colors hover:text-red-400"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
