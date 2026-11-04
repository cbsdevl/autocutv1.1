// Procedural Royalty-Free Audio Generator using Web Audio API
// Generates studio-quality ambient, upbeat, and afrobeat soundtrack WAV blobs
// 100% offline, zero CORS issues, guaranteed to play and export cleanly.

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write audio samples
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Clamp sample between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed int
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

// Generate Cinematic Ambient Horizon soundtrack
export async function generateCinematicAmbientWav(durationSeconds: number = 32): Promise<string> {
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

  // Chords: Cmaj7 -> Am9 -> Fmaj7 -> Gsus4 -> C
  const chords = [
    [130.81, 164.81, 196.0, 246.94], // C3, E3, G3, B3
    [110.0, 130.81, 164.81, 220.0],  // A2, C3, E3, A3
    [87.31, 130.81, 174.61, 220.0],   // F2, C3, F3, A3
    [98.0, 146.83, 196.0, 261.63],   // G2, D3, G3, C4
  ];

  const chordDuration = 8;
  chords.forEach((chord, chordIdx) => {
    const startTime = chordIdx * chordDuration;
    if (startTime >= durationSeconds) return;

    chord.forEach((freq, noteIdx) => {
      // Warm pad oscillator
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      const filter = offlineCtx.createBiquadFilter();

      osc.type = noteIdx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, startTime);

      // Low pass filter for warm cinematic feel
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600 + noteIdx * 100, startTime);

      // Gentle attack and release envelope
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.08, startTime + 2);
      gain.gain.setValueAtTime(0.08, startTime + chordDuration - 1.5);
      gain.gain.linearRampToValueAtTime(0.001, startTime + chordDuration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(startTime);
      osc.stop(Math.min(durationSeconds, startTime + chordDuration));
    });
  });

  const renderedBuffer = await offlineCtx.startRendering();
  const blob = audioBufferToWav(renderedBuffer);
  return URL.createObjectURL(blob);
}

// Generate Upbeat Vlog Acoustic Groove soundtrack
export async function generateUpbeatVlogWav(durationSeconds: number = 30): Promise<string> {
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

  const bpm = 110;
  const beatTime = 60 / bpm;
  const totalBeats = Math.floor(durationSeconds / beatTime);

  // Rhythmic beat loop
  for (let beat = 0; beat < totalBeats; beat++) {
    const time = beat * beatTime;

    // Kick on beats 0 and 2
    if (beat % 4 === 0 || beat % 4 === 2) {
      const kickOsc = offlineCtx.createOscillator();
      const kickGain = offlineCtx.createGain();
      kickOsc.frequency.setValueAtTime(140, time);
      kickOsc.frequency.exponentialRampToValueAtTime(38, time + 0.18);
      kickGain.gain.setValueAtTime(0.25, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
      kickOsc.connect(kickGain);
      kickGain.connect(offlineCtx.destination);
      kickOsc.start(time);
      kickOsc.stop(time + 0.25);
    }

    // Snare / clap on beats 1 and 3
    if (beat % 4 === 1 || beat % 4 === 3) {
      const noiseBuffer = offlineCtx.createBuffer(1, sampleRate * 0.12, sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.03));
      }
      const noise = offlineCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = offlineCtx.createGain();
      noiseGain.gain.setValueAtTime(0.15, time);
      noise.connect(noiseGain);
      noiseGain.connect(offlineCtx.destination);
      noise.start(time);
    }

    // Melodic acoustic pluck
    const melodyNotes = [261.63, 329.63, 392.0, 523.25, 440.0, 392.0];
    const noteFreq = melodyNotes[beat % melodyNotes.length];
    const pluckOsc = offlineCtx.createOscillator();
    const pluckGain = offlineCtx.createGain();
    pluckOsc.type = "sine";
    pluckOsc.frequency.setValueAtTime(noteFreq, time);
    pluckGain.gain.setValueAtTime(0.07, time);
    pluckGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    pluckOsc.connect(pluckGain);
    pluckGain.connect(offlineCtx.destination);
    pluckOsc.start(time);
    pluckOsc.stop(time + 0.4);
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const blob = audioBufferToWav(renderedBuffer);
  return URL.createObjectURL(blob);
}

// Generate Afrobeat Island Rhythms soundtrack
export async function generateAfrobeatWav(durationSeconds: number = 30): Promise<string> {
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

  const bpm = 105;
  const beatTime = 60 / bpm;
  const totalBeats = Math.floor(durationSeconds / beatTime);

  // Polyrhythmic Afrobeat shaker & log drum groove
  for (let beat = 0; beat < totalBeats; beat++) {
    const time = beat * beatTime;

    // Log drum sync
    const drumNotes = [73.42, 98.0, 82.41, 110.0];
    const drumFreq = drumNotes[Math.floor(beat / 2) % drumNotes.length];

    const drumOsc = offlineCtx.createOscillator();
    const drumGain = offlineCtx.createGain();
    drumOsc.type = "sine";
    drumOsc.frequency.setValueAtTime(drumFreq * 1.5, time);
    drumOsc.frequency.exponentialRampToValueAtTime(drumFreq, time + 0.15);
    drumGain.gain.setValueAtTime(0.3, time);
    drumGain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    drumOsc.connect(drumGain);
    drumGain.connect(offlineCtx.destination);
    drumOsc.start(time);
    drumOsc.stop(time + 0.3);

    // Shakers on 16th notes
    for (let sub = 0; sub < 4; sub++) {
      const subTime = time + sub * (beatTime / 4);
      if (subTime >= durationSeconds) break;

      const shakerBuf = offlineCtx.createBuffer(1, sampleRate * 0.04, sampleRate);
      const out = shakerBuf.getChannelData(0);
      for (let i = 0; i < shakerBuf.length; i++) {
        out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.008));
      }
      const shaker = offlineCtx.createBufferSource();
      shaker.buffer = shakerBuf;
      const shakerGain = offlineCtx.createGain();
      shakerGain.gain.setValueAtTime(sub % 2 === 0 ? 0.06 : 0.03, subTime);
      shaker.connect(shakerGain);
      shakerGain.connect(offlineCtx.destination);
      shaker.start(subTime);
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const blob = audioBufferToWav(renderedBuffer);
  return URL.createObjectURL(blob);
}
