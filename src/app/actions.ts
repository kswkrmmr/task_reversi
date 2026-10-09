"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireUserId } from "@/lib/auth/session";
import {
  createTask,
  GameError,
  startNewGame,
  submitMove,
  undoLastMove,
  updateTask,
  validateTaskInput,
  type SubmitMoveInput,
} from "@/lib/game/service";

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
    const input = validateTaskInput(formData.get("title"), formData.get("recurrenceType"));
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
    const input = validateTaskInput(formData.get("title"), formData.get("recurrenceType"));
    await updateTask(userId, taskId, { ...input, active: formData.get("active") === "on" });
  });
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

export async function undoLastMoveAction(_prev: ActionState): Promise<ActionState> {
  const userId = await requireUserId();
  const state = await runAction(() => undoLastMove(userId));
  revalidatePath("/", "layout");
  return state;
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
