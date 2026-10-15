// Every stream URL the tests use lives here. Each one was checked with curl
// (HTTP 200, CORS header `access-control-allow-origin: *`) before use.
//
// Both manifests offer H.264/AAC (MP4) and VP9/Opus (WebM) variants; Shaka picks
// whichever the browser supports and prefers.

export interface Stream {
  name: string;
  manifest: string;
}

const SHAKA_ASSETS = 'https://storage.googleapis.com/shaka-demo-assets';

export const STREAMS = {
  /** Angel One, clear (unencrypted) DASH, 144p to 576p. */
  angelOneClear: {
    name: 'Angel One (clear DASH)',
    manifest: `${SHAKA_ASSETS}/angel-one/dash.mpd`,
  },
  /** Angel One, ClearKey-encrypted DASH. Used in Phase 2 to exercise EME. */
  angelOneClearKey: {
    name: 'Angel One (ClearKey DASH)',
    manifest: `${SHAKA_ASSETS}/angel-one-clearkey/dash.mpd`,
  },
} satisfies Record<string, Stream>;
