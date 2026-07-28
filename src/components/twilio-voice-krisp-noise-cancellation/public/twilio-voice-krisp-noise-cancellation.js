import KrispSDK from '/twilio-voice-krisp-noise-cancellation/krisp/krispsdk.mjs';

const BASE = '/twilio-voice-krisp-noise-cancellation/krisp';

// One KrispSDK instance is constructed and init()'d once, shared by every
// processor. Kept in a module-scoped promise so concurrent toggles await the
// same init; cleared on failure so a later toggle retries.
let krispSdkPromise;

function getKrispSDK() {
  if (!krispSdkPromise) {
    const sdk = new KrispSDK({
      params: {
        // Outbound (microphone) models.
        models: {
          model8: `${BASE}/models/krisp-nc-o-nb-v2.kef`,
          modelNC: `${BASE}/models/krisp-nc-o-med-v7.kef`,
        },
        // Inbound (incoming audio) models. Key names must be model_inbound_8 /
        // model_inbound_16 (the SDK does not recognize model8/model16 here).
        inboundModels: {
          model_inbound_8: `${BASE}/models/krisp-nc-i-nb-pro-v1.kef`,
          model_inbound_16: `${BASE}/models/krisp-nc-i-wb-pro-v3.kef`,
        },
      },
    });
    krispSdkPromise = sdk
      .init()
      .then(() => sdk)
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
 * instance is used per direction (local mic / remote output). The isInbound
 * flag selects the Krisp model set: false uses the outbound models, true uses
 * the inbound models.
 *
 * Krisp picks a model by the AudioContext sample rate (model8 <= 8 kHz,
 * model16 <= 16 kHz, full band > 16 kHz), so each direction runs its own
 * context at a rate its models cover: 48 kHz for outbound (full-band model),
 * 16 kHz for inbound. Krisp ships no full-band inbound model -- the inbound
 * models top out at wideband -- so the inbound filter must run at 16 kHz.
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

  constructor(isInbound) {
    this.#isInbound = isInbound;
    this.#ctx = new AudioContext({ sampleRate: isInbound ? 16000 : 48000 });
  }

  async createProcessedStream(stream) {
    // The SDK may call this repeatedly without an intervening destroy; tear down
    // the previous graph first so we don't leak filter nodes / Krisp workers.
    await this.destroyProcessedStream();

    const sdk = await getKrispSDK();

    // Do all node work synchronously after the awaits so a destroy that runs
    // during setup can't null a field. Bind to a local `node` so the ready
    // callback enables this exact filter, not a later one.
    const node = await sdk.createNoiseFilter(
      { audioContext: this.#ctx, stream, isInbound: this.#isInbound },
      () => node.enable(), // filter starts disabled; enable once its model loads
    );
    const source = new MediaStreamAudioSourceNode(this.#ctx, { mediaStream: stream });
    const destination = this.#ctx.createMediaStreamDestination();
    source.connect(node);
    node.connect(destination);

    this.#source = source;
    this.#node = node;
    this.#destination = destination;
    return this.#destination.stream;
  }

  async destroyProcessedStream() {
    this.#source?.disconnect();
    this.#node?.disconnect();
    this.#destination?.disconnect();
    // Terminates the Krisp worker backing this filter node.
    await this.#node?.dispose();
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
    });

    this.shadowRoot
      .querySelector('#denoise-local')
      .addEventListener('change', (e) => this.#toggleLocal(e.target.checked));
    this.shadowRoot
      .querySelector('#denoise-remote')
      .addEventListener('change', (e) => this.#toggleRemote(e.target.checked));
  }

  #setChecked(selector, checked) {
    const checkbox = this.shadowRoot.querySelector(selector);
    if (checkbox) checkbox.checked = checked;
  }

  async #toggleLocal(on) {
    if (!this.#device) {
      console.warn('Device not ready yet.');
      this.#setChecked('#denoise-local', false);
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
      this.#setChecked('#denoise-local', !on);
    }
  }

  async #toggleRemote(on) {
    if (!this.#device) {
      console.warn('Device not ready yet.');
      this.#setChecked('#denoise-remote', false);
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
      this.#setChecked('#denoise-remote', !on);
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
  'twilio-voice-krisp-noise-cancellation',
  TwilioVoiceKrispNoiseCancellation
);
