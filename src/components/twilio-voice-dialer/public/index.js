(async function () {
  const response = await fetch(`/twilio-voice-dialer/token`);
  const data = await response.json();

  const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
  twilioVoiceDialer.setToken(data.token);
  twilioVoiceDialer.addEventListener('onTokenWillExpire', async (e) => {
    const device = e.detail.device;
    console.log('onTokenWillExpire', device);

    const updateTokenResponse = await fetch(`/twilio-voice-dialer/token`);
    const updateTokenData = await updateTokenResponse.json();
    device.updateToken(updateTokenData.token);
  });
  twilioVoiceDialer.addEventListener('onIncoming', (e) => {
    const call = e.detail.call;
    console.log('onIncoming', call);
  });
})();
