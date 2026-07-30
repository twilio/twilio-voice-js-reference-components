const BASE = '/twilio-voice-krisp-noise-cancellation/krisp';

// The Krisp SDK is imported, constructed, and init()'d once, shared by every
// processor. Kept in a module-scoped promise so concurrent toggles await the
// same init; cleared on failure so a later toggle retries. The import is dynamic
// (not a top-level import) so that a missing SDK file (the Krisp assets are
// gitignored and user-provided) surfaces as a caught toggle error instead of
// failing this module at load time and leaving the custom element undefined.
let krispSdkPromise;

function getKrispSDK() {
  if (!krispSdkPromise) {
    krispSdkPromise = import(`${BASE}/krispsdk.mjs`)
      .then(({ default: KrispSDK }) => {
        if (!KrispSDK.isSupported()) {
          throw new Error('Krisp SDK is not supported in this browser.');
        }
        const sdk = new KrispSDK({
          params: {
            // Outbound (mic) runs at 48 kHz, so Krisp uses the full-band model.
            models: {
              modelNC: `${BASE}/models/krisp-nc-o-med-v7.kef`,
            },
            // Inbound (incoming) runs at 16 kHz, so Krisp uses the wideband
            // inbound model. The key must be model_inbound_16 (the SDK does not
            // recognize model16 here).
            inboundModels: {
              model_inbound_16: `${BASE}/models/krisp-nc-i-wb-pro-v3.kef`,
            },
          },
        });
        return sdk.init().then(() => sdk);
      })
      .catch((error) => {
        krispSdkPromise = undefined;
        throw error;
      });
  }
  return krispSdkPromise;
}

/**
 * Implements the Voice SDK's AudioProcessor interface. The SDK calls
 * createProcessedStream whenever the underlying input/output stream is
 * (re)initialized, and destroyProcessedStream once it is torn down. One
 * instance is used per direction (local mic / remote incoming).
 *
 * Krisp selects its model from the AudioContext sample rate and the isInbound
 * flag: the mic runs at 48 kHz with the full-band outbound model, and the
 * incoming audio runs at 16 kHz with Krisp's wideband inbound model (Krisp
 * ships no full-band inbound model). The incoming stream is also sunk to a
 * media element (see createProcessedStream), because a remote WebRTC track
 * otherwise yields no Web Audio samples in Chrome.
 *
 * Audio graph:
 *   stream -> MediaStreamAudioSourceNode -> Krisp AudioFilterNode
 *          -> MediaStreamAudioDestinationNode -> processed MediaStream
 */
class KrispProcessor {
  #ctx;
  #isInbound;
  #source;
  #node;
  #destination;
  #sink;

  constructor(isInbound) {
    this.#isInbound = isInbound;
    this.#ctx = new AudioContext({ sampleRate: isInbound ? 16000 : 48000 });
  }

  async createProcessedStream(stream) {
    // The SDK may call this repeatedly without an intervening destroy; tear down
    // the previous graph first so we don't leak filter nodes / Krisp workers.
    await this.destroyProcessedStream();

    const sdk = await getKrispSDK();

    // enableOnceReady lets the filter enable itself once its model has loaded, so
    // there's no ready callback to wire up. The rest is synchronous after the
    // awaits so a destroy that runs during setup can't null a field.
    this.#node = await sdk.createNoiseFilter({
      audioContext: this.#ctx,
      stream,
      isInbound: this.#isInbound,
      enableOnceReady: true,
    });
    // Model load / sample-rate failures are reported on the node (e.data.errorCode
    // is e.g. MODEL_URL_FETCH_ERROR / MODEL_LOAD_ERROR / SAMPLING_RATE_NOT_SUPPORTED),
    // not through this promise, so they never reach the toggle try/catch.
    this.#node.addEventListener('error', (e) => {
      const direction = this.#isInbound ? 'inbound' : 'outbound';
      console.error(
        `Krisp ${direction} noise filter error:`,
        e.data?.errorCode,
        e.data?.errorMessage,
      );
    });
    // Chrome produces no Web Audio samples from a remote WebRTC track unless the
    // stream is also sunk to a media element (the mic path pumps on its own), so
    // keep a muted `new Audio()` on the incoming stream alongside the source node.
    if (this.#isInbound) {
      this.#sink = new Audio();
      this.#sink.srcObject = stream;
      this.#sink.muted = true;
      this.#sink
        .play()
        .catch((error) => console.warn('Krisp inbound sink autoplay was blocked:', error));
    }
    this.#source = new MediaStreamAudioSourceNode(this.#ctx, { mediaStream: stream });
    this.#destination = this.#ctx.createMediaStreamDestination();

    this.#source.connect(this.#node).connect(this.#destination);
    return this.#destination.stream;
  }

  async destroyProcessedStream() {
    this.#source?.disconnect();
    this.#node?.disconnect();
    this.#destination?.disconnect();
    // Terminates the Krisp worker backing this filter node.
    await this.#node?.dispose();
    if (this.#sink) {
      this.#sink.pause();
      this.#sink.srcObject = null;
      this.#sink = null;
    }
    this.#source = this.#node = this.#destination = null;
  }
}

class TwilioVoiceKrispNoiseCancellation extends HTMLElement {
  #device;
  #localProcessor;
  #remoteProcessor;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();

    const twilioVoiceDialer = this.shadowRoot.host.parentElement;
    twilioVoiceDialer.addEventListener('device', (e) => {
      this.#device = e.detail.device;
      // Disable the browser's own noise suppression and gain control on the
      // outgoing mic so they don't run in series with Krisp (double-processing).
      // Applies to the input device only; the inbound path isn't from getUserMedia.
      this.#device.audio
        .setAudioConstraints({ noiseSuppression: false, autoGainControl: false })
        .catch((error) => console.error('Failed to set audio constraints:', error));
    });

    this.shadowRoot
      .querySelector('#denoise-local-checkbox')
      .addEventListener('change', (e) => this.#onLocalChange(e.target.checked));
    this.shadowRoot
      .querySelector('#denoise-remote-checkbox')
      .addEventListener('change', (e) => this.#onRemoteChange(e.target.checked));
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
      this.#localProcessor ??= new KrispProcessor(false);
      if (on) {
        // Pre-warm the SDK so an init/load failure surfaces here (and reverts the
        // checkbox below) instead of only as a swallowed async rejection later.
        await getKrispSDK();
        await this.#device.audio.addProcessor(this.#localProcessor, false);
      } else {
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
      this.#remoteProcessor ??= new KrispProcessor(true);
      if (on) {
        // Pre-warm the SDK so an init/load failure surfaces here (and reverts the
        // checkbox below) instead of only as a swallowed async rejection later.
        await getKrispSDK();
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
  'twilio-voice-krisp-noise-cancellation',
  TwilioVoiceKrispNoiseCancellation
);
