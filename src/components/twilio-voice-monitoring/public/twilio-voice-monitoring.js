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

  #handleCallLogging(event) {
    const callLog = {
      callSid: this.#callSid,
      event,
    };
    this.#log('INFO', JSON.stringify(callLog, null, 2));
  }

  #handleCallMessageReceived(message) {
    const { content, messageType } = message;
    if (messageType === 'user-defined-message') {
      const { callSid, category, label, statusCallbackEvent } = content;
      const statusLog = {
        callSid,
        event: category,
        label,
        statusCallbackEvent,
      };
      this.#log('INFO', JSON.stringify(statusLog, null, 2));
    }
  }

  #handleWarning(warningName) {
    // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#warning-event

    // Network Quality Warnings
    // https://www.twilio.com/docs/voice/voice-insights/api/call/details-sdk-call-quality-events#network-warnings
    // Notify the agent that they might be encountering one-way or silent audio
    const networkWarnings = [
      'high-rtt',
      'high-jitter',
      'high-packet-loss',
      'high-packets-lost-fraction',
      'ice-connectivity-lost',
      'low-bytes-received',
      'low-bytes-sent',
      'low-mos',
    ];

    // Audio Quality Warnings
    // https://www.twilio.com/docs/voice/voice-insights/api/call/details-sdk-call-quality-events#audio-warnings
    const audioWarnings = [
      'constant-audio-input-level',
      // Notify the agent the sdk is unable to detect from mic, therefore
      // the other end of the call may be unable to hear them
      'constant-audio-output-level',
      // Notify the agent the sdk is unable to detect an output speaker/headset,
      // therefore the agent may be unable to hear audio from the call
    ];

    const category =
      networkWarnings.includes(warningName) ? 'Network' :
      audioWarnings.includes(warningName) ? 'Audio' :
      'General';

    const warningLog = {
      callSid: this.#callSid,
      category,
      warningName,
    };

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
    // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#events
    this.#call = call;
    this.#call.on('accept', (call) => {
      this.#handleCallLogging('call-accepted');
      this.#callSid = this.#call.parameters.CallSid;
    });
    this.#call.on('cancel', () => {
      this.#handleCallLogging('call-canceled');
      this.#reset;
    });
    this.#call.on('disconnect', (call) => {
      this.#handleCallLogging('call-disconnected');
      this.#reset;
    });
    this.#call.on('error', (error) => {
      const errorLog = {
        callSid: this.#callSid,
        code: error.code,
        message: error.message,
      };
      this.#log('ERROR', JSON.stringify(errorLog, null, 2));
    });
    this.#call.on('messageReceived', (message) =>
      this.#handleCallMessageReceived(message)
    );
    this.#call.on('messageSent', (message) => {
      this.#handleCallLogging('call-message-sent');
    });
    this.#call.on('mute', (isMuted, call) => {
      this.#handleCallLogging(isMuted ? 'call-muted' : 'call-unmuted');
    });
    this.#call.on('reconnected', () => {
      this.#handleCallLogging('call-reconnected');
    });
    this.#call.on('reconnecting', (twilioError) => {
      this.#handleCallLogging('call-reconnecting');
    });
    this.#call.on('reject', () => {
      this.#handleCallLogging('call-rejected');
      this.#reset;
    });
    this.#call.on('ringing', (hasEarlyMedia) => {
      this.#handleCallLogging('call-ringing');
    });
    this.#call.on('sample', (sample) => {
      // Handle WebRTC sample data
    });
    this.#call.on('volume', (inputVolume, outputVolume) => {
      // Display volume levels to user
    });
    this.#call.on('warning', (warningName) => {
      this.#handleWarning(warningName);
    });
    this.#call.on('warning-cleared', (warningName) => {
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
