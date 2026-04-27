"use strict";

const BEATS_PER_BAR = 4;

const NOTE_ROOTS = {
  C: 60,
  Db: 61,
  D: 62,
  Eb: 63,
  E: 64,
  F: 65,
  Gb: 66,
  G: 67,
  Ab: 68,
  A: 69,
  Bb: 70,
  B: 71,
};

const DEGREE_STEPS = [0, 0, 2, 4, 5, 7, 9, 11];

const INSTRUMENTS = {
  piano: {
    label: "钢琴",
    program: 0,
    transpose: 0,
    range: [21, 108],
    wave: "triangle",
    family: "keys",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0000_Aspirin_sf2_file.js",
      variable: "_tone_0000_Aspirin_sf2_file",
      volume: 0.66,
    },
  },
  altoSax: {
    label: "中音萨克斯 Eb",
    program: 65,
    transpose: 9,
    range: [54, 85],
    wave: "sawtooth",
    family: "wind",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0650_Aspirin_sf2_file.js",
      variable: "_tone_0650_Aspirin_sf2_file",
      volume: 0.56,
      glue: 0.072,
    },
  },
  tenorSax: {
    label: "次中音萨克斯 Bb",
    program: 66,
    transpose: 14,
    range: [49, 80],
    wave: "sawtooth",
    family: "wind",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0660_Aspirin_sf2_file.js",
      variable: "_tone_0660_Aspirin_sf2_file",
      volume: 0.58,
      glue: 0.078,
    },
  },
  sopranoSax: {
    label: "高音萨克斯 Bb",
    program: 64,
    transpose: 2,
    range: [56, 88],
    wave: "sawtooth",
    family: "wind",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0640_Aspirin_sf2_file.js",
      variable: "_tone_0640_Aspirin_sf2_file",
      volume: 0.52,
      glue: 0.064,
    },
  },
  guitar: {
    label: "吉他",
    program: 24,
    transpose: 12,
    range: [40, 88],
    wave: "triangle",
    family: "pluck",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0250_Acoustic_Guitar_sf2_file.js",
      variable: "_tone_0250_Acoustic_Guitar_sf2_file",
      volume: 0.78,
    },
  },
  electricGuitar: {
    label: "电吉他",
    program: 27,
    transpose: 12,
    range: [40, 88],
    wave: "sawtooth",
    family: "pluck",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0270_Aspirin_sf2_file.js",
      variable: "_tone_0270_Aspirin_sf2_file",
      volume: 0.66,
    },
  },
  bass: {
    label: "贝斯",
    program: 33,
    transpose: 12,
    range: [28, 67],
    wave: "square",
    family: "pluck",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0330_Aspirin_sf2_file.js",
      variable: "_tone_0330_Aspirin_sf2_file",
      volume: 0.78,
    },
  },
  trumpet: {
    label: "小号 Bb",
    program: 56,
    transpose: 2,
    range: [54, 82],
    wave: "sawtooth",
    family: "wind",
    sample: {
      path: "https://surikov.github.io/webaudiofontdata/sound/0560_Aspirin_sf2_file.js",
      variable: "_tone_0560_Aspirin_sf2_file",
      volume: 0.52,
      glue: 0.052,
    },
  },
};

const SAMPLE = [
  "1231|235-|6/123|2---|",
  "1.2.3.5.65|321-|561*2*|3*-2*1*|",
  "1+2+3+5|1b2b3b5|",
].join("\n");

const state = {
  notes: [],
  bars: [],
  activeId: null,
  audioContext: null,
  masterGain: null,
  soundfontPlayer: null,
  soundfontPromises: new Map(),
  sampleEnvelopes: [],
  audioEngineLabel: "内置合成",
  sources: [],
  visualTimer: null,
  playing: false,
  paused: false,
  playbackToken: 0,
  playStartTime: 0,
  playEndTime: 0,
  currentView: "both",
  currentPage: 0,
  barsPerPage: 4,
};

const els = {
  input: document.getElementById("notationInput"),
  play: document.getElementById("playButton"),
  stop: document.getElementById("stopButton"),
  export: document.getElementById("exportButton"),
  sample: document.getElementById("sampleButton"),
  key: document.getElementById("keySelect"),
  instrument: document.getElementById("instrumentSelect"),
  tempo: document.getElementById("tempoInput"),
  tempoOutput: document.getElementById("tempoOutput"),
  volume: document.getElementById("volumeInput"),
  volumeOutput: document.getElementById("volumeOutput"),
  loop: document.getElementById("loopButton"),
  octave: document.getElementById("octaveButton"),
  status: document.getElementById("parseStatus"),
  meta: document.getElementById("scoreMeta"),
  jianpu: document.getElementById("jianpuBoard"),
  staff: document.getElementById("staffBoard"),
  prevPage: document.getElementById("prevPageButton"),
  nextPage: document.getElementById("nextPageButton"),
  pageText: document.getElementById("pageText"),
  barsPerPage: document.getElementById("barsPerPageSelect"),
  scorePane: document.querySelector(".score-pane"),
  range: document.getElementById("rangeText"),
  duration: document.getElementById("durationText"),
  transpose: document.getElementById("transposeText"),
  tabs: Array.from(document.querySelectorAll(".tab")),
};

