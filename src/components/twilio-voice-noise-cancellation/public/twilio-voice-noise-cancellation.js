import {
  loadRnnoise,
  RnnoiseWorkletNode,
} from '/twilio-voice-noise-cancellation/web-noise-suppressor/index.js';

const BASE = '/twilio-voice-noise-cancellation/web-noise-suppressor';

// The RNNoise WASM binary is fetched once and shared by every processor.
let wasmBinaryPromise;

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
  #source;
  #node;
  #destination;

  constructor(audioContext) {
    this.#ctx = audioContext;
  }

  async createProcessedStream(stream) {
    wasmBinaryPromise ??= loadRnnoise({
      url: `${BASE}/rnnoise.wasm`,
      simdUrl: `${BASE}/rnnoise_simd.wasm`,
    });
    const wasmBinary = await wasmBinaryPromise;

    if (!workletAddedFor.has(this.#ctx)) {
      await this.#ctx.audioWorklet.addModule(`${BASE}/rnnoise/workletProcessor.js`);
      workletAddedFor.add(this.#ctx);
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
    this.#source = this.#node = this.#destination = null;
  }
}

class TwilioVoiceNoiseCancellation extends HTMLElement {
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
      .querySelector('#denoise-local')
      .addEventListener('change', (e) => this.#toggleLocal(e.target.checked));
    this.shadowRoot
      .querySelector('#denoise-remote')
      .addEventListener('change', (e) => this.#toggleRemote(e.target.checked));
  }

  // One AudioContext is shared by both processors. Constructed lazily on the
  // first toggle so it begins inside a user gesture. RNNoise expects 48 kHz.
  #getAudioContext() {
    this.#audioContext ??= new AudioContext({ sampleRate: 48000 });
    return this.#audioContext;
  }

  async #toggleLocal(on) {
    if (!this.#device) {
      console.warn('Device not ready yet.');
      return;
    }
    try {
      this.#localProcessor ??= new RnnoiseProcessor(this.#getAudioContext());
      if (on) {
        await this.#device.audio.addProcessor(this.#localProcessor, false);
      } else {
        await this.#device.audio.removeProcessor(this.#localProcessor, false);
      }
    } catch (error) {
      console.error('Failed to toggle local noise cancellation:', error);
    }
  }

  async #toggleRemote(on) {
    if (!this.#device) {
      console.warn('Device not ready yet.');
      return;
    }
    try {
      this.#remoteProcessor ??= new RnnoiseProcessor(this.#getAudioContext());
      if (on) {
        await this.#device.audio.addProcessor(this.#remoteProcessor, true);
      } else {
        await this.#device.audio.removeProcessor(this.#remoteProcessor, true);
      }
    } catch (error) {
      console.error('Failed to toggle remote noise cancellation:', error);
    }
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div id="noise-cancellation">
        <label>
          <input type="checkbox" id="denoise-local" /> Denoise microphone
        </label>
        <label>
          <input type="checkbox" id="denoise-remote" /> Denoise incoming audio
        </label>
      </div>
    `;
  }
}

customElements.define(
  'twilio-voice-noise-cancellation',
  TwilioVoiceNoiseCancellation
);
