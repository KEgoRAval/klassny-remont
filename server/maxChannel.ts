import fs from "node:fs";
import path from "node:path";

/**
 * Channels the MAX bot was made an admin of. The user who added the bot becomes the one
 * person allowed to publish through it: they send the bot a message whose text starts
 * with /post (or /postpin), with photos or a video, and the bot publishes it to the
 * channel with a "Рассчитать ремонт" button under it.
 *
 * Stored next to the lead journal so it survives releases.
 */

export type ChannelRecord = { chatId: number; ownerUserId: number; title?: string; addedAt: string };

export class ChannelStore {
  constructor(private file: string) {}

  list(): ChannelRecord[] {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, "utf8")) as ChannelRecord[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  add(record: ChannelRecord) {
    const rest = this.list().filter(item => item.chatId !== record.chatId);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...rest, record], null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  remove(chatId: number) {
    const rest = this.list().filter(item => item.chatId !== chatId);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(rest, null, 2), { mode: 0o600 });
  }

  ownedBy(userId: number): ChannelRecord[] {
    return this.list().filter(item => item.ownerUserId === userId);
  }
}

export type PostCommand = { pin: boolean; text: string };

/** "/post текст" or "/postpin текст" (the text may be empty when the post is only media). */
export function parsePostCommand(text: string | null | undefined): PostCommand | null {
  const match = text?.match(/^\/(postpin|post)(?:@\S+)?(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return { pin: match[1].toLowerCase() === "postpin", text: (match[2] ?? "").trim() };
}

type Media = { type?: string; payload?: { token?: string } };

/** Photos and videos of the owner's message, as attachments the bot may send again by token. */
export function reusableMedia(attachments: Media[] | null | undefined): { type: "image" | "video"; payload: { token: string } }[] {
  return (attachments ?? [])
    .filter((item): item is { type: "image" | "video"; payload: { token: string } } =>
      (item.type === "image" || item.type === "video") && typeof item.payload?.token === "string" && item.payload.token.length > 0)
    .map(item => ({ type: item.type, payload: { token: item.payload.token } }));
}

export const POST_HELP = [
  "Я администратор канала ✅",
  "",
  "Чтобы опубликовать пост с кнопкой «Рассчитать ремонт», пришлите мне сюда сообщение: фото или видео и подпись, которая начинается с /post",
  "Например: «/post Готовая кухня-гостиная в ЖК Very, 112 м²».",
  "",
  "/postpin — то же самое, и пост закрепится в канале.",
].join("\n");
