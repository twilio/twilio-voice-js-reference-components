class TwilioVoiceBasicCallControl extends HTMLElement {
  #call;
  #conferenceSid;
  #participants = new Map();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();

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
      .querySelector('#add-conference')
      .addEventListener('click', () => this.#handleAddConference());
  }

  async #handleAddConference() {
    const participant = this.shadowRoot.querySelector('#add-participant').value;

    if (participant === '') {
      console.log('Please enter a validparticipant');
    } else {
      await fetch(
        `/twilio-voice-basic-call-control/conferences/${
          this.#conferenceSid
        }/participants/add/${participant}`,
        {
          method: 'POST',
        }
      );
    }
  }

  #handleCallMessageReceived(message) {
    const { content, messageType } = message;
    if (messageType === 'user-defined-message') {
      const { callSid, conferenceSid, hold, label, muted } = content;
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
    if (response.status === 200) {
      this.#showElement(`#${callSid}-hold`, !shouldHold);
      this.#showElement(`#${callSid}-resume`, shouldHold);
    } else {
      console.error('Unable to set hold: ', response.error);
    }
  }

  async #handleMute(shouldMute, callSid) {
    const response = await this.#updateConferenceCall(callSid, {
      muted: shouldMute,
    });
    if (response.status === 200) {
      this.#showElement(`#${callSid}-mute`, !shouldMute);
      this.#showElement(`#${callSid}-unmute`, shouldMute);
    } else {
      console.error('Unable to set mute: ', response.error);
    }
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

  #renderCallControlButton(options) {
    const { name, callSid, shouldHide } = options;
    const button = document.createElement('button');
    button.innerHTML = name;
    button.setAttribute('id', `${callSid}-${name}`);
    button.style.display = shouldHide ? 'none' : 'inline-block';
    switch (name) {
      case 'hold':
        button.addEventListener('click', () => this.#handleHold(true, callSid));
        break;
      case 'resume':
        button.addEventListener('click', () =>
          this.#handleHold(false, callSid)
        );
        break;
      case 'mute':
        button.addEventListener('click', () => this.#handleMute(true, callSid));
        break;
      case 'unmute':
        button.addEventListener('click', () =>
          this.#handleMute(false, callSid)
        );
    }
    return button;
  }

  #renderCallControlButtons() {
    this.#removeCallControlButtons();
    const component = this.shadowRoot.querySelector('#basic-call-control');
    const callControlButtons = document.createElement('div');
    callControlButtons.setAttribute('id', 'call-control-buttons');
    component.appendChild(callControlButtons);

    for (const [callSid, content] of this.#participants) {
      const participantContainer = document.createElement('div');

      const label = document.createElement('span');
      label.innerHTML = `${content.label}: `;
      participantContainer.appendChild(label);

      const holdButton = this.#renderCallControlButton({
        name: 'hold',
        callSid,
        shouldHide: content.hold,
      });
      participantContainer.appendChild(holdButton);

      const resumeButton = this.#renderCallControlButton({
        callSid,
        name: 'resume',
        shouldHide: !content.hold,
      });
      participantContainer.appendChild(resumeButton);

      const muteButton = this.#renderCallControlButton({
        callSid,
        name: 'mute',
        shouldHide: content.muted,
      });
      participantContainer.appendChild(muteButton);

      const unMuteButton = this.#renderCallControlButton({
        callSid,
        name: 'unmute',
        shouldHide: !content.muted,
      });
      participantContainer.appendChild(unMuteButton);

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
