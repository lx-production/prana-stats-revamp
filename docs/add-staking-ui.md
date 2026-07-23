# Gộp `staking-ui` thành lazy route `/stake` trong main app

## Tóm tắt kiến trúc

- Dùng chung một Vite app, `WagmiProvider`, React Query, locale, favicon và design system.
- Một SPA, nhiều path (không React Router): `/` (stats), `/stake/` (staking), `/terms`, `/privacy` — chọn page theo `window.location.pathname` (`useAppPathname` + `constants/appRoutes`).
- `/` và `/stake/` là `React.lazy`; người vào trang stats không tải code staking; `/terms` và `/privacy` giữ page nhỏ eager như hiện tại.
- Link `/stake/` dùng navigation thông thường (full URL), không client-side router library.
- Contract reads đi qua backend API chuyên biệt; Alchemy key chỉ tồn tại server-side.
- Ví người dùng vẫn ký permit và gửi transaction trực tiếp.
- Chuyển toàn bộ staking sang TypeScript, bigint chính xác và chỉ báo thành công sau khi receipt được xác nhận.

## Tiến độ

- [x] **Bước 1 — Tách homepage và thiết lập lazy `/stake/`** (`40e0da1`): frontend/server typecheck pass, 70 server tests pass, production build pass; `StatsPage` và `StakingPage` đã thành chunk riêng, `/stake` redirect `308` giữ query string và direct refresh `/stake/` trả SPA shell.
- [x] **Bước 2 — Chuẩn hóa constants, ABI và types**: `network.ts` chain ID + seconds; typed minimal ABI; permit constants; `types/blockchain.types.ts` (`Address`/`Hex`); `features/staking/staking.types.ts`; stake route tests dùng fixture dist (không phụ thuộc `dist/`); `npm test` / `test:server`; typecheck + server tests pass.
- [x] **Bước 3 — Tạo backend staking read API**: `GET /api/staking/config` (30s cache) + `GET /api/staking/account` (`private, no-store`, checksum trước rate-limit, 30/IP + 120/global); cùng `blockTag`; amounts/nonces string; 405 non-GET; 400/502 redacted (response + logs); tests trong `stakingApi.test.ts`.
- [x] **Bước 4 — Port form và account state**: React Query `useStakingConfig` / `useStakingAccount`; `stakingMath` (Solidity bigint interest + `parseStakeAmount`); `DurationSelector` chip grid; `StakingForm` (balance+MAX trong amount header, bỏ cap 10M); `ActiveStakes`/`StakeCard` read-only; `WalletControl`; `staking.copy` VI/EN; `npm run test:staking`.
- [x] **Bước 5 — Harden permit và transaction flow**: `useStakeTransaction` (`createPermitSnapshot` + `submitStakeWithPermit` + `permitAndStake`); một CTA gold; claim-before-unstake / grace; lỗi VI/EN; Polygonscan; tests permit/status/errors/CTA phase.
- [x] **Bước 6 — Đồng bộ styling với main app**: shell dark + shader `0.32`; `GlassPanel`/`StatusBanner`; inline `LanguageToggle`; gold CTA/chip; Lucide; contract links; mobile layout; **a11y closeout**: `prefers-reduced-motion` (shader off + freeze gold border), EarlyUnstake focus trap/Escape, DurationSelector roving tabindex + mũi tên, GlassPanel `focus-within`. *(Commit phải `git add` các file `components/ui/*` + type mới — không dùng `-am` alone.)*
- [x] **Bước 7 — Xóa phần dư thừa của `staking-ui`**: xóa toàn bộ directory legacy; form/stakes/actions sống ở `features/staking/` + `/stake/`; license/contact từ README cũ ghi vào closeout; root `README` trỏ `/stake/` + doc này.
- [ ] **Bước 8 — Deployment và cập nhật tài liệu vận hành**: config/docs trong repo đã sẵn sàng; code review sau refactor Swap đã hoàn tất và Hero STAKE đã trỏ vào lazy route `/stake/`; rollout nginx Pi/VPS, public smoke-test và rollback window vẫn thực hiện sau khi deploy.

