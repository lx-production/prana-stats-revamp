# Gộp `staking-ui` thành lazy route `/stake` trong main app

## Tóm tắt kiến trúc

- Dùng chung một Vite app, `WagmiProvider`, React Query, locale, favicon và design system.
- `/` và `/stake/` là hai page được `React.lazy`; người vào trang stats không tải code staking.
- Không thêm React Router: bootstrap chọn page theo `window.location.pathname`; link `/stake/` dùng navigation thông thường.
- Contract reads đi qua backend API chuyên biệt; Alchemy key chỉ tồn tại server-side.
- Ví người dùng vẫn ký permit và gửi transaction trực tiếp.
- Chuyển toàn bộ staking sang TypeScript, bigint chính xác và chỉ báo thành công sau khi receipt được xác nhận.

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
| Wagmi/React Query providers | `main.tsx` hiện tại |
| Connect, disconnect, switch Polygon | `useInjectedWallet` |
| Locale VI/EN | `SiteLanguageProvider`, `useSiteLanguage`, `LanguageToggle` |
| Polygon chain ID/RPC | Chuyển chain ID về `constants/network.ts`; dùng `wagmiConfig` hiện tại |
| PRANA address/decimals | `constants/sharedContracts.ts` |
| Staking/Interest address và ABI | Một nguồn chuẩn duy nhất trong `constants/stakingContracts.ts` |
| Format số/ngày giờ | Mở rộng `utils/formatters.ts` |
| Rút gọn wallet address | Chuyển `formatCompactAddress` sang `utils/walletFormatting.ts`; Swap và Staking cùng dùng |
| Favicon | `useSpinningFavicon` hiện tại |
| Background/glass/gold CTA | `NeuralShaderBackground` và các UI primitive mới |
| Transaction receipt pattern | Theo mô hình đã dùng trong `useUniswapSwap` |

ABI staking chuẩn hóa thành object ABI `as const`, đủ cho cả Viem/Wagmi và Ethers. Bao gồm các read/write function thực sự dùng; bỏ ABI admin và event không cần thiết khỏi frontend bundle.

## 2. Các bước triển khai

### Bước 1 — Tách homepage khỏi entrypoint

- Chuyển toàn bộ homepage JSX hiện tại từ `main.tsx` sang `pages/StatsPage.tsx`.
- `main.tsx` chỉ giữ:
  - Global CSS.
  - `WagmiProvider`.
  - `QueryClientProvider`.
  - `SiteLanguageProvider`.
  - Route resolver và `Suspense`.
- Path `/stake` được server redirect `308` sang `/stake/`; mọi path bắt đầu bằng `/stake/` lazy-load `StakingPage`.
- Các path khác giữ hành vi homepage hiện tại.
- Chuyển `prefetchInitialJson()` vào `StatsPage` để `/stake/` không tải dữ liệu stats.
- Gỡ preload `model-viewer` và `prana-coin.glb` khỏi HTML chung; kích hoạt chúng từ `StatsPage`/hero để trang staking không tải GLB 2.6 MB.
- Đổi CTA STAKE trong hero thành `href="/stake/"`, mở cùng tab.
- Staking page có link quay về `/` và link xem protocol statistics.

### Bước 2 — Chuẩn hóa constants, ABI và types

- Hợp nhất PRANA, staking và interest contract addresses vào constants hiện tại; xóa bản sao trong `staking-ui`.
- Thay ABI human-readable/ABI lớn bằng một typed ABI tối thiểu dùng chung.
- Bổ sung các constants:
  - Polygon chain ID.
  - Permit domain name `Prana_v2`, version `1`.
  - Permit deadline 1 giờ.
  - Seconds per day/year.
- Không hardcode duration/APR, min stake, grace period hoặc penalty trong client; lấy từ backend/on-chain.
- Tạo TypeScript types cho config, account snapshot, stake record, permit snapshot và transaction status.
- Mở rộng Tailwind/TypeScript config để scan/include `pages/**` và `features/**`.

### Bước 3 — Tạo backend staking read API

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
- Thêm rate limit `/account` 30 request/IP/phút và global cap để bảo vệ Pi/Alchemy.
- Upstream RPC failure trả lỗi chung `502`, không trả URL/key hoặc raw provider error.
- Không tạo generic JSON-RPC proxy.
- Backend dùng `POLYGON_RPC_URL`; giữ fallback env cũ trong một giai đoạn deploy nhưng không có `VITE_*` nào được tham chiếu từ frontend.

### Bước 4 — Port form và account state

- Chuyển `StakingForm`, `ActiveStakes` và hooks sang TS/TSX trong feature folder.
- Dùng React Query:
  - `['staking-config']`, stale time 30 giây.
  - `['staking-account', address]`, chỉ enabled với address hợp lệ, không polling.
- `PranaBalance` không còn là card riêng; đưa balance và nút MAX vào header của amount input.
- Bỏ giới hạn UI hardcode 10 triệu PRANA; max hợp lệ là số dư hiện tại.
- Parse amount bằng `parseUnits(..., PRANA_DECIMALS)`; reject quá 9 chữ số thập phân.
- Min stake, paused state, APR và duration dùng dữ liệu config.
- Duration mặc định là 30 ngày nếu tồn tại, nếu không dùng option đầu tiên.
- Thay MUI slider bằng grid button/chip rời rạc; mỗi option hiển thị số ngày và APR, dùng được bằng keyboard.
- Projected interest dùng bigint và đúng thứ tự làm tròn của Solidity:

