(() => {
  "use strict";

  const DEFAULT_FFT_SIZE = 1024;
  const DEFAULT_BAND_COUNT = 64;
  const DEFAULT_MAX_FRAMES = 1200;
  const DEFAULT_WAVEFORM_BINS = 1000;
  const MAX_ANALYSIS_SAMPLE_RATE = 22050;
  const MIN_FREQUENCY = 20;

  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

  const percentile = (values, ratio) => {
    if (!values.length) return 0;
    const sorted = Array.from(values).sort((left, right) => left - right);
    const position = clamp(ratio, 0, 1) * (sorted.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    const weight = position - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  const resampleForAnalysis = (samples, sampleRate) => {
    if (sampleRate <= MAX_ANALYSIS_SAMPLE_RATE) {
      return { sampleRate, samples };
    }
    const ratio = sampleRate / MAX_ANALYSIS_SAMPLE_RATE;
    const length = Math.max(1, Math.floor(samples.length / ratio));
    const output = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
      let sum = 0;
      for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
        sum += samples[sourceIndex] || 0;
      }
      output[index] = sum / Math.max(1, end - start);
    }
    return { sampleRate: MAX_ANALYSIS_SAMPLE_RATE, samples: output };
  };

  const createFftPlan = (size) => {
    const bitReverse = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let index = 0; index < size; index += 1) {
      let value = index;
      let reversed = 0;
      for (let bit = 0; bit < bits; bit += 1) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }
      bitReverse[index] = reversed;
    }
    const window = new Float32Array(size);
    for (let index = 0; index < size; index += 1) {
      window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
    }
    return { bitReverse, size, window };
  };

  const fftMagnitudes = (samples, offset, plan) => {
    const { bitReverse, size, window } = plan;
    const real = new Float64Array(size);
    const imaginary = new Float64Array(size);
    for (let index = 0; index < size; index += 1) {
      real[bitReverse[index]] = (samples[offset + index] || 0) * window[index];
    }
    for (let length = 2; length <= size; length *= 2) {
      const angle = (-2 * Math.PI) / length;
      const stepReal = Math.cos(angle);
      const stepImaginary = Math.sin(angle);
      const half = length / 2;
      for (let block = 0; block < size; block += length) {
        let weightReal = 1;
        let weightImaginary = 0;
        for (let index = 0; index < half; index += 1) {
          const even = block + index;
          const odd = even + half;
          const oddReal =
            real[odd] * weightReal - imaginary[odd] * weightImaginary;
          const oddImaginary =
            real[odd] * weightImaginary + imaginary[odd] * weightReal;
          real[odd] = real[even] - oddReal;
          imaginary[odd] = imaginary[even] - oddImaginary;
          real[even] += oddReal;
          imaginary[even] += oddImaginary;
          const nextWeightReal =
            weightReal * stepReal - weightImaginary * stepImaginary;
          weightImaginary =
            weightReal * stepImaginary + weightImaginary * stepReal;
          weightReal = nextWeightReal;
        }
      }
    }
    const magnitudes = new Float32Array(size / 2 + 1);
    const scale = 2 / size;
    for (let index = 0; index < magnitudes.length; index += 1) {
      magnitudes[index] = Math.hypot(real[index], imaginary[index]) * scale;
    }
    return magnitudes;
  };

  const createBandEdges = (sampleRate, bandCount) => {
    const maximum = sampleRate / 2;
    const edges = new Float32Array(bandCount + 1);
    const ratio = maximum / MIN_FREQUENCY;
    for (let index = 0; index <= bandCount; index += 1) {
      edges[index] = MIN_FREQUENCY * Math.pow(ratio, index / bandCount);
    }
    return edges;
  };

  const aggregateBands = (magnitudes, sampleRate, fftSize, bandEdges) => {
    const bands = new Float32Array(bandEdges.length - 1);
    const counts = new Uint16Array(bands.length);
    let bandIndex = 0;
    for (let bin = 1; bin < magnitudes.length; bin += 1) {
      const frequency = (bin * sampleRate) / fftSize;
      while (
        bandIndex < bands.length - 1 &&
        frequency >= bandEdges[bandIndex + 1]
      ) {
        bandIndex += 1;
      }
      if (frequency < bandEdges[bandIndex] || frequency > bandEdges.at(-1)) continue;
      bands[bandIndex] += magnitudes[bin] * magnitudes[bin];
      counts[bandIndex] += 1;
    }
    for (let index = 0; index < bands.length; index += 1) {
      bands[index] = Math.sqrt(bands[index] / Math.max(1, counts[index]));
    }
    return bands;
  };

  const createWaveform = (samples, binCount) => {
    const minimums = new Float32Array(binCount);
    const maximums = new Float32Array(binCount);
    const rms = new Float32Array(binCount);
    for (let bin = 0; bin < binCount; bin += 1) {
      const start = Math.floor((bin * samples.length) / binCount);
      const end = Math.max(start + 1, Math.floor(((bin + 1) * samples.length) / binCount));
      let minimum = 1;
      let maximum = -1;
      let energy = 0;
      for (let index = start; index < end; index += 1) {
        const value = samples[index] || 0;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
        energy += value * value;
      }
      minimums[bin] = minimum;
      maximums[bin] = maximum;
      rms[bin] = Math.sqrt(energy / Math.max(1, end - start));
    }
    return { maximums, minimums, rms };
  };

  const analyze = (inputSamples, inputSampleRate, options = {}) => {
    if (!(inputSamples instanceof Float32Array) || !inputSamples.length) {
      throw new TypeError("Audio analysis requires non-empty Float32 samples.");
    }
    const fftSize = options.fftSize || DEFAULT_FFT_SIZE;
    if (fftSize < 256 || (fftSize & (fftSize - 1)) !== 0) {
      throw new RangeError("FFT size must be a power of two of at least 256.");
    }
    const { samples, sampleRate } = resampleForAnalysis(
      inputSamples,
      inputSampleRate
    );
    const bandCount = options.bandCount || DEFAULT_BAND_COUNT;
    const maximumFrames = options.maxFrames || DEFAULT_MAX_FRAMES;
    const waveformBinCount = options.waveformBins || DEFAULT_WAVEFORM_BINS;
    const availableFrames = Math.max(1, samples.length - fftSize + 1);
    const hopSize = Math.max(
      fftSize / 2,
      Math.ceil(availableFrames / maximumFrames)
    );
    const frameCount = Math.max(1, Math.ceil(availableFrames / hopSize));
    const plan = createFftPlan(fftSize);
    const bandEdges = createBandEdges(sampleRate, bandCount);
    const frameTimes = new Float32Array(frameCount);
    const spectra = new Float32Array(frameCount * bandCount);
    const averageSpectrum = new Float32Array(bandCount);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const offset = Math.min(frame * hopSize, Math.max(0, samples.length - 1));
      const magnitudes = fftMagnitudes(samples, offset, plan);
      const bands = aggregateBands(magnitudes, sampleRate, fftSize, bandEdges);
      spectra.set(bands, frame * bandCount);
      frameTimes[frame] = Math.min(
        inputSamples.length / inputSampleRate,
        (offset + fftSize / 2) / sampleRate
      );
      for (let band = 0; band < bandCount; band += 1) {
        averageSpectrum[band] += bands[band];
      }
    }
    let spectrumMaximum = 0;
    for (let band = 0; band < bandCount; band += 1) {
      averageSpectrum[band] /= frameCount;
      spectrumMaximum = Math.max(spectrumMaximum, averageSpectrum[band]);
    }
    if (spectrumMaximum > 0) {
      for (let band = 0; band < bandCount; band += 1) {
        averageSpectrum[band] /= spectrumMaximum;
      }
    }
    return {
      averageSpectrum,
      bandCount,
      bandEdges,
      duration: inputSamples.length / inputSampleRate,
      fftSize,
      frameCount,
      frameTimes,
      hopSize,
      sampleRate,
      sourceSampleRate: inputSampleRate,
      spectra,
      waveform: createWaveform(samples, waveformBinCount),
    };
  };

  const selectedBandIndexes = (analysis, minimumHz, maximumHz) => {
    const indexes = [];
    for (let band = 0; band < analysis.bandCount; band += 1) {
      const lower = analysis.bandEdges[band];
      const upper = analysis.bandEdges[band + 1];
      if (upper >= minimumHz && lower <= maximumHz) indexes.push(band);
    }
    return indexes;
  };

  const normalizeSeries = (values) => {
    const lower = percentile(values, 0.1);
    const upper = percentile(values, 0.95);
    const span = Math.max(1e-9, upper - lower);
    const normalized = new Float32Array(values.length);
    for (let index = 0; index < values.length; index += 1) {
      normalized[index] = clamp((values[index] - lower) / span, 0, 1);
    }
    return normalized;
  };

  const createBandSeries = (analysis, minimumHz, maximumHz) => {
    const indexes = selectedBandIndexes(analysis, minimumHz, maximumHz);
    const values = new Float32Array(analysis.frameCount);
    for (let frame = 0; frame < analysis.frameCount; frame += 1) {
      let energy = 0;
      for (const band of indexes) {
        const value = analysis.spectra[frame * analysis.bandCount + band];
        energy += value * value;
      }
      values[frame] = Math.sqrt(energy / Math.max(1, indexes.length));
    }
    return normalizeSeries(values);
  };

  const createOnsetSeries = (analysis) => {
    const lowBands = selectedBandIndexes(analysis, 40, 200);
    const values = new Float32Array(analysis.frameCount);
    for (let frame = 1; frame < analysis.frameCount; frame += 1) {
      let flux = 0;
      let lowFlux = 0;
      for (let band = 0; band < analysis.bandCount; band += 1) {
        const current = analysis.spectra[frame * analysis.bandCount + band];
        const previous = analysis.spectra[(frame - 1) * analysis.bandCount + band];
        const change = Math.max(0, current - previous);
        flux += change;
        if (lowBands.includes(band)) lowFlux += change;
      }
      values[frame] = flux + lowFlux * 1.5;
    }
    return normalizeSeries(values);
  };

  const findDirectionalCrossings = (
    times,
    series,
    threshold,
    direction,
    options = {}
  ) => {
    const hysteresis = options.hysteresis ?? 0.05;
    const minimumSpacing = options.minimumSpacing ?? 0.18;
    const crossings = [];
    let lastTime = -Infinity;
    let armed =
      direction === "rising"
        ? series[0] <= threshold - hysteresis
        : series[0] >= threshold + hysteresis;
    for (let index = 1; index < series.length; index += 1) {
      const value = series[index];
      if (direction === "rising") {
        if (!armed && value <= threshold - hysteresis) armed = true;
        if (armed && value >= threshold) {
          if (times[index] - lastTime >= minimumSpacing) {
            crossings.push({ polarity: "rising", score: value, time: times[index] });
            lastTime = times[index];
          }
          armed = false;
        }
      } else {
        if (!armed && value >= threshold + hysteresis) armed = true;
        if (armed && value <= threshold) {
          if (times[index] - lastTime >= minimumSpacing) {
            crossings.push({ polarity: "falling", score: 1 - value, time: times[index] });
            lastTime = times[index];
          }
          armed = false;
        }
      }
    }
    return crossings;
  };

  const findThresholdCrossings = (
    times,
    series,
    threshold,
    direction,
    options = {}
  ) => {
    const normalizedThreshold = clamp(threshold, 0, 1);
    const directions = direction === "both" ? ["rising", "falling"] : [direction];
    const combined = directions.flatMap((candidate) =>
      findDirectionalCrossings(
        times,
        series,
        normalizedThreshold,
        candidate,
        options
      )
    );
    combined.sort((left, right) => left.time - right.time);
    const minimumSpacing = options.minimumSpacing ?? 0.18;
    return combined.filter(
      (crossing, index) =>
        index === 0 || crossing.time - combined[index - 1].time >= minimumSpacing
    );
  };

  const recommendThreshold = (series, ratio = 0.75) =>
    clamp(percentile(series, ratio), 0.35, 0.88);

  self.VideoEditorAudioAnalysis = Object.freeze({
    analyze,
    createBandSeries,
    createOnsetSeries,
    findThresholdCrossings,
    percentile,
    recommendThreshold,
  });
})();