## 1. Cấu trúc và phần dùng chung

Cấu trúc đích:

```text
pages/
├── StatsPage.tsx
└── StakingPage.tsx

features/staking/
├── components/
│   ├── StakingForm.tsx
│   ├── DurationSelector.tsx
│   ├── ActiveStakes.tsx
│   ├── StakeCard.tsx
│   ├── WalletControl.tsx
│   └── EarlyUnstakeDialog.tsx
├── hooks/
│   ├── useStakingConfig.ts
│   ├── useStakingAccount.ts
│   ├── useStakeTransaction.ts
│   └── useStakeActions.ts
├── staking.copy.ts
├── stakingMath.ts
└── staking.types.ts

components/ui/
├── PranaButton.tsx
├── GlassPanel.tsx
└── StatusBanner.tsx
```

Các phần dùng chung:

| Nhu cầu | Nguồn dùng chung |
|---|---|
| Wagmi/React Query providers | `features/web3/Web3Providers.tsx` (lazy via `StakingEntry` / `SwapEntry`; not root `main.tsx`) |
| Connect, disconnect, switch Polygon | `features/web3/useInjectedWallet.ts` |
| Locale VI/EN | `SiteLanguageProvider`, `useSiteLanguage`, `LanguageToggle` |
| Path matching (`/terms`, `/privacy`, `/stake`) | `constants/appRoutes.ts` + `useAppPathname` |
| Polygon RPC (frontend public) | `constants/network.ts` + `features/web3/wagmiConfig.ts` |
| PRANA address/decimals | `constants/sharedContracts.ts` (đã có) |
| Staking/Interest address và ABI | `constants/stakingContracts.ts` (typed ABI `as const`, tối thiểu cho stats + UI) |
| Format số/ngày giờ | Mở rộng `utils/formatters.ts` |
| Rút gọn wallet address | `formatCompactAddress` trong `features/web3/walletFormatting.ts` (Swap + staking dùng chung) |
| Favicon | `useSpinningFavicon` hiện tại |
| Background | `FlutterShaderBackground` (homepage/legal shell); staking dùng cùng shader với brightness thấp hơn |
| Glass / gold CTA | Class hero hiện có (`btn-hero`, `btn-gold-border`, `btn-glass`) + UI primitive mới khi cần |
| Footer / legal | Reuse `AppFooter` trên homepage, legal pages và staking page; contract links của staking đặt riêng trong page content |
| Transaction receipt pattern | Theo mô hình đã dùng trong `useUniswapSwap` |

ABI staking chuẩn hóa thành object ABI `as const`, đủ cho cả Viem/Wagmi và Ethers. Bao gồm các read/write function thực sự dùng; bỏ ABI admin và event không cần thiết khỏi frontend bundle.

## 2. Các bước triển khai

### Bước 1 — Tách homepage khỏi entrypoint ✅

Baseline: v2.3.1 đã có path resolver cho `/terms` và `/privacy` trong `main.tsx` (shell chung: `LanguageToggle` + `FlutterShaderBackground` + `AppFooter`).

- Chuyển content homepage (`HomePage`) từ `main.tsx` sang `pages/StatsPage.tsx` (main + `AppFooter`; **không** nhét lại shader/language toggle vào StatsPage — chúng thuộc shell).
- Mở rộng resolver hiện có:
  - `/stake` và mọi path bắt đầu bằng `/stake/` → lazy `StakingEntry` → `StakingPage` (không dùng shell homepage, để tránh prefetch stats / GLB).
  - `/terms`, `/privacy` giữ hành vi hiện tại.
  - Còn lại → lazy `StatsPage`.