function parseNotation(source, keyName) {
  const root = NOTE_ROOTS[keyName] ?? NOTE_ROOTS.C;
  const notes = [];
  const bars = [createBar(0, 0)];
  let beat = 0;
  let bar = 0;
  let id = 0;
  let lastNote = null;
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === "|") {
      if (bars[bars.length - 1].notes.length > 0) {
        bar += 1;
        bars.push(createBar(bar, beat));
      }
      i += 1;
      continue;
    }

    if (char === "-" && lastNote) {
      lastNote.duration += 1;
      beat += 1;
      i += 1;
      continue;
    }

    const parsed = parseNoteAt(source, i, root);
    if (!parsed) {
      i += 1;
      continue;
    }

    const note = {
      id: id++,
      token: parsed.token,
      degreeText: parsed.degreeText,
      pitch: parsed.pitch,
      start: beat,
      localStart: beat - bars[bars.length - 1].start,
      duration: parsed.duration,
      bar,
      rest: parsed.rest,
    };

    notes.push(note);
    bars[bars.length - 1].notes.push(note);
    if (!note.rest) {
      lastNote = note;
    }
    beat += parsed.duration;
    i = parsed.nextIndex;
  }

  while (bars.length && bars[bars.length - 1].notes.length === 0) {
    bars.pop();
  }

  return { notes, bars };
}

function createBar(index, start) {
  return { index, start, notes: [] };
}

function parseNoteAt(source, startIndex, root) {
  let i = startIndex;
  let prefixAccidental = 0;
  let prefix = "";

  if (source[i] === "#") {
    prefixAccidental = 1;
    prefix = "#";
    i += 1;
  } else if (source[i] === "b") {
    prefixAccidental = -1;
    prefix = "b";
    i += 1;
  }

  const degreeChar = source[i];
  if (!/[0-7]/.test(degreeChar || "")) {
    return null;
  }

  i += 1;
  let token = `${prefix}${degreeChar}`;
  let duration = 1;
  let accidental = prefixAccidental;
  let octave = 0;

  while (i < source.length) {
    const char = source[i];
    if (char === ".") {
      duration *= 0.5;
    } else if (char === "-") {
      duration += 1;
    } else if (char === "+") {
      accidental += 1;
    } else if (char === "b" || char === "♭" || char === "↓" || char === "_") {
      accidental -= 1;
    } else if (char === "*" || char === "'") {
      octave += 1;
    } else if (char === "/" || char === ",") {
      octave -= 1;
    } else {
      break;
    }
    token += char;
    i += 1;
  }

  if (degreeChar === "0") {
    return {
      token,
      degreeText: token,
      pitch: null,
      duration,
      rest: true,
      nextIndex: i,
    };
  }

  const degree = Number(degreeChar);
  const pitch = root + DEGREE_STEPS[degree] + accidental + octave * 12;
  return {
    token,
    degreeText: token,
    pitch,
    duration,
    rest: false,
    nextIndex: i,
  };
}

function render() {
  const parsed = parseNotation(els.input.value, els.key.value);
  state.notes = parsed.notes;
  state.bars = parsed.bars;
  clampCurrentPage();
  renderJianpu();
  renderStaff();
  renderStats();
}

function getPageCount() {
  return Math.max(1, Math.ceil(state.bars.length / state.barsPerPage));
}

function clampCurrentPage() {
  state.currentPage = Math.max(0, Math.min(state.currentPage, getPageCount() - 1));
}

function getVisibleBars() {
  const start = state.currentPage * state.barsPerPage;
  return state.bars.slice(start, start + state.barsPerPage);
}

function getPageForBar(barIndex) {
  return Math.max(0, Math.floor(barIndex / state.barsPerPage));
}

function setPage(pageIndex) {
  const nextPage = Math.max(0, Math.min(pageIndex, getPageCount() - 1));
  if (nextPage === state.currentPage) {
    renderStats();
    return;
  }
  state.currentPage = nextPage;
  renderJianpu();
  renderStaff();
  renderStats();
}

function renderJianpu() {
  els.jianpu.innerHTML = "";
  const row = document.createElement("div");
  row.className = "bar-row";

  getVisibleBars().forEach((barData) => {
    const barEl = document.createElement("div");
    barEl.className = "bar";

    const label = document.createElement("div");
    label.className = "bar-number";
    label.textContent = String(barData.index + 1).padStart(2, "0");
    barEl.appendChild(label);

    barData.notes.forEach((note) => {
      const noteEl = document.createElement("span");
      noteEl.className = `jianpu-note${note.rest ? " rest" : ""}${state.activeId === note.id ? " active" : ""}`;
      noteEl.dataset.noteId = note.id;
      noteEl.textContent = note.rest ? "0" : note.degreeText;
      noteEl.title = note.rest ? "休止" : midiName(displayPitch(note.pitch));
      noteEl.addEventListener("click", () => audition(note));
      barEl.appendChild(noteEl);
    });

    row.appendChild(barEl);
  });

  if (!state.notes.length) {
    const empty = document.createElement("div");
    empty.className = "parse-status";
    empty.textContent = "等待输入";
    row.appendChild(empty);
  }

  els.jianpu.appendChild(row);
}

