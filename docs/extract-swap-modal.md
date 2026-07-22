# Extract Swap modal and Web3 dependencies from the stats bundle

## Mục tiêu và baseline

- Production build hiện tại đặt toàn bộ Swap frontend trong `StatsPage`: 578.73 kB, 177.61 kB gzip. Entry bundle vẫn eager-load Wagmi config, `WagmiProvider` và `QueryClientProvider`.
- Homepage chỉ lấy protocol stats qua API backend; không dùng Wagmi, React Query hay browser RPC. `@uniswap/*` đã là server-only.
- Sau refactor, user vào `/` chỉ tải stats UI/data. Code Swap và Web3 chỉ được tải khi bấm **SWAP**; `/stake/` chỉ tải Web3 và React Query khi vào route đó.
- Không đổi API `/api/swap/*`, quote/approval/swap flow, token allowlist, contract addresses, slippage hoặc transaction state machine.

## Phase 1 — Lazy Swap feature

- Gom `SwapModal`, `useUniswapQuote`, `useUniswapSwap`, logging/error handling và formatting chỉ dùng cho Swap vào `features/swap/`.
- Giữ swap types/constants và token lookup ở shared layer vì backend cũng dùng chúng. Tách `formatCompactAddress` thành wallet helper trung lập vì staking đang dùng nó.
- Thay static import ở `hero3.tsx` bằng `React.lazy`. Dùng `isSwapOpen` + `hasRequestedSwap`: click đầu tiên mới render lazy entry; sau khi tải xong, giữ entry mounted khi đóng/mở để không thay đổi lifecycle form hiện tại.
- Không prefetch theo hover, viewport hoặc khi tải `StatsPage`.
- Thêm `Suspense` fallback là modal shell có spinner, `aria-busy` và nút đóng. Đóng trong khi tải phải ẩn fallback ngay; request JS có thể hoàn tất nền nhưng không tự mở lại modal.
- Bọc lazy entry bằng error boundary để lỗi import không làm hỏng homepage. Cho đóng, thử lại với lỗi transient và nút reload trang cho case asset hash cũ đã bị xóa sau deploy.
- Để Vite tự tạo async `SwapModal-[hash].js`; không thêm `manualChunks`. CSS Tailwind vẫn là stylesheet chung, giống lazy staking route.

## Phase 2 — Lazy Web3 and React Query providers

- Tạo `features/web3/Web3Providers` chứa `WagmiProvider`, `QueryClientProvider`, `wagmiConfig` và `QueryClient`. Wagmi `3.x` dùng TanStack Query bên trong các hook connect/switch/write, vì vậy cả Swap lẫn staking đều cần đủ hai provider; React Query không thể chỉ đặt ở staking entry.
- Đây là boundary dùng chung nhưng vẫn phải lazy: chỉ lazy entry của Swap và staking được import `Web3Providers`; `main.tsx`, `StatsPage`, `hero3.tsx` và các component homepage không được import module này hoặc bất kỳ barrel nào re-export nó.
- Tạo entry wrapper cho Swap: `Web3Providers` bọc modal trước khi hooks wallet/viem chạy. Provider giữ mounted sau lần mở Swap đầu tiên để duy trì connection/state như Phase 1.
- Tạo entry wrapper cho `/stake/`: `Web3Providers` bọc staking page; các query nghiệp vụ `staking-config` và `staking-account` dùng cùng Query Client nằm trong boundary này.
- Bỏ `WagmiProvider`, `wagmiConfig`, `QueryClient` và `QueryClientProvider` khỏi root render trong `main.tsx`; `SiteLanguageProvider` giữ ở root vì homepage/legal/Swap/staking đều dùng locale.
- `useInjectedWallet` vẫn là shared hook, nhưng chỉ được thực thi phía trong `Web3Providers`.
- Loại `ethers` khỏi homepage path: thay/tách `formatPranaFloatFromRaw` trong formatter chung thành helper bigint không import `ethers` (hành vi `parseFloat(formatUnits(raw, 9))` giữ nguyên). Ethers tiếp tục server-only ở loaders/scripts; không thay đổi backend.
- `viem` sẽ chỉ nằm trong Web3 lazy chunks hoặc feature chunks phụ thuộc chúng. Vite có thể tạo một shared async chunk dùng chung Swap và staking; đó là kết quả mong muốn.

## Shared utils/dependencies cho Swap và staking

