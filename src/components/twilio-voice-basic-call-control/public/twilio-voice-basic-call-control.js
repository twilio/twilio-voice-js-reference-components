class TwilioVoiceBasicCallControl extends HTMLElement {
  #call;
  #callSid;
  #conferenceSid;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.#render();
    this.#showButtons('hold');
    this.#showButtons('mute');

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
      .addEventListener('click', () => this.#handleHold(true));
    this.shadowRoot
      .querySelector('#resume')
      .addEventListener('click', () => this.#handleHold(false));
    this.shadowRoot
      .querySelector('#mute')
      .addEventListener('click', () => this.#handleMute(true));
    this.shadowRoot
      .querySelector('#unmute')
      .addEventListener('click', () => this.#handleMute(false));
  }

  #handleCallMessageReceived(message) {
    const { content, messageType } = message;
    if (messageType === 'user-defined-message') {
      this.#callSid = content.callSid;
      this.#conferenceSid = content.conferenceSid;
      this.#showButtons('hold', 'hold');
      this.#showButtons('mute', 'mute');
    }
  }

  async #handleHold(shouldHold) {
    if (this.#hasParticipantConnected()) {
      const response = await this.#updateConferenceCall({ hold: shouldHold });
      if (response.status === 200) {
        this.#showButtons('hold', shouldHold ? 'resume' : 'hold');
      } else {
        console.error('Unable to set hold: ', response.error);
      }
    }
  }

  async #handleMute(shouldMute) {
    if (this.#hasParticipantConnected()) {
      const response = await this.#updateConferenceCall({ muted: shouldMute });
      if (response.status === 200) {
        this.#showButtons('mute', shouldMute ? 'unmute' : 'mute');
      } else {
        console.error('Unable to set mute: ', response.error);
      }
    }
  }

  #hasParticipantConnected = () =>
    Boolean(this.#call && this.#callSid && this.#conferenceSid);

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
    this.#showButtons('hold');
    this.#showButtons('mute');
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

  #showButtons(query, ...buttonsToShow) {
    this.shadowRoot
      .querySelectorAll(`#${query}-buttons > button`)
      .forEach((el) => {
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
