export const dynamic = "force-dynamic";

const UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";

export async function GET() {
  const response = await fetch(UMAMI_SCRIPT_URL, {
    headers: {
      accept: "application/javascript,text/javascript,*/*",
    },
    next: {
      revalidate: 3600,
    },
  });

  if (!response.ok) {
    return new Response("", { status: 502 });
  }

  return new Response(await response.text(), {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "application/javascript; charset=utf-8",
    },
  });
}
