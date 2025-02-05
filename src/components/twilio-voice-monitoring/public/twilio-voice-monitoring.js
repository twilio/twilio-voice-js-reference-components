class TwilioVoiceMonitoring extends HTMLElement {
  #call;
  #monitorLog;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();
    this.#monitorLog = this.shadowRoot.querySelector('#log');

    const twilioVoiceDialer = this.shadowRoot.host.parentElement;
    twilioVoiceDialer.addEventListener('incoming', (e) => {
      const call = e.detail.call;
      this.#setCallHandlers(call);
    });
    twilioVoiceDialer.addEventListener('outgoing', (e) => {
      const call = e.detail.call;
      this.#setCallHandlers(call);
    });
  }

  #handleCallMessageReceived(message) {
    const { content, messageType } = message;
    if (messageType === 'user-defined-message') {
      const { label, statusCallbackEvent } = content;
      this.#log('STATUS', `${label} - ${statusCallbackEvent}`);
    }
  }

  #log(type, msg) {
    const p = document.createElement('p');
    p.innerHTML = `${type}: ${msg}`;
    this.#monitorLog.appendChild(p);

    this.#monitorLog.scrollTop = this.#monitorLog.scrollHeight;
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <div id="monitoring">
        <p>Monitoring:</p>
        <div
          id="log"
          style="
            width: 600px;
            background: #D3D3D3;
            padding: 10px;
            max-height: 400px;
            overflow: auto;">
        </div>
      </div>
    `;
  }

  #reset = () => {
    this.#call = undefined;
  };

  #setCallHandlers(call) {
    this.#call = call;
    this.#call.on('disconnect', this.#reset);
    this.#call.on('cancel', this.#reset);
    this.#call.on('reject', this.#reset);
    this.#call.on('messageReceived', (message) =>
      this.#handleCallMessageReceived(message)
    );
    this.#call.on('warning', (warningName) => {
      // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#warning-event
      this.#log('WARNING', `${warningName}`);
    });
    this.#call.on('warning-cleared', (warningName) => {
      // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#warning-cleared-event
      this.#log('INFO', `Warning-cleared - ${warningName}`);
    });
  }
}

customElements.define('twilio-voice-monitoring', TwilioVoiceMonitoring);
