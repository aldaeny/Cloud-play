#!/usr/bin/env bash
# Runs a local generated HLS fixture; requires ffmpeg, chromium, chromedriver and Selenium.
# No third-party streams or test files are deployed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; WEB="$ROOT/apps/web"; TEST="$WEB/public/cp-test-only"; PAGE="$WEB/pages/cp-test-only.tsx"; FFMPEG="${FFMPEG:-ffmpeg}"; PORT="${PORT:-3107}"
if [[ -e "$TEST" || -e "$PAGE" ]]; then echo 'Fixture paths already exist; refusing to overwrite.' >&2; exit 1; fi
command -v "$FFMPEG" >/dev/null || { echo 'FFMPEG executable required' >&2; exit 1; }
mkdir "$TEST"; server=''
cleanup(){ if [[ -n "$server" ]]; then kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; fi; rm -rf "$TEST"; rm -f "$PAGE"; }
trap cleanup EXIT
for scale in 180 360; do
 width=$((scale*16/9)); rate=180k; [[ "$scale" == 360 ]] && rate=400k
 "$FFMPEG" -hide_banner -loglevel error -f lavfi -i "testsrc=size=${width}x${scale}:rate=25" -t 14 -pix_fmt yuv420p -c:v libx264 -profile:v baseline -level 3.0 -g 50 -sc_threshold 0 -preset ultrafast -b:v "$rate" -f hls -hls_time 2 -hls_list_size 0 "$TEST/v${scale}.m3u8"
done
for freq in 440 660; do "$FFMPEG" -hide_banner -loglevel error -f lavfi -i "sine=frequency=${freq}:sample_rate=44100" -t 14 -c:a aac -b:a 64k -f hls -hls_time 2 -hls_list_size 0 "$TEST/a${freq}.m3u8"; done
cat > "$TEST/subs.vtt" <<'VTT'
WEBVTT

00:00:01.000 --> 00:00:10.000
Synthetic test captions
VTT
cat > "$TEST/subs.m3u8" <<'M3U'
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:14
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:14,
subs.vtt
#EXT-X-ENDLIST
M3U
cat > "$TEST/master.m3u8" <<'M3U'
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="a440.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Arabic",LANGUAGE="ar",DEFAULT=NO,AUTOSELECT=YES,URI="a660.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English CC",LANGUAGE="en",DEFAULT=NO,AUTOSELECT=YES,URI="subs.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=320x180,CODECS="avc1.42c01e,mp4a.40.2",AUDIO="audio",SUBTITLES="subs"
v180.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360,CODECS="avc1.42c01e,mp4a.40.2",AUDIO="audio",SUBTITLES="subs"
v360.m3u8
M3U
cat > "$PAGE" <<'TSX'
import MediaViewer from '../src/components/player/MediaViewer';
export default function Fixture(){return <div className="site"><MediaViewer title="Synthetic local HLS" language="en" kind="hls" url="/cp-test-only/master.m3u8" onClose={()=>{}}/></div>}
TSX
(cd "$WEB" && exec "$ROOT/node_modules/.bin/next" dev --hostname 127.0.0.1 -p "$PORT") >/tmp/cloudplay-hls-fixture-server.log 2>&1 & server=$!
# Wait for one local test server, not for an external service.
for _ in $(seq 1 60); do if curl -fsS "http://localhost:$PORT/cp-test-only" >/dev/null 2>&1; then break; fi; if ! kill -0 "$server" 2>/dev/null; then cat /tmp/cloudplay-hls-fixture-server.log >&2; exit 1; fi; sleep 1; done
CLOUDPLAY_HLS_FIXTURE_PAGE="http://localhost:$PORT/cp-test-only" /usr/bin/python3 "$ROOT/scripts/player-hls-browser-smoke.py"