- `main.tsx` giữ: global CSS, `SiteLanguageProvider`, favicon, path resolver, `Suspense`, shell homepage/legal. Web3 providers sống trong lazy `StakingEntry` / `SwapEntry`.
- Thêm `isStakePath` vào `constants/appRoutes.ts`; dùng chung `STAKE_PATH = "/stake"` và `STAKE_CANONICAL_PATH = "/stake/"` trong hero, client matcher và server redirect để tránh route string bị drift.
- Path `/stake` được server redirect `308` sang `/stake/`; `/stake/` serve `dist/index.html`.
- Chuyển `prefetchInitialJson()` vào `StatsPage` để `/stake/` (và legal pages) không tải dữ liệu stats.
- Gỡ preload `model-viewer` và `prana-coin.glb` khỏi HTML chung; kích hoạt chúng từ `StatsPage`/hero.
- CTA STAKE trong hero trỏ `STAKE_CANONICAL_PATH` (`/stake/`) cùng tab; đã chuyển khỏi prod legacy sau code review hậu refactor Swap.
- Staking placeholder: link về `/`, link xem protocol statistics và shared `AppFooter`; dùng class button hiện có khi có UI tạm.
- Trước Bước 2, thêm automated tests cho `isStakePath`, redirect `/stake` (kể cả query string), direct refresh `/stake/`, `/stake/*` SPA fallback và negative case `/staking`.

### Bước 2 — Chuẩn hóa constants, ABI và types ✅

- Hợp nhất/chuẩn hóa tiếp trên nền đã có: `sharedContracts.ts`, `stakingContracts.ts`, `network.ts`; xóa bản sao trong `staking-ui`.
- Thay ABI human-readable/ABI lớn bằng một typed ABI tối thiểu dùng chung (đủ stake/claim/unstake/permit reads+writes cho UI mới; stats loader có thể dùng chung hoặc subset).
- Bổ sung constants còn thiếu (không hardcode lại những gì `network` / shared đã có):
  - Polygon chain ID (nếu chưa export từ một nguồn chuẩn).
  - Permit domain name `Prana_v2`, version `1`.
  - Permit deadline 1 giờ.
  - Seconds per day/year.
- Không hardcode duration/APR, min stake, grace period hoặc penalty trong client; lấy từ backend/on-chain.
- Tạo TypeScript types cho config, account snapshot, stake record, permit snapshot và transaction status.
- Đảm bảo Tailwind/TypeScript config scan/include `pages/**` và `features/**` (Bước 1 có thể đã thêm `pages/**`).


### Bước 3 — Tạo backend staking read API ✅

Thêm hai GET endpoint:

```ts
GET /api/staking/config

{
  chainId: 137,
  blockNumber: number,
  blockTimestamp: number,
  paused: boolean,
  minStakeRaw: string,
  gracePeriodSeconds: number,
  earlyUnstakePenaltyPercent: number,
  durations: Array<{
    seconds: number,
    days: number,
    apr: number
  }>,
  contracts: {
    prana: HexAddress,
    staking: HexAddress,
    interest: HexAddress
  },
  permitDomain: {
    name: "Prana_v2",
    version: "1"
  }
}
```

```ts
GET /api/staking/account?address=0x...

{
  address: HexAddress,
  blockNumber: number,
  blockTimestamp: number,
  balanceRaw: string,
  permitNonce: string,
  stakes: Array<{
    id: number,
    amountRaw: string,
    startTime: number,
    durationSeconds: number,
    apr: number,
    lastClaimTime: number
  }>
}
```

Quy tắc backend:

- Validate và checksum address; invalid address trả `400`.
- Resolve một block number rồi thực hiện toàn bộ contract reads với cùng `blockTag`.
- Token amounts/nonces serialize thành decimal string, không convert qua `number`.
- `/config`: server/browser cache 30 giây.
- `/account`: `private, no-store`; chỉ fetch khi wallet đã kết nối và refetch sau receipt.
- Thêm rate limit `/account`: 30 request/IP/phút và 120 request/phút trên toàn server để bảo vệ Pi/Alchemy.
- Upstream RPC failure trả lỗi chung `502`, không trả URL/key hoặc raw provider error.
- Không tạo generic JSON-RPC proxy.
- Backend tiếp tục dùng `VITE_ALCHEMY_POLYGON_MAIN` làm Polygon RPC mặc định, theo cấu hình server hiện tại. Biến này chỉ được đọc ở server; frontend main app không tham chiếu nó.


### Bước 4 — Port form và account state ✅

