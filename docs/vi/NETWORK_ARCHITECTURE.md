# PRANA Protocol – Kiến trúc mạng

Tài liệu này mô tả cách app được expose ra internet: một Raspberry Pi ở nhà chạy app và kết nối tới VPS công khai qua **reverse SSH tunnel**. VPS là mặt tiền công khai; Pi là origin riêng tư.

Liên quan: [`SECURITY_OVERVIEW.md`](./SECURITY_OVERVIEW.md) liệt kê các cơ chế bảo mật trên đường dẫn này và trong swap modal.

Bản tiếng Anh: [`NETWORK_ARCHITECTURE.md`](../NETWORK_ARCHITECTURE.md)

---

## Tổng quan

- **Điểm vào công khai:** VPS (ví dụ `vps-prana.triethocduongpho.net`) — có IP public, DNS và SSL.
- **Origin:** Raspberry Pi ở nhà — chạy Node app và nginx; không expose trực tiếp ra internet.
- **Liên kết:** Reverse SSH tunnel từ Pi → VPS. Pi mở kết nối SSH tới VPS và yêu cầu VPS bind port 9000 rồi forward traffic đó về nginx trên Pi (port 80).

Vậy: **User → VPS (HTTPS) → tunnel (VPS:9000 → Pi:80) → Pi nginx → Node app hoặc static files.**

---

## Sơ đồ (đơn giản hóa)

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  VPS (public)                                                    │
│  • nginx :443 (HTTPS), :80 → redirect sang HTTPS                 │
│  • Server name: prana.triethocduongpho.net                       │
│  • SSL: Let’s Encrypt (ví dụ cert content.triethocduongpho.net) │
│  • Rate limiting, bảo mật                                        │
│  • Gzip: fallback; ưu tiên `*.gz` precompress từ origin          │
│                                                                  │
│  Mọi traffic HTTPS được proxy tới 127.0.0.1:9000                 │
└─────────────────────────────────────────────────────────────────┘
    │
    │  reverse SSH tunnel (Pi khởi tạo)
    │  VPS:9000  ◄──────►  Pi:80
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Raspberry Pi (nhà, sau NAT)                                     │
│  • nginx :80 (default_server)                                    │
│  • Server name: prana.triethocduongpho.net                       │
│                                                                  │
│  /           → proxy tới 127.0.0.1:4173 (Node: stats, /stake/, API) │
│  /bond/      → static + gzip_static từ disk                      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
  Node server (server/index.ts) trên port 4173
  • Phục vụ HTML, API và JSON cho SPA chính (gồm lazy /stake/)
  • Phục vụ asset Vite `dist/`; ưu tiên sibling `*.gz` (build level 9)
```

**Định danh IP cho rate-limit trên Node:** vì cả VPS nginx và Pi nginx đều append vào
`X-Forwarded-For`, service Node production phải chạy với
`TRUSTED_PROXY_HOP_COUNT=2`. Nhờ đó rate limiter swap theo IP chọn được IP client thật
từ chuỗi proxy hai hop, thay vì hop localhost của Pi nginx.

---

## 1. VPS (edge công khai)

**Tham chiếu cấu hình:** `docs/vps-prana.triethocduongpho.net`

**Vai trò:** Terminate HTTPS, áp dụng bảo mật, rồi forward mọi thứ vào tunnel (localhost:9000). Asset hashed được nén **một lần lúc build** (gzip level 9); VPS chỉ dùng gzip động làm fallback khi response chưa có `Content-Encoding: gzip`.

- **Port 80:** Redirect sang `https://prana.triethocduongpho.net`.
- **Port 443:** HTTPS với TLS 1.2/1.3 và cert Let’s Encrypt (đường dẫn tham chiếu `content.triethocduongpho.net`; có thể là cert multi-domain).
- **Rate limiting:** 50 req/s mỗi IP (`burst=40 nodelay`), 20 kết nối đồng thời mỗi IP; 429 và trang tùy chỉnh `rate_limited.html` cho request bị chặn.
- **Bảo mật:** Chặn các path quét phổ biến (ví dụ `.env`, `wp-`, `phpunit`, …) bằng đóng kết nối ngay (444).
- **Gzip:** `gzip on` với `gzip_comp_level 1` làm fallback cho API/HTML/legacy chưa có sibling `.gz`. **Không** xóa `Accept-Encoding` khi proxy — origin cần thấy encoding của client để trả `*.gz` (nhẹ hơn qua SSH tunnel, không tốn CPU nén từng request asset).
- **Proxy:** Mọi request (gồm `/`, `/assets/`, `/stake/`, `/bond/`) được gửi tới `http://127.0.0.1:9000` với header chuẩn (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto). Cache proxy tắt rõ ràng ở location chính để Pi/app kiểm soát caching. Legacy `/bond/assets/` nhận header cache dài hạn ở edge VPS; asset của `/stake/` nằm dưới location `/assets/` chính.

