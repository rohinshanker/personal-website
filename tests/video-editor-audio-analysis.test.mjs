import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = await readFile(
  new URL("../video-editor/audio-analysis.js", import.meta.url),
  "utf8"
);
const workerScope = {};
runInNewContext(source, {
  Float32Array,
  Float64Array,
  Math,
  Object,
  RangeError,
  TypeError,
  Uint16Array,
  Uint32Array,
  self: workerScope,
});
const analysis = workerScope.VideoEditorAudioAnalysis;

const sineBurst = ({
  amplitude = 0.9,
  duration = 2,
  end = 0.75,
  frequency = 1_000,
  sampleRate = 16_000,
  start = 0.5,
} = {}) => {
  const samples = new Float32Array(Math.floor(duration * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    if (time >= start && time < end) {
      samples[index] = Math.sin(2 * Math.PI * frequency * time) * amplitude;
    }
  }
  return { sampleRate, samples };
};

test("Audio-Sync analysis produces bounded waveform and Fourier data", () => {
  const input = sineBurst();
  const result = analysis.analyze(input.samples, input.sampleRate, {
    maxFrames: 300,
    waveformBins: 200,
  });

  assert.equal(result.duration, 2);
  assert.equal(result.bandCount, 64);
  assert.equal(result.waveform.minimums.length, 200);
  assert.equal(result.waveform.maximums.length, 200);
  assert.equal(result.spectra.length, result.frameCount * result.bandCount);
  assert.equal(result.averageSpectrum.length, result.bandCount);
  assert.ok(Array.from(result.averageSpectrum).every((value) => value >= 0 && value <= 1));
});

test("Audio-Sync band rules find rising and falling edges near a known burst", () => {
  const input = sineBurst();
  const result = analysis.analyze(input.samples, input.sampleRate, { maxFrames: 300 });
  const series = analysis.createBandSeries(result, 800, 1_200);
  const threshold = analysis.recommendThreshold(series, 0.7);
  const rising = analysis.findThresholdCrossings(
    result.frameTimes,
    series,
    threshold,
    "rising"
  );
  const falling = analysis.findThresholdCrossings(
    result.frameTimes,
    series,
    threshold,
    "falling"
  );
  const both = analysis.findThresholdCrossings(
    result.frameTimes,
    series,
    threshold,
    "both"
  );

  assert.ok(rising.some((crossing) => Math.abs(crossing.time - 0.5) < 0.08));
  assert.ok(falling.some((crossing) => Math.abs(crossing.time - 0.75) < 0.08));
  assert.ok(both.length >= 2);
  assert.ok(both.every((crossing, index) => index === 0 || crossing.time >= both[index - 1].time));
});

test("Audio-Sync onset and input guards handle silence and invalid analysis requests", () => {
  const silence = new Float32Array(16_000);
  const result = analysis.analyze(silence, 16_000, { maxFrames: 200 });
  const onset = analysis.createOnsetSeries(result);

  assert.deepEqual(Array.from(onset), Array.from({ length: result.frameCount }, () => 0));
  assert.equal(
    analysis.findThresholdCrossings(result.frameTimes, onset, 0.5, "both").length,
    0
  );
  assert.throws(() => analysis.analyze(new Float32Array(), 16_000), TypeError);
  assert.throws(
    () => analysis.analyze(new Float32Array(1_024), 16_000, { fftSize: 300 }),
    RangeError
  );
});
