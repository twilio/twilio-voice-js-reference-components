class TwilioVoiceAIConversation extends HTMLElement {
  #call;
  #conversationRelayLog;
  #device;
  #status = 'idle';
  #token;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();
    this.#conversationRelayLog = this.shadowRoot.querySelector('#log');

    const ws = new WebSocket("ws://localhost:3030");
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'log') {
        this.#log(message.content);
      }
    };

    this.shadowRoot
      .querySelector('#call')
      .addEventListener('click', () => this.#handleCall());
    this.shadowRoot
      .querySelector('#hangup')
      .addEventListener('click', () => this.#handleHangup());
  }

  async #handleCall() {
    console.log('Making a call...');
    this.#call = await this.#device.connect();
    this.#setupCallHandlers(this.#call);
    this.#setStatus('inprogress');
  }

  #handleHangup() {
    this.#call.disconnect();
    this.#call = undefined;
  }

  async #handleInit() {
    this.#device = new Twilio.Device(this.#token, { logLevel: 1 });
    this.#setStatus('idle');
  }

  #log(msg) {
    const p = document.createElement('p');
    p.innerHTML = msg;
    this.#conversationRelayLog.appendChild(p);

    this.#conversationRelayLog.scrollTop = this.#conversationRelayLog.scrollHeight;
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div class="container">
        <p id="status">Status: pending</p>
        <div
          style="margin-bottom: 20px;">
          <button id="call" style="display: none;">Connect to an Agent</button>
          <button id="hangup" style="display: none;">Hangup</button>
        </div>
        <p>Conversation Relay Log:</p>
        <div
          id="log"
          style="
            width: 600px;
            background: #D3D3D3;
            padding: 10px;
            height: 400px;
            overflow: auto;">
        </div>
      </div>
    `;
  }

  #setStatus(status) {
    this.#status = status;
    if (this.#status === 'idle') {
      this.#showButtons('call');
    } else if (this.#status === 'inprogress') {
      this.#showButtons('hangup');
    }

    const statusEl = this.shadowRoot.querySelector('#status');
    statusEl.innerText = `Status: ${this.#status}`;
  }

  #setupCallHandlers(call) {
    call.on('disconnect', () => {
      this.#setStatus('idle');
    });
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

  setToken(token) {
    if (this.#token) {
      this.#device.updateToken(token);
    } else {
      this.#token = token;
      this.#handleInit();
    }
  }
}

customElements.define(
  'twilio-voice-ai-conversation',
  TwilioVoiceAIConversation
);
