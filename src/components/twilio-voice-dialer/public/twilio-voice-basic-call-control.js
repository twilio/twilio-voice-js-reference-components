class TwilioVoiceBasicCallControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    const callControlContainer = document.createElement('div');
    const holdButton = document.createElement('button');
    holdButton.textContent = 'Hold';
    const resumeButton = document.createElement('button');
    resumeButton.textContent = 'Resume';
    callControlContainer.appendChild(holdButton);
    callControlContainer.appendChild(resumeButton);

    this.shadowRoot.appendChild(callControlContainer);
  }

  async attributeChangedCallback() {}
}

customElements.define(
  'twilio-voice-basic-call-control',
  TwilioVoiceBasicCallControl
);
