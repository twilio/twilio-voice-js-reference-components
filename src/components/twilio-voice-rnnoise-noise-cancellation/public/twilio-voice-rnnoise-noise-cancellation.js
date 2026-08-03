import {
  loadRnnoise,
  RnnoiseWorkletNode,
} from '/twilio-voice-rnnoise-noise-cancellation/web-noise-suppressor/index.js';

const BASE = '/twilio-voice-rnnoise-noise-cancellation/web-noise-suppressor';

// The RNNoise WASM binary is fetched once and shared by every processor. Clearing
// the cache on failure lets a later toggle retry instead of staying broken until a
// page reload.
let wasmBinaryPromise;

function loadRnnoiseOnce() {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = loadRnnoise({
      url: `${BASE}/rnnoise.wasm`,
      simdUrl: `${BASE}/rnnoise_simd.wasm`,
    }).catch((error) => {
      wasmBinaryPromise = undefined;
      throw error;
    });
  }
  return wasmBinaryPromise;
}

// The worklet module only needs to be registered once per AudioContext.
const workletAddedFor = new WeakSet();

/**
 * Implements the Voice SDK's AudioProcessor interface. The SDK calls
 * createProcessedStream whenever the underlying input/output stream is
 * (re)initialized, and destroyProcessedStream once it is torn down. One
 * instance is used per direction (local mic / remote output).
 *
 * Audio graph:
 *   stream -> MediaStreamAudioSourceNode -> RnnoiseWorkletNode
 *          -> MediaStreamAudioDestinationNode -> processed MediaStream
 */
class RnnoiseProcessor {
  #ctx;
  #isRemote;
  #source;
  #node;
  #destination;
  #sink;

  constructor(audioContext, isRemote) {
    this.#ctx = audioContext;
    this.#isRemote = isRemote;
  }

  async createProcessedStream(stream) {
    // The SDK may call this repeatedly without an intervening destroy; tear down
    // the previous graph first so we don't leak worklet nodes / RNNoise WASM heap.
    await this.destroyProcessedStream();

    const wasmBinary = await loadRnnoiseOnce();

    if (!workletAddedFor.has(this.#ctx)) {
      await this.#ctx.audioWorklet.addModule(`${BASE}/rnnoise/workletProcessor.js`);
      workletAddedFor.add(this.#ctx);
    }

    // Chrome produces no Web Audio samples from a remote WebRTC track unless the
    // stream is also sunk to a media element (the mic path pumps on its own).
    if (this.#isRemote) {
      this.#sink = new Audio();
      this.#sink.srcObject = stream;
      this.#sink.muted = true;
      this.#sink
        .play()
        .catch((error) => console.warn('RNNoise inbound sink autoplay was blocked:', error));
    }

    this.#source = new MediaStreamAudioSourceNode(this.#ctx, { mediaStream: stream });
    // Calls are mono, so a single channel is all RNNoise needs to process.
    this.#node = new RnnoiseWorkletNode(this.#ctx, { wasmBinary, maxChannels: 1 });
    this.#destination = this.#ctx.createMediaStreamDestination();

    this.#source.connect(this.#node).connect(this.#destination);
    return this.#destination.stream;
  }

  async destroyProcessedStream() {
    this.#source?.disconnect();
    this.#node?.disconnect();
    this.#destination?.disconnect();
    // Frees the RNNoise WASM state held by the worklet.
    this.#node?.destroy();
    if (this.#sink) {
      this.#sink.pause();
      this.#sink.srcObject = null;
      this.#sink = null;
    }
    this.#source = this.#node = this.#destination = null;
  }
}

class TwilioVoiceRnnoiseNoiseCancellation extends HTMLElement {
  #device;
  #audioContext;
  #localProcessor;
  #remoteProcessor;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();

    const twilioVoiceDialer = this.shadowRoot.host.parentElement;
    twilioVoiceDialer.addEventListener('device', (e) => {
      this.#device = e.detail.device;
    });

    this.shadowRoot
      .querySelector('#denoise-local-checkbox')
      .addEventListener('change', (e) => this.#onLocalChange(e.target.checked));
    this.shadowRoot
      .querySelector('#denoise-remote-checkbox')
      .addEventListener('change', (e) => this.#onRemoteChange(e.target.checked));
  }

  // One AudioContext is shared by both processors. Constructed lazily on the
  // first toggle so it begins inside a user gesture. RNNoise expects 48 kHz.
  #getAudioContext() {
    this.#audioContext ??= new AudioContext({ sampleRate: 48000 });
    return this.#audioContext;
  }

  #setChecked(selector, checked) {
    const checkbox = this.shadowRoot.querySelector(selector);
    if (checkbox) checkbox.checked = checked;
  }

  async #onLocalChange(on) {
    if (!this.#device) {
      console.warn('Device not ready yet.');
      this.#setChecked('#denoise-local-checkbox', false);
      return;
    }
    try {
      this.#localProcessor ??= new RnnoiseProcessor(this.#getAudioContext(), false);
      if (on) {
        // Pre-warm the WASM so a load failure surfaces here (and reverts the
        // checkbox below) instead of only as a swallowed async rejection later.
        await loadRnnoiseOnce();
        // Disable the browser's own NS/AGC only while denoising the mic, so they
        // don't run in series with RNNoise. Reverted when denoise is turned off.
        await this.#device.audio.setAudioConstraints({ noiseSuppression: false, autoGainControl: false });
        await this.#device.audio.addProcessor(this.#localProcessor, false);
      } else {
        await this.#device.audio.unsetAudioConstraints();
        await this.#device.audio.removeProcessor(this.#localProcessor, false);
      }
    } catch (error) {
      console.error('Failed to toggle local noise cancellation:', error);
      // The toggle didn't take effect; don't let the checkbox misrepresent state.
      this.#setChecked('#denoise-local-checkbox', !on);
    }
  }

  async #onRemoteChange(on) {
    if (!this.#device) {
      console.warn('Device not ready yet.');
      this.#setChecked('#denoise-remote-checkbox', false);
      return;
    }
    try {
      this.#remoteProcessor ??= new RnnoiseProcessor(this.#getAudioContext(), true);
      if (on) {
        // Pre-warm the WASM so a load failure surfaces here (and reverts the
        // checkbox below) instead of only as a swallowed async rejection later.
        await loadRnnoiseOnce();
        await this.#device.audio.addProcessor(this.#remoteProcessor, true);
      } else {
        await this.#device.audio.removeProcessor(this.#remoteProcessor, true);
      }
    } catch (error) {
      console.error('Failed to toggle remote noise cancellation:', error);
      // The toggle didn't take effect; don't let the checkbox misrepresent state.
      this.#setChecked('#denoise-remote-checkbox', !on);
    }
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div id="noise-cancellation">
        <label>
          <input type="checkbox" id="denoise-local-checkbox" /> Denoise microphone
        </label>
        <label>
          <input type="checkbox" id="denoise-remote-checkbox" /> Denoise incoming audio
        </label>
      </div>
    `;
  }
}

customElements.define(
  'twilio-voice-rnnoise-noise-cancellation',
  TwilioVoiceRnnoiseNoiseCancellation
);
