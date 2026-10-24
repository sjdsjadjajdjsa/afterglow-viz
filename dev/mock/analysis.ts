import { seededRandom } from "../../src/util/math";

export interface MockAudioSpec {
  seed: number;
  durationMs: number;
  tempo: number;
  energy: number;
}

const r = (x: number) => Math.round(x * 100000) / 100000;

// fake data shaped like spotify's audio-analysis response
export function mockAnalysis({ seed, durationMs, tempo, energy }: MockAudioSpec) {
  const rand = seededRandom(seed);
  const duration = durationMs / 1000;
  const beat = 60 / tempo;
  const baseDb = -20 + 12 * energy;
  const key = Math.floor(rand() * 12);
  const mode = rand() < 0.6 ? 1 : 0;

  const beats = [];
  const bars = [];
  const tatums = [];
  for (let i = 0, t = 0; t < duration; i++, t = i * beat) {
    const confidence = r(0.5 + rand() * 0.5);
    beats.push({ start: r(t), duration: r(beat), confidence });
    tatums.push({ start: r(t), duration: r(beat / 2), confidence }, { start: r(t + beat / 2), duration: r(beat / 2), confidence });
    if (i % 4 === 0) bars.push({ start: r(t), duration: r(beat * 4), confidence });
  }

  const sections = [];
  for (let t = 0; t < duration; ) {
    const length = Math.min(beat * (rand() < 0.5 ? 16 : 32), duration - t);
    sections.push({
      start: r(t),
      duration: r(length),
      confidence: r(rand()),
      loudness: r(baseDb + rand() * 6 - 3),
      tempo,
      tempo_confidence: r(0.6 + rand() * 0.4),
      key,
      key_confidence: r(rand()),
      mode,
      mode_confidence: r(rand()),
      time_signature: 4,
      time_signature_confidence: 1,
    });
    t += length;
  }

  const segments = [];
  for (let t = 0; t < duration; ) {
    const length = Math.min(beat * (0.3 + rand() * 0.5), duration - t);
    const onBeat = (t / beat) % 1 < 0.15;
    const fade = Math.min(1, t / 3, (duration - t) / 5);
    const loudnessMax = baseDb + (onBeat ? 5 : 0) + rand() * 4 - 2 - (1 - fade) * 25;
    const pitches = Array.from({ length: 12 }, () => rand());
    const top = Math.max(...pitches);
    segments.push({
      start: r(t),
      duration: r(length),
      confidence: r(rand()),
      loudness_start: r(loudnessMax - 8 - rand() * 10),
      loudness_max_time: r(length * 0.3 * rand()),
      loudness_max: r(loudnessMax),
      loudness_end: 0,
      pitches: pitches.map((p) => r(p / top)),
      timbre: [r(60 + loudnessMax), ...Array.from({ length: 11 }, () => r(rand() * 200 - 100))],
    });
    t += length;
  }

  return {
    meta: { analyzer_version: "mock", platform: "harness", status_code: 0, status: "OK" },
    track: {
      duration: r(duration),
      loudness: r(baseDb),
      tempo,
      tempo_confidence: 0.8,
      time_signature: 4,
      key,
      mode,
      end_of_fade_in: 0,
      start_of_fade_out: r(Math.max(0, duration - 5)),
    },
    bars,
    beats,
    sections,
    segments,
    tatums,
  };
}

// shaped like the web api's audio-features response
export function mockFeatures(id: string, { seed, durationMs, tempo, energy }: MockAudioSpec) {
  const rand = seededRandom(seed ^ 0x9e3779b9);
  return {
    type: "audio_features",
    id,
    uri: `spotify:track:${id}`,
    duration_ms: durationMs,
    tempo,
    energy,
    loudness: r(-20 + 12 * energy),
    danceability: r(rand()),
    valence: r(rand()),
    acousticness: r(rand()),
    instrumentalness: r(rand()),
    liveness: r(rand() * 0.4),
    speechiness: r(rand() * 0.2),
    key: Math.floor(rand() * 12),
    mode: rand() < 0.6 ? 1 : 0,
    time_signature: 4,
  };
}
