/** Accept Microsoft report embeds, including approved public synthetic-data reports. */
export function powerBIReportUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "app.powerbi.com" ||
      !["/reportEmbed", "/view"].includes(url.pathname) ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return null;
    if (url.pathname === "/view") {
      const code = url.searchParams.get("r") || "";
      if (!/^[A-Za-z0-9_+\/-]{20,}={0,2}$/.test(code)) return null;
      // Retain only the public embed code, never arbitrary query parameters.
      const publicUrl = new URL("https://app.powerbi.com/view");
      publicUrl.searchParams.set("r", code);
      return publicUrl.toString();
    }
    if (
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
        url.searchParams.get("reportId") || "",
      )
    )
      return null;
    if (
      [...url.searchParams.keys()].some((key) =>
        /token|secret|password/i.test(key),
      )
    )
      return null;
    url.searchParams.set("autoAuth", "true");
    url.searchParams.set("navContentPaneEnabled", "false");
    return url.toString();
  } catch {
    return null;
  }
}
