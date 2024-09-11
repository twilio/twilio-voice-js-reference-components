const render = (x) => `
  <div class="container">
    <p id="status">Status: pending</p>
    <input type="text" placeholder="recipient" id="recipient" value=${x.recipient}>
  </div>
`;

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
  get recipient() {
    return this.getAttribute('recipient');
  }

  connectedCallback() {}

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
    this.shadowRoot.innerHTML = render(this);
  }

  #setStatus(status) {
    const recipientEl = this.shadowRoot.querySelector('#recipient');
    const statusEl = this.shadowRoot.querySelector('#status');
    statusEl.innerText = `Status: ${status}`;
  }

  setToken(token) {
    this.#token = token;
    this.#handleInit();
  }
}

customElements.define('twilio-voice-dialer', TwilioVoiceDialer);