function renderStaff() {
  const visibleBars = getVisibleBars();
  const visibleNotes = visibleBars.flatMap((barData) => barData.notes);
  const width = Math.max(760, visibleNotes.length * 46 + 180);
  const measuresPerLine = Math.min(4, Math.max(1, state.barsPerPage));
  const totalLines = Math.max(1, Math.ceil(Math.max(1, visibleBars.length) / measuresPerLine));
  const height = Math.max(270, totalLines * 150 + 76);
  const svg = createSvg("svg", {
    class: "staff-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
  });

  const lineGap = 148;
  const staffTop = 64;
  const left = 54;
  const staffGap = 10;
  const measureWidth = Math.max(170, (width - left - 36) / measuresPerLine);

  for (let line = 0; line < totalLines; line += 1) {
    const y = staffTop + line * lineGap;
    drawStaffLines(svg, left, width - 28, y, staffGap);
    const clef = createSvg("text", {
      x: 18,
      y: y + 34,
      class: "staff-label",
    });
    clef.textContent = "G";
    svg.appendChild(clef);
  }

  visibleBars.forEach((barData, pageBarIndex) => {
    const line = Math.floor(pageBarIndex / measuresPerLine);
    const col = pageBarIndex % measuresPerLine;
    const x0 = left + col * measureWidth;
    const y = staffTop + line * lineGap;
    const x1 = x0 + measureWidth;
    svg.appendChild(createSvg("line", { x1: x0, y1: y, x2: x0, y2: y + 40, class: "measure-line" }));
    svg.appendChild(createSvg("line", { x1, y1: y, x2: x1, y2: y + 40, class: "measure-line" }));

    const label = createSvg("text", { x: x0 + 6, y: y - 10, class: "measure-label" });
    label.textContent = String(barData.index + 1);
    svg.appendChild(label);

    const usable = Math.max(120, measureWidth - 32);
    const barLength = Math.max(BEATS_PER_BAR, getBarLength(barData));
    barData.notes.forEach((note) => {
      const x = x0 + 18 + (usable * note.localStart) / barLength;
      drawStaffNote(svg, note, x, y, staffGap);
    });
  });

  els.staff.innerHTML = "";
  els.staff.appendChild(svg);
}

function getBarLength(barData) {
  return barData.notes.reduce((max, note) => Math.max(max, note.localStart + note.duration), BEATS_PER_BAR);
}

function drawStaffLines(svg, x1, x2, y, gap) {
  for (let i = 0; i < 5; i += 1) {
    svg.appendChild(
      createSvg("line", {
        x1,
        y1: y + i * gap,
        x2,
        y2: y + i * gap,
        class: "staff-line",
      }),
    );
  }
}

function drawStaffNote(svg, note, x, staffY, gap) {
  const active = state.activeId === note.id ? " active" : "";
  if (note.rest) {
    const rest = createSvg("text", {
      x: x - 5,
      y: staffY + 25,
      class: `rest-mark${active}`,
      "data-note-id": note.id,
    });
    rest.textContent = "𝄽";
    svg.appendChild(rest);
    return;
  }

  const pitch = displayPitch(note.pitch);
  const y = staffY + pitchToStaffOffset(pitch) * (gap / 2);
  drawLedgerLines(svg, x, y, staffY, gap);
  svg.appendChild(
    createSvg("ellipse", {
      cx: x,
      cy: y,
      rx: 7,
      ry: 5,
      transform: `rotate(-18 ${x} ${y})`,
      class: `note-head${active}`,
      "data-note-id": note.id,
    }),
  );

  if (note.duration <= 1.5) {
    const stemUp = y > staffY + 20;
    svg.appendChild(
      createSvg("line", {
        x1: stemUp ? x + 6 : x - 6,
        y1: y,
        x2: stemUp ? x + 6 : x - 6,
        y2: stemUp ? y - 34 : y + 34,
        class: "stem",
      }),
    );
  }
}

function drawLedgerLines(svg, x, y, staffY, gap) {
  const top = staffY;
  const bottom = staffY + 4 * gap;
  if (y < top) {
    for (let ly = top - gap; ly >= y - 1; ly -= gap) {
      svg.appendChild(createSvg("line", { x1: x - 11, y1: ly, x2: x + 11, y2: ly, class: "ledger" }));
    }
  }
  if (y > bottom) {
    for (let ly = bottom + gap; ly <= y + 1; ly += gap) {
      svg.appendChild(createSvg("line", { x1: x - 11, y1: ly, x2: x + 11, y2: ly, class: "ledger" }));
    }
  }
}

