"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireUserId } from "@/lib/auth/session";
import {
  createTask,
  deleteTask,
  GameError,
  replaceLastMove,
  startNewGame,
  submitMove,
  updateTask,
  validateTaskInput,
  type SubmitMoveInput,
} from "@/lib/game/service";
import type { Position } from "@/lib/reversi/board";

export type ActionState = { error: string | null };

// GameError は利用者向けのメッセージとして返し、それ以外の例外はそのまま投げる。
async function runAction(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
    return { error: null };
  } catch (err) {
    if (err instanceof GameError) return { error: err.message };
    throw err;
  }
}

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const state = await runAction(async () => {
    const input = validateTaskInput(
      formData.get("title"),
      formData.get("recurrenceType"),
      formData.get("dueAt"),
    );
    await createTask(userId, input);
  });
  if (state.error) return state;
  revalidatePath("/");
  redirect("/");
}

export async function updateTaskAction(
  taskId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const state = await runAction(async () => {
    const input = validateTaskInput(
      formData.get("title"),
      formData.get("recurrenceType"),
      formData.get("dueAt"),
    );
    // フォームは「一時停止中」のチェックなので、DB の active はその反対。
    await updateTask(userId, taskId, { ...input, active: formData.get("paused") !== "on" });
  });
  if (state.error) return state;
  revalidatePath("/");
  redirect("/");
}

export async function deleteTaskAction(taskId: string, _prev: ActionState): Promise<ActionState> {
  const userId = await requireUserId();
  const state = await runAction(() => deleteTask(userId, taskId));
  if (state.error) return state;
  revalidatePath("/");
  redirect("/");
}

export async function submitMoveAction(input: SubmitMoveInput): Promise<ActionState> {
  const userId = await requireUserId();
  let outcome: { gameId: string; finished: boolean } | undefined;
  const state = await runAction(async () => {
    outcome = await submitMove(userId, {
      taskId: String(input.taskId),
      result: input.result,
      row: Number(input.row),
      col: Number(input.col),
    });
  });
  if (state.error || !outcome) return state;
  revalidatePath("/", "layout");
  redirect(outcome.finished ? `/games/${outcome.gameId}` : "/");
}

export async function replaceLastMoveAction(pos: Position): Promise<ActionState> {
  const userId = await requireUserId();
  const state = await runAction(() =>
    replaceLastMove(userId, { row: Number(pos.row), col: Number(pos.col) }),
  );
  if (state.error) return state;
  revalidatePath("/", "layout");
  redirect("/");
}

export async function startNewGameAction(): Promise<void> {
  const userId = await requireUserId();
  await startNewGame(userId);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
