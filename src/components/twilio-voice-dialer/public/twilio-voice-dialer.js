class TwilioVoiceDialer extends HTMLElement {
  static get observedAttributes() {
    return ['recipient'];
  }

  #device;
  #token;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  disconnectedCallback() {
    this.#device.destroy();
  }

  attributeChangedCallback() {
    this.#render();
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
      </div>
    `;
  }

  #setStatus(status) {
    const statusEl = this.shadowRoot.querySelector('#status');
    statusEl.innerText = `Status: ${status}`;
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
