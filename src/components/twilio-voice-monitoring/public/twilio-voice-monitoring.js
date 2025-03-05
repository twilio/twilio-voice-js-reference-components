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
    twilioVoiceDialer.addEventListener('device', (e) => {
      const device = e.detail.device;
      this.#setDeviceHandlers(device);
    });
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
      const { callSid, category, label, statusCallbackEvent } = content;
      const statusLog = {
        callSid,
        event: category,
        label,
        statusCallbackEvent,
      };
      this.#log('INFO[Call]', JSON.stringify(statusLog, null, 2));
    }
  }

  #handleCallWarning(warningName) {
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

    this.#log('WARNING[Call]', JSON.stringify(warningLog, null, 2));
  }

  #log(type, msg) {
    const p = document.createElement('p');
    p.innerHTML = `${type}: ${msg}`;
    this.#monitorLog.appendChild(p);

    this.#monitorLog.scrollTop = this.#monitorLog.scrollHeight;
  }

  #logCallEvent(event) {
    const callLog = {
      callSid: this.#callSid,
      event,
    };
    this.#log('INFO[Call]', JSON.stringify(callLog, null, 2));
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

  #setDeviceHandlers(device) {
    device.on('destroyed', () => {
      this.#log('INFO[Device]', 'destroyed');
    });
    device.on('error', (twilioError, call) => {
      const errorLog = {
        callSid: call.parameters.CallSid,
        code: twilioError.code,
        message: twilioError.message,
      };
      this.#log('ERROR[Device]', JSON.stringify(errorLog, null, 2));
    });
    device.on('incoming', (call) => {
      this.#log('INFO[Device]', `incoming call from: ${call.parameters.From}`);
    });
    device.on('registered', () => {
      this.#log('INFO[Device]', 'registered');
    });
    device.on('registering', () => {
      this.#log('INFO[Device]', 'registering');
    });
    device.on('tokenWillExpire', () => {
      this.#log('INFO[Device]', 'tokenWillExpire');
    });
    device.on('unregistered', () => {
      this.#log('INFO[Device]', 'unregistered');
    });
  }

  #setCallHandlers(call) {
    // https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#events
    this.#call = call;
    this.#call.on('accept', (call) => {
      this.#logCallEvent('accepted');
      this.#callSid = this.#call.parameters.CallSid;
    });
    this.#call.on('cancel', () => {
      this.#logCallEvent('canceled');
      this.#reset();
    });
    this.#call.on('disconnect', (call) => {
      this.#logCallEvent('disconnected');
      this.#reset();
    });
    this.#call.on('error', (twilioError) => {
      const errorLog = {
        callSid: this.#callSid,
        code: twilioError.code,
        message: twilioError.message,
      };
      this.#log('ERROR[Call]', JSON.stringify(errorLog, null, 2));
    });
    this.#call.on('messageReceived', (message) =>
      this.#handleCallMessageReceived(message)
    );
    this.#call.on('messageSent', (message) => {
      this.#logCallEvent('message-sent');
    });
    this.#call.on('mute', (isMuted, call) => {
      this.#logCallEvent(isMuted ? 'muted' : 'unmuted');
    });
    this.#call.on('reconnected', () => {
      this.#logCallEvent('reconnected');
    });
    this.#call.on('reconnecting', (twilioError) => {
      this.#logCallEvent('reconnecting');
    });
    this.#call.on('reject', () => {
      this.#logCallEvent('rejected');
      this.#reset();
    });
    this.#call.on('ringing', (hasEarlyMedia) => {
      this.#logCallEvent('ringing');
    });
    this.#call.on('sample', (sample) => {
      // Handle WebRTC sample data
    });
    this.#call.on('volume', (inputVolume, outputVolume) => {
      // Display volume levels to user
    });
    this.#call.on('warning', (warningName) => {
      this.#handleCallWarning(warningName);
    });
    this.#call.on('warning-cleared', (warningName) => {
      const warningClearedLog = {
        event: 'warning-cleared',
        callSid: this.#callSid,
        warningName,
      };
      this.#log('INFO[Call]', JSON.stringify(warningClearedLog, null, 2));
    });
  }
}

customElements.define('twilio-voice-monitoring', TwilioVoiceMonitoring);
