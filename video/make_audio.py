"""Original deterministic ambient score, generated without third-party samples."""
from pathlib import Path
import wave
import numpy as np

RATE=48000
DURATION=34
t=np.arange(RATE*DURATION)/RATE
rng=np.random.default_rng(4819)
score=np.zeros_like(t)
# Sparse minor suspended bed: slow attack and breathing upper partials.
for hz,amplitude in [(55,.09),(82.4069,.035),(110,.023),(130.813,.018),(164.814,.014),(220,.009)]:
    score+=amplitude*np.sin(2*np.pi*hz*t+.2*np.sin(t*.3))*(.7+.3*np.sin(t*.27+hz))
score*=np.minimum(t/2,1)*np.minimum((DURATION-t)/1.8,1)
# Soft environmental texture, original filtered noise.
noise=rng.standard_normal(len(t))
smoothed=np.convolve(noise,np.ones(90)/90,mode='same')
score+=smoothed*.09*(.2+.8*np.exp(-((t-13)/3)**2)+.4*np.exp(-((t-28)/2)**2))
for impact in [0.15,2,5,6.5,8,11,15,19,22,24.5,27,30]:
    dt=t-impact;mask=(dt>=0)&(dt<1.8);x=dt[mask]
    score[mask]+=.23*np.exp(-x*4.8)*np.sin(2*np.pi*(44*x+22*(1-np.exp(-x*9))/9))
    score[mask]+=.05*np.exp(-x*15)*noise[mask]
for end in [2,5,8,11,15,19,22,24.5,27,30]:
    dt=t-(end-.65);mask=(dt>=0)&(dt<.85);x=dt[mask]
    envelope=np.sin(np.pi*np.clip(x/.85,0,1))**2
    score[mask]+=.10*smoothed[mask]*envelope+.016*np.sin(2*np.pi*(450*x+550*x*x))*envelope
score=np.tanh(score*1.6)*.72
left=score
right=score*.94+np.roll(score,431)*.06
pcm=(np.stack([left,right],axis=1)*32767).astype('<i2')
with wave.open(str(Path(__file__).with_name('audio.wav')),'wb') as out:
    out.setnchannels(2);out.setsampwidth(2);out.setframerate(RATE);out.writeframes(pcm.tobytes())
print('Original ambient audio:',DURATION,'seconds, stereo 48 kHz')
