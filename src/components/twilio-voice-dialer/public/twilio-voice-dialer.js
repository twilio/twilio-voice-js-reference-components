class TwilioVoiceDialer extends HTMLElement {
  static get observedAttributes() {
    return ['recipient', 'register'];
  }

  #call;
  #device;
  #isRegistered = false;
  #status = 'idle';
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
        this.#device.on('incoming', this.#handleIncoming);
      } else if (!shouldRegister && this.#isRegistered) {
        this.#device.unregister();
        this.#device.removeListener('incoming', this.#handleIncoming);
        this.#isRegistered = false;
      }
      this.#setStatus(this.#status);
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

  #dispatchDeviceEvent(device) {
    const deviceEvent = new CustomEvent('device', {
      detail: { device },
    });
    this.dispatchEvent(deviceEvent);
  }

  #dispatchIncomingEvent(call) {
    const incomingEvent = new CustomEvent('incoming', {
      detail: { call },
    });
    this.dispatchEvent(incomingEvent);
  }

  #dispatchOutgoingEvent(call) {
    const outgoingEvent = new CustomEvent('outgoing', {
      detail: { call },
    });
    this.dispatchEvent(outgoingEvent);
  }

  #dispatchTokenWillExpireEvent(device) {
    const tokenWillExpireEvent = new CustomEvent('tokenWillExpire', {
      detail: { device },
    });
    this.dispatchEvent(tokenWillExpireEvent);
  }

  #handleAccept() {
    this.#call.accept();
    this.#setStatus('inprogress');
  }

  async #handleCall() {
    const recipient = this.shadowRoot.querySelector('#recipient').value;
    if (recipient) {
      this.#call = await this.#device.connect({ params: { recipient } });
      this.#dispatchOutgoingEvent(this.#call);
      this.#setupCallHandlers(this.#call);
      this.#setStatus('inprogress');
    } else {
      console.log('recipient is required to make a call');
    }
  }

  #handleHangup() {
    this.#call.disconnect();
  }

  #handleIncoming = (call) => {
    this.#dispatchIncomingEvent(call);

    call.on('disconnect', this.#reset);
    call.on('cancel', this.#reset);
    call.on('reject', this.#reset);
    this.#call = call;
    this.#setStatus('incoming');
  };

  async #handleInit() {
    this.#device = new Twilio.Device(this.#token, {
      codecPreferences: ['opus', 'pcmu'],
      logLevel: 1,
    });
    this.#dispatchDeviceEvent(this.#device);
    this.#device.on('tokenWillExpire', (device) => {
      this.#dispatchTokenWillExpireEvent(device);
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
          <button id="call" style="display: none;">Call</button>
          <button id="hangup" style="display: none;">Hangup</button>
          <button id="accept" style="display: none;">Accept</button>
          <button id="reject" style="display: none;">Reject</button>
        </div>
        <input type="button" id="register" value="Register" />
        <slot></slot>
      </div>
    `;
  }

  #reset = () => {
    this.#setStatus('idle');
    this.#call = null;
  };

  #setStatus(status) {
    this.#status = status;
    if (this.#status === 'idle') {
      this.#showButtons('call');
    } else if (this.#status === 'incoming') {
      this.#showButtons('accept', 'reject');
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

customElements.define('twilio-voice-dialer', TwilioVoiceDialer);
