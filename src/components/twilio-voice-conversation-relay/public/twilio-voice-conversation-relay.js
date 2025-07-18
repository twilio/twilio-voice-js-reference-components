class TwilioVoiceConversationRelay extends HTMLElement {
  #call;
  #device;
  #status = 'idle';
  #token;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();

    this.shadowRoot
      .querySelector('#call')
      .addEventListener('click', () => this.#handleCall());
    this.shadowRoot
      .querySelector('#hangup')
      .addEventListener('click', () => this.#handleHangup());
  }

  async #handleCall() {
    console.log('Making a call...');
    this.#call = await this.#device.connect();
    this.#setupCallHandlers(this.#call);
    this.#setStatus('inprogress');
  }

  #handleHangup() {
    this.#call.disconnect();
    this.#call = undefined;
  }

  async #handleInit() {
    this.#device = new Twilio.Device(this.#token, { logLevel: 1 });
    this.#setStatus('idle');
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div class="container">
        <p id="status">Status: pending</p>
        <div>
          <button id="call" style="display: none;">Connect to an Agent</button>
          <button id="hangup" style="display: none;">Hangup</button>
        </div>
      </div>
    `;
  }

  #setStatus(status) {
    this.#status = status;
    if (this.#status === 'idle') {
      this.#showButtons('call');
    } else if (this.#status === 'inprogress') {
      this.#showButtons('hangup');
    }

    const statusEl = this.shadowRoot.querySelector('#status');
    statusEl.innerText = `Status: ${this.#status}`;
  }

  #setupCallHandlers(call) {
    call.on('disconnect', () => {
      this.#setStatus('idle');
    });
  }

  #showButtons(...buttonsToShow) {
    this.shadowRoot.querySelectorAll('button').forEach((el) => {
      if (buttonsToShow.includes(el.id)) {
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    });
  }

  setToken(token) {
    if (this.#token) {
      this.#device.updateToken(token);
    } else {
      this.#token = token;
      this.#handleInit();
    }
  }
}

customElements.define(
  'twilio-voice-conversation-relay',
  TwilioVoiceConversationRelay
);
