(async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const identity = urlParams.get('identity');
  const tokenUrl = `/twilio-voice-ai-assistant/token?identity=${identity}`;

  const response = await fetch(tokenUrl);
  const data = await response.json();

  const TwilioVoiceAIAssistant = document.querySelector('twilio-voice-ai-assistant');
  TwilioVoiceAIAssistant.setToken(data.token);
  TwilioVoiceAIAssistant.addEventListener('tokenWillExpire', async (e) => {
    const device = e.detail.device;

    const updateTokenResponse = await fetch(tokenUrl);
    const updateTokenData = await updateTokenResponse.json();
    device.updateToken(updateTokenData.token);
  });
})();
