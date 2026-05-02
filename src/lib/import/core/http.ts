export async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "FollowTheScheme/0.1 (+local-dev-import)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}