```text
annualInterest = amountRaw × APR / 100
interestPerSecond = annualInterest / 31,536,000
totalInterest = interestPerSecond × duration
```

### Bước 5 — Harden permit và transaction flow

Giữ hai nút riêng theo lựa chọn:

1. `Sign Permit`
2. `Stake PRANA`

Permit flow:

- Validate connected wallet, Polygon chain, config không paused, amount ≥ min và amount ≤ balance.
- Refetch account ngay trước khi ký để lấy nonce mới nhất.
- Dùng typed EIP-712 domain/message và utility parse signature của Viem.
- Permit snapshot phải lưu address, chain, nonce, amount, duration và deadline.
- Tự hủy permit nếu user đổi amount/duration/account/chain hoặc deadline hết hạn.
- Hiển thị rõ trạng thái signing/rejected/signed.

Stake flow:

- Revalidate permit snapshot trước khi gửi.
- Gửi `stakeWithPermit` qua wallet client.
- Chuyển trạng thái `submitting → confirming → success/error`.
- Chờ `waitForTransactionReceipt`; receipt reverted là lỗi.
- Chỉ reset form, permit và refetch account sau receipt thành công.
- Hiển thị transaction hash và Polygonscan link.

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

### Bước 6 — Đồng bộ styling với main app

- Bỏ hoàn toàn light theme và `ThemeContext`; staking dùng dark theme của main app.
- Page shell:
  - `bg-[#050116]`, text trắng.
  - Dùng `NeuralShaderBackground` với brightness thấp hơn homepage.
  - Container responsive khoảng `max-w-5xl/6xl`.
- Panel/form/stake card:
  - `rounded-2xl`.
  - `border-white/10`.
  - `bg-white/5`.
  - `backdrop-blur-md`.
  - Hover/focus border giống `StatCard`.
- Primary CTA dùng gold gradient hiện có ở hero/SwapModal.
- Secondary/claim dùng cyan–emerald; early unstake dùng red nhưng giữ cùng border/glass language.
- Input dùng nền trong suốt, border trắng mờ, focus ring vàng/cyan.
- Progress bar dùng cyan/gold gradient; status dùng pill `Active`, `Matured`, `Claim first`, `Grace expired`.
- Dùng Lucide `Loader2`, `Wallet`, `Lock`, `Coins`, `ExternalLink`; bỏ unicode spinner.
- Alerts dùng chung `StatusBanner` với `role="status"` hoặc `role="alert"` và `aria-live`.
- Mobile:
  - Duration options thành grid 2 cột.
  - Action buttons full width.
  - Stake metadata chuyển từ nhiều cột về stack.
  - Transaction hashes wrap an toàn.
- `LanguageToggle` hỗ trợ placement `fixed` cho homepage và `inline` trong staking header.
- Toàn bộ copy nằm trong `staking.copy.ts`, chọn đúng một ngôn ngữ theo toggle; bỏ các câu trộn Việt–Anh.

### Bước 7 — Xóa phần dư thừa của `staking-ui`

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

### Bước 8 — Routing, deployment và docs

- Node static handler phục vụ `dist/index.html` rõ ràng cho `/stake/` và SPA fallback.
- `/stake` redirect `308` sang `/stake/`.
- Vite chỉ tạo một `dist/`; staking là hashed lazy chunk.
- Cập nhật `NETWORK_ARCHITECTURE.md`:
  - `/stake/` đi qua Node giống `/`.
  - Không còn static staking directory riêng.
- Cập nhật Pi nginx:
  - Xóa redirect/location/alias `/stake`.
  - Giữ một `location /` proxy Node.
- Cập nhật VPS nginx:
  - Bỏ `stake` khỏi regex cache legacy assets; tiếp tục giữ `/bond/assets/`.
- Rollout không downtime:
  1. Deploy build/server mới trong khi nginx vẫn phục vụ staking cũ.
  2. Xác minh Node `/stake/` nội bộ.
  3. `nginx -t`, sau đó bỏ staking locations và reload.
  4. Smoke-test public `/stake/`.
  5. Giữ static staking cũ trong một rollback window rồi mới xóa ngoài repo.

## 3. Kiểm thử và tiêu chí hoàn thành

Automated checks:

- Thêm `test:staking` dùng `node:test` + `tsx`, không thêm frontend test framework mới.
- Test bigint interest đúng thứ tự Solidity và không có floating-point rounding.
- Test trạng thái active/matured/within-grace/after-grace.
- Test rule claim-before-unstake và early penalty.
- Test amount parsing: rỗng, zero, âm, quá 9 decimals, dưới min, quá balance.
- Test permit invalidation khi đổi amount/duration/address/chain hoặc hết deadline.
- Test config/account API validation, serialization, cache headers, error redaction và rate limit.
- Test `/stake` redirect, direct refresh `/stake/` và static asset cache.
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
- Không thêm React Router; navigation `/` ↔ `/stake/` dùng URL thật.
- Main app tiếp tục là nơi duy nhất hiển thị protocol-level staking statistics.
- Staking page chỉ hiển thị dữ liệu cá nhân và transaction workflow.
- Contract reads nghiệp vụ đi qua backend; public dRPC frontend chỉ dùng cho wallet coordination/receipt.
- UI giữ hai nút Permit và Stake riêng.
- Toàn bộ staking UI theo locale toggle VI/EN, không hiển thị hai ngôn ngữ trong cùng câu.
- Không thay smart contract hoặc transaction semantics on-chain.
