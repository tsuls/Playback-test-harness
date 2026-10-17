// Every stream URL the tests use lives here. Each one was checked with curl
// (HTTP 200, CORS header `access-control-allow-origin: *`) before use.
//
// Both manifests offer H.264/AAC (MP4) and VP9/Opus (WebM) variants; Shaka picks
// whichever the browser supports and prefers.

export interface Stream {
  name: string;
  manifest: string;
  /** ClearKey key as "<keyId hex>:<key hex>", for encrypted streams. */
  clearKey?: string;
}

const SHAKA_ASSETS = 'https://storage.googleapis.com/shaka-demo-assets';

export const STREAMS = {
  /** Angel One, clear (unencrypted) DASH, 144p to 576p, 60 s long. */
  angelOneClear: {
    name: 'Angel One (clear DASH)',
    manifest: `${SHAKA_ASSETS}/angel-one/dash.mpd`,
  },
  /**
   * Angel One, ClearKey-encrypted DASH. The key below was verified in Phase 2:
   * with it the stream decodes at 20 s; with a wrong key it fails there.
   *
   * The first few seconds are a "clear lead" (not encrypted), so any key appears
   * to work at the start. Tests must play past it to prove decryption.
   */
  angelOneClearKey: {
    name: 'Angel One (ClearKey DASH)',
    manifest: `${SHAKA_ASSETS}/angel-one-clearkey/dash.mpd`,
    clearKey: 'feedf00deedeadbeeff0baadf00dd00d:00112233445566778899aabbccddeeff',
  },
} satisfies Record<string, Stream>;

/** A position safely past the ClearKey stream's clear lead. */
export const PAST_CLEAR_LEAD_SECONDS = 20;
