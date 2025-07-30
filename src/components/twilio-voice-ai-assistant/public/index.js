(async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const identity = urlParams.get('identity');
  const tokenUrl = `/twilio-voice-ai-assistant/token?identity=${identity}`;

  const response = await fetch(tokenUrl);
  const data = await response.json();

  const twilioVoiceAIAssistant = document.querySelector('twilio-voice-ai-assistant');
  twilioVoiceAIAssistant.setToken(data.token);
  twilioVoiceAIAssistant.addEventListener('tokenWillExpire', async (e) => {
    const device = e.detail.device;

    const updateTokenResponse = await fetch(tokenUrl);
    const updateTokenData = await updateTokenResponse.json();
    device.updateToken(updateTokenData.token);
  });
})();
