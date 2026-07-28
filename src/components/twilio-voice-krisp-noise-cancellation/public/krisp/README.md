# Krisp SDK assets

The Krisp SDK library and noise-cancellation models are **proprietary** and
**separately licensed by Krisp**, so they are **not committed** to this repo
(they are git-ignored). Download them from the [Krisp SDK Portal](https://sdk.krisp.ai)
and place them here before running the component.

This reference component was built against **`@krispai/javascript-sdk` v2.3.9**
(`krisp-rtc-js-browser-sdk-2.3.9`) and NC models **v9.9**.

## Layout expected by the component

```
public/krisp/
  krispsdk.mjs                        # from the SDK's dist/krispsdk.mjs
  models/
    krisp-nc-o-nb-v2.kef              # outbound, narrowband  (model8)
    krisp-nc-o-med-v7.kef             # outbound, wideband     (modelNC)
    krisp-nc-i-nb-pro-v1.kef          # inbound,  narrowband  (model8)
    krisp-nc-i-wb-pro-v3.kef          # inbound,  wideband     (model16)
```

The model → file mapping is configured in
`../twilio-voice-krisp-noise-cancellation.js` (`getKrispSDK()`). If you ship
different model files, update the URLs there to match.
