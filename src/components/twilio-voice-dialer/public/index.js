(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const identity = urlParams.get('identity');
  const tokenUrl = `/twilio-voice-dialer/token?identity=${identity}`;

  const response = await fetch(tokenUrl);
  const data = await response.json();

  const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
  twilioVoiceDialer.setToken(data.token);
  twilioVoiceDialer.addEventListener('tokenWillExpire', async (e) => {
    const device = e.detail.device;

    const updateTokenResponse = await fetch(tokenUrl);
    const updateTokenData = await updateTokenResponse.json();
    device.updateToken(updateTokenData.token);
  });
  twilioVoiceDialer.addEventListener('incoming', (e) => {
    const call = e.detail.call;
    // handle call events here
    // example: call.on('disconnect', (call) => {});
  });
  twilioVoiceDialer.addEventListener('outgoing', (e) => {
    const call = e.detail.call;
    // handle outgoing call events here
    // example: call.on('disconnect', (call) => {});
  });
})();
