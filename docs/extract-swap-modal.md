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

- Tạo `features/web3/Web3Providers` chứa `WagmiProvider` và `wagmiConfig`. Đây là boundary dùng chung, chỉ được import từ lazy entry của Swap và staking, không từ `main.tsx` hay `StatsPage`.
- Tạo entry wrapper cho Swap: `Web3Providers` bọc modal trước khi hooks wallet/viem chạy. Provider giữ mounted sau lần mở Swap đầu tiên để duy trì connection/state như Phase 1.
- Tạo entry wrapper cho `/stake/`: `Web3Providers` bọc staking page. Đặt `QueryClient` và `QueryClientProvider` trong entry staking vì React Query hiện chỉ được staking sử dụng.
- Bỏ `WagmiProvider`, `wagmiConfig`, `QueryClient` và `QueryClientProvider` khỏi root render trong `main.tsx`; `SiteLanguageProvider` giữ ở root vì homepage/legal/Swap/staking đều dùng locale.
- `useInjectedWallet` vẫn là shared hook, nhưng chỉ được thực thi phía trong `Web3Providers`.
- Loại `ethers` khỏi homepage path: thay/tách `formatPranaFloatFromRaw` trong formatter chung thành helper bigint không import `ethers` (hành vi `parseFloat(formatUnits(raw, 9))` giữ nguyên). Ethers tiếp tục server-only ở loaders/scripts; không thay đổi backend.
- `viem` sẽ chỉ nằm trong Web3 lazy chunks hoặc feature chunks phụ thuộc chúng. Vite có thể tạo một shared async chunk dùng chung Swap và staking; đó là kết quả mong muốn.

## Interfaces và tương thích

- `SwapModalProps { isOpen, onClose }` và default export của modal giữ nguyên contract cho lazy entry.
- Không thay đổi wire format, HTTP route, cache policy hoặc static route server: assets hash hiện được serve `immutable` và HTML `no-cache` đã phù hợp với code splitting.
- Không yêu cầu một file vật lý duy nhất: Swap/Web3 có thể gồm entry chunk và các shared async vendor chunks. Tiêu chí là các chunk đó không được request khi chỉ xem homepage.

## Kiểm thử và acceptance

- Chạy `npm run typecheck`, `npm test`, `npm run test:staking` và `npm run build` sau mỗi phase.
- So sánh build output trước/sau; ghi lại kích thước gzip của entry, `StatsPage`, Swap và Web3/staking chunks. Không đặt budget số byte giả định trước khi có output mới.
- Cập nhật `docs/swap-modal-technical-overview.md` và bản VI với kiến trúc `hero → lazy Swap entry → Web3Providers → SwapModal`, source map mới và behavior loading/error.
