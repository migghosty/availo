/**
 * The push transport's failure behaviour.
 *
 * Same safety property as `sms.test.ts` and `telegram.test.ts`, and the same
 * reason: a booking that has committed is a real appointment, so nothing here
 * may throw into the caller. Every case below is a way the outside world can
 * break — no VAPID keys, an expired subscription, a rejected send, an
 * unreachable database — and in all of them `sendPushToAll` must return a count
 * and stay quiet.
 *
 * The one behaviour unique to this transport is **pruning**: a subscription the
 * push service reports as gone has to be deleted, or every future send retries
 * a dead endpoint forever. Just as important is what must *not* be pruned — a
 * 429 or a 500 is transient, and deleting on those would turn notifications off
 * permanently with the admin's only clue being their absence.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();

vi.mock("web-push", () => {
  class WebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number
    ) {
      super(message);
    }
  }

  return {
    WebPushError,
    default: { sendNotification },
    sendNotification,
  };
});

const findMany = vi.fn();
const deleteOne = vi.fn();
const update = vi.fn();

vi.mock("./db", () => ({
  db: {
    pushSubscription: {
      findMany: () => findMany(),
      delete: (args: unknown) => deleteOne(args),
      update: (args: unknown) => update(args),
    },
  },
}));

const { WebPushError } = await import("web-push");
const { isWebPushConfigured, getVapidPublicKey, sendPushToAll } = await import("./webPush");

const CONFIG = {
  VAPID_PUBLIC_KEY: "test-public-key",
  VAPID_PRIVATE_KEY: "test-private-key",
  VAPID_SUBJECT: "mailto:admin@example.com",
};

const SUBSCRIPTION = {
  id: 1,
  endpoint: "https://web.push.apple.com/abc",
  p256dh: "key",
  auth: "secret",
  userAgent: "iPhone",
  createdAt: new Date(),
  lastSuccessAt: null,
};

const PAYLOAD = { title: "New booking", body: "Ada Lovelace" };

function configure(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  // Quiet: these paths log deliberately, and the logs aren't what's under test.
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  findMany.mockResolvedValue([SUBSCRIPTION]);
  deleteOne.mockResolvedValue({});
  update.mockResolvedValue({});
  sendNotification.mockResolvedValue({ statusCode: 201 });
});

afterEach(() => {
  configure({
    VAPID_PUBLIC_KEY: undefined,
    VAPID_PRIVATE_KEY: undefined,
    VAPID_SUBJECT: undefined,
  });
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("when unconfigured", () => {
  it("reports itself as not configured and offers no public key", () => {
    expect(isWebPushConfigured()).toBe(false);
    expect(getVapidPublicKey()).toBeNull();
  });

  it("makes no request and does not even read the subscriptions", async () => {
    // What lets local dev and the whole test suite run with no credentials.
    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 0, pruned: 0 });
    expect(findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("treats a partial configuration as unconfigured", async () => {
    // A public key with no private key would fail on every booking; behaving
    // as if nothing were set is the quieter failure.
    configure({ ...CONFIG, VAPID_PRIVATE_KEY: undefined });

    expect(isWebPushConfigured()).toBe(false);
    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 0, pruned: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("when configured", () => {
  beforeEach(() => configure(CONFIG));

  it("exposes the public key for the browser to subscribe with", () => {
    expect(isWebPushConfigured()).toBe(true);
    expect(getVapidPublicKey()).toBe("test-public-key");
  });

  it("sends the payload as JSON the service worker can parse", async () => {
    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 1, failed: 0, pruned: 0 });

    const [subscription, body] = sendNotification.mock.calls[0];
    expect(subscription).toEqual({
      endpoint: SUBSCRIPTION.endpoint,
      keys: { p256dh: "key", auth: "secret" },
    });
    expect(JSON.parse(body)).toEqual(PAYLOAD);
  });

  it("makes no request when nobody has subscribed", async () => {
    findMany.mockResolvedValue([]);

    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 0, pruned: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("reaches every subscribed device independently of the others", async () => {
    // The admin's phone and laptop are separate subscriptions; one failing
    // must not cost the other its notification.
    findMany.mockResolvedValue([SUBSCRIPTION, { ...SUBSCRIPTION, id: 2 }]);
    sendNotification
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ statusCode: 201 });

    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 1, failed: 1, pruned: 0 });
  });

  it("never throws when the database is unreachable", async () => {
    findMany.mockRejectedValue(new Error("connection refused"));

    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 0, pruned: 0 });
  });

  it("never throws when the push service rejects the send", async () => {
    sendNotification.mockRejectedValue(new WebPushError("bad request", 400));

    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 1, pruned: 0 });
  });

  for (const statusCode of [404, 410]) {
    it(`prunes a subscription the push service reports gone (${statusCode})`, async () => {
      // The home-screen app was deleted or the phone restored. Nothing else
      // will ever tell us, so this is the only cleanup there is.
      sendNotification.mockRejectedValue(new WebPushError("gone", statusCode));

      expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 0, pruned: 1 });
      expect(deleteOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  }

  for (const statusCode of [429, 500, 503]) {
    it(`keeps the subscription after a transient failure (${statusCode})`, async () => {
      // Pruning here would silently end notifications for good.
      sendNotification.mockRejectedValue(new WebPushError("later", statusCode));

      expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 1, pruned: 0 });
      expect(deleteOne).not.toHaveBeenCalled();
    });
  }

  it("keeps the subscription after a plain network error", async () => {
    sendNotification.mockRejectedValue(new Error("ETIMEDOUT"));

    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 0, failed: 1, pruned: 0 });
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("still reports a delivered push when the bookkeeping write fails", async () => {
    // `lastSuccessAt` is a convenience; it must not be able to turn a
    // notification the admin already received into a reported failure.
    update.mockRejectedValue(new Error("write conflict"));

    expect(await sendPushToAll(PAYLOAD)).toEqual({ sent: 1, failed: 0, pruned: 0 });
  });
});
