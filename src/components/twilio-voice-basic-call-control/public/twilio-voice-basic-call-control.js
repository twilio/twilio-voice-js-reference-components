class TwilioVoiceBasicCallControl extends HTMLElement {
  #call;
  #callSid;
  #conferenceSid;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.#render();
    this.#showButtons();

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
  }

  #handleCallMessageReceived(message) {
    const { content, messageType } = message;
    if (messageType === 'user-defined-message') {
      this.#callSid = content.callSid;
      this.#conferenceSid = content.conferenceSid;
      this.#showButtons('hold');
    }
  }

  #handleHold() {
    this.#setHold(true);
  }

  #handleResume() {
    this.#setHold(false);
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div>
        <button id="hold">Hold</button>
        <button id="resume">Resume</button>
      </div>
    `;
  }

  #reset = () => {
    this.#call = undefined;
    this.#callSid = undefined;
    this.#conferenceSid = undefined;
    this.#showButtons();
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
    if (this.#call && this.#callSid && this.#conferenceSid) {
      const response = await fetch(
        `/twilio-voice-basic-call-control/conferences/${
          this.#conferenceSid
        }/participants/${this.#callSid}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            hold: shouldHold,
          }),
        }
      );
      if (response.status === 200) {
        this.#showButtons(shouldHold ? 'resume' : 'hold');
      }
    }
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
}

customElements.define(
  'twilio-voice-basic-call-control',
  TwilioVoiceBasicCallControl
);
