# Anime Zone: naye AWS account pe poora setup (shuru se live tak)

Is guide mein naye AWS account se shuru karke ye sab ban jayega:

- **EC2 server**: website, database, login/VIP/key ki jaanch
- **S3 bucket**: videos rakhne ke liye (private)
- **AWS MediaConvert**: upload hui video se 360p, 480p aur Original banane ke liye
- **CloudFront** (optional): CDN, account verify hone ke baad

Order mein chalo. Har step ke aage ✅ laga ke aage badho.

> **Kabhi share mat karna** (chat, screenshot, kahin bhi): AWS secret key, GitHub token,
> `cloudfront-private.pem`, `.env.local` ki poori file, admin password.
> Share karne mein koi dikkat nahi: bucket name, account ID, role ARN, public key, CloudFront domain.

---

## Notepad mein ye values likhte jao

| Naam | Kahan se milega | Example |
|---|---|---|
| ACCOUNT_ID | Step 1 | `792394000641` |
| BUCKET | Step 3 | `hindianimezone-media-7291` |
| MEDIACONVERT_ROLE_ARN | Step 4a | `arn:aws:iam::ACCOUNT_ID:role/AnnimeMediaConvert` |
| ELASTIC_IP | Step 5 | `13.x.x.x` |
| CLOUDFRONT_KEY_PAIR_ID | Step 12 (optional) | `K2ABC...` |
| CLOUDFRONT_DOMAIN | Step 12 (optional) | `d1abc.cloudfront.net` |

---

## Step 0: Code GitHub pe taiyar rakho (Mac pe)

Server code GitHub se leta hai, isliye sabse naya code push hona chahiye:

```bash
cd ~/Desktop/annime && git status -sb && git push origin main
```

- Password ki jagah **GitHub Personal Access Token** lagta hai: GitHub → Settings → Developer settings →
  Tokens (classic) → `repo` scope. Token sirf terminal mein daalo.
- **Domain ya repo badla hai?** To `setup.sh` ki shuru ki lines mein `DOMAIN=` aur `REPO_URL=` badal ke commit aur push karo.

---

## Step 1: AWS account ki suraksha aur budget

1. Upar right corner mein **Region: Asia Pacific (Mumbai) `ap-south-1`** chuno. Poore setup mein yahi region rakhna.
2. **Root account pe MFA lagao:** upar right mein account name → **Security credentials** → **Assign MFA device**
   (Authenticator app).
3. **Account ID** note karo (account name ke menu mein 12 digit ka number).
4. **Credit check karo:** Billing and Cost Management → **Credits**. Dekho expiry date kya hai, aur S3, EC2,
   MediaConvert, CloudFront "Applicable products" mein hain ya nahi.
5. **Budget alert lagao:** Billing → **Budgets → Create budget → Customize → Cost budget**:
   - Monthly amount, jaise `$300`
   - Advanced options mein **Credits ko uncheck** karo, taaki credit se pehle ka asli kharcha dikhe
   - Alert 80% pe, apne email ke saath

---

## Step 2: CloudFront verification ki request abhi bhej do (free)

Naye account mein CloudFront tab tak band rehta hai jab tak AWS Support verify na kare. Jawab aane mein
1–2 din lagte hain, isliye request abhi bhej do. Tab tak site S3 se chalegi.

1. https://console.aws.amazon.com/support/home#/case/create kholo
2. **Account and billing** → Service: **Account** → Category: **Other Account Issues**
3. Subject: `Request to verify account for CloudFront`
4. Description:
   > Hello, I want to create a CloudFront distribution in account ACCOUNT_ID to deliver HLS video
   > from my private S3 bucket in ap-south-1 for my website DOMAIN. New accounts show "Your account
   > must be verified before you can add new CloudFront resources." Please verify my account. Thank you.
5. Contact: **Web**, phir **Submit**

---

## Step 3: S3 bucket (videos ke liye)

1. **S3 → Create bucket**
   - Bucket type: **General purpose**
   - Name: unique hona chahiye, jaise `hindianimezone-media-7291`. **Note karo.**
   - Object Ownership: **ACLs disabled**
   - **Block all public access: ON** (tick rehne do)
   - Versioning: Disable. Encryption: SSE-S3 (default).
   - **Create bucket**
