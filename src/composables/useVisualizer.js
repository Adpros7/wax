// Audio-reactive visualizer. Reads frequency data from the main <audio>
// element and drives every `.eq.is-playing` SVG on the page (track rows
// + queue panel). Same algorithm as legacy public/js/visualizer.js.
import { reactive, watch } from 'vue';
import { usePlayerStore } from '@/stores/player';

const viz = reactive({
  ctx: null,
  analyser: null,
  bass: null,
  mid: null,
  treble: null,
  dataArray: null,
  running: false,
  frame: null,
});

function init() {
  if (viz.ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    viz.ctx = new Ctx();
    const player = usePlayerStore();
    if (!player.audioEl) return;
    const source = viz.ctx.createMediaElementSource(player.audioEl);
    viz.analyser = viz.ctx.createAnalyser();
    viz.analyser.fftSize = 64;
    viz.analyser.smoothingTimeConstant = 0.55;
    // EQ: bass (lowshelf 100Hz) → mid (peaking 1kHz) → treble (highshelf 3kHz)
    viz.bass = viz.ctx.createBiquadFilter();
    viz.bass.type = 'lowshelf';
    viz.bass.frequency.value = 100;
    viz.mid = viz.ctx.createBiquadFilter();
    viz.mid.type = 'peaking';
    viz.mid.frequency.value = 1000;
    viz.mid.Q.value = 1;
    viz.treble = viz.ctx.createBiquadFilter();
    viz.treble.type = 'highshelf';
    viz.treble.frequency.value = 3000;
    source.connect(viz.bass);
    viz.bass.connect(viz.mid);
    viz.mid.connect(viz.treble);
    viz.treble.connect(viz.analyser);
    viz.analyser.connect(viz.ctx.destination);
    viz.dataArray = new Uint8Array(viz.analyser.frequencyBinCount);
  } catch {
    /* not all browsers */
  }
}

export function startVisualizer() {
  init();
  if (!viz.analyser) return;
  if (viz.ctx.state === 'suspended') viz.ctx.resume();
  if (viz.running) return;
  viz.running = true;
  document.body.classList.add('viz-running');
  const bins = viz.dataArray;
  const total = bins.length;
  const third = Math.floor(total / 3);
  // sqrt curve amplifies quiet/mid amplitudes so the bars feel more alive.
  const minS = 0.08;
  const gain = 1.4;
  const norm = (sum, count) => {
    const v = sum / count / 255;
    return Math.min(1, Math.pow(v, 0.55) * gain);
  };
  const draw = () => {
    if (!viz.running) return;
    viz.frame = requestAnimationFrame(draw);
    viz.analyser.getByteFrequencyData(bins);
    let low = 0, mid = 0, high = 0;
    for (let i = 0; i < third; i++) low += bins[i];
    for (let i = third; i < third * 2; i++) mid += bins[i];
    for (let i = third * 2; i < total; i++) high += bins[i];
    const ls = minS + norm(low, third) * (1 - minS);
    const ms = minS + norm(mid, third) * (1 - minS);
    const hs = minS + norm(high, total - third * 2) * (1 - minS);
    document.querySelectorAll('.eq.is-playing').forEach((eq) => {
      const rects = eq.querySelectorAll('rect');
      if (rects[0]) rects[0].style.transform = `scaleY(${ls})`;
      if (rects[1]) rects[1].style.transform = `scaleY(${ms})`;
      if (rects[2]) rects[2].style.transform = `scaleY(${hs})`;
    });
  };
  draw();
}

export function stopVisualizer() {
  viz.running = false;
  if (viz.frame) cancelAnimationFrame(viz.frame);
  document.body.classList.remove('viz-running');
  document.querySelectorAll('.eq rect').forEach((r) => (r.style.transform = ''));
}

export function setEq(bass, mid, treble) {
  if (viz.bass) viz.bass.gain.value = bass;
  if (viz.mid) viz.mid.gain.value = mid;
  if (viz.treble) viz.treble.gain.value = treble;
}

// Auto-start/stop in lockstep with playing state.
export function useVisualizer() {
  const player = usePlayerStore();
  watch(
    () => player.playing,
    (playing) => {
      if (playing) startVisualizer();
      else stopVisualizer();
    },
  );
}
