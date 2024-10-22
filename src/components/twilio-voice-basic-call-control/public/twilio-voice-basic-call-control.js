class TwilioVoiceBasicCallControl extends HTMLElement {
  #call;
  #callSid;
  #conferenceSid;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.#render();
    this.#showHoldButtons();
    this.#showMuteButtons();

    const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
    twilioVoiceDialer.addEventListener('incoming', (e) => {
      const call = e.detail.call;
      this.#setCallHandlers(call);
    });
    twilioVoiceDialer.addEventListener('outgoing', (e) => {
      const call = e.detail.call;
      this.#setCallHandlers(call);
    });

    this.shadowRoot
      .querySelector('#hold')
      .addEventListener('click', () => this.#handleHold());
    this.shadowRoot
      .querySelector('#resume')
      .addEventListener('click', () => this.#handleResume());
    this.shadowRoot
      .querySelector('#mute')
      .addEventListener('click', () => this.#handleMute());
    this.shadowRoot
      .querySelector('#unmute')
      .addEventListener('click', () => this.#handleUnmute());
  }

  #handleCallMessageReceived(message) {
    const { content, messageType } = message;
    if (messageType === 'user-defined-message') {
      this.#callSid = content.callSid;
      this.#conferenceSid = content.conferenceSid;
      this.#showHoldButtons('hold');
      this.#showMuteButtons('mute');
    }
  }

  #handleHold() {
    this.#setHold(true);
  }

  #handleMute() {
    this.#setMute(true);
  }

  #handleUnmute() {
    this.#setMute(false);
  }

  #handleResume() {
    this.#setHold(false);
  }

  #isConferenceCall = () =>
    !!(this.#call && this.#callSid && this.#conferenceSid);

  #render() {
    this.shadowRoot.innerHTML = `
      <div>
        <div id="hold-buttons">
          <button id="hold">Hold</button>
          <button id="resume">Resume</button>
        </div>
        <div id="mute-buttons">
          <button id="mute">Mute</button>
          <button id="unmute">Unmute</button>
        </div>
      </div>
    `;
  }

  #reset = () => {
    this.#call = undefined;
    this.#callSid = undefined;
    this.#conferenceSid = undefined;
    this.#showHoldButtons();
    this.#showMuteButtons();
  };

  #setCallHandlers = (call) => {
    this.#call = call;
    this.#call.on('disconnect', this.#reset);
    this.#call.on('cancel', this.#reset);
    this.#call.on('reject', this.#reset);
    this.#call.on('messageReceived', (message) =>
      this.#handleCallMessageReceived(message)
    );
  };

  async #setHold(shouldHold) {
    if (this.#isConferenceCall()) {
      const response = await this.#updateConferenceCall({ hold: shouldHold });
      if (response.status === 200) {
        this.#showHoldButtons(shouldHold ? 'resume' : 'hold');
      }
    }
  }

  async #setMute(shouldMute) {
    if (this.#isConferenceCall()) {
      const response = await this.#updateConferenceCall({ muted: shouldMute });
      if (response.status === 200) {
        this.#showMuteButtons(shouldMute ? 'unmute' : 'mute');
      }
    }
  }

  #showHoldButtons(...buttonsToShow) {
    this.shadowRoot.querySelectorAll('#hold-buttons > button').forEach((el) => {
      if (buttonsToShow.includes(el.id)) {
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    });
  }

  #showMuteButtons(...buttonsToShow) {
    this.shadowRoot.querySelectorAll('#mute-buttons > button').forEach((el) => {
      if (buttonsToShow.includes(el.id)) {
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    });
  }

  async #updateConferenceCall(params) {
    return await fetch(
      `/twilio-voice-basic-call-control/conferences/${
        this.#conferenceSid
      }/participants/${this.#callSid}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }
}

customElements.define(
  'twilio-voice-basic-call-control',
  TwilioVoiceBasicCallControl
);
