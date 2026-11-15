"""Generate the app's own sound effects (no third-party audio, ТЗ §12).

Run: python3 tools/sounds/generate.py  -> apps/mobile/assets/sounds/<set>/<name>.wav
Deterministic (seeded noise), so re-running produces identical files.
"""
import math
import os
import random
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'apps', 'mobile', 'assets', 'sounds')


def write(path, samples):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = 0.85 / peak
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s * scale)) * 32767)) for s in samples))


def silence(sec):
    return [0.0] * int(RATE * sec)


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] if i < len(t) else 0.0 for t in tracks) for i in range(n)]


def wood_knock(freq=190.0, length=0.16, noise=0.6, seed=1, bright=1.0):
    """Short wooden 'tok': damped low partials + a filtered noise click."""
    rnd = random.Random(seed)
    out = []
    lp = 0.0
    for i in range(int(RATE * length)):
        t = i / RATE
        body = (math.sin(2 * math.pi * freq * t) * math.exp(-t * 38)
                + 0.5 * math.sin(2 * math.pi * freq * 2.76 * t) * math.exp(-t * 60)
                + 0.25 * bright * math.sin(2 * math.pi * freq * 5.4 * t) * math.exp(-t * 90))
        n = rnd.uniform(-1, 1)
        lp += (n - lp) * 0.35
        click = lp * math.exp(-t * 260) * noise
        out.append(body + click)
    return out


def tone(freq, length, decay=6.0, attack=0.004, harmonics=(1.0, 0.3, 0.1)):
    out = []
    for i in range(int(RATE * length)):
        t = i / RATE
        env = min(1.0, t / attack) * math.exp(-t * decay)
        s = sum(a * math.sin(2 * math.pi * freq * (k + 1) * t) for k, a in enumerate(harmonics))
        out.append(s * env)
    return out


def seq(*parts):
    out = []
    for p in parts:
        out.extend(p)
    return out


def buzz(freq=140.0, length=0.22):
    out = []
    for i in range(int(RATE * length)):
        t = i / RATE
        env = min(1.0, t / 0.01) * math.exp(-t * 9)
        s = math.sin(2 * math.pi * freq * t) + 0.6 * math.sin(2 * math.pi * freq * 1.5 * t)
        out.append(math.tanh(2.2 * s) * env)
    return out


SETS = {
    'wood': {
        'move': wood_knock(200, seed=1),
        'capture': mix(wood_knock(160, 0.2, 1.0, seed=2), silence(0.03) + wood_knock(240, 0.15, 0.6, seed=3)),
        'castle': seq(wood_knock(210, 0.09, seed=4), silence(0.02), wood_knock(185, 0.16, seed=5)),
        'check': mix(wood_knock(220, seed=6), tone(880, 0.25, decay=14, harmonics=(0.35, 0.1))),
        'correct': seq(tone(660, 0.09, decay=18), tone(990, 0.22, decay=10)),
        'wrong': buzz(),
        'complete': seq(tone(523, 0.1, decay=14), tone(659, 0.1, decay=14), tone(784, 0.1, decay=14), tone(1047, 0.35, decay=6)),
    },
    'soft': {
        'move': tone(420, 0.12, decay=28, harmonics=(1.0, 0.15)),
        'capture': mix(tone(330, 0.16, decay=22, harmonics=(1.0, 0.2)), tone(495, 0.12, decay=30, harmonics=(0.5,))),
        'castle': seq(tone(420, 0.07, decay=35, harmonics=(1.0, 0.15)), silence(0.02), tone(380, 0.12, decay=28, harmonics=(1.0, 0.15))),
        'check': tone(740, 0.22, decay=12, harmonics=(0.8, 0.2)),
        'correct': seq(tone(587, 0.09, decay=16, harmonics=(1.0,)), tone(880, 0.2, decay=10, harmonics=(1.0,))),
        'wrong': tone(196, 0.22, decay=10, harmonics=(1.0, 0.4, 0.2)),
        'complete': seq(tone(587, 0.1, decay=12, harmonics=(1.0,)), tone(740, 0.1, decay=12, harmonics=(1.0,)), tone(880, 0.35, decay=5, harmonics=(1.0,))),
    },
}

if __name__ == '__main__':
    for set_name, sounds in SETS.items():
        for name, samples in sounds.items():
            write(os.path.join(OUT, set_name, f'{name}.wav'), samples)
    print('ok')