function pitchToStaffOffset(midi) {
  const letterIndex = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  const diatonic = octave * 7 + letterIndex;
  const e4 = 4 * 7 + 2;
  return e4 - diatonic + 8;
}

function displayPitch(pitch) {
  if (pitch == null) {
    return null;
  }
  const inst = INSTRUMENTS[els.instrument.value] || INSTRUMENTS.piano;
  const octaveShift = els.octave.getAttribute("aria-pressed") === "true" ? -12 : 0;
  return pitch + inst.transpose + octaveShift;
}

function playbackPitch(pitch) {
  const octaveShift = els.octave.getAttribute("aria-pressed") === "true" ? -12 : 0;
  return pitch + octaveShift;
}

function renderStats() {
  const notes = state.notes.filter((note) => !note.rest);
  const inst = INSTRUMENTS[els.instrument.value] || INSTRUMENTS.piano;
  const totalBeats = state.notes.reduce((sum, note) => Math.max(sum, note.start + note.duration), 0);
  const noteCount = notes.length;
  const pageCount = getPageCount();
  els.status.textContent = `${noteCount} 个音 · ${state.bars.length} 小节 · ${pageCount} 页 · ${state.audioEngineLabel}`;
  els.meta.textContent = `1=${els.key.value} · ${inst.label}`;
  els.pageText.textContent = `${state.currentPage + 1} / ${pageCount}`;
  els.prevPage.disabled = state.currentPage <= 0;
  els.nextPage.disabled = state.currentPage >= pageCount - 1;
  els.tempoOutput.textContent = els.tempo.value;
  els.volumeOutput.textContent = els.volume.value;
  els.duration.textContent = `${totalBeats.toFixed(totalBeats % 1 ? 1 : 0)} 拍`;
  els.transpose.textContent = inst.transpose ? `谱面 +${inst.transpose}` : "原位";

  if (!notes.length) {
    els.range.textContent = "-";
    return;
  }

  const pitches = notes.map((note) => displayPitch(note.pitch));
  const low = Math.min(...pitches);
  const high = Math.max(...pitches);
  const out = pitches.some((pitch) => {
    const concertPitch = pitch - inst.transpose;
    return concertPitch < inst.range[0] || concertPitch > inst.range[1];
  });
  els.range.textContent = `${midiName(low)} - ${midiName(high)}${out ? " !" : ""}`;
  els.range.style.color = out ? "var(--warn)" : "inherit";
}

function createSvg(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function midiName(midi) {
  if (midi == null) {
    return "-";
  }
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function frequencyFromMidi(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function ensureAudio() {
  if (!state.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioCtx();
    state.masterGain = state.audioContext.createGain();
    const compressor = state.audioContext.createDynamicsCompressor();
    const dryGain = state.audioContext.createGain();
    const wetGain = state.audioContext.createGain();
    const reverb = state.audioContext.createConvolver();

    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;
    dryGain.gain.value = 0.88;
    wetGain.gain.value = 0.18;
    reverb.buffer = createReverbImpulse(state.audioContext, 1.4, 2.6);

    state.masterGain.connect(compressor);
    compressor.connect(dryGain).connect(state.audioContext.destination);
    compressor.connect(wetGain).connect(reverb).connect(state.audioContext.destination);
  }
  state.masterGain.gain.value = Number(els.volume.value) / 100;
  return state.audioContext;
}

function createReverbImpulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const fade = (1 - i / length) ** decay;
      data[i] = (Math.random() * 2 - 1) * fade;
    }
  }
  return impulse;
}

function getSoundfontPlayer() {
  if (state.soundfontPlayer) {
    return state.soundfontPlayer;
  }

  if (typeof window.WebAudioFontPlayer !== "function") {
    return null;
  }

  state.soundfontPlayer = new window.WebAudioFontPlayer();
  return state.soundfontPlayer;
}

function loadSamplePreset(ctx, inst) {
  const player = getSoundfontPlayer();
  if (!player || !inst.sample) {
    state.audioEngineLabel = "内置合成";
    return Promise.resolve(null);
  }

  const variable = inst.sample.variable;
  if (window[variable]) {
    player.loader.decodeAfterLoading(ctx, variable);
    state.audioEngineLabel = "采样音源";
    return Promise.resolve(window[variable]);
  }

  if (state.soundfontPromises.has(variable)) {
    return state.soundfontPromises.get(variable);
  }

  state.audioEngineLabel = "音色加载中";
  renderStats();

  const promise = new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const finish = (preset) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      state.audioEngineLabel = preset ? "采样音源" : "内置合成";
      renderStats();
      resolve(preset);
    };

    try {
      timeoutId = window.setTimeout(() => finish(null), 6500);
      player.loader.startLoad(ctx, inst.sample.path, variable);
      player.loader.waitLoad(() => {
        const preset = window[variable] || null;
        if (preset) {
          player.loader.decodeAfterLoading(ctx, variable);
        }
        finish(preset);
      });
    } catch (_error) {
      finish(null);
    }
  });

  state.soundfontPromises.set(variable, promise);
  return promise;
}

