# Product image uploads

Cloudinary uploads are signed by a server route. The Cloudinary API secret is
never sent to the browser. Rotate the API secret that was shared in chat before
using uploads, then configure the newly generated secret locally and in your
server deployment environment.

Add these values to `.env.local` (never commit that file):

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-new-rotated-api-secret
FIREBASE_PROJECT_ID=r-one-1450f
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"r-one-1450f","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...","client_id":"...","token_uri":"https://oauth2.googleapis.com/token"}
```

Create a Firebase service account for the server in Firebase Console > Project
settings > Service accounts. Grant it only the permissions required to verify
Firebase Authentication tokens and read the `admins` collection. Keep the
service account JSON private too. `FIREBASE_SERVICE_ACCOUNT_JSON` must be one
line of valid JSON; escape newlines in `private_key` as `\\n`.

Restart the Next.js server after changing `.env.local`. Each product supports
up to 8 JPG, PNG, WEBP, or AVIF images, up to 8 MB per image. Uploads are stored
in the `r-one/products` Cloudinary folder. Firestore stores each image's secure
URL and public ID in the product's ordered `images` array; the first image is
the cover. Existing single-image products using `imageUrl` remain supported.

The reusable customer-facing gallery is `app/product-image-gallery.tsx`. Use it
on a product detail page like this:

```tsx
<ProductImageGallery
	images={product.images}
	imageUrl={product.imageUrl}
	productName={product.name}
/>
```
