class TwilioVoiceBasicCallControl extends HTMLElement {
  #call;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.#render();

    const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
    twilioVoiceDialer.addEventListener('incoming', (e) => {
      const call = e.detail.call;
      this.#call = call;
    });
    twilioVoiceDialer.addEventListener('outgoing', (e) => {
      const call = e.detail.call;
      this.#call = call;
    });

    this.shadowRoot
      .querySelector('#hold')
      .addEventListener('click', () => this.#handleHold());
    this.shadowRoot
      .querySelector('#resume')
      .addEventListener('click', () => this.#handleResume());
  }

  #handleHold() {
    if (this.#call) {
      console.log('attempting to hold call');
    }
  }

  #handleResume() {
    if (this.#call) {
      console.log('attempting to resume call');
    }
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div>
        <button id="hold">Hold</button>
        <button id="resume">Resume</button>
      </div>
    `;
  }
}

customElements.define(
  'twilio-voice-basic-call-control',
  TwilioVoiceBasicCallControl
);