async function handlePlayButton() {
  if (state.playing && !state.paused) {
    await pausePlayback();
    return;
  }

  if (state.playing && state.paused) {
    await resumePlayback();
    return;
  }

  await startPlayback();
}

async function startPlayback() {
  stop(false);
  const playbackToken = state.playbackToken + 1;
  state.playbackToken = playbackToken;
  render();
  if (!state.notes.length) {
    return;
  }

  const ctx = ensureAudio();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const secondsPerBeat = 60 / Number(els.tempo.value);
  const endBeat = getEndBeat();
  const inst = INSTRUMENTS[els.instrument.value] || INSTRUMENTS.piano;
  const samplePreset = await loadSamplePreset(ctx, inst);
  if (playbackToken !== state.playbackToken) {
    return;
  }

  state.playing = true;
  state.paused = false;
  state.playStartTime = ctx.currentTime + 0.08;
  state.playEndTime = state.playStartTime + endBeat * secondsPerBeat;
  setPlayButton("pause");

  if (samplePreset) {
    playSampleSequence(ctx, samplePreset, state.notes, state.playStartTime, secondsPerBeat, inst);
  } else if (inst.family === "wind") {
    playWindSequence(ctx, state.notes, state.playStartTime, secondsPerBeat);
  } else {
    state.notes.forEach((note, index) => {
      if (!note.rest) {
        const next = findNextNote(index);
        const hasGap = !next || next.start > note.start + note.duration + 0.01;
        playNote(ctx, playbackPitch(note.pitch), state.playStartTime + note.start * secondsPerBeat, note.duration * secondsPerBeat, {
          hasGap,
        });
      }
    });
  }

  startVisualClock();
}

async function pausePlayback() {
  if (!state.audioContext || !state.playing) {
    return;
  }
  await state.audioContext.suspend();
  state.paused = true;
  setPlayButton("resume");
}

async function resumePlayback() {
  if (!state.audioContext || !state.playing) {
    return;
  }
  await state.audioContext.resume();
  state.paused = false;
  setPlayButton("pause");
}

function stop(clearActive = true) {
  state.playbackToken += 1;
  if (state.visualTimer) {
    window.clearInterval(state.visualTimer);
    state.visualTimer = null;
  }

  state.sources.forEach((source) => {
    try {
      if (source.stop) {
        source.stop(0);
      }
    } catch (_error) {
      // The node may have already ended.
    }
    try {
      if (source.disconnect) {
        source.disconnect();
      }
    } catch (_error) {
      // Some browser nodes are already disconnected after stop.
    }
  });
  state.sources = [];
  state.sampleEnvelopes.forEach((envelope) => {
    try {
      envelope.cancel?.();
    } catch (_error) {
      // Some WebAudioFont envelopes are already released.
    }
  });
  state.sampleEnvelopes = [];

  state.playing = false;
  state.paused = false;
  setPlayButton("play");
  if (clearActive) {
    setActive(null);
  }
}

function setPlayButton(mode) {
  if (mode === "pause") {
    els.play.innerHTML = '<span aria-hidden="true">Ⅱ</span><span>暂停</span>';
  } else if (mode === "resume") {
    els.play.innerHTML = '<span aria-hidden="true">▶</span><span>继续</span>';
  } else {
    els.play.innerHTML = '<span aria-hidden="true">▶</span><span>播放</span>';
  }
}

function getEndBeat() {
  return state.notes.reduce((sum, note) => Math.max(sum, note.start + note.duration), 0);
}

function findNextNote(index) {
  for (let i = index + 1; i < state.notes.length; i += 1) {
    if (!state.notes[i].rest) {
      return state.notes[i];
    }
  }
  return null;
}

function findPreviousNote(index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!state.notes[i].rest) {
      return state.notes[i];
    }
  }
  return null;
}

function startVisualClock() {
  if (state.visualTimer) {
    window.clearInterval(state.visualTimer);
  }
  state.visualTimer = window.setInterval(updateVisualClock, 45);
}

function updateVisualClock() {
  if (!state.playing || !state.audioContext) {
    return;
  }

  const secondsPerBeat = 60 / Number(els.tempo.value);
  const beat = (state.audioContext.currentTime - state.playStartTime) / secondsPerBeat;
  const active = state.notes.find((note) => beat >= note.start && beat < note.start + note.duration);
  setActive(active ? active.id : null);

  if (state.audioContext.currentTime >= state.playEndTime + 0.06) {
    if (els.loop.getAttribute("aria-pressed") === "true") {
      startPlayback();
    } else {
      stop();
    }
  }
}