“Shared” ở đây nghĩa là một source module có ownership trung lập và được hai feature tái sử dụng; không có nghĩa module đó được phép đi vào eager entry. Mọi shared module phụ thuộc `wagmi`, `viem` hoặc TanStack Query phải nằm phía sau lazy boundary của Swap/staking. Chỉ các helper thuần, constants/types không có runtime import nặng và UI primitives thật sự dùng toàn app mới được import từ homepage/root.

### Phân lớp và dependency direction

| Nhóm | Vị trí đích | Nội dung | Quy tắc import |
|---|---|---|---|
| Web3 runtime | `features/web3/` | `Web3Providers`, `wagmiConfig`, injected connector, `QueryClient` | Chỉ `features/swap/SwapEntry` và `features/staking/StakingEntry` import; không re-export qua shared barrel eager |
| Wallet dùng chung | `features/web3/useInjectedWallet.ts`, `features/web3/walletFormatting.ts` | connect/disconnect/switch Polygon và `formatCompactAddress` | Swap/staking dùng chung; formatter address phải thuần và không import Wagmi |
| Chain/contracts dùng chung | `constants/network.ts`, `constants/sharedContracts.ts`, `types/blockchain.types.ts` | chain ID, public RPC, explorer URLs, PRANA/token addresses, `Address`/`Hex` | Client lazy features và backend được import trực tiếp; không import ngược từ constants sang feature |
| UI dùng chung | `components/ui/` | `GlassPanel`, `StatusBanner`, button/loading primitives nếu có ít nhất hai consumer | Không chứa wallet state, transaction state hoặc copy riêng của Swap/staking |
| Amount helpers thuần | `utils/tokenAmounts.ts` (hoặc tên tương đương) | bigint ↔ decimal string/number với decimals truyền vào | Không import `ethers`, `viem`, React hay feature types; dùng được từ homepage và server mà không kéo Web3 vendor |
| Swap-local | `features/swap/` | modal, quote/swap hooks, swap error/logging, slippage/form state, token amount UI | Không đưa vào shared chỉ vì staking cũng có transaction receipt |
| Staking-local | `features/staking/` | React Query hooks, permit, stake actions, staking math/errors/copy | Không import module bên trong `features/swap/` |

Dependency direction mục tiêu:

```text
main.tsx / StatsPage                 (không Web3)
          |
          +-- lazy SwapEntry --------+
          |                          |
          +-- lazy StakingEntry -----+--> features/web3
                                      --> constants + pure utils + components/ui

features/swap ------X------> features/staking
features/staking ---X------> features/swap
```

Các điểm share cụ thể:

- Chuyển `utils/wagmiConfig.ts` vào `features/web3/wagmiConfig.ts`; cập nhật `features/staking/getPolygonWalletClient.ts` và các Swap hooks import từ đây. Module config không được xuất từ `utils/index` hay một barrel mà homepage đang dùng.
- Chuyển `hooks/useInjectedWallet.ts` và type `UseInjectedWalletResult` ra khỏi `types/swap.types.ts` sang `features/web3/`. Hook này là Web3 runtime; `formatCompactAddress` tách riêng thành helper thuần để component có thể dùng mà không kéo hook/Wagmi theo.
- Giữ `types/blockchain.types.ts`, `constants/network.ts` và contract constants ở layer trung lập vì frontend và backend cùng dùng. ABI nên tối thiểu và có thể tách theo contract/feature nếu một ABI chỉ có một consumer; không tạo một `web3.ts` tổng hợp re-export tất cả ABI.
- Tách `formatCompactAddress` khỏi `utils/swapTokenFormatting.ts` sang `features/web3/walletFormatting.ts` (hoặc `utils/walletFormatting.ts` nếu cần dùng ngoài Web3 UI), rồi cho `SwapModal` và `WalletControl` cùng import helper mới.
- Tách `formatPranaFloatFromRaw` thành amount helper bigint thuần. Không thay `ethers.formatUnits` bằng `viem.formatUnits` ngay trong `utils/formatters.ts`, vì như vậy homepage vẫn có thể kéo `viem`; helper phải tự format theo `decimals` hoặc nằm trong module server-only. Giữ output/rounding hiện tại bằng characterization tests trước khi đổi.
- `GlassPanel` và `StatusBanner` tiếp tục là shared UI primitives. Chỉ extract thêm transaction link/spinner/button khi Swap và staking có cùng API/a11y behavior; copy, màu trạng thái và state machine vẫn thuộc từng feature.
- Chỉ share các primitive lỗi thật sự trung lập (ví dụ đọc `code`/`cause`, nhận diện EIP-1193 rejection). Mapping sang message VI/EN, fallback và error codes vẫn feature-local vì Swap và staking có semantics/retry khác nhau.
- Không tạo generic `useTransaction` từ `useUniswapSwap` và staking actions trong đợt này. Có thể share utility `waitForReceipt` sau khi hai flow có cùng cancellation, replacement và error contract được chứng minh bằng tests; hiện tại chỉ reuse pattern, không reuse state machine.