2. **CORS:** bucket → **Permissions → Cross-origin resource sharing (CORS) → Edit**. Apna domain daalo:

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

   `ETag` zaroor rakhna, iske bina browser se S3 pe upload fail hota hai.

3. **Adhure upload ki safai:** bucket → **Management → Create lifecycle rule**
   - Name: `cleanup-incomplete`. Scope: **Apply to all objects** (acknowledge pe tick)
   - Sirf **"Delete expired object delete markers or incomplete multipart uploads"** chuno
   - **Delete incomplete multipart uploads: 2 days**, phir Create

---

## Step 4: IAM (permissions). Access key ki zaroorat nahi

Server ko IAM **role** milega, isliye `.env.local` mein koi AWS secret key nahi rakhni.

### 4a. MediaConvert role

1. **IAM → Roles → Create role** → AWS service → **MediaConvert** → Next
2. Permissions page pe 2 default policies dikhengi (S3FullAccess, APIGateway). Yahan **untick ka option nahi hota**,
   to seedha **Next** dabao.
3. Name: `AnnimeMediaConvert` → **Create role**
4. Role kholo → **Permissions** tab → dono default policies pe tick lagao → **Remove**
5. **Add permissions → Create inline policy → JSON**. Cmd+A se sab hatao, ye paste karo (`BUCKET` badlo).
   JSON `{` se shuru hona chahiye:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": "arn:aws:s3:::BUCKET/*" },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::BUCKET" }
  ]
}
```

6. Name: `bucket-access` → Create. Role page se **ARN** note karo.

### 4b. Server ki policy

**IAM → Policies → Create policy → JSON** (`BUCKET` aur `ACCOUNT_ID` badlo):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      "Resource": "arn:aws:s3:::BUCKET/*"
    },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::BUCKET" },
    { "Effect": "Allow", "Action": ["mediaconvert:CreateJob", "mediaconvert:GetJob", "mediaconvert:CancelJob"], "Resource": "*" },
    { "Effect": "Allow", "Action": "iam:PassRole", "Resource": "arn:aws:iam::ACCOUNT_ID:role/AnnimeMediaConvert" }
  ]
}
```

Name: `AnnimeVpsMedia` → Create policy.

### 4c. EC2 ke liye role

**IAM → Roles → Create role** → AWS service → **EC2** → Next → `AnnimeVpsMedia` pe tick lagao → Next →
Name: `AnnimeEc2Media` → Create role.

---

## Step 5: EC2 server

1. **EC2 → Instances → Launch instances**
   - Name: `annime-web`
   - AMI: **Ubuntu Server 26.04 LTS** (ya 24.04 LTS), 64-bit (x86)
   - Instance type: 16 GB RAM wala, jaise **m7i.xlarge** ya **t3.xlarge** (4 vCPU, 16 GB)
   - Key pair: **Create new key pair** → name `annime-key`, type RSA, format `.pem` → download ho jayegi.
     Ise sambhal ke rakhna, iske bina SSH nahi hoga.
   - Network settings → **Edit** → security group mein ye 3 rules:
     - SSH (22): **My IP**
     - HTTP (80): Anywhere (0.0.0.0/0)
     - HTTPS (443): Anywhere (0.0.0.0/0)
   - Storage: **100 GB gp3**. Videos S3 pe rahengi, isliye bahut disk ki zaroorat nahi.
   - **Advanced details:**
     - IAM instance profile: **AnnimeEc2Media**
     - Metadata version: **V2 only (token required)**
   - **Launch instance**
2. **Elastic IP (permanent IP):** EC2 → **Elastic IPs → Allocate** → nayi IP select karo → **Actions → Associate** →
   apna instance chuno. **ELASTIC_IP note karo.**
3. Launch karte waqt role ya IMDSv2 reh gaya ho, to baad mein aise karo:
   - Instance select karo → **Actions → Security → Modify IAM role** → `AnnimeEc2Media`
   - **Actions → Instance settings → Modify instance metadata options** → IMDSv2 **Required**
   - ("Allow tags in instance metadata" wala option **nahi** chahiye.)

---

## Step 6: Domain ka DNS

Domain provider (ya Cloudflare) mein:

| Type | Name | Value |
|---|---|---|
| A | `@` | ELASTIC_IP |
| A | `www` | ELASTIC_IP |

**Cloudflare use kar rahe ho?** Setup ke dauraan dono records **DNS only (grey cloud)** rakho, taaki Step 8 mein
SSL ban sake. Site chalne ke baad orange cloud (Proxied) on karo aur **SSL/TLS mode: Full (strict)** rakho.

Mac pe check karo, ELASTIC_IP dikhni chahiye (DNS faillne mein 5–30 min lag sakte hain):

```bash
dig +short hindianimezone.fun
```

---

## Step 7: Server pe login (Mac Terminal se)

```bash
chmod 400 ~/Downloads/annime-key.pem
```

```bash
ssh -i ~/Downloads/annime-key.pem ubuntu@ELASTIC_IP
```

Iske baad ke saare commands **server pe** chalane hain, jahan prompt `ubuntu@ip-...:~$` dikhta hai.
Mac ke terminal mein nahi.

---

## Step 8: Website install karo (1-click installer)

```bash
git clone https://github.com/anoopmauryadev/annime.git ~/annime
```

Repo private hai to username aur token maangega. Wo terminal mein hi daalna.

```bash
sudo bash ~/annime/setup.sh
```

Installer ye sab karta hai: Node 22, PM2, ffmpeg, Nginx, SSL (certbot), firewall, aur code `/var/www/annime` mein.
Phir `.env.local` banata hai, build karta hai, aur `annime` + `annime-transcoder` chalu karta hai.
End mein **DEPLOYMENT COMPLETED SUCCESSFULLY** aana chahiye.

Installer ke baad:

```bash
node -v && sudo -u annime -H pm2 status
```

`v22.x` dikhna chahiye, aur dono process **online**.

Pehla admin password:

```bash
sudo cat /var/www/annime/data/admin-bootstrap.txt
```

`https://DOMAIN/admin` pe login karke password badlo, phir:

```bash
sudo rm /var/www/annime/data/admin-bootstrap.txt && rm -rf ~/annime
```

> Website **`annime`** user se chalti hai, `ubuntu` se nahi. Isliye aage ke commands `sudo -u annime -H ...` ke saath hain.

---

## Step 9: IAM role check karo

```bash
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60") && curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

Jawab mein `AnnimeEc2Media` aana chahiye.

---

## Step 10: AWS ko website se jodo

```bash
sudo nano /var/www/annime/.env.local
```

File ke **end** mein ye jodo (apni values ke saath). Access key nahi daalni:

```
AWS_REGION=ap-south-1
AWS_S3_BUCKET=BUCKET
MEDIACONVERT_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/AnnimeMediaConvert
```

`Ctrl+O`, Enter, `Ctrl+X` se save karo. Check karo:

```bash
sudo grep -E "^AWS_|^MEDIACONVERT|^CLOUDFRONT" /var/www/annime/.env.local
```

Website restart karo aur AWS worker chalu karo:

```bash
cd /var/www/annime && sudo -u annime -H env TRANSCODE_WORKER_MODE=external pm2 restart annime --update-env && sudo -u annime -H pm2 restart annime-transcoder --update-env
```

```bash
cd /var/www/annime && sudo -u annime -H pm2 start scripts/cloud-worker.cjs --name annime-cloud && sudo -u annime -H pm2 save
```

```bash
sudo -u annime -H pm2 status && sudo -u annime -H pm2 logs annime-cloud --lines 20 --nostream
```

Teeno process **online** hone chahiye, aur log mein `"storage":true,"mediaConvert":true` dikhna chahiye.

Code ka self-test. Ye AWS se connect nahi karta, sirf signing ka code check karta hai. `PASS` aana chahiye:

```bash
cd /var/www/annime && sudo -u annime -H node scripts/test-cloud-delivery.cjs
```

---

## Step 11: Admin panel mein AWS on karo aur test karo

1. `https://DOMAIN/admin` → **Settings**
   - **Auto-Transcoding: ON**
   - **AWS storage & CDN** section: **S3 ✓** aur **MediaConvert ✓** green hone chahiye. CloudFront ✗ abhi theek hai.
   - **Upload destination → AWS S3**
   - **Transcoding engine → AWS MediaConvert**
   - **Playback source → AWS first**
   - (Optional) **Playback access → "Play uploaded file while processing" → ON**. Isse transcoding ke dauraan
     upload hui MP4 chalegi, aur us dauraan free users bhi poori HD dekh payenge.
2. Ek chhota episode (MP4, 100–300 MB) poster ke saath upload karo.
3. Transcode status: `AWS MediaConvert: NN%` → **`Done on AWS! 360p, 480p, Original ready.`** (5–15 min)
4. Website pe login karo, **key activate** karo, aur episode chalao:
   - 360p / 480p chale
   - VIP account se **Original Quality** chale
   - **F12 → Network** mein `.ts` files `BUCKET.s3.ap-south-1.amazonaws.com` se **200** status ke saath aayen
5. Bucket ka link seedha kholne pe **AccessDenied** aana chahiye. Iska matlab bucket private hai, jo sahi hai.

**Site live hai.**

---

## Step 12 (optional): CloudFront jodo, account verify hone ke baad

### 12a. Signing key (server pe)

```bash
sudo mkdir -p /etc/annime && cd /etc/annime && sudo openssl genrsa -out cloudfront-private.pem 2048 && sudo openssl rsa -pubout -in cloudfront-private.pem -out cloudfront-public.pem
```

```bash
sudo chown annime:annime /etc/annime/cloudfront-private.pem && sudo chmod 600 /etc/annime/cloudfront-private.pem && cat /etc/annime/cloudfront-public.pem
```

`-----BEGIN PUBLIC KEY-----` se `-----END PUBLIC KEY-----` tak copy karo. BEGIN aur END wali lines bhi copy karni hain.

### 12b. Public key aur key group (CloudFront console)

1. **Key management → Public keys → Create public key**: name `annime-key`, Key mein public key paste karo
   → Create → **ID (`K...`) note karo**
2. **Key groups → Create key group**: name `annime-group`, `annime-key` pe tick → Create

### 12c. Distribution

1. **Distributions → Create distribution** → plan poochhe to **Pay as you go**
2. Name: `annime-media`, type: **Single website configuration**, domain khaali chhodo → Next
3. Origin: **Amazon S3** → Browse S3 → apna bucket → **"Allow private S3 bucket access to CloudFront"** pe tick →
   Use recommended origin + cache settings → Next
4. Security: **Do not enable security protections** → Next → TLS step skip → **Create distribution**
5. Distribution → **Behaviors** → `Default (*)` → **Edit**:
   - Viewer protocol: **Redirect HTTP to HTTPS**
   - Allowed methods: **GET, HEAD, OPTIONS**
   - **Restrict viewer access: Yes → Trusted key groups → `annime-group`** (sabse zaroori)
   - Cache policy: **CachingOptimized**
   - Response headers policy: **CORS-With-Preflight**
   - **Save changes**
6. **General** tab se **Distribution domain name** note karo
7. S3 → bucket → Permissions → **Bucket policy** mein `cloudfront.amazonaws.com` wali policy honi chahiye.
   Na ho to CloudFront → Origins → Edit → **Copy policy** dabao aur bucket policy mein paste karo.

### 12d. Website mein jodo

```bash
sudo nano /var/www/annime/.env.local
```

End mein jodo:

```
CLOUDFRONT_DOMAIN=dxxxxxxxx.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=Kxxxxxxxx
CLOUDFRONT_PRIVATE_KEY_PATH=/etc/annime/cloudfront-private.pem
```

```bash
cd /var/www/annime && sudo -u annime -H env TRANSCODE_WORKER_MODE=external pm2 restart annime --update-env && sudo -u annime -H pm2 restart annime-cloud --update-env
```

Admin → Settings mein **CloudFront ✓** green hona chahiye. Ab F12 → Network mein `.ts` files `cloudfront.net` se aayengi.
Code mein kuch nahi badalna.

---

## Step 13 (optional): Purane server se data laana

Purani site ka data (users, anime, episodes) laana ho:

1. Purane server pe: `cd /var/www/annime && npm run backup`. Phir `data/anime.db` aur `public/uploads/` naye server
   pe copy karo (`scp` ya `rsync`). Website band karke copy karna:
   `sudo -u annime -H pm2 stop annime annime-transcoder annime-cloud`
2. Naye server pe owner theek karo aur website chalu karo:

```bash
sudo chown -R annime:annime /var/www/annime/data /var/www/annime/public/uploads && cd /var/www/annime && sudo -u annime -H pm2 restart annime annime-transcoder annime-cloud --update-env
```

3. Admin → Settings → **Copy VPS transcodes to S3: ON**, phir purani videos S3 pe bhejo (local copy waisi hi rahegi):

```bash
cd /var/www/annime && sudo -u annime -H npm run cloud:migrate
```

---

## Aage code update karne ka tarika

Mac se push karo:

```bash
cd ~/Desktop/annime && git push origin main
```

Server pe:

```bash
cd /var/www/annime && sudo -u annime -H git pull origin main && sudo -u annime -H npm ci && sudo -u annime -H npm run build
```

Build sahi ho jaye, tab restart karo:

```bash
cd /var/www/annime && sudo -u annime -H env TRANSCODE_WORKER_MODE=external pm2 restart annime --update-env && sudo -u annime -H pm2 restart annime-transcoder annime-cloud --update-env
```

> Chalte hue server pe **`setup.sh` dobara mat chalana**. Wo Nginx config phir se likhta hai aur SSL ka step bhi dobara chalata hai.

---

## Dikkat aaye to (is setup mein jo jo aaya tha)

| Dikkat | Wajah aur hal |
|---|---|
| `fatal: detected dubious ownership` | Repo `annime` user ki hai. `git` ko `sudo -u annime -H git -C /var/www/annime ...` se chalao |
| `sudo` Mac pe password maange | Command galti se Mac pe chal gayi. Server ke SSH terminal mein chalao |
| `better-sqlite3 ... required node >=22` | Purana `setup.sh` tha. Naya code pull karke installer dobara chalao (naya wala Node 22 lagata hai) |
| `Cannot find module '../../scripts/cluster/schema.cjs'` | Purana code tha. Latest code pull karo |
| Video upload 100% ke baad "Failed to create anime" | Nginx 64 KB limit. Latest `setup.sh` mein theek hai. Log mein dekho: `sudo grep "too large" /var/log/nginx/error.log` |
| Video play pe "Internal Server Error" / log mein `EPROTO wrong version number` | `/uploads/hls` ke liye Nginx routing. Latest `setup.sh` mein theek hai (`annime-protected-media.conf` include) |
| `{"error":"Active key required"}` | Normal hai. Login karke key activate karo |
| Bucket link pe `AccessDenied` | Normal hai. Bucket private hai |
| Upload pe "ETag" error | S3 CORS mein `ExposeHeaders: ETag` nahi hai (Step 3) |
| Admin mein S3 / MediaConvert ✗ | `.env.local` ki lines aur IAM role check karo (Step 9, 10), phir restart karo |
| "Your account must be verified ... CloudFront" | Step 2 wala support case. Tab tak S3 se chalao |
| CloudFront pe 403 | Behavior mein **Trusted key group** aur S3 **bucket policy** check karo |
| MediaConvert job failed | `sudo -u annime -H pm2 logs annime-cloud --lines 50 --nostream` dekho, aur MediaConvert role ki inline policy check karo |
| Sab kuch AWS se hata ke wapas VPS pe | Admin → Playback source → **VPS first**. Jin videos ki local copy hai, wo VPS se chalengi |

---

## Kharcha (andaza, Mumbai region)

- Video dekhne ka data: ~**$0.11/GB**. 480p mein ek viewer ka ek ghanta ~0.45 GB, 720p mein ~1.1 GB.
  CloudFront pe har mahine 1 TB free.
- S3 storage: ~$0.025/GB har mahine.
- MediaConvert: 24 min ka ek episode (360p + 480p + Original) ~**$0.50–0.75**.
- EC2 (16 GB) instance ka alag ghante ke hisaab se charge lagta hai.
- Pehle hafte roz **Billing → Bills** dekho, aur Step 1 ka budget alert zaroor lagao.

---

## Suraksha checklist

- [ ] Root account pe MFA
- [ ] Koi AWS access key nahi (server IAM role se chalta hai). Purani keys IAM mein Delete
- [ ] S3 **Block all public access: ON**
- [ ] CloudFront behavior mein **Restrict viewer access: Yes**
- [ ] EC2 IMDSv2 **Required**, SSH sirf **My IP** se
- [ ] `admin-bootstrap.txt` delete, admin password badla hua
- [ ] Chat mein bheja hua koi bhi token ya password revoke/badla hua