- Chuyển `StakingForm`, `ActiveStakes` và hooks sang TS/TSX trong feature folder.
- Dùng React Query:
  - `['staking-config']`, stale time 30 giây.
  - `['staking-account', address]`, chỉ enabled với address hợp lệ, không polling.
- `PranaBalance` không còn là card riêng; đưa balance và nút MAX vào header của amount input.
- Bỏ giới hạn UI hardcode 10 triệu PRANA; max hợp lệ là số dư hiện tại.
- Parse amount bằng `parseUnits(..., PRANA_DECIMALS)`; reject quá 9 chữ số thập phân.
- Min stake, paused state, APR và duration dùng dữ liệu config.
- Duration mặc định là 30 ngày nếu tồn tại, nếu không dùng option đầu tiên.
- Khi config refresh loại bỏ kỳ hạn đang chọn, form chuyển sang option hợp lệ; CTA và transaction hook đều chặn kỳ hạn không còn trong snapshot mới nhất.
- Thay MUI slider bằng grid button/chip rời rạc; mỗi option hiển thị số ngày và APR, dùng được bằng keyboard.
- Projected interest dùng bigint và đúng thứ tự làm tròn của Solidity:

```text
annualInterest = amountRaw × APR / 100
interestPerSecond = annualInterest / 31,536,000
totalInterest = interestPerSecond × duration
```


### Bước 5 — Harden permit và transaction flow ✅

Giữ một nút gold full-width:

1. `Permit & Stake` (hoặc `Tiếp tục Stake` nếu còn Permit hợp lệ sau khi user từ chối tx)

Luồng kết hợp:

- Validate connected wallet, Polygon chain (switch nếu cần), config không paused, amount ≥ min và amount ≤ balance.
- `createPermitSnapshot()`: **refetch account phải thành công và đúng wallet đang thao tác** (không dùng cache stale/cross-account), lấy nonce mới, ký EIP-712, trả `PermitSnapshot` trực tiếp (và lưu state cho retry trước broadcast).
- `submitStakeWithPermit(snapshot)` nhận Permit qua tham số — không phụ thuộc React state đã flush; sau khi có hash chỉ resume `waitForTransactionReceipt`, không `writeContract` lần hai.
- Trước ký và trước broadcast, kiểm tra lại duration/min stake theo config hiện tại để config đổi giữa hai popup không tạo giao dịch chắc chắn revert.
- `permitAndStake()` điều phối resume receipt / reuse permit / create+stake; không hiện banner “Permit đã ký” giữa hai popup.
- Chỉ `setSuccess()` sau receipt thành công; lỗi refetch account sau đó là **warning không fatal**.
- Từ chối Permit → không gọi transaction; từ chối Stake **trước** broadcast → giữ Permit; lỗi receipt **sau** hash → CTA `Tiếp tục xác nhận` (không gửi tx mới).
- Tự hủy permit nếu user đổi amount/duration/account/chain hoặc deadline hết hạn.

Stake management:

- Tính thời gian hiện tại từ `blockTimestamp + elapsed time` để giảm phụ thuộc clock máy người dùng.
- Claimable interest dùng `lastClaimTime`, maturity và grace period; không còn “always allow claiming”.
- Stake đã mature nhưng còn lãi claimable trong grace period:
  - Cho claim.
  - Disable unstake và yêu cầu claim trước, tránh xóa stake làm mất lãi.
- Sau grace period:
  - Disable claim.
  - Cho unstake principal nhưng cảnh báo lãi chưa claim đã hết hạn.
- Early unstake dùng dialog riêng, không dùng `window.confirm`.
- Dialog hiển thị penalty lấy từ contract, principal dự kiến nhận lại và cảnh báo toàn bộ accrued interest sẽ bị mất.
- Mỗi action chờ receipt rồi mới refetch; khóa các action khác trong lúc một transaction đang chạy.
- Chuẩn hóa lỗi VI/EN cho user rejection, wrong chain, insufficient balance, expired permit, revert và RPC unavailable; không render nguyên raw wallet/provider error.

### Bước 6 — Đồng bộ styling với main app ✅

