// A proxy/redeploy response may be HTML or empty. Never leak a browser JSON parser
// error or blindly repeat a write whose outcome may already have committed.
export async function readApiResponse(response: Response, path: string) {
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error(
      path.endsWith("/publish")
        ? "The server response was interrupted. Refresh this shop to check whether it published before trying again."
        : `The server returned an incomplete response${response.status ? ` (HTTP ${response.status})` : ""}. Refresh and try again once the service is ready.`,
    );
  }
  if (!response.ok)
    throw Error(data?.error?.message || "Request did not finish.");
  return data;
}
