class TwilioVoiceBasicCallControl extends HTMLElement {
  #call;
  #conferenceSid;
  #participants = new Map();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();

    const twilioVoiceDialer = this.shadowRoot.host.parentElement;
    twilioVoiceDialer.addEventListener('incoming', (e) => {
      const call = e.detail.call;
      this.#setCallHandlers(call);
    });
    twilioVoiceDialer.addEventListener('outgoing', (e) => {
      const call = e.detail.call;
      this.#setCallHandlers(call);
    });

    this.shadowRoot
      .querySelector('#add-conference')
      .addEventListener('click', () => this.#handleAddConference());
  }

  async #handleAddConference() {
    const participant = this.shadowRoot.querySelector('#add-participant').value;

    if (participant === '') {
      throw new Error('Please enter a valid participant');
    }
    await fetch(
      `/twilio-voice-basic-call-control/conferences/${
        this.#conferenceSid
      }/participants`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ to: participant }),
      }
    );
  }

  #handleCallMessageReceived(message) {
    const { content, messageType } = message;
    if (messageType === 'user-defined-message') {
      const { callSid, conferenceSid, hold, label, muted, remove } = content;
      if (remove) {
        this.#participants.delete(callSid);
        this.#renderCallControlButtons();
        return;
      }
      this.#participants.set(callSid, { conferenceSid, hold, label, muted });
      this.#conferenceSid = content.conferenceSid;
      this.#showElement('#add-participant-container', true);
      this.#renderCallControlButtons();
    }
  }

  async #handleHold(shouldHold, callSid) {
    const response = await this.#updateConferenceCall(callSid, {
      hold: shouldHold,
    });

    if (response.status !== 200) {
      console.error('Unable to set hold: ', response.error);
      return;
    }
    this.#showElement(`#${callSid}-hold`, !shouldHold);
    this.#showElement(`#${callSid}-resume`, shouldHold);
  }

  async #handleMute(shouldMute, callSid) {
    const response = await this.#updateConferenceCall(callSid, {
      muted: shouldMute,
    });

    if (response.status !== 200) {
      console.error('Unable to set mute: ', response.error);
      return;
    }
    this.#showElement(`#${callSid}-mute`, !shouldMute);
    this.#showElement(`#${callSid}-unmute`, shouldMute);
  }

  #removeCallControlButtons() {
    const callControlButtons = this.shadowRoot.querySelector(
      '#call-control-buttons'
    );
    if (callControlButtons) {
      callControlButtons.remove();
    }
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div id="basic-call-control">
        <div id="add-participant-container" style="display: none;">
          <input
            type="text"
            placeholder="Add participant"
            id="add-participant"
            value=""
          />
          <button id="add-conference">Add</button>
        <div>
      </div>
    `;
  }

  #renderCallControlButtons() {
    this.#removeCallControlButtons();
    const component = this.shadowRoot.querySelector('#basic-call-control');
    const callControlButtons = document.createElement('div');
    callControlButtons.setAttribute('id', 'call-control-buttons');
    component.appendChild(callControlButtons);

    for (const [callSid, content] of this.#participants) {
      const participantContainer = document.createElement('div');

      participantContainer.innerHTML = `
        <span>${content.label}: </span>
        <button
          id="${callSid}-hold"
          style="display: ${content.hold ? 'none' : 'inline-block'}"
        >
          Hold
        </button>
        <button
          id="${callSid}-resume"
          style="display: ${!content.hold ? 'none' : 'inline-block'}"
        >
          Resume
        </button>
        <button
          id="${callSid}-mute"
          style="display: ${content.muted ? 'none' : 'inline-block'}"
        >
          Mute
        </button>
        <button
          id="${callSid}-unmute"
          style="display: ${!content.muted ? 'none' : 'inline-block'}"
        >
          Unmute
        </button>
      `;

      participantContainer
        .querySelector(`#${callSid}-hold`)
        .addEventListener('click', () => this.#handleHold(true, callSid));
      participantContainer
        .querySelector(`#${callSid}-resume`)
        .addEventListener('click', () => this.#handleHold(false, callSid));
      participantContainer
        .querySelector(`#${callSid}-mute`)
        .addEventListener('click', () => this.#handleMute(true, callSid));
      participantContainer
        .querySelector(`#${callSid}-unmute`)
        .addEventListener('click', () => this.#handleMute(false, callSid));

      callControlButtons.appendChild(participantContainer);
    }
  }

  #reset = () => {
    this.#call = undefined;
    this.#conferenceSid = undefined;
    this.#participants = new Map();
    this.#removeCallControlButtons();
    this.#showElement('#add-participant-container', false);
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

  #showElement(parentSelector, shouldShow) {
    this.shadowRoot.querySelector(parentSelector).style.display = shouldShow
      ? 'inline-block'
      : 'none';
  }

  async #updateConferenceCall(callSid, params) {
    return await fetch(
      `/twilio-voice-basic-call-control/conferences/${
        this.#conferenceSid
      }/participants/${callSid}`,
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
