/**
 * XMP sidecar file generator for CamTune shoot sessions.
 *
 * Produces XMP metadata using a custom CamTune namespace alongside
 * standard EXIF and XMP namespaces so files can be read by Lightroom.
 */

export interface XmpSessionData {
  sessionId: string;
  iso?: number | string;
  aperture?: number | string;
  shutterSpeed?: string;
  whiteBalance?: string;
  aiConfidence?: number;
  locationName?: string;
  modifyDate?: Date;
  /** Any additional key-value pairs to include under the camtune: namespace */
  extras?: Record<string, string | number>;
}

/**
 * Escapes a value for inclusion in an XML attribute or text node.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formats a Date as an ISO 8601 string without milliseconds (XMP convention).
 */
function xmpDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

/**
 * Generates a complete XMP sidecar XML string from session data.
 *
 * @param data  Session data to embed in the XMP packet
 * @returns     A valid XMP packet string ready to write to a .xmp file
 */
export function generateXmp(data: XmpSessionData): string {
  const modifyDate = data.modifyDate ?? new Date();
  const lines: string[] = [];

  // Build the optional fields
  if (data.iso !== undefined) {
    lines.push(`      <camtune:ISO>${escapeXml(String(data.iso))}</camtune:ISO>`);
  }
  if (data.aperture !== undefined) {
    lines.push(
      `      <camtune:Aperture>${escapeXml(String(data.aperture))}</camtune:Aperture>`
    );
  }
  if (data.shutterSpeed !== undefined) {
    lines.push(
      `      <camtune:ShutterSpeed>${escapeXml(data.shutterSpeed)}</camtune:ShutterSpeed>`
    );
  }
  if (data.whiteBalance !== undefined) {
    lines.push(
      `      <camtune:WhiteBalance>${escapeXml(data.whiteBalance)}</camtune:WhiteBalance>`
    );
  }
  if (data.aiConfidence !== undefined) {
    lines.push(
      `      <camtune:AIConfidence>${data.aiConfidence.toFixed(4)}</camtune:AIConfidence>`
    );
  }
  if (data.locationName !== undefined) {
    lines.push(
      `      <camtune:LocationName>${escapeXml(data.locationName)}</camtune:LocationName>`
    );
  }

  lines.push(`      <camtune:SessionId>${escapeXml(data.sessionId)}</camtune:SessionId>`);

  // Extra fields
  if (data.extras) {
    for (const [key, value] of Object.entries(data.extras)) {
      const safeKey = escapeXml(key);
      lines.push(
        `      <camtune:${safeKey}>${escapeXml(String(value))}</camtune:${safeKey}>`
      );
    }
  }

  lines.push(`      <xmp:ModifyDate>${xmpDate(modifyDate)}</xmp:ModifyDate>`);

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:camtune="https://camtune.app/ns/1.0/"
      xmlns:exif="http://ns.adobe.com/exif/1.0/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
${lines.join("\n")}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}