function setActive(id) {
  if (state.activeId === id) {
    return;
  }

  let pageChanged = false;
  if (id != null) {
    const note = state.notes.find((item) => item.id === id);
    if (note) {
      const targetPage = getPageForBar(note.bar);
      if (targetPage !== state.currentPage) {
        state.currentPage = targetPage;
        pageChanged = true;
      }
    }
  }

  state.activeId = id;
  document
    .querySelectorAll(".jianpu-note.active, .note-head.active, .rest-mark.active")
    .forEach((node) => node.classList.remove("active"));

  if (pageChanged) {
    renderJianpu();
  }
  renderStaff();
  if (pageChanged) {
    renderStats();
  }
  if (id != null) {
    document.querySelectorAll(`[data-note-id="${id}"]`).forEach((node) => node.classList.add("active"));
  }
}

async function audition(note) {
  if (note.rest) {
    return;
  }
  const ctx = ensureAudio();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const inst = INSTRUMENTS[els.instrument.value] || INSTRUMENTS.piano;
  const preset = await loadSamplePreset(ctx, inst);
  if (preset) {
    const envelope = getSoundfontPlayer().queueWaveTable(
      ctx,
      createInstrumentBus(ctx, inst, ctx.currentTime + 0.02, 1.1),
      preset,
      ctx.currentTime + 0.02,
      playbackPitch(note.pitch),
      0.72,
      inst.sample?.volume ?? 0.75,
    );
    if (envelope) {
      state.sampleEnvelopes.push(envelope);
    }
  } else {
    playNote(ctx, playbackPitch(note.pitch), ctx.currentTime + 0.02, 0.62, { hasGap: true });
  }
  setActive(note.id);
  window.setTimeout(() => setActive(null), 650);
}

function createInstrumentBus(ctx, inst, start, duration) {
  const input = ctx.createGain();
  const highpass = ctx.createBiquadFilter();
  const lowpass = ctx.createBiquadFilter();
  const body = ctx.createBiquadFilter();
  const output = ctx.createGain();

  highpass.type = "highpass";
  lowpass.type = "lowpass";
  body.type = "peaking";

  if (inst.family === "wind") {
    highpass.frequency.value = 130;
    lowpass.frequency.value = inst === INSTRUMENTS.trumpet ? 3800 : 2850;
    lowpass.Q.value = 0.72;
    body.frequency.value = inst === INSTRUMENTS.trumpet ? 1250 : 760;
    body.Q.value = 0.75;
    body.gain.value = inst === INSTRUMENTS.trumpet ? 1.2 : 2.4;
    output.gain.value = 0.94;
  } else if (inst.family === "pluck") {
    highpass.frequency.value = inst === INSTRUMENTS.bass ? 35 : 75;
    lowpass.frequency.value = inst === INSTRUMENTS.bass ? 2200 : 5200;
    lowpass.Q.value = 0.65;
    body.frequency.value = inst === INSTRUMENTS.bass ? 120 : 900;
    body.Q.value = 0.8;
    body.gain.value = inst === INSTRUMENTS.bass ? 2.2 : 1.1;
    output.gain.value = 0.9;
  } else {
    highpass.frequency.value = 35;
    lowpass.frequency.value = 7600;
    lowpass.Q.value = 0.55;
    body.frequency.value = 340;
    body.Q.value = 0.6;
    body.gain.value = 0.8;
    output.gain.value = 0.86;
  }

  input.connect(highpass).connect(body).connect(lowpass).connect(output).connect(state.masterGain);
  window.setTimeout(() => {
    [input, highpass, body, lowpass, output].forEach((node) => {
      try {
        node.disconnect();
      } catch (_error) {
        // The graph may already be disconnected after stopping playback.
      }
    });
  }, Math.max(0, (start + duration - ctx.currentTime) * 1000 + 250));
  return input;
}

function playSampleSequence(ctx, preset, notes, startTime, secondsPerBeat, inst) {
  const player = getSoundfontPlayer();
  if (!player) {
    return;
  }

  notes.forEach((note, index) => {
    if (note.rest) {
      return;
    }

    const next = findNextNote(index);
    const previous = findPreviousNote(index);
    const hasGapBefore = !previous || previous.start + previous.duration < note.start - 0.01;
    const hasGapAfter = !next || next.start > note.start + note.duration + 0.01;
    const earlyStart = inst.family === "wind" && !hasGapBefore ? Math.min(0.035, secondsPerBeat * 0.08) : 0;
    const start = startTime + note.start * secondsPerBeat - earlyStart;
    const baseDuration = note.duration * secondsPerBeat;
    const overlap = inst.family === "wind" && !hasGapAfter ? Math.min(0.16, secondsPerBeat * 0.26) : 0;
    const releaseTail = inst.family === "pluck" ? 0.055 : 0.035;
    const duration = Math.max(0.06, baseDuration + earlyStart + overlap + releaseTail);
    const volume = inst.sample?.volume ?? 0.75;
    const envelope = player.queueWaveTable(
      ctx,
      createInstrumentBus(ctx, inst, start, duration + 0.8),
      preset,
      start,
      playbackPitch(note.pitch),
      duration,
      volume,
    );

    if (envelope) {
      state.sampleEnvelopes.push(envelope);
    }
  });

  if (inst.family === "wind") {
    playWindSequence(ctx, notes, startTime, secondsPerBeat, {
      toneLevel: inst.sample?.glue ?? 0.06,
      noiseLevel: 0.0028,
      filterFrequency: inst === INSTRUMENTS.trumpet ? 1650 : 1180,
      vibratoDepth: inst === INSTRUMENTS.trumpet ? 2.1 : 2.7,
      softAttack: true,
    });
  }
}

