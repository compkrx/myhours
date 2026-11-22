import { str, titleOf, type LifeRecord } from "../domain/model";
interface TokenResponse {
  access_token?: string;
  error?: string;
}
interface GoogleAuth {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback: (e: { type: string }) => void;
      }) => { requestAccessToken: (o: { prompt: string }) => void };
      revoke: (token: string) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleAuth;
  }
}
let loading: Promise<void> | undefined;
export const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
export function loadGoogle() {
  return (loading ??= new Promise<void>((resolve, reject) => {
    if (window.google) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      reject(
        new Error(
          "Google authorization could not load. Check your connection.",
        ),
      );
    };
    document.head.appendChild(script);
  }));
}
export async function googleToken(scope: string) {
  if (!googleConfigured)
    throw new Error(
      "Google OAuth is not configured. Add a public web client ID and register this exact origin.",
    );
  await loadGoogle();
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope,
      callback: (r) =>
        r.access_token
          ? resolve(r.access_token)
          : reject(new Error(r.error || "Google authorization failed.")),
      error_callback: (e) => reject(new Error(`Google sign-in ${e.type}.`)),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}
async function googleFetch(
  token: string,
  url: string,
  options: RequestInit = {},
) {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Google authorization expired. Connect again."
        : `Google request failed (${response.status}). No success is recorded.`,
    );
  return response.json();
}
export async function listDriveFolders(
  token: string,
): Promise<{ id: string; name: string }[]> {
  const data = await googleFetch(
    token,
    "https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id,name)&pageSize=100",
  );
  return data.files;
}
export async function createDriveFolder(
  token: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return googleFetch(
    token,
    "https://www.googleapis.com/drive/v3/files?fields=id,name",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
      }),
    },
  );
}
export async function uploadSnapshot(
  token: string,
  folderId: string,
  name: string,
  content: string,
  mime: string,
) {
  const boundary = `life${crypto.randomUUID()}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--`;
  return googleFetch(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
}
export async function readCalendar(
  token: string,
): Promise<Record<string, string | number | boolean>[]> {
  const now = new Date();
  let pageToken = "";
  const entries: Record<string, string | number | boolean>[] = [];
  do {
    const query = new URLSearchParams({
      singleEvents: "true",
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 30 * 86400000).toISOString(),
      maxResults: "250",
      orderBy: "startTime",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const data = await googleFetch(
      token,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`,
    );
    for (const event of data.items ?? []) {
      if (event.status === "cancelled") continue;
      const start = event.start?.dateTime || `${event.start?.date}T00:00:00Z`;
      const end = event.end?.dateTime || `${event.end?.date}T00:00:00Z`;
      entries.push({
        title: event.summary || "Untitled Google event",
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        timezone: event.start?.timeZone || "UTC",
        source: "google",
        externalId: `google:${event.id}`,
        recurrence: "none",
        busy: event.transparency !== "transparent",
        buffer: 0,
        notes: event.start?.date
          ? "All-day Google event imported at UTC date boundaries. Review in your local timezone."
          : "",
      });
    }
    pageToken = data.nextPageToken ?? "";
    if (entries.length > 1000)
      throw new Error(
        "Calendar import exceeds 1,000 events. Use a smaller calendar.",
      );
  } while (pageToken);
  return entries;
}
export async function writeCalendarEvent(token: string, record: LifeRecord) {
  const repeat = str(record, "recurrence");
  const recurrence =
    repeat === "none"
      ? undefined
      : [
          `RRULE:${repeat === "weekdays" ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" : repeat === "weekly" ? "FREQ=WEEKLY" : "FREQ=DAILY"}`,
        ];
  return googleFetch(
    token,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: titleOf(record),
        start: {
          dateTime: str(record, "start"),
          timeZone: str(record, "timezone"),
        },
        end: {
          dateTime: str(record, "end"),
          timeZone: str(record, "timezone"),
        },
        recurrence,
        transparency: record.data.busy ? "opaque" : "transparent",
        extendedProperties: { private: { projectLifeId: record.id } },
      }),
    },
  );
}
