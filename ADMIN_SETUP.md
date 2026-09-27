# Create the first dashboard admin

This one-time script creates an Authentication user, or changes the password of
an existing user, and grants that UID access to the dashboard. Password input
is hidden and is never written to a file.

1. In Firebase Console, open **Project settings > Service accounts** and create
   a private key for the `r-one-1450f` project. Keep the downloaded JSON private;
   do not put it in the repository or share it in chat.
2. In a terminal, point Application Default Credentials at that file and run
   the script. The default account is `ms@r.one`; an optional email argument can
   be provided instead.

```sh
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
npm run admin:create
```

The script prompts for a new password twice without echoing it. Use at least 12
characters. It creates or updates the Authentication account, then writes the
matching `admins/{uid}` document with `active: true` using the Admin SDK.
After success, sign in at `http://localhost:3000` with that email and password.

Unset `GOOGLE_APPLICATION_CREDENTIALS` when finished. Never deploy or commit a
service-account private key.

## Firestore access rules

Publish the current contents of `firestore.rules` from the Firestore **Rules**
tab after updating the dashboard. The admin-only rules cover products,
categories, brands, orders, customers, suppliers, purchases, shipping rates,
and reviews; unmatched collections remain denied.