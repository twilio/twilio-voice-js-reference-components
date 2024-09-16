(async function () {
  const identity = 'alice';
  const response = await fetch(`/twilio-voice-dialer/token?identity=${identity}`
  );
  const data = await response.json();

  const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
  twilioVoiceDialer.setToken(data.token);
})();
