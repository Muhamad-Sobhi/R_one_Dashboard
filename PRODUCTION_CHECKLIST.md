# Production checklist

## Secrets and credentials

- Rotate the Cloudinary API secret previously shared in chat, then update `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` together in the hosting provider's encrypted environment-variable settings.
- Set `CLOUDINARY_CLOUD_NAME` and `FIREBASE_PROJECT_ID` in the server environment.
- Provide Firebase Admin credentials using `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`. Keep the service-account key outside the source tree and grant only the permissions the server requires.
- Never use a `NEXT_PUBLIC_` prefix for Cloudinary secrets or Firebase Admin credentials.
- Keep `.env.local`, service-account JSON, private keys, and certificates out of source control and deployment artifacts.

## Deploy and verify

- Deploy the current `firestore.rules` to project `r-one-1450f`. Public reads are allowed for the storefront collections `products`, `categories`, `brands`, `offers`, and `shippingRates`, plus the single `workshopSettings/main` document. Writes to these collections and all operational collections remain restricted to active admins.
- Deploy the `Frontend` Next.js app separately. Set its `NEXT_PUBLIC_FIREBASE_*` web configuration and a server-only `FIREBASE_SERVICE_ACCOUNT_JSON` in the hosting provider. Never expose Firebase Admin credentials with a `NEXT_PUBLIC_` prefix or commit them.
- Deploy `storage.rules` only if Firebase Storage is used. Product image uploads currently go directly to Cloudinary using a server-generated signature.
- Set all required environment variables in the hosting provider, then restart or redeploy so Next.js reads them.
- Verify admin sign-in, product and multi-image upload, active promotions, and the public workshop profile on the production domain.
- Confirm HTTPS is enabled. Production responses add HSTS and other security headers; the Content Security Policy allows the app's Firebase, Cloudinary, and Google Fonts connections.
- Review account access and remove any Firebase Admin service account keys that are no longer needed.
