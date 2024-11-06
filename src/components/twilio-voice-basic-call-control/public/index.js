(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const identity = urlParams.get('identity');

  const response = await fetch(
    `/twilio-voice-dialer/token?identity=${identity}`
  );
  const data = await response.json();

  const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
  twilioVoiceDialer.setToken(data.token);
  twilioVoiceDialer.addEventListener('tokenWillExpire', async (e) => {
    const device = e.detail.device;

    const updateTokenResponse = await fetch(`/twilio-voice-dialer/token`);
    const updateTokenData = await updateTokenResponse.json();
    device.updateToken(updateTokenData.token);
  });
})();