function playWindSequence(ctx, notes, startTime, secondsPerBeat, options = {}) {
  const main = ctx.createOscillator();
  const round = ctx.createOscillator();
  const vibrato = ctx.createOscillator();
  const vibratoGain = ctx.createGain();
  const mainMix = ctx.createGain();
  const roundMix = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const toneGain = ctx.createGain();
  const noise = createNoiseSource(ctx);
  const noiseFilter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();

  main.type = "sawtooth";
  round.type = "triangle";
  vibrato.type = "sine";
  vibrato.frequency.value = 5.1;
  vibratoGain.gain.value = options.vibratoDepth ?? 3.2;
  mainMix.gain.value = 0.38;
  roundMix.gain.value = 0.24;
  filter.type = "lowpass";
  filter.frequency.value = options.filterFrequency ?? 1250;
  filter.Q.value = 5.5;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 1150;
  noiseFilter.Q.value = 0.9;

  toneGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.setValueAtTime(0.0001, startTime);

  vibrato.connect(vibratoGain);
  vibratoGain.connect(main.frequency);
  vibratoGain.connect(round.frequency);
  main.connect(mainMix).connect(filter);
  round.connect(roundMix).connect(filter);
  filter.connect(toneGain).connect(state.masterGain);
  noise.connect(noiseFilter).connect(noiseGain).connect(state.masterGain);

  const playable = notes.filter((note) => !note.rest);
  const toneLevel = options.toneLevel ?? 0.22;
  const noiseLevel = options.noiseLevel ?? 0.018;
  const attackTime = options.softAttack ? 0.075 : 0.055;
  const bendTime = options.softAttack ? 0.032 : 0.018;
  playable.forEach((note, index) => {
    const t = startTime + note.start * secondsPerBeat;
    const end = t + note.duration * secondsPerBeat;
    const pitch = playbackPitch(note.pitch);
    const freq = frequencyFromMidi(pitch);
    const previous = playable[index - 1];
    const next = playable[index + 1];
    const hasGapBefore = !previous || previous.start + previous.duration < note.start - 0.01;
    const hasGapAfter = !next || next.start > note.start + note.duration + 0.01;
    const repeated = previous && previous.pitch === note.pitch && !hasGapBefore;

    if (index === 0) {
      main.frequency.setValueAtTime(freq, t);
      round.frequency.setValueAtTime(freq * 0.997, t);
    } else {
      main.frequency.setTargetAtTime(freq, t, bendTime);
      round.frequency.setTargetAtTime(freq * 0.997, t, bendTime);
    }

    if (hasGapBefore) {
      toneGain.gain.setValueAtTime(0.0001, Math.max(startTime, t - 0.01));
      noiseGain.gain.setValueAtTime(0.0001, Math.max(startTime, t - 0.01));
      toneGain.gain.exponentialRampToValueAtTime(toneLevel, t + attackTime);
      noiseGain.gain.exponentialRampToValueAtTime(noiseLevel, t + Math.max(0.04, attackTime * 0.72));
    } else if (repeated) {
      toneGain.gain.setTargetAtTime(toneLevel * 0.58, t, 0.015);
      toneGain.gain.setTargetAtTime(toneLevel, t + 0.035, 0.02);
    }

    if (hasGapAfter) {
      toneGain.gain.setTargetAtTime(0.0001, end, 0.08);
      noiseGain.gain.setTargetAtTime(0.0001, end, 0.06);
    } else {
      toneGain.gain.setValueAtTime(toneLevel * 0.96, Math.max(t + 0.06, end - 0.02));
      noiseGain.gain.setValueAtTime(noiseLevel * 0.72, Math.max(t + 0.04, end - 0.02));
    }
  });

  const stopAt = state.playEndTime + 0.5;
  [main, round, vibrato, noise].forEach((source) => {
    source.start(startTime);
    source.stop(stopAt);
    registerSource(source);
  });
}

