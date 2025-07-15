(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const identity = urlParams.get('identity');
  const tokenUrl = `/twilio-voice-conversation-relay/token?identity=${identity}`;

  const response = await fetch(tokenUrl);
  const data = await response.json();

  const twilioVoiceConversationRelay = document.querySelector('twilio-voice-conversation-relay');
  twilioVoiceConversationRelay.setToken(data.token);
  twilioVoiceConversationRelay.addEventListener('tokenWillExpire', async (e) => {
    const device = e.detail.device;

    const updateTokenResponse = await fetch(tokenUrl);
    const updateTokenData = await updateTokenResponse.json();
    device.updateToken(updateTokenData.token);
  });
})();