Vậy VPS **không** chạy app; nó chỉ terminate TLS và forward vào tunnel.

---

## 2. Reverse SSH tunnel

**Hướng:** Pi (client) → VPS (server).

**Lệnh điển hình (chạy trên Pi):**

```bash
ssh -R 9000:127.0.0.1:80 user@vps-host
```

Ý nghĩa:

- Pi giữ một kết nối SSH **tới** VPS.
- Trên **VPS**, SSH server bind `127.0.0.1:9000`.
- Mọi kết nối tới `VPS:9000` được forward qua SSH về **Pi:80** (nginx trên Pi).

Từ góc nhìn internet: user hit VPS:443 → nginx trên VPS gửi tới 127.0.0.1:9000 → đó là tunnel → traffic xuất hiện ở Pi:80.

**Quan trọng:** Pi phải khởi tạo phiên SSH. VPS không cần reach được IP của Pi; chỉ cần chấp nhận SSH từ Pi. Đó là lý do cách này hoạt động từ mạng nhà đứng sau NAT.

---

## 3. Raspberry Pi (origin)

**Tham chiếu cấu hình:** `docs/pi-prana.triethocduongpho.net`

**Vai trò:** Chạy nginx trên port 80 và Node app trên 4173; phục vụ SPA chính (stats + lazy `/stake/`) và SPA bond cũ.

- **Port 80:** nginx `default_server` cho `prana.triethocduongpho.net`.
- **`/`:** Proxy tới `http://127.0.0.1:4173` (Node server từ `server/index.ts`, port lấy từ env `PORT` hoặc 4173). Phục vụ SPA shell, API và JSON — gồm `/stake/` (lazy route; Node redirect bare `/stake` → `/stake/` với `308`). Forward `Accept-Encoding` để Node chọn `dist/**/*.gz` đã precompress bằng Vite.
- **`/bond/`:** Phục vụ từ `/var/www/html/prana/bond/` (React SPA cũ, try_files về `index.html`) với `gzip_static on`. Header no-cache cho HTML.
- **`/bond/assets/`:** Static asset từ disk với `gzip_static on`, cache dài hạn và CORS. Deploy bond kèm sibling `*.gz` cạnh JS/CSS hashed để static gzip có hiệu lực.

Vậy **chỉ** port **80** (nginx) cần reach được từ tunnel. Node app (4173) chỉ được nginx trên localhost dùng.

---

## 3b. Asset precompress (gzip level 9)

**Build (app chính):** `vite-plugin-compression2` trong `config/vite.config.js` ghi `*.gz` cạnh file `dist/` đủ điều kiện ở **gzip level 9** (threshold 1024 byte). Giữ file gốc cho client không nhận gzip.

**Serve (app chính):** `server/serveFile.ts` đọc `Accept-Encoding` và, nếu có sibling `.gz`, trả body đó với `Content-Encoding: gzip` và `Vary: Accept-Encoding`.

**Serve (bond):** Pi nginx `gzip_static on` làm tương tự cho `/bond/` khi có file `.gz` trên disk.

