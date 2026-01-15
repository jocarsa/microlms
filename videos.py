#!/usr/bin/env python3
import os
import json
import subprocess
from pathlib import Path
from typing import Dict, List

# =========================
# CONFIG
# =========================
VIDEOS_DIR = Path(__file__).resolve().parent / "videos"
THUMBS_DIR = Path(__file__).resolve().parent / "thumbnails"
OUT_JSON   = Path(__file__).resolve().parent / "videos.json"

# Thumbnail capture time (seconds). If video is shorter, ffmpeg still usually returns a frame.
THUMB_AT_SECONDS = 2.0

# Thumbnail size (keep aspect ratio; width fixed)
THUMB_WIDTH = 640

# Output image format
THUMB_EXT = "webp"   # webp is small; change to "jpg" if you prefer


def run(cmd: List[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ffprobe_duration_seconds(video_path: Path) -> float:
    """
    Returns duration in seconds (float). If probe fails, returns 0.0.
    """
    try:
        p = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(video_path)
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        s = (p.stdout or "").strip()
        return float(s) if s else 0.0
    except Exception:
        return 0.0


def safe_rel(path: Path, base: Path) -> str:
    return path.resolve().relative_to(base.resolve()).as_posix()


def make_thumbnail(video_path: Path, thumb_path: Path) -> None:
    """
    Creates a thumbnail image using ffmpeg. Overwrites existing file.
    """
    # If duration is available, pick a time that isn't beyond the end.
    dur = ffprobe_duration_seconds(video_path)
    t = THUMB_AT_SECONDS
    if dur > 0.0:
        t = min(THUMB_AT_SECONDS, max(0.0, dur * 0.2))  # 20% in, capped by THUMB_AT_SECONDS

    # -ss before -i is faster for many files
    # -vf scale keeps aspect ratio
    run([
        "ffmpeg",
        "-y",
        "-ss", f"{t:.3f}",
        "-i", str(video_path),
        "-vframes", "1",
        "-vf", f"scale={THUMB_WIDTH}:-2",
        str(thumb_path)
    ])


def main() -> None:
    if not VIDEOS_DIR.is_dir():
        raise SystemExit(f"Missing folder: {VIDEOS_DIR}")

    THUMBS_DIR.mkdir(parents=True, exist_ok=True)

    videos = sorted([p for p in VIDEOS_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".mp4"])
    items: List[Dict] = []

    for idx, vp in enumerate(videos, start=1):
        vid_id = vp.stem
        thumb_name = f"{vid_id}.{THUMB_EXT}"
        thumb_path = THUMBS_DIR / thumb_name

        # Create thumbnail if missing (or regenerate if you want: remove this if-check)
        if not thumb_path.is_file():
            try:
                make_thumbnail(vp, thumb_path)
            except subprocess.CalledProcessError:
                # If thumbnail generation fails, continue but leave thumb empty
                thumb_name = ""

        items.append({
            "id": vid_id,
            "index": idx,
            "title": vp.stem,
            "video_file": safe_rel(vp, Path(__file__).resolve().parent),
            "thumbnail_file": safe_rel(thumb_path, Path(__file__).resolve().parent) if thumb_name else "",
            "duration_seconds": round(ffprobe_duration_seconds(vp), 3),
            "size_bytes": vp.stat().st_size,
        })

    payload = {
        "generated_at_epoch": int(__import__("time").time()),
        "videos_dir": "videos",
        "thumbnails_dir": "thumbnails",
        "count": len(items),
        "videos": items,
    }

    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"OK: {len(items)} videos -> {OUT_JSON}")
    print(f"Thumbnails in: {THUMBS_DIR}")


if __name__ == "__main__":
    main()

