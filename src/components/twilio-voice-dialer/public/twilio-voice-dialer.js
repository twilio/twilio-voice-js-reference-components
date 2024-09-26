class TwilioVoiceDialer extends HTMLElement {
  static get observedAttributes() {
    return ['recipient', 'register'];
  }

  #call;
  #device;
  #isRegistered = false;
  #token;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    this.#render();

    if (name === 'register' && this.#device) {
      const shouldRegister = newValue === 'true';
      if (shouldRegister && !this.#isRegistered) {
        await this.#device.register();
        this.#isRegistered = true;
        this.#device.on('incoming', this.#incomingHandler);
      } else if (!shouldRegister && this.#isRegistered) {
        this.#device.unregister();
        this.#device.removeListener('incoming', this.#incomingHandler);
        this.#isRegistered = false;
      }
      this.#setStatus('idle');
    }

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
    this.#device.on('tokenWillExpire', (device) => {
      this.#onTokenWillExpireEvent(device);
    });
    this.#setStatus('idle');

    if (!this.#isRegistered && this.getAttribute('register') === 'true') {
      await this.#handleRegister();
    }
  }

  async #handleRegister() {
    if (!this.#isRegistered) {
      this.setAttribute('register', 'true');
    } else {
      console.log('device is already registered');
    }
  }

  #handleReject() {
    this.#call.reject();
  }

  #incomingHandler = (call) => {
    this.#onIncomingEvent(call);

    call.on('disconnect', this.#reset);
    call.on('cancel', this.#reset);
    call.on('reject', this.#reset);
    this.#call = call;
    this.#setStatus('incoming');
  };

  #onIncomingEvent(call) {
    const incomingEvent = new CustomEvent('onIncoming', {
      detail: { call },
    });
    this.dispatchEvent(incomingEvent);
  }

  #onTokenWillExpireEvent(device) {
    const tokenWillExpireEvent = new CustomEvent('onTokenWillExpire', {
      detail: { device },
    });
    this.dispatchEvent(tokenWillExpireEvent);
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div class="container">
        <p id="status">Status: pending</p>
        <p id="register-status">
          Register: ${this.getAttribute('register') === 'true'}
        </p>
        <input 
          type="text"
          placeholder="recipient"
          id="recipient"
          value="${this.getAttribute('recipient')}"
        />
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

  #reset = () => {
    this.#setStatus('idle');
    this.#call = null;
  };

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
