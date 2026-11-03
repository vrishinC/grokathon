"""Deterministic, scene-scored original sound design; no third-party samples."""
from pathlib import Path
import json
import subprocess
import wave
import numpy as np

RATE = 48000
DURATION = 34
ROOT = Path(__file__).parent
rng = np.random.default_rng(4819)
mix = np.zeros((RATE * DURATION, 2), dtype=np.float64)
cues = []


def clock(duration):
    return np.arange(round(duration * RATE)) / RATE


def envelope(t, attack=.03, release=.2):
    return np.minimum(t / attack, 1) * np.minimum((len(t) / RATE - t) / release, 1)


def noise(duration, low, high):
    """Soft band edges avoid ringing; each invocation is a distinct texture."""
    size = round(duration * RATE)
    frequencies = np.fft.rfftfreq(size, 1 / RATE)
    spectrum = np.fft.rfft(rng.standard_normal(size))
    band = (1 - np.exp(-(frequencies / max(low, 1)) ** 4)) * np.exp(-(frequencies / high) ** 4)
    result = np.fft.irfft(spectrum * band, n=size)
    return result / max(np.sqrt(np.mean(result ** 2)), 1e-9)


def add(signal, start, gain=1, pan=0, echo=0):
    begin = round(start * RATE)
    if begin >= len(mix):
        return
    size = min(len(signal), len(mix) - begin)
    signal = signal[:size] * gain
    p = np.asarray(pan)
    if p.ndim:
        p = p[:size]
    angle = (p + 1) * np.pi / 4
    mix[begin:begin + size, 0] += signal * np.cos(angle)
    mix[begin:begin + size, 1] += signal * np.sin(angle)
    if echo:
        add(signal, start + .137, echo, -pan)
        add(signal, start + .293, echo * .45, pan)


def mark(time, name):
    cues.append({'time_seconds': time, 'sound': name})


def whoosh(start, duration, gain, direction=1, airy=False):
    t = clock(duration)
    sweep = np.sin(np.pi * t / duration) ** 1.8
    texture = noise(duration, 450 if airy else 110, 6800 if airy else 2300)
    # A low, descending air resonance supports the camera movement.
    resonance = np.sin(2 * np.pi * (220 * t - 65 * t * t / duration))
    add((texture * .7 + resonance * .3) * sweep, start, gain,
        direction * np.linspace(-.85, .85, len(t)))


def impact(start, strength=.3, pitch=62, metallic=False):
    t = clock(1.7)
    phase = 2 * np.pi * (pitch * t + 34 * (1 - np.exp(-t * 12)) / 12)
    body = np.sin(phase) * np.exp(-t * 4.2)
    transient = noise(1.7, 800, 4500) * np.exp(-t * 43) * .22
    if metallic:
        transient += .16 * np.sin(2 * np.pi * 427 * t) * np.exp(-t * 7)
    add((body + transient) * np.minimum(t / .008, 1), start, strength, echo=.1)


def chime(start, hz, gain=.08, pan=0, duration=.65):
    t = clock(duration)
    signal = (np.sin(2 * np.pi * hz * t) + .23 * np.sin(2 * np.pi * hz * 2.01 * t))
    add(signal * np.exp(-t * 6) * envelope(t, .008, .12), start, gain, pan, echo=.22)


# A quiet harmonic bed changes register with the story, leaving the effects space.
for start, duration, notes, level in [
    (0, 8, [55, 82.4069, 110], .025),
    (7.5, 7.5, [65.406, 98, 130.813], .022),
    (14.5, 7.5, [73.416, 110, 146.832], .018),
    (22, 5, [65.406, 98, 164.814], .014),
    (26.5, 7.5, [55, 82.4069, 130.813, 220], .025),
]:
    t = clock(duration)
    for index, hz in enumerate(notes):
        sound = np.sin(2 * np.pi * hz * t + .1 * np.sin(t * .8))
        add(sound * envelope(t, 1.1, 1.6), start, level / (1 + index * .55), (index % 2 * 2 - 1) * .35)

# Hook: a tactile low impact, spacious air, then a close stereo geographic dive.
mark(.12, 'Opening low impact and map scan')
impact(.12, .30, 48)
chime(.65, 330, .055, -.45)
whoosh(1.3, 1.15, .13)
mark(2, 'Stereo air dive and two muted street-detail ticks')
for start, pan in [(2.8, -.45), (3.65, .4)]:
    t = clock(.16)
    add(noise(.16, 900, 4200) * np.exp(-t * 45) * envelope(t, .002, .03), start, .085, pan)
whoosh(4.55, .8, .11, -1, True)

# Grid fracture: dry micro-impacts scatter into an ascending, restrained data run.
mark(5, 'Grid fracture, granular scatter and scale-change shimmer')
impact(5, .18, 83, True)
for index in range(17):
    start = 5.05 + index * .068
    t = clock(.09)
    add(noise(.09, 1400, 7000) * np.exp(-t * 60) * envelope(t, .002, .025), start, .035, rng.uniform(-.85, .85))
for index, hz in enumerate([330, 440, 587.33, 659.25]):
    chime(5.6 + index * .19, hz, .055, -.6 + index * .4)
whoosh(7.45, .85, .075, 1, True)

