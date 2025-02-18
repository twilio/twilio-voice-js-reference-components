class TwilioVoiceMonitoring extends HTMLElement {
  #call;
  #callSid;
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
      const statusLog = {
        event: 'status',
        label,
        statusCallbackEvent,
      };
      this.#log('INFO', JSON.stringify(statusLog, null, 2));
    }
  }

  #handleWarning(warningName) {
    // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#warning-event
    const warningLog = {
      callSid: this.#callSid,
      warningName,
      category: 'General',
    };

    // Network Quality Warnings
    // https://www.twilio.com/docs/voice/voice-insights/api/call/details-sdk-call-quality-events#network-warnings
    const networkWarnings = [
      'high-rtt',
      'low-mos',
      'high-jitter',
      'high-packet-loss',
      'high-packets-lost-fraction',
      'low-bytes-received',
      'low-bytes-sent',
      'ice-connectivity-lost',
    ];
    if (networkWarnings.includes(warningName)) {
      // Notify the agent that they might be encountering one-way or silent audio
      warningLog.category = 'Network';
    }

    // Audio Quality Warnings
    // https://www.twilio.com/docs/voice/voice-insights/api/call/details-sdk-call-quality-events#audio-warnings
    if (warningName === 'constant-audio-input-level') {
      // Notify the agent the sdk is unable to detect from mic, therefore
      // the other end of the call may be unable to hear them
      warningLog.category = 'Audio';
    } else if (warningName === 'constant-audio-output-level') {
      // Notify the agent the sdk is unable to detect an output speaker/headset,
      // therefore the agent may be unable to hear audio from the call
      warningLog.category = 'Audio';
    }

    this.#log('WARNING', JSON.stringify(warningLog, null, 2));
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
    this.#callSid = undefined;
  };

  #setCallHandlers(call) {
    this.#call = call;
    this.#call.on('accept', () => {
      this.#callSid = this.#call.parameters.CallSid;
    });
    this.#call.on('disconnect', this.#reset);
    this.#call.on('cancel', this.#reset);
    this.#call.on('reject', this.#reset);
    this.#call.on('messageReceived', (message) =>
      this.#handleCallMessageReceived(message)
    );
    this.#call.on('error', (error) => {
      // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#error-event
      const errorLog = {
        callSid: this.#callSid,
        code: error.code,
        message: error.message,
      };
      this.#log('ERROR', JSON.stringify(errorLog, null, 2));
    });
    this.#call.on('warning', (warningName) => {
      this.#handleWarning(warningName);
    });
    this.#call.on('warning-cleared', (warningName) => {
      // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#warning-cleared-event
      const warningClearedLog = {
        event: 'warning-cleared',
        callSid: this.#callSid,
        warningName,
      };
      this.#log('INFO', JSON.stringify(warningClearedLog, null, 2));
    });
  }
}

customElements.define('twilio-voice-monitoring', TwilioVoiceMonitoring);