### Cấu trúc đích đề xuất

```text
features/
├── web3/
│   ├── Web3Providers.tsx
│   ├── wagmiConfig.ts
│   ├── useInjectedWallet.ts
│   ├── walletFormatting.ts
│   └── web3.types.ts
├── swap/
│   ├── SwapEntry.tsx
│   ├── SwapModal.tsx
│   ├── hooks/
│   └── utils/
└── staking/
    ├── StakingEntry.tsx
    ├── components/
    ├── hooks/
    └── ...

utils/
└── tokenAmounts.ts
```

`SwapEntry` và `StakingEntry` là composition roots duy nhất biết cả feature UI lẫn `Web3Providers`. `hero3.tsx` lazy-import `SwapEntry`, còn route resolver lazy-import `StakingEntry` thay vì import thẳng `StakingPage`.

### Thứ tự refactor an toàn

1. **Khóa behavior bằng tests:** thêm characterization tests cho address/amount formatting, wallet error sanitization và provider-dependent hooks hiện tại; ghi baseline bundle + network requests.
2. **Tách pure shared trước:** tạo `walletFormatting`, `tokenAmounts`, chuyển shared wallet types khỏi `swap.types`; cập nhật imports nhưng chưa đổi lazy/provider topology. Chạy typecheck/tests để bắt circular import hoặc output drift.
3. **Gom Swap feature:** move modal/hooks/utils riêng của Swap vào `features/swap/`, giữ API/types dùng chung với backend ngoài feature. Dùng direct imports trong lúc move, chưa tạo barrel file.
4. **Tạo provider boundary:** chuyển Wagmi config + wallet hook vào `features/web3/`; tạo `Web3Providers` với thứ tự `WagmiProvider → QueryClientProvider → children`. Khởi tạo `QueryClient` ngoài render của provider để đóng/mở modal không tạo cache mới.
5. **Thêm hai lazy composition roots:** `SwapEntry` bọc `SwapModal`; `StakingEntry` bọc `StakingPage`. Đổi `hero3.tsx` và route resolver import entry tương ứng, sau đó gỡ providers/config khỏi `main.tsx`.
6. **Kiểm tra import graph và chunks:** dùng build manifest/source map để xác nhận entry/homepage không còn `wagmi`, `viem`, `@tanstack/react-query`, `ethers`, Swap hooks hoặc staking hooks. Việc Vite tạo một shared async Web3 vendor chunk cho hai entry là hợp lệ.
7. **Dọn compatibility imports cuối cùng:** xóa file cũ hoặc để re-export tạm chỉ khi re-export đó không được homepage import; cập nhật technical overview và bỏ alias sau khi toàn bộ call site đã chuyển.

Không refactor đồng thời transaction semantics, API payload hoặc UX state machine với việc đổi ownership/import boundary. Mỗi bước chỉ thay vị trí/composition, chạy đủ test rồi mới sang bước tiếp theo để lỗi bundle topology không bị trộn với lỗi giao dịch.

## Interfaces và tương thích

- `SwapModalProps { isOpen, onClose }` và default export của modal giữ nguyên contract cho lazy entry.
- Không thay đổi wire format, HTTP route, cache policy hoặc static route server: assets hash hiện được serve `immutable` và HTML `no-cache` đã phù hợp với code splitting.
- Không yêu cầu một file vật lý duy nhất: Swap/Web3 có thể gồm entry chunk và các shared async vendor chunks. Tiêu chí là các chunk đó không được request khi chỉ xem homepage.

## Kiểm thử và acceptance

- Chạy `npm run typecheck`, `npm test`, `npm run test:staking` và `npm run build` sau mỗi phase.
- So sánh build output trước/sau; ghi lại kích thước gzip của entry, `StatsPage`, Swap và Web3/staking chunks. Không đặt budget số byte giả định trước khi có output mới.
- Cập nhật `docs/swap-modal-technical-overview.md` và bản VI với kiến trúc `hero → lazy Swap entry → Web3Providers → SwapModal`, source map mới và behavior loading/error.