- Bỏ hoàn toàn light theme và `ThemeContext`; staking dùng dark theme của main app.
- Page shell:
  - `bg-[#050116]`, text trắng.
  - Dùng `FlutterShaderBackground` với brightness thấp hơn homepage (không dùng lại `NeuralShaderBackground` trừ khi có lý do riêng).
  - Container responsive khoảng `max-w-5xl/6xl`.
- Panel/form/stake card:
  - `rounded-2xl`.
  - `border-white/10`.
  - `bg-white/5`.
  - `backdrop-blur-md`.
  - Hover/focus border giống `StatCard`.
- Primary CTA dùng class gold hiện có (`btn-hero btn-gold-border` / tương đương SwapModal).
- Secondary/claim dùng cyan–emerald hoặc `btn-glass`; early unstake dùng red nhưng giữ cùng border/glass language.
- Input dùng nền trong suốt, border trắng mờ, focus ring vàng/cyan.
- Progress bar dùng cyan/gold gradient; status dùng pill `Active`, `Matured`, `Claim first`, `Grace expired`.
- Dùng Lucide `Loader2`, `Wallet`, `Lock`, `Coins`, `ExternalLink`; bỏ unicode spinner.
- Alerts dùng chung `StatusBanner` với `role="status"` hoặc `role="alert"` và `aria-live`.
- Mobile:
  - Duration options thành grid 3 cột (mọi breakpoint).
  - Action buttons full width.
  - Stake metadata chuyển từ nhiều cột về stack.
  - Transaction hashes wrap an toàn.
- `LanguageToggle`: homepage/legal giữ placement `fixed` trong shell `main.tsx`; staking header dùng `inline` (mở rộng prop nếu cần).
- Toàn bộ copy nằm trong `staking.copy.ts`, chọn đúng một ngôn ngữ theo toggle; bỏ các câu trộn Việt–Anh.
- Staking page metadata: Closeout Bước 1 đã thêm `usePageMetadata` (title + description theo locale, restore khi unmount). Giữ hành vi đó khi port UI đầy đủ. Open Graph/Twitter vẫn là metadata chung của PRANA Protocol (một HTML shell).

### Bước 7 — Xóa phần dư thừa của `staking-ui` ✅

Xóa hoàn toàn:

- `InterestContractBalance`: main `StakingStats` đã hiển thị Interest Balance và Committed.
- `StakingContractBalance`: main đã có Total Value Staked.
- `ThemeSwitcher` và `ThemeContext`.
- Standalone header/footer/copyright shell.
- Standalone `App.jsx`, `main.jsx`, `index.html`, `index.css`.
- Duplicate favicon implementation và duplicate icon.
- MUI/Emotion slider.
- `vite.config.js`, compression plugin, package manifest/lockfile, ESLint config và `.env` riêng.
- Duplicate Solidity contracts; hash hiện tại giống hệt bản trong root `contracts/`.
- Hardcoded `durations.js`.
- `staking-ui/dist`.
- Standalone GitHub footer link.

Giữ lại dưới dạng mới:

- Staking form.
- Wallet-specific PRANA balance.
- Active stakes.
- Claim, unstake và early-unstake actions.
- Staking/Interest contract Polygonscan links dưới dạng compact verification links trong page header/footer.
- Nội dung cần thiết từ README được nhập vào docs chính trước khi bỏ directory.

### Bước 8 — Deployment và docs 🚧

- Routing đã hoàn thành từ Bước 1: Node phục vụ `/stake/` bằng SPA shell, `/stake` redirect `308`, và Vite tạo staking thành hashed lazy chunk trong một `dist/`.
- Đã cập nhật `NETWORK_ARCHITECTURE.md`:
  - `/stake/` đi qua Node giống `/`.
  - Không còn static staking directory riêng.
- Đã cập nhật đồng bộ các tài liệu còn mô tả `/stake/` là static legacy SPA:
  - `docs/vi/NETWORK_ARCHITECTURE.md`.
  - `docs/swap-modal-technical-overview.md`.
  - `docs/vi/swap-modal-technical-overview.md`.
- Đã chuẩn bị config Pi nginx trong repo (`docs/pi-prana.triethocduongpho.net`):
  - Xóa redirect/location/alias `/stake`.
  - Giữ một `location /` proxy Node (và giữ `/bond/` static).
