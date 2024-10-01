(async function () {
  const response = await fetch(
    `http://localhost:3030/twilio-voice-dialer/token`
  );
  const data = await response.json();

  const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
  twilioVoiceDialer.setToken(data.token);
})();
