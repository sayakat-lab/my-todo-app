"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Todo = {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
};

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    const res = await fetch("/api/todos");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setError("TODO の取得に失敗しました");
      return;
    }
    setTodos((await res.json()) as Todo[]);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email ?? null);
      await loadTodos();
      setLoading(false);
    })();
  }, [router, loadTodos]);

  async function addTodo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setError(null);

    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    if (!res.ok) {
      setError("追加に失敗しました");
      return;
    }
    const created = (await res.json()) as Todo;
    setTodos((prev) => [created, ...prev]);
    setTitle("");
  }

  async function toggleTodo(todo: Todo) {
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !todo.isCompleted }),
    });
    if (!res.ok) {
      setError("更新に失敗しました");
      return;
    }
    const updated = (await res.json()) as Todo;
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function deleteTodo(id: string) {
    const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("削除に失敗しました");
      return;
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-400">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">TODO</h1>
            {email && (
              <p className="mt-0.5 text-xs text-zinc-500">{email}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            ログアウト
          </button>
        </div>

        <form onSubmit={addTodo} className="mb-4 flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="新しいタスク"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            追加
          </button>
        </form>

        {error && (
          <p className="mb-4 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

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
                className="size-4 accent-indigo-500"
              />
              <span
                className={`flex-1 text-sm ${
                  todo.isCompleted
                    ? "text-zinc-500 line-through"
                    : "text-zinc-100"
                }`}
              >
                {todo.title}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-xs text-zinc-500 transition-colors hover:text-red-400"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
