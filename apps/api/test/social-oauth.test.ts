import { describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file:./data/test-social-oauth.db";

describe("hubungkan TikTok", () => {
  it("tautan izin, tukar kode dari alamat yang ditempel, token tersimpan dan tidak bocor", async () => {
    const { migrateDb } = await import("../src/db/migrate.js");
    await migrateDb();
    const { AuditService } = await import(
      "../src/modules/audit/audit.service.js"
    );
    const { EventBusService } = await import(
      "../src/modules/events/event-bus.service.js"
    );
    const { SocialService } = await import(
      "../src/modules/social/social.service.js"
    );
    const { parseRedirect } = await import("../src/modules/social/oauth.js");
    const social = new SocialService(new EventBusService(), new AuditService());
    await social.removeAccount("tiktok-tes");

    expect(
      parseRedirect("https://contoh.id/cb?code=a%2Ab&state=s1#_").get("code"),
    ).toBe("a*b");
    expect(parseRedirect("?code=x&state=y").get("state")).toBe("y");

    const base = {
      clientKey: "kunci-tes",
      clientSecret: "rahasia-tes-12345",
      redirectUri: "https://contoh.id/callback",
      id: "tiktok-tes",
      label: "TikTok tes",
    };
    await expect(
      social.tiktokConnectStart({ ...base, redirectUri: "bukan-url" }),
    ).rejects.toThrow(/Redirect URI/);
    const { url, state } = await social.tiktokConnectStart(base);
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(
      "https://www.tiktok.com/v2/auth/authorize/",
    );
    expect(u.searchParams.get("client_key")).toBe("kunci-tes");
    expect(u.searchParams.get("scope")).toContain("video.upload");
    expect(u.searchParams.get("state")).toBe(state);
    expect(url).not.toContain("rahasia-tes");

    const sent: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      return new Response(
        JSON.stringify({
          access_token: "act.tes",
          refresh_token: "rft.tes",
          scope: "user.info.basic,video.upload",
        }),
        { status: 200 },
      );
    });
    await expect(
      social.tiktokConnectFinish({
        redirected: "https://contoh.id/callback?state=lain&code=abc",
      }),
    ).rejects.toThrow(/Sesi hubungkan/);
    await expect(
      social.tiktokConnectFinish({
        redirected: `https://contoh.id/callback?error=access_denied&state=${state}`,
      }),
    ).rejects.toThrow(/menolak izin/);
    const done = await social.tiktokConnectFinish({
      redirected: `https://contoh.id/callback?code=kode1&state=${state}`,
    });
    expect(done).toMatchObject({ ok: true, id: "tiktok-tes" });
    expect(sent[0]).toContain("grant_type=authorization_code");
    expect(sent[0]).toContain("code=kode1");
    // kode sekali pakai: sesi sudah habis
    await expect(
      social.tiktokConnectFinish({
        redirected: `https://contoh.id/callback?code=kode1&state=${state}`,
      }),
    ).rejects.toThrow(/Sesi hubungkan/);

    const [acc] = (await social.listAccounts()).filter(
      (a) => a.id === "tiktok-tes",
    );
    expect(acc.filled).toEqual(
      expect.arrayContaining([
        "accessToken",
        "refreshToken",
        "clientKey",
        "clientSecret",
        "mode",
      ]),
    );
    expect(JSON.stringify(acc)).not.toMatch(/act\.tes|rft\.tes|rahasia-tes/);
    vi.unstubAllGlobals();
    await social.removeAccount("tiktok-tes");
  });
});
