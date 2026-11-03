"""Rebuild the soundtrack and replace audio without re-encoding video frames."""
from pathlib import Path
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
movie = ROOT / 'public/videos/aquatic-sustainability-story.mp4'
temporary = movie.with_name('aquatic-sustainability-story.remix.mp4')


def video_hash(path):
    return subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
                                    '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-'], text=True).strip()


if not movie.exists():
    raise SystemExit('Render the original film first with npm run video:render.')
original_hash = video_hash(movie)
subprocess.run([sys.executable, str(HERE / 'make_audio.py')], check=True)
try:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(movie),
                    '-i', str(HERE / 'audio.wav'), '-map', '0:v:0', '-map', '1:a:0',
                    '-map_metadata', '0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
                    '-ar', '48000', '-t', '34', '-movflags', '+faststart', str(temporary)], check=True)
    if video_hash(temporary) != original_hash:
        raise RuntimeError('Video stream changed unexpectedly; original retained.')
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(temporary), '-f', 'null', '-'], check=True)
    temporary.replace(movie)
    shutil.copyfile(movie, ROOT / 'dist/videos' / movie.name)
finally:
    temporary.unlink(missing_ok=True)
print('Updated public/videos and dist/videos. Video stream hash is unchanged.')