function createNoiseSource(ctx) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.7));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function playNote(ctx, midi, start, duration, options = {}) {
  const inst = INSTRUMENTS[els.instrument.value] || INSTRUMENTS.piano;
  if (inst.family === "pluck") {
    playPluck(ctx, midi, start, duration, els.instrument.value === "electricGuitar");
    return;
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = inst.wave === "sawtooth" ? 1800 : 3200;
  filter.Q.value = inst.wave === "sawtooth" ? 5 : 1.2;
  osc.type = inst.wave;
  osc.frequency.value = frequencyFromMidi(midi);

  const vol = inst.family === "wind" ? 0.22 : 0.28;
  const release = options.hasGap ? 0.08 : 0.035;
  const end = start + Math.max(0.03, duration + (options.hasGap ? 0 : 0.025));
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.035);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.05, vol * 0.68), start + Math.max(0.08, duration * 0.55));
  gain.gain.setTargetAtTime(0.0001, end, release);

  osc.connect(filter).connect(gain).connect(state.masterGain);
  osc.start(start);
  osc.stop(end + release + 0.05);
  registerSource(osc);
}

function playPluck(ctx, midi, start, duration, electric) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = electric ? "sawtooth" : "triangle";
  osc.frequency.value = frequencyFromMidi(midi);
  filter.type = electric ? "bandpass" : "lowpass";
  filter.frequency.value = electric ? 1800 : 2600;
  filter.Q.value = electric ? 8 : 1.5;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(electric ? 0.24 : 0.32, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.min(duration, 1.2));
  osc.connect(filter).connect(gain).connect(state.masterGain);
  osc.start(start);
  osc.stop(start + duration + 0.04);
  registerSource(osc);
}

function registerSource(source) {
  state.sources.push(source);
  source.addEventListener?.("ended", () => {
    state.sources = state.sources.filter((item) => item !== source);
  });
}

function exportMidi() {
  render();
  const inst = INSTRUMENTS[els.instrument.value] || INSTRUMENTS.piano;
  const ppq = 480;
  const bpm = Number(els.tempo.value);
  const tempo = Math.round(60000000 / bpm);
  const events = [];

  events.push({ tick: 0, bytes: [0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] });
  events.push({ tick: 0, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] });
  events.push({ tick: 0, bytes: [0xc0, inst.program] });

  state.notes.forEach((note) => {
    if (note.rest) {
      return;
    }
    const start = Math.round(note.start * ppq);
    const end = Math.round((note.start + note.duration * 0.96) * ppq);
    const pitch = Math.max(0, Math.min(127, playbackPitch(note.pitch)));
    events.push({ tick: start, bytes: [0x90, pitch, 96] });
    events.push({ tick: end, bytes: [0x80, pitch, 0] });
  });

  const bytes = buildMidi(events, ppq);
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quick-score-studio.mid";
  link.click();
  URL.revokeObjectURL(url);
}

function buildMidi(events, ppq) {
  const sorted = events.sort((a, b) => a.tick - b.tick);
  const track = [];
  let lastTick = 0;
  sorted.forEach((event) => {
    track.push(...vlq(event.tick - lastTick), ...event.bytes);
    lastTick = event.tick;
  });
  track.push(0x00, 0xff, 0x2f, 0x00);
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 255, ppq & 255];
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, ...uint32(track.length)];
  return new Uint8Array([...header, ...trackHeader, ...track]);
}

function vlq(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
  return bytes;
}

function uint32(value) {
  return [(value >> 24) & 255, (value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function bindEvents() {
  els.input.addEventListener("input", render);
  els.key.addEventListener("change", render);
  els.instrument.addEventListener("change", render);
  els.tempo.addEventListener("input", renderStats);
  els.volume.addEventListener("input", renderStats);
  els.play.addEventListener("click", handlePlayButton);
  els.stop.addEventListener("click", () => stop());
  els.export.addEventListener("click", exportMidi);
  els.sample.addEventListener("click", () => {
    els.input.value = SAMPLE;
    state.currentPage = 0;
    render();
  });
  els.prevPage.addEventListener("click", () => setPage(state.currentPage - 1));
  els.nextPage.addEventListener("click", () => setPage(state.currentPage + 1));
  els.barsPerPage.addEventListener("change", () => {
    const currentBar = state.currentPage * state.barsPerPage;
    state.barsPerPage = Number(els.barsPerPage.value) || 4;
    state.currentPage = Math.floor(currentBar / state.barsPerPage);
    clampCurrentPage();
    renderJianpu();
    renderStaff();
    renderStats();
  });
  els.loop.addEventListener("click", () => togglePressed(els.loop));
  els.octave.addEventListener("click", () => {
    togglePressed(els.octave);
    render();
  });
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.currentView = tab.dataset.view;
      els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
      els.scorePane.classList.toggle("view-jianpu", state.currentView === "jianpu");
      els.scorePane.classList.toggle("view-staff", state.currentView === "staff");
    });
  });
}

function togglePressed(button) {
  const pressed = button.getAttribute("aria-pressed") === "true";
  button.setAttribute("aria-pressed", String(!pressed));
}

els.input.value = SAMPLE;
bindEvents();
render();
