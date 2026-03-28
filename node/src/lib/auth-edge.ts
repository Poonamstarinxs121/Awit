function base64ToUtf8(b64: string): string {
  const binStr = atob(b64);
  const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function validateAuthTokenEdge(token: string, adminPassword: string, nodeName: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.', 2);
  if (!payloadB64 || !sig) return false;
  try {
    const payload = base64ToUtf8(payloadB64);
    const secret = `sqj_node_${adminPassword}_${nodeName}`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (sig.length !== expectedSig.length) return false;
    let match = true;
    for (let i = 0; i < sig.length; i++) {
      if (sig[i] !== expectedSig[i]) match = false;
    }
    return match;
  } catch {
    return false;
  }
}
