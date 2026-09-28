/**
 * DNS wire format parser.
 *
 * Wire layout (RFC 1035):
 *   - 12-byte header
 *   - QNAME: sequence of (length-byte + label) terminated by 0x00
 *   - QTYPE: 2 bytes
 *   - QCLASS: 2 bytes
 */

const QTYPE_MAP: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  35: "NAPTR",
  43: "DS",
  46: "RRSIG",
  47: "NSEC",
  48: "DNSKEY",
  52: "TLSA",
  65: "HTTPS",
  255: "ANY",
  257: "CAA",
};

export interface DnsQueryInfo {
  domain: string;
  queryType: string;
}

/**
 * Parse a DNS wire-format query buffer and extract the queried domain and
 * query type.
 */
export function parseDnsQuery(buf: ArrayBuffer): DnsQueryInfo {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // QNAME starts at offset 12 (after the 12-byte header)
  let offset = 12;
  const labels: string[] = [];

  while (offset < bytes.length) {
    const len = bytes[offset];
    if (len === 0) {
      offset += 1; // skip the null terminator
      break;
    }
    offset += 1;
    const label = new TextDecoder().decode(bytes.slice(offset, offset + len));
    labels.push(label);
    offset += len;
  }

  const domain = labels.join(".");

  // QTYPE is the 2 bytes right after the null-terminated QNAME
  const qtypeNum = view.getUint16(offset, false); // big-endian
  const queryType = QTYPE_MAP[qtypeNum] || `TYPE${qtypeNum}`;

  return { domain, queryType };
}

/**
 * Decode a base64url string (no padding) into an ArrayBuffer.
 */
export function base64urlToBuffer(b64url: string): ArrayBuffer {
  // Restore standard base64 characters and padding
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
