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

    this.#render();
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'register' && this.#device) {
      const shouldRegister = newValue === 'true';
      if (shouldRegister && !this.#isRegistered) {
        await this.#device.register();
        this.#isRegistered = true;
        this.#device.on('incoming', this.#handleIncoming);
        this.shadowRoot.querySelector('#register-status').textContent =
          'Register: true';
      } else if (!shouldRegister && this.#isRegistered) {
        this.#device.unregister();
        this.#device.removeListener('incoming', this.#handleIncoming);
        this.#isRegistered = false;
      }
      this.#setStatus('idle');
    }
  }

  #dispatchIncomingEvent(call) {
    const incomingEvent = new CustomEvent('incoming', {
      detail: { call },
    });
    this.dispatchEvent(incomingEvent);
  }

  #dispatchTokenWillExpireEvent(device) {
    const tokenWillExpireEvent = new CustomEvent('tokenWillExpire', {
      detail: { device },
    });
    this.dispatchEvent(tokenWillExpireEvent);
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

  #handleIncoming = (call) => {
    this.#dispatchIncomingEvent(call);

    call.on('disconnect', this.#reset);
    call.on('cancel', this.#reset);
    call.on('reject', this.#reset);
    this.#call = call;
    this.#setStatus('incoming');
  };

  async #handleInit() {
    this.#device = new Twilio.Device(this.#token, { logLevel: 1 });
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
    const dialerContainer = document.createElement('div');
    const statusEl = document.createElement('p');
    statusEl.setAttribute('id', 'status');
    statusEl.textContent = 'Status: pending';
    const registerEl = document.createElement('p');
    registerEl.setAttribute('id', 'register-status');
    registerEl.textContent = `Register: ${
      this.getAttribute('register') === 'true'
    }`;
    const inputEl = document.createElement('input');
    inputEl.setAttribute('type', 'text');
    inputEl.setAttribute('placeholder', 'recipient');
    inputEl.setAttribute('id', 'recipient');
    inputEl.setAttribute('value', `${this.getAttribute('recipient')}`);

    const callControlContainer = document.createElement('div');
    const callButton = document.createElement('button');
    callButton.setAttribute('id', 'call');
    callButton.textContent = 'Call';
    callButton.addEventListener('click', () => this.#handleCall());
    const hangupButton = document.createElement('button');
    hangupButton.setAttribute('id', 'hangup');
    hangupButton.textContent = 'Hangup';
    hangupButton.addEventListener('click', () => this.#handleHangup());
    const acceptButton = document.createElement('button');
    acceptButton.setAttribute('id', 'accept');
    acceptButton.textContent = 'Accept';
    acceptButton.addEventListener('click', () => this.#handleAccept());
    const rejectButton = document.createElement('button');
    rejectButton.setAttribute('id', 'reject');
    rejectButton.textContent = 'Reject';
    rejectButton.addEventListener('click', () => this.#handleReject());

    const registerButton = document.createElement('input');
    registerButton.setAttribute('type', 'button');
    registerButton.setAttribute('id', 'register');
    registerButton.setAttribute('value', 'Register');
    registerButton.addEventListener('click', () => this.#handleRegister());

    callControlContainer.appendChild(callButton);
    callControlContainer.appendChild(hangupButton);
    callControlContainer.appendChild(acceptButton);
    callControlContainer.appendChild(rejectButton);

    dialerContainer.appendChild(statusEl);
    dialerContainer.appendChild(registerEl);
    dialerContainer.appendChild(inputEl);
    dialerContainer.appendChild(callControlContainer);
    dialerContainer.appendChild(registerButton);

    this.shadowRoot.appendChild(dialerContainer);
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
