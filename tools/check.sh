#!/bin/sh
# 成片檢查：從 mp4 產生一組給自己看的圖，並量聲音和節奏。
#   sh check.sh out/draft.mp4 [快動作的秒數，例如 4.2]
# 產出在同資料夾的 check/：
#   contact.png  每秒 2 格的總覽          → 整體結構、有沒有空拍、有沒有重複的構圖
#   phone.png    縮到 360 px 寬           → 手機上字還看不看得清
#   strip.png    指定時間前後的連續 12 格  → 疊字、跳格、殘影（要給秒數）
#   loop.mp4     連播兩次                 → 循環接縫（要循環的片才需要）
# 並印出：長度、解析度、色彩標記、響度、節奏數字。
set -e
V="$1"; AT="$2"
[ -f "$V" ] || { echo "用法：sh check.sh 影片.mp4 [秒數]"; exit 1; }
D="$(dirname "$V")/check"; mkdir -p "$D"
HERE="$(cd "$(dirname "$0")" && pwd)"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
N=$(python3 -c "import math;print(math.ceil($DUR*2))")
ROWS=$(python3 -c "import math;print(math.ceil($N/6))")
ffmpeg -y -loglevel error -i "$V" -vf "fps=2,scale=320:-1,tile=6x${ROWS}:padding=3:color=0x222222" -frames:v 1 "$D/contact.png"
PR=$(python3 -c "import math;print(math.ceil(math.ceil($DUR)/5))")
ffmpeg -y -loglevel error -i "$V" -vf "fps=1,scale=360:-1,tile=5x${PR}:padding=3:color=0x222222" -frames:v 1 "$D/phone.png"
if [ -n "$AT" ]; then
  ffmpeg -y -loglevel error -ss "$(python3 -c "print(max(0,$AT-0.15))")" -i "$V" -vf "scale=320:-1,tile=6x2:padding=3:color=0x222222" -frames:v 1 "$D/strip.png"
fi
ffmpeg -y -loglevel error -stream_loop 1 -i "$V" -c copy "$D/loop.mp4"
echo "── 檔案"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames,color_primaries,color_transfer -of default=nw=1 "$V"
echo "duration=$DUR"
if ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$V" | grep -q .; then
  echo "── 響度（社群 −14 LUFS、蘋果風產品片 −16 LUFS；真峰值要低於 −1.5 dBTP）"
  ffmpeg -hide_banner -nostats -i "$V" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | sed 's/^ */  /'
else
  echo "── 沒有音軌"
fi
echo "── 節奏"
python3 "$HERE/rhythm.py" "$V" | tail -6
if ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$V" | grep -q .; then
  echo "── 音畫對位"
  # 這部片的配樂時間表在 data/audio.json（score.py 產生），直接用它量
  A="$HERE/../data/audio.json"
  python3 "$HERE/sync.py" "$V" --analysis "$A" 2>/dev/null | sed -n 2,13p
fi
echo "── 圖在 $D/：用 Read 打開 contact.png、phone.png$( [ -n "$AT" ] && echo '、strip.png' ) 仔細看"
