importScripts("./audio-analysis.js");

self.addEventListener("message", (event) => {
  const { generation, sampleRate, samples } = event.data || {};
  try {
    const analysis = self.VideoEditorAudioAnalysis.analyze(samples, sampleRate);
    const transfer = [
      analysis.averageSpectrum.buffer,
      analysis.bandEdges.buffer,
      analysis.frameTimes.buffer,
      analysis.spectra.buffer,
      analysis.waveform.maximums.buffer,
      analysis.waveform.minimums.buffer,
      analysis.waveform.rms.buffer,
    ];
    self.postMessage({ analysis, generation, ok: true }, transfer);
  } catch (error) {
    self.postMessage({
      error: String(error?.message || "Audio analysis failed."),
      generation,
      ok: false,
    });
  }
});
