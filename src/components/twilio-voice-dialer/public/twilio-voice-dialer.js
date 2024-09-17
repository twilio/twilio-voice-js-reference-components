class TwilioVoiceDialer extends HTMLElement {
  static get observedAttributes() {
    return ['recipient', 'register'];
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
    this.shadowRoot
      .querySelector('#accept')
      .addEventListener('click', () => this.#handleAccept());
    this.shadowRoot
      .querySelector('#call')
      .addEventListener('click', () => this.#handleCall());
    this.shadowRoot
      .querySelector('#hangup')
      .addEventListener('click', () => this.#handleHangup());
    this.shadowRoot
      .querySelector('#register')
      .addEventListener('click', () => this.#handleRegister());
    this.shadowRoot
      .querySelector('#reject')
      .addEventListener('click', () => this.#handleReject());
  }

  disconnectedCallback() {
    this.#device.destroy();
  }

  #handleAccept() {
    this.#call.accept();
    this.#setStatus('inprogress');
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

  async #handleInit() {
    this.#device = new Twilio.Device(this.#token, { logLevel: 1 });
    this.#setStatus('idle');

    if (Boolean(this.getAttribute('register'))) {
      await this.#handleRegister();
    }
  }

  async #handleRegister() {
    await this.#device.register();
    this.#device.on('incoming', (call) => {
      call.on('disconnect', this.#reset.bind(this));
      call.on('cancel', this.#reset.bind(this));
      call.on('reject', this.#reset.bind(this));
      this.#call = call;
      this.#setStatus('incoming');
    });

    if (!Boolean(this.getAttribute('register'))) {
      this.setAttribute('register', 'true');
      this.#setStatus('idle');
    }
  }

  #handleReject() {
    this.#call.reject();
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div class="container">
        <p id="status">Status: pending</p>
        <p id="register-status">Register: ${Boolean(
          this.getAttribute('register')
        )}</p>
        <input 
					type="text"
					placeholder="recipient"
					id="recipient"
					value=${this.getAttribute('recipient')}>
				<div>
					<button id="call">Call</button>
					<button id="hangup">Hangup</button>
					<button id="accept">Accept</button>
					<button id="reject">Reject</button>
				</div>
				<input type="button" id="register" value="Register" />
      </div>
    `;
  }

  #reset() {
    this.#setStatus('idle');
    this.#call = null;
  }

  #setStatus(status) {
    if (status === 'idle') {
      this.#showButtons('call');
    } else if (status === 'incoming') {
      this.#showButtons('accept', 'reject');
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