- Đã chuẩn bị config VPS nginx trong repo (`docs/vps-prana.triethocduongpho.net`):
  - Bỏ `stake` khỏi legacy asset cache; chỉ còn `/bond/assets/`.
- Rollout không downtime còn pending (sẽ áp dụng trên Pi/VPS thủ công sau khi app hoàn thiện):
  1. Deploy build/server mới trong khi nginx vẫn phục vụ staking cũ.
  2. Xác minh Node `/stake/` nội bộ (`curl -I http://127.0.0.1:4173/stake/`).
  3. Copy config từ repo → `nginx -t`, rồi reload (Pi trước hoặc cùng lúc với VPS).
  4. Smoke-test public `/stake/`.
  5. Giữ static staking cũ trong một rollback window rồi mới xóa `/var/www/html/prana/stake/`.

## 3. Kiểm thử và tiêu chí hoàn thành

Automated checks:

- Thêm `test:staking` dùng `node:test` + `tsx`, không thêm frontend test framework mới. Tests nằm ở `features/staking/tests/` (có `tsconfig.json` riêng với `types: ["node"]`); mỗi file test cũng `/// <reference types="node" />` vì root tsconfig chỉ load `vite/client`.
- Test bigint interest đúng thứ tự Solidity và không có floating-point rounding.
- Test trạng thái active/matured/within-grace/after-grace.
- Test rule claim-before-unstake và early penalty.
- Test amount parsing: rỗng, zero, âm, quá 9 decimals, dưới min, quá balance.
- Test permit invalidation khi đổi amount/duration/address/chain hoặc hết deadline.
- Test config/account API validation, serialization, cache headers, error redaction và rate limit.
- Test `isStakePath` và `/stake` redirect, gồm query preservation, direct refresh `/stake/`, `/stake/*` fallback, negative case `/staking` và static asset cache.
- Chạy:
  - `npm run typecheck`
  - `npx tsc -p server --noEmit`
  - Toàn bộ server tests hiện có
  - `npm run test:staking`
  - `npm run build`
- Scan `dist/` đảm bảo không chứa `VITE_ALCHEMY`, Alchemy RPC URL hoặc API key.

Browser/network acceptance:

- Vào `/` không tải staking chunk và không gọi staking account/config API.
- Vào `/stake/` không prefetch homepage JSON, model-viewer hoặc `prana-coin.glb`.
- `/terms` và `/privacy` vẫn hoạt động sau khi thêm `/stake/`.
- Refresh trực tiếp `/stake/` không 404.
- Sai network yêu cầu switch Polygon trước khi ký/gửi.
- Reject signature/transaction giữ form state và hiển thị lỗi đúng ngôn ngữ.
- Transaction chỉ hiện success sau receipt.
- Stake thành công cập nhật balance và danh sách stake.
- Claim thành công cập nhật accrued interest; sau đó mới cho unstake matured stake.
- Early unstake dialog hiển thị penalty động và cảnh báo mất lãi.
- Kiểm tra desktop/mobile, keyboard navigation và reduced-motion.

## 4. Giả định đã khóa

- `/stake/` là lazy route chung, không phải Vite entry riêng.
- Không thêm React Router; navigation giữa `/`, `/stake/`, `/terms`, `/privacy` dùng URL thật + path helpers hiện có.
- Main app tiếp tục là nơi duy nhất hiển thị protocol-level staking statistics.
- Staking page chỉ hiển thị dữ liệu cá nhân và transaction workflow.
- Contract reads nghiệp vụ đi qua backend; public dRPC frontend chỉ dùng cho wallet coordination/receipt.
- UI dùng một nút `Permit & Stake` (tự mở popup Stake sau khi ký Permit; vẫn cần user xác nhận hai lần trong wallet).
- Toàn bộ staking UI theo locale toggle VI/EN, không hiển thị hai ngôn ngữ trong cùng câu.
- Không thay smart contract hoặc transaction semantics on-chain.
- Baseline UI/shell là v2.3.1 (`FlutterShaderBackground`, `AppFooter`, legal pages, `btn-hero` classes).
