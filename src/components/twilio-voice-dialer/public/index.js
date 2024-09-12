(async function () {
  const identity = '';
  const response = await fetch(
    `http://127.0.0.1:3030/token?identity=${identity}`
  );
  const data = await response.json();

  const twilioVoiceDialer = document.querySelector('twilio-voice-dialer');
  twilioVoiceDialer.setToken(data.token);
})();