**Vì sao không chỉ tăng `gzip_comp_level` trên VPS:** nén on-the-fly tốn CPU mỗi request và trước đây còn buộc tunnel chuyển bản chưa nén (vì xóa `Accept-Encoding`). Precompress một lần lúc build nhỏ hơn dynamic level 6 và rẻ hơn lúc serve.

---

## 4. Luồng request (end to end)

1. User request `https://prana.triethocduongpho.net/` (hoặc bất kỳ path nào) kèm `Accept-Encoding: gzip`.
2. DNS resolve ra IP public của VPS.
3. VPS nginx nhận trên 443, terminate SSL, áp dụng rate limit và rule bảo mật, rồi `proxy_pass` tới `http://127.0.0.1:9000` **không xóa Accept-Encoding**.
4. Process lắng nghe trên VPS:9000 là SSH server (reverse tunnel). Nó forward request sang Pi qua kết nối SSH sẵn có.
5. Trên Pi, kết nối đó xuất hiện như request tới `127.0.0.1:80` (nginx).
6. Pi nginx:
   - Với `/` và `/stake/` (và hầu hết path khác): proxy tới `http://127.0.0.1:4173` (Node app), có thể trả body `*.gz` đã precompress.
   - Với `/bond/`: phục vụ từ disk, ưu tiên `gzip_static` khi có sibling `.gz`.
7. Response đi ngược lại: Node hoặc disk → Pi nginx → tunnel (đã gzip với asset precompress) → VPS nginx → user. Gzip động trên VPS bỏ qua body đã có `Content-Encoding`.

---

## 5. Vì sao thiết kế thế này

- **Không cần port forwarding ở nhà:** Pi không cần mở port trên router nhà; Pi chủ động mở SSH tới VPS.
- **Một endpoint công khai duy nhất:** SSL, rate limiting và giảm thiểu DDoS nằm trên VPS; Pi chỉ thấy traffic đã qua VPS.
- **Vận hành đơn giản:** App và nginx chạy trên một máy (Pi); VPS chủ yếu chạy nginx và SSH.

---

## 6. Vị trí file cấu hình

| Vai trò | File trong repo                         | Đường dẫn deploy điển hình (ví dụ) |
|--------|------------------------------------------|-------------------------------------|
| VPS    | `docs/vps-prana.triethocduongpho.net`     | ví dụ `/etc/nginx/sites-available/` và symlink trong `sites-enabled/` |
| Pi     | `docs/pi-prana.triethocduongpho.net`      | Cùng ý tưởng trên Pi                |

Sau khi sửa, reload nginx trên host tương ứng: `sudo nginx -t && sudo systemctl reload nginx`.

---

## 7. Kiểm tra prod khớp GitHub `main`

Sau `npm run redeploy` (build + restart), bất kỳ ai cũng có thể kiểm tra:

1. Mở footer trang: **Build** hiện git tag khi HEAD được tag (link tới GitHub release), nếu không thì short SHA (link tới commit).
2. Hoặc gọi `GET https://prana.triethocduongpho.net/api/version` và so `tag` (ví dụ `v2.0.0`) và/hoặc `commit` với GitHub.
3. Dấu `*` ở cuối label nghĩa là checkout bị dirty (thay đổi local chưa commit) lúc identity được resolve — không phải commit public sạch.

Identity UI được bake lúc `vite build`; `/api/version` được resolve khi Node process khởi động. Với luồng `redeploy` thông thường chúng khớp nhau. Redeploy từ checkout `main` sạch đã fetch tag (`git fetch --tags`) để khớp GitHub.

## 8. Ghi chú vận hành

- **Bind trên VPS:** Tunnel bind `127.0.0.1:9000` trên VPS, nên chỉ nginx trên VPS dùng được; đúng và an toàn.
- **SSL:** Chỉ VPS cần certificate; Pi chỉ nói HTTP với tunnel và với Node app trên localhost.
