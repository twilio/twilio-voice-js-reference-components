(async function () {
  const response = await fetch(`/twilio-voice-dialer/token`);
  const data = await response.json();

  const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
  twilioVoiceDialer.setToken(data.token);
})();
