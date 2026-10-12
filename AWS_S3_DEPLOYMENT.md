# AWS S3 + CloudFront + MediaConvert

The website, database and login/VIP/key checks stay on the VPS. Videos can be
uploaded, transcoded and served from AWS. Every option has an ON/OFF or VPS/AWS
switch in **Admin → Settings → AWS storage & CDN**, and all of them default to VPS.

| Setting | VPS | AWS |
|---|---|---|
| Upload destination | Resumable upload to the VPS (current behaviour) | Admin browser uploads straight to S3 (multipart, 16 MB parts) |
| Transcoding engine | FFmpeg on the VPS | AWS MediaConvert: 360p, 480p and Original (same outputs as FFmpeg) |
| Playback source | Serve from the VPS when a local copy exists | Serve from CloudFront (or signed S3 links) when the video is on S3 |
| Copy VPS transcodes to S3 | — | After FFmpeg finishes, upload the HLS folder and source video to S3 |
| Delete VPS copy after S3 upload | — | Free VPS disk once a video is safely on S3 |

The URLs stay the same (`/uploads/hls/...`). The VPS still checks VIP, key and
login for each playlist request. After the check passes it hands out signed
CloudFront links that expire after 6 hours. Each link only works for that one
quality's segments, so a free user can't reuse a 360p link to fetch 720p.
Downloads use a signed S3 link with `Content-Disposition: attachment`. The
download intro is skipped for files that exist only on S3.

All combinations work. For example, you can upload to the VPS, transcode with
FFmpeg, copy to S3 and serve from AWS. Or you can upload to S3, transcode with
MediaConvert and serve from AWS; in that case the video never touches the VPS.
If you upload to S3 and transcode with FFmpeg, the worker downloads the source
to the VPS first.

## 1. S3 bucket

1. In the S3 console, create a bucket in **ap-south-1 (Mumbai)**. Keep **Block all public access ON**.
2. Bucket → Permissions → **CORS**. Replace `hindianimezone.fun` if your domain is different:

```json
[
  {
    "AllowedOrigins": ["https://hindianimezone.fun", "https://www.hindianimezone.fun"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]
```

`ETag` must be exposed, otherwise browser uploads to S3 fail.

3. Bucket → Management → add a lifecycle rule: **Delete incomplete multipart uploads after 2 days**.

## 2. IAM user for the VPS

IAM → Users → create `annime-vps` (no console access) → attach this inline policy
(replace `YOUR_BUCKET` and `ACCOUNT_ID`) → create an access key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*" },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::YOUR_BUCKET" },
    { "Effect": "Allow", "Action": ["mediaconvert:CreateJob", "mediaconvert:GetJob", "mediaconvert:CancelJob"], "Resource": "*" },
    { "Effect": "Allow", "Action": "iam:PassRole", "Resource": "arn:aws:iam::ACCOUNT_ID:role/AnnimeMediaConvert" }
  ]
}
```

## 3. CloudFront (recommended)

1. Generate a signing key **on the VPS**. The private key never leaves the server:

```bash
sudo mkdir -p /etc/annime && cd /etc/annime && sudo openssl genrsa -out cloudfront-private.pem 2048 && sudo openssl rsa -pubout -in cloudfront-private.pem -out cloudfront-public.pem
```

```bash
sudo chown ubuntu:ubuntu /etc/annime/cloudfront-private.pem && sudo chmod 600 /etc/annime/cloudfront-private.pem && cat /etc/annime/cloudfront-public.pem
```

(Replace `ubuntu` with the user that runs PM2.)

2. CloudFront → Key management → **Public keys** → create one and paste `cloudfront-public.pem`. Note its **ID**.
   Then **Key groups** → create one containing that public key.
3. CloudFront → **Create distribution**:
   - Origin: your S3 bucket, **Origin access: Origin access control (OAC)** → create OAC → after creation, copy the
     suggested bucket policy into the bucket's Permissions → Bucket policy.
   - Viewer protocol: Redirect HTTP to HTTPS. Allowed methods: GET, HEAD, OPTIONS.
   - **Restrict viewer access: Yes → Trusted key groups →** the key group from step 2.
   - Cache policy: **CachingOptimized**. Response headers policy: **CORS-With-Preflight** (or SimpleCORS).
   - Price class: choose one that includes India (e.g. "North America, Europe, Asia, Middle East, and Africa").
4. Note the distribution domain (`dxxxx.cloudfront.net`). You can also add your own `cdn.` domain with an ACM certificate.

If CloudFront is not set up, the app falls back to signed S3 links. That also works, but you get no edge caching.

## 4. MediaConvert (optional, for AWS transcoding)

IAM → Roles → Create role → trusted service **MediaConvert** → name it `AnnimeMediaConvert`.
Give it S3 read/write on your bucket only, for example with an inline policy:

```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": "arn:aws:s3:::YOUR_BUCKET/*" },
  { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::YOUR_BUCKET" } ] }
```

## 5. `.env.local` on the VPS

Add these lines yourself on the server. Never commit them or paste them anywhere:

```
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
CLOUDFRONT_DOMAIN=dxxxxxxxx.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=K...            # Public key ID from step 3.2
CLOUDFRONT_PRIVATE_KEY_PATH=/etc/annime/cloudfront-private.pem
MEDIACONVERT_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/AnnimeMediaConvert
```

## 6. Deploy

From `/var/www/annime` as the app user, using the usual steps in `PLAYBACK_DEPLOYMENT.md`
(backup → stop → pull → `npm ci` → build → restart). Then start the AWS worker once:

```bash
pm2 start scripts/cloud-worker.cjs --name annime-cloud && pm2 save
```

On later deploys use `pm2 restart annime-cloud --update-env`. The worker runs
MediaConvert jobs and handles "Copy VPS transcodes to S3". No Nginx change is needed.

## 7. Turn it on in stages

1. Admin → Settings → AWS storage & CDN: all three badges should be green.
2. Turn ON **Copy VPS transcodes to S3** and run the one-time migration of existing videos (this keeps the local copies):

```bash
npm run cloud:migrate
```

3. Switch **Playback source → AWS first**. Play a few episodes as a free user and as a VIP. In browser DevTools → Network,
   segments should load from `cloudfront.net`.
4. Switch **Upload destination → AWS S3** and **Transcoding engine → AWS MediaConvert**, then upload one test episode.
   The transcode status shows `AWS MediaConvert: NN%`.
5. Only when everything plays from AWS, turn ON **Delete VPS copy after S3 upload**. To clear old local copies, run
   `node scripts/cloud-worker.cjs --migrate --delete-local`. Take a backup first; this frees disk and cannot be undone from the panel.

To roll back, switch Playback source back to **VPS first**. Any video that still has a local copy plays from the VPS again.

## Costs (approximate, ap-south-1, check your credit terms)

- CloudFront to India is about **$0.11/GB** (first 1 TB/month free). 1 TB of viewing costs about $100–110.
  480p uses about 0.45 GB per viewer-hour and 720p about 1.1 GB.
- S3 storage is about $0.025/GB-month. Transfer from S3 to CloudFront is free.
- MediaConvert (Basic tier) costs about $0.0075/min per SD output and $0.015/min per HD output. A 24-min episode with
  360p+480p+Original costs about $0.50–0.75.
- Check **Billing → Credits** to see which services the credit covers and when it expires. Set an **AWS Budget alert**.
