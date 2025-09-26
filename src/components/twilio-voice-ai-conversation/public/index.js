(async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const identity = urlParams.get('identity');
  const tokenUrl = `/twilio-voice-ai-conversation/token?identity=${identity}`;

  const response = await fetch(tokenUrl);
  const data = await response.json();

  const twilioVoiceAIConversation = document.querySelector('twilio-voice-ai-conversation');
  twilioVoiceAIConversation.setToken(data.token);
  twilioVoiceAIConversation.addEventListener('tokenWillExpire', async (e) => {
    const device = e.detail.device;

    const updateTokenResponse = await fetch(tokenUrl);
    const updateTokenData = await updateTokenResponse.json();
    device.updateToken(updateTokenData.token);
  });
})();
