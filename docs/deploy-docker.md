# استقرار RetroPulse با Docker

این راهنما برای یک سرور لینوکسی با Docker Engine، افزونهٔ Docker Compose و Caddy روی میزبان است. نسخهٔ فعلی را با یک کانتینر برنامه اجرا کنید. فایل SQLite در والیوم مستقل از کانتینر ذخیره می‌شود.

## راه‌اندازی

۱. Docker و Compose را طبق [راهنمای Docker Engine](https://docs.docker.com/engine/install/) نصب کنید و مطمئن شوید سرویس Docker هنگام بوت بالا می‌آید. برای Debian و Ubuntu می‌توانید با `sudo systemctl enable --now docker` آن را فعال کنید.
۲. سورس پروژه را همراه با `Dockerfile`، `compose.yaml` و فایل مخفی `.dockerignore` به سرور منتقل کنید. فایل‌های دیتابیس محلی فقط در صورت نیاز به مهاجرت منتقل می‌شوند.
۳. از ریشهٔ پروژه دستورهای زیر را اجرا کنید. مقادیر نمونهٔ `.env` را متناسب با سرور تنظیم کنید. اگر فایلی از قبل وجود دارد، کلیدها را در همان فایل ویرایش کنید.

```dotenv
RETRO_TAG=v1
RETRO_PORT=3000
```

```bash
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
curl -fsS http://127.0.0.1:3000/ > /dev/null
```

ساخت ایمیج به دسترسی به رجیستری ایمیج Node و رجیستری npm نیاز دارد. اگر Docker Hub در دسترس نیست، می‌توانید `NODE_IMAGE=public.ecr.aws/docker/library/node:24-bookworm-slim` را در `.env` تنظیم کنید. Docker پس از خروج فرایند، کانتینر را دوباره بالا می‌آورد. وضعیت `unhealthy` را در مانیتورینگ دنبال کنید، چون صرفاً تغییر وضعیت سلامت، ری‌استارت ایجاد نمی‌کند.

## دامنه و HTTPS

Caddy را [روی میزبان نصب کنید](https://caddyserver.com/docs/install). DNS دامنه را به سرور وصل کنید و پورت‌های ۸۰ و ۴۴۳ را باز کنید. پورت برنامه در Compose فقط روی `127.0.0.1` منتشر می‌شود. در فایل `/etc/caddy/Caddyfile` دامنهٔ واقعی و در صورت تغییر، مقدار `RETRO_PORT` را قرار دهید.

```caddyfile
retro.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://retro.example.com/ > /dev/null
```

بعد از استقرار، از طریق دامنه یک برد آزمایشی بسازید و با مرورگر دوم وارد شوید. برای هشدار قطعی، آدرس HTTPS را از خارج سرور پایش کنید. اگر ابزار داخلی است، دسترسی را در شبکه یا درگاه ورود سازمان محدود کنید.

## داده، بکاپ و به‌روزرسانی

- والیوم `retro-tools_retro-data` فایل `/app/data/retro.sqlite` را نگه می‌دارد. `docker compose down` والیوم را حفظ می‌کند. گزینهٔ `-v` والیوم را حذف می‌کند.
- برای بکاپ آنلاین، از دستور زیر استفاده کنید. اگر آن را زمان‌بندی می‌کنید، فقط خروجی موفق را رمزگذاری و خارج از سرور نگه دارید. بازیابی را روی محیط آزمایشی امتحان کنید.

```bash
umask 077
docker compose exec -T app node --input-type=module -e '
  import { createReadStream } from "node:fs";
  import { mkdtemp, rm } from "node:fs/promises";
  import { pipeline } from "node:stream/promises";
  import { backup, DatabaseSync } from "node:sqlite";
  const dir = await mkdtemp("/tmp/retro-backup-");
  const file = dir + "/retro.sqlite";
  const db = new DatabaseSync("/app/data/retro.sqlite", { readOnly: true });
  try {
    await backup(db, file);
    await pipeline(createReadStream(file), process.stdout);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
' > "retro-backup-$(date +%F-%H%M%S).sqlite"
```

- برای به‌روزرسانی بکاپ بگیرید، نسخهٔ جدید سورس را منتقل کنید و `RETRO_TAG` را در `.env` تغییر دهید. سپس `docker compose build --pull app` و `docker compose up -d --no-build --wait` را اجرا کنید. برای برگشت، تگ قبلی را در `.env` قرار دهید و با همان دستور `up` برگردید. ایمیج قبلی را برای این کار نگه دارید.
- برای بررسی خطاها از `docker compose logs --tail=100 app` استفاده کنید.
