class TwilioVoiceDialer extends HTMLElement {
  static get observedAttributes() {
    return ['recipient'];
  }

  #call;
  #device;
  #token;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  attributeChangedCallback() {
    this.#render();
  }

  connectedCallback() {
    this.shadowRoot
      .querySelector('#call')
      .addEventListener('click', () => this.#handleCall());
    this.shadowRoot
      .querySelector('#hangup')
      .addEventListener('click', () => this.#handleHangup());
  }

  disconnectedCallback() {
    this.#device.destroy();
  }

  async #handleCall() {
    const recipient = this.shadowRoot.querySelector('#recipient').value;
    if (recipient) {
      this.#call = await this.#device.connect({ params: { recipient } });
      this.#setupCallHandlers(this.#call);
      this.#setStatus('inprogress');
    } else {
      console.log('recipient is required to make a call');
    }
  }

  #handleHangup() {
    this.#call.disconnect();
  }

  #handleInit() {
    this.#device = new Twilio.Device(this.#token, { logLevel: 1 });
    this.#setStatus('idle');
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div class="container">
        <p id="status">Status: pending</p>
        <input 
            type="text"
            placeholder="recipient"
            id="recipient"
            value=${this.getAttribute('recipient')}>
				<button id="call">Call</button>
				<button id="hangup">Hangup</button>
      </div>
    `;
  }

  #setStatus(status) {
    if (status === 'idle') {
      this.#showButtons('call');
    } else if (status === 'inprogress') {
      this.#showButtons('hangup');
    }

    const statusEl = this.shadowRoot.querySelector('#status');
    statusEl.innerText = `Status: ${status}`;
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

customElements.define('twilio-voice-dialer', TwilioVoiceDialer);
