import { describe, expect, it } from "vitest";
import { senderAddress } from "./jobs";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("estimate mail sender", () => {
  it("keeps a full address", () => {
    expect(senderAddress(env({ MAIL_FROM: "krem@yandex.ru", SMTP_URL: "smtps://krem%40yandex.ru:p@smtp.yandex.ru:465" }))).toBe("krem@yandex.ru");
  });

  it("completes a bare Yandex login, which the server rejects with 501 5.1.7", () => {
    expect(senderAddress(env({ MAIL_FROM: "krem", SMTP_URL: "smtps://krem:p@smtp.yandex.ru:465" }))).toBe("krem@yandex.ru");
  });

  it("takes the SMTP login when MAIL_FROM is not an address", () => {
    expect(senderAddress(env({ MAIL_FROM: "Классный ремонт", SMTP_URL: "smtps://info%40krem.moscow:p@smtp.yandex.ru:465" }))).toBe("info@krem.moscow");
  });

  it("strips quotes and spaces", () => {
    expect(senderAddress(env({ MAIL_FROM: ' "info@krem.moscow" ', SMTP_URL: "smtps://x:p@smtp.mail.ru:465" }))).toBe("info@krem.moscow");
  });

  it("gives up on a bare login elsewhere", () => {
    expect(senderAddress(env({ MAIL_FROM: "info", SMTP_URL: "smtps://info:p@smtp.mail.ru:465" }))).toBeNull();
  });
});
