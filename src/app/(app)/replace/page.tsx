import { redirect } from "next/navigation";
import { ReplaceFlow } from "@/components/ReplaceFlow";
import { requireUserId } from "@/lib/auth/session";
import { getCurrentGame } from "@/lib/game/service";

export default async function ReplacePage() {
  const userId = await requireUserId();
  const game = await getCurrentGame(userId);
  if (!game || !game.canReplaceLastMove || !game.lastMove) redirect("/board");

  return <ReplaceFlow moves={game.moves} taskTitle={game.lastMove.taskTitle} />;
}
