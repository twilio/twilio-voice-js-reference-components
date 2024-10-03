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
  }

  async attributeChangedCallback() {}

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
    const callControlContainer = document.createElement('div');
    const holdButton = document.createElement('button');
    holdButton.setAttribute('id', 'hold');
    holdButton.textContent = 'Hold';
    holdButton.addEventListener('click', () => this.#handleHold());

    const resumeButton = document.createElement('button');
    resumeButton.setAttribute('id', 'resume');
    resumeButton.textContent = 'Resume';
    resumeButton.addEventListener('click', () => this.#handleResume());

    callControlContainer.appendChild(holdButton);
    callControlContainer.appendChild(resumeButton);
    this.shadowRoot.appendChild(callControlContainer);
  }
}

customElements.define(
  'twilio-voice-basic-call-control',
  TwilioVoiceBasicCallControl
);