# Valley: independent left/right river textures, soft wind and water droplets.
mark(8, 'Open valley wind, flowing water and near-field droplets')
for pan in [-.7, .7]:
    t = clock(7)
    stream = noise(7, 180, 3500)
    movement = .65 + .20 * np.sin(t * 1.7 + pan * 2) + .1 * np.sin(t * 4.1)
    add(stream * movement * envelope(t, .8, 1), 8, .031, pan)
for start, hz, pan in [(8.6, 880, -.6), (9.3, 740, .55), (10.05, 990, -.2)]:
    t = clock(.24)
    add(np.sin(2 * np.pi * (hz * t - 700 * t * t)) * np.exp(-t * 20) * envelope(t, .004, .05), start, .045, pan, echo=.15)

# Fred: rain builds before a distant rolling thunder event and a water surge.
mark(11, 'Fred rainfall swell, distant thunder and rising-water rush')
for pan in [-.8, .8]:
    t = clock(4.4)
    add(noise(4.4, 1900, 10000) * envelope(t, .9, .6) * (.55 + .45 * t / 4.4), 10.8, .047, pan)
t = clock(3)
thunder = noise(3, 30, 230) * envelope(t, .15, 1.8) * (1 + .25 * np.sin(t * 13))
add(thunder, 11.25, .11, -.25)
whoosh(12.1, 2.2, .095, -1)
impact(13.3, .17, 57)

# Scientific diagram: five unique pitched UI ticks match the highlighted steps.
mark(15, 'Analytical reveal and five synchronized pipeline tones')
whoosh(14.6, .65, .09, 1, True)
for index, hz in enumerate([261.626, 329.628, 391.995, 523.251, 659.255]):
    chime(15.08 + index / 1.4, hz, .075, -.6 + index * .3)

# Compare: a split swipe and alternating left/right confirmation pings.
mark(19, 'Comparison swipe and alternating measured/model pings')
whoosh(18.6, .8, .1, -1, True)
for start, hz, pan in [(19.45, 440, -.65), (20, 554.365, .65), (20.7, 440, -.65), (21.2, 554.365, .65)]:
    chime(start, hz, .055, pan, .5)

# Human-scale passage: deliberately quieter, with nearby water and a warm pulse.
mark(22, 'Quiet neighborhood water and a soft two-part human-impact pulse')
t = clock(5)
add(noise(5, 240, 2200) * envelope(t, .6, .8) * (.7 + .2 * np.sin(t * 2.7)), 22, .027, .2)
impact(24.5, .19, 65)
impact(24.83, .10, 76)
chime(25.5, 329.628, .045, -.25, 1.2)

# Helene: a shorter, more wind-led storm than Fred, followed by a resolving logo.
mark(27, 'Helene wind gust, sparse rain and deeper storm accent')
whoosh(26.35, 1.15, .13, 1)
impact(27.05, .22, 43)
for pan in [-.65, .65]:
    t = clock(2.8)
    add(noise(2.8, 2300, 8500) * envelope(t, .35, .9), 27, .034, pan)
mark(30, 'Aerial pullback, tonal resolution and long clean tail')
whoosh(29.35, 1.2, .11, -1, True)
impact(30.05, .2, 55)
for hz, pan in [(220, -.5), (329.628, 0), (440, .5)]:
    chime(30.25, hz, .065, pan, 3.2)

# Gentle DC removal, generous headroom and an exact, click-free ending.
mix -= np.mean(mix, axis=0)
t = clock(DURATION)
mix *= envelope(t, .025, 1.1)[:, None]
peak = float(np.max(np.abs(mix)))
if peak > .88:
    mix *= .88 / peak
assert np.isfinite(mix).all()
pcm = np.round(np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(str(ROOT / 'audio.wav'), 'wb') as out:
    out.setnchannels(2)
    out.setsampwidth(2)
    out.setframerate(RATE)
    out.writeframes(pcm.tobytes())
(ROOT / 'sound-cues.json').write_text(json.dumps({'duration': DURATION, 'sample_rate': RATE, 'cues': cues}, indent=2) + '\n')
print(f'Original scene-scored soundtrack: {DURATION}s, stereo {RATE} Hz, {len(cues)} cue groups; peak {np.max(np.abs(mix)):.3f}')

# Two-pass loudness mastering keeps phone playback clear without clipped impacts.
target = 'loudnorm=I=-16:TP=-1.5:LRA=9'
analysis = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(ROOT / 'audio.wav'),
                          '-af', target + ':print_format=json', '-f', 'null', '-'],
                         capture_output=True, text=True, check=True)
measurements, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind('{'):])
master_filter = target + ''.join(':' + key + '=' + measurements[value] for key, value in [
    ('measured_I', 'input_i'), ('measured_TP', 'input_tp'),
    ('measured_LRA', 'input_lra'), ('measured_thresh', 'input_thresh'),
    ('offset', 'target_offset')]) + ':linear=true'
master = ROOT / 'audio-master.wav'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(ROOT / 'audio.wav'),
                '-af', master_filter, '-ar', str(RATE), '-c:a', 'pcm_s16le', str(master)], check=True)
master.replace(ROOT / 'audio.wav')
print('Mastered to -16 LUFS integrated, with a -1.5 dBTP ceiling.')
