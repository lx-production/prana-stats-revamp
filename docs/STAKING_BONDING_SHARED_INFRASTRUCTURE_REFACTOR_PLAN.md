# Kế hoạch refactor hạ tầng dùng chung giữa Staking và Bonding

## 1. Mục tiêu

Giảm code lặp giữa Staking và Bonding nhưng không trộn domain logic của hai
feature. Refactor tập trung vào bảy nhóm:

1. Validate kết quả account refetch.
2. Xác nhận transaction phía client.
3. Lưu và khôi phục pending transaction.
4. Xác nhận receipt rồi đồng bộ account.
5. API adapters và React Query hooks.
6. Xác nhận transaction qua RPC phía server.
7. Debounce, abort, chống response cũ, và stale-state của quote hooks.

Kết quả phải giữ nguyên hành vi hiện tại:

- Không báo transaction thành công khi chỉ gặp lỗi đọc RPC.
- Không gửi lại transaction đã có hash.
- Pending transaction luôn gắn với account và chain đã submit.
- Resume sau reload vẫn phải xác thực sender, target, và calldata phía server.
- Quote cũ hoặc response đến sai thứ tự không được ghi đè quote mới.
- Account refetch lỗi sau receipt thành công chỉ tạo cảnh báo sync, không đổi
  transaction thành thất bại.

## 2. Phạm vi không refactor

Các phần sau tiếp tục thuộc feature:

- `stakingMath.ts`, `stakingFundCheck.ts`, permit và grace-window.
- `bondingMath.ts`, allowance, Buy/Sell, term, V1/V2, và claim target.
- `stakeCtaPhase.ts` và `bondCtaPhase.ts`.
- `submitStakeWithPermitFlow` và phần simulate/write riêng của Bonding.
- Action snapshot và parser action của từng feature.
- ABI, contract mapping, và `buildExpectedCall` của từng feature.
- Error codes, nội dung VI/EN, và UI components của từng feature.
- API adapters và React Query config/account hooks (`stakingApi.ts`,
  `bondingApi.ts`, `useStakingConfig` / `useBondingConfig`,
  `useStakingAccount` / `useBondingAccount`) — decision gate Điểm 5 không đạt;
  xem mục 10.
- Swap transaction flow trong đợt đầu. Swap có verification contract khác và
  chưa có pending-storage/resume giống Staking/Bonding.

Không tạo một `sharedTransactionManager` lớn. Mỗi module shared chỉ giải quyết
một hành vi trung lập và có API nhỏ.

## 3. Nguyên tắc triển khai

- Refactor từng bước nhỏ; mỗi bước phải typecheck và chạy test trước khi sang
  bước tiếp theo.
- Viết characterization tests trước khi di chuyển logic.
- Shared module nhận dependency qua tham số; không import Staking/Bonding types,
  endpoints, copy, ABI, hay constants riêng của feature.
- TypeScript types đặt trong file `.types.ts` riêng.
- Feature files còn lại chỉ orchestration, tạo dependency, và map kết quả sang
  state/copy của feature.
- Giữ named exports; không tạo object shared toàn cục.
- Không thay đổi localStorage key, schema version, TTL, endpoint, query key, hay
  error behavior trong refactor này.
- Không xóa wrapper feature cho đến khi tests chứng minh API shared giữ nguyên
  public contract hiện tại.

## 4. Cấu trúc đích dự kiến

```text
features/web3/
├── accountRefetch.ts
├── accountRefetch.types.ts
├── transactionConfirmation.ts
├── transactionConfirmation.types.ts
├── confirmReceiptWithAccountSync.ts
├── confirmReceiptWithAccountSync.types.ts
├── pendingTransactionStorage.ts
├── pendingTransactionStorage.types.ts
└── hooks/
    ├── usePendingTransaction.ts
    └── usePendingTransaction.types.ts

hooks/
└── useDebouncedAbortableQuote.ts

types/
└── debouncedAbortableQuote.types.ts

server/utils/
└── transactionConfirmationLookup.ts

server/types/
└── transactionConfirmationTypes.ts
```

API/query helpers **không** được thêm: decision gate mục 10 đã kết luận giữ
wrapper feature-local. Không tạo `useWalletAccountQuery` /
`useFeatureConfigQuery`.

## 5. Bước 0 — Baseline và characterization tests

### Công việc

- Chạy baseline:
  - `npm run typecheck`
  - `npm run test:client`
  - `npm run test:staking`
  - `npm run test:bonding`
  - `npm run test:server`
- Ghi lại số test và mọi lỗi đã tồn tại trước refactor.
- Bổ sung test còn thiếu cho các invariant:
  - ✅ Browser receipt `reverted` là terminal.
  - ✅ Browser RPC lỗi phải thử server fallback.
  - ✅ `requireServerValidation` buộc gọi server dù browser receipt thành công.
  - ✅ Account/chain đổi trong lúc chờ không được hiển thị success cho ví mới.
  - ✅ Pending record malformed, expired, sai account, hoặc sai chain bị loại.
  - ✅ Quote response cũ không ghi đè response mới.
  - ✅ Abort không tạo error UI.
  - ✅ `freshQuote()` bỏ debounce và hủy request cũ.

### Điều kiện hoàn thành

- Có baseline xanh hoặc danh sách lỗi có sẵn được ghi rõ.
- Mỗi hành vi sẽ di chuyển đã có ít nhất một test bảo vệ.

## 6. Điểm 1 — Dùng chung `accountFromSuccessfulRefetch` ✅

### Hiện trạng

Hai implementation gần như giống nhau:

- `features/staking/accountRefetch.ts`
- `features/bonding/utils/accountRefetch.ts`

Chúng cùng kiểm tra `isSuccess/status`, `error`, `data`, và address của account.
Khác biệt duy nhất là type dữ liệu trả về.

### Thiết kế

Tạo generic helper:

```ts
accountFromSuccessfulRefetch<TAccount extends { address: string }>(
  refreshed: unknown,
  expectedAddress?: Address,
): TAccount | undefined
```

- Implementation: `features/web3/accountRefetch.ts`.
- Types mô tả React Query-like result:
  `features/web3/accountRefetch.types.ts`.
- Helper không import `StakingAccountSnapshot` hoặc `BondingAccount`.

### Migration

1. ✅ Chuyển test chung sang `features/web3/tests/accountRefetch.test.ts`.
2. ✅ Cho `stakeTransactionFlow.ts` gọi generic helper với
   `StakingAccountSnapshot`.
3. ✅ Cho `bondTransactionFlow.ts` gọi generic helper với `BondingAccount`.
4. ✅ Xóa hai implementation cũ sau khi không còn consumer.

### Điều kiện hoàn thành

- ✅ Address comparison vẫn case-insensitive.
- ✅ Không fallback sang cached account.
- ✅ Kết quả lỗi hoặc thiếu data vẫn trả `undefined`.
- ✅ Staking và Bonding tests giữ nguyên kết quả.

## 7. Điểm 2 — Dùng chung transaction confirmation phía client ✅

### Hiện trạng

Hai file có cùng browser-receipt → server-fallback state machine:

- `features/staking/stakeTransactionConfirmation.ts`
- `features/bonding/utils/bondTransactionConfirmation.ts`

Chúng chỉ khác tên type và callback server.

### Thiết kế

Tạo:

- `features/web3/transactionConfirmation.ts`
- `features/web3/transactionConfirmation.types.ts`

API dự kiến:

```ts
confirmBroadcastTransaction({
  waitForReceipt,
  confirmOnServer,
  requireServerValidation,
})
```

Shared server result tối thiểu chỉ cần:

- `confirmed`
- `reverted`
- `not_mined`
- `confirmation_unavailable`

Shared outcome giữ:

- `confirmed` với source `browser | server`
- `reverted` với source `browser | server`
- `confirmation_unavailable` với `receiptError` và `verificationError`

### Migration

1. ✅ Chuyển các test trùng nhau thành
   `features/web3/tests/transactionConfirmation.test.ts`.
2. ✅ Giữ thin feature adapters trong bước đầu để giảm diff:
   - `confirmStakeTransaction()` gọi shared helper.
   - `confirmBondTransaction()` gọi shared helper.
3. Khi tất cả consumer đã ổn định, quyết định giữ adapter để tên domain rõ hoặc
   import shared helper trực tiếp.
4. ✅ Không migrate `confirmSwapTransaction()` trong bước này.

### Điều kiện hoàn thành

- ✅ Fresh transaction có thể thành công từ browser receipt mà không gọi server.
- ✅ Resume transaction luôn gọi server khi `requireServerValidation` là `true`.
- ✅ `not_mined` không bị map thành revert.
- ✅ Lỗi browser và lỗi server được giữ để logging/debug.

## 8. Điểm 3 — Dùng chung pending transaction storage và hook ✅

### Hiện trạng

Storage scaffold và hooks đang lặp:

- `features/staking/stakePendingTransactionStorage.ts`
- `features/bonding/utils/bondPendingTransactionStorage.ts`
- `features/staking/hooks/usePendingStakeTransaction.ts`
- `features/bonding/hooks/usePendingBondTransaction.ts`

Phần thực sự khác nhau là storage prefix, action type, danh sách kind, và
`parseStoredAction`.

### Thiết kế storage factory

Tạo:

- `features/web3/pendingTransactionStorage.ts`
- `features/web3/pendingTransactionStorage.types.ts`

Factory dự kiến:

```ts
createPendingTransactionStorage<TAction>({
  storagePrefix,
  ttlMs,
  parseAction,
})
```

Factory trả các hàm:

- `storageKey(account, chainId)`
- `buildPendingTransaction(input)`
- `matchesWallet(pending, account, chainId)`
- `save(pending, storage?)`
- `clear(account, chainId, storage?)`
- `load(account, chainId, kinds?, storage?, nowMs?)`
- `parse(raw, nowMs?)`

Envelope shared validate:

- `version`
- `chainId`
- `account`
- `hash`
- `createdAt`
- TTL và far-future timestamp

Feature-local parser tiếp tục validate:

- Staking: permit fields, `stakeId`, `claim`, `unstake`, `unstakeEarly`.
- Bonding: `approve`, `create`, `claim`, side, version, mode, term, bond id.

Không thay đổi:

- Prefix `prana:staking:pending:v1`.
- Prefix `prana:bonding:pending:v1`.
- Schema version `1`.
- TTL 24 giờ.

### Thiết kế hook

Tạo generic hook:

- `features/web3/hooks/usePendingTransaction.ts`
- `features/web3/hooks/usePendingTransaction.types.ts`

Hook nhận storage adapter và `kinds`, sau đó cung cấp:

- `pending`
- `pendingLoaded`
- `rememberPending`
- `clearPendingRecord`
- `discardLocalPending`

Feature wrappers giữ type-safe kinds:

- `usePendingStakeTransaction`
- `usePendingBondTransaction`

### Migration

1. ✅ Tạo shared envelope tests bằng in-memory storage.
2. ✅ Giữ feature parser tests trong từng feature.
3. ✅ Migrate Bonding hoặc Staking trước, chạy test đầy đủ.
4. ✅ Migrate feature còn lại.
5. ✅ Chỉ xóa scaffold cũ sau khi localStorage compatibility test pass.
   (Feature files giữ public API + prefix; scaffold dùng chung factory.)

### Điều kiện hoàn thành

- ✅ Record đang tồn tại trước deployment mới vẫn load được.
- ✅ Record sai identity không bao giờ xuất hiện trong UI.
- ✅ `discardLocalPending` không xóa record của account cũ.
- ✅ `clearPendingRecord` xóa đúng key của record đã submit.
- ✅ Hook không tạo vòng effect do identity của `kinds` thay đổi.

## 9. Điểm 4 — Dùng chung confirmation + account sync ✅

### Hiện trạng

Hai hàm trùng orchestration sau broadcast:

- `confirmStakeReceipt()` trong `stakeTransactionFlow.ts`.
- `confirmBondReceipt()` trong `bondTransactionFlow.ts`.

Cả hai:

1. Xác nhận transaction.
2. Trả sớm nếu reverted hoặc confirmation unavailable.
3. Refetch account khi confirmed.
4. Giữ confirmed nhưng đánh dấu `syncFailed` nếu refetch lỗi.

### Thiết kế

Tạo:

- `features/web3/confirmReceiptWithAccountSync.ts`
- `features/web3/confirmReceiptWithAccountSync.types.ts`

API dự kiến:

```ts
confirmReceiptWithAccountSync({
  hash,
  waitForReceipt,
  confirmOnServer,
  refetchAccount,
  isSuccessfulRefetch,
  requireServerValidation,
})
```

Helper dùng `confirmBroadcastTransaction` từ Điểm 2 và generic account helper
từ Điểm 1.

### Migration

1. ✅ Tạo shared tests cho confirmed/sync success, confirmed/sync failure,
   reverted, và confirmation unavailable.
2. ✅ `confirmStakeReceipt` trở thành thin feature adapter.
3. ✅ `confirmBondReceipt` trở thành thin feature adapter.
4. ✅ Giữ submit flows và CTA resolution trong feature.

### Điều kiện hoàn thành

- ✅ Không refetch account trước khi receipt được xác nhận.
- ✅ Refetch throw hoặc trả result không hợp lệ đều tạo `syncFailed: true`.
- ✅ Source `browser | server` không bị mất.
- ✅ Không thay đổi outcome unions mà UI hooks đang xử lý.

## 10. Điểm 5 — API adapters và React Query hooks ❌ không refactor

### Quyết định

Sau Điểm 1–4 (`ecdfc24` → `ab2978b`), decision gate **không đạt**. Giữ nguyên
wrapper feature-local; không tạo `useWalletAccountQuery` /
`useFeatureConfigQuery` hay factory API chung.

Lý do:

- Sáu file API/account/config không đổi trong phạm vi Điểm 1–4; chưa có prototype generic nào chứng minh lợi ích.
- Wrapper hiện tại ngắn, typed, và lộ endpoint + query key ngay tại feature:
  - `features/staking/stakingApi.ts`
  - `features/bonding/utils/bondingApi.ts`
  - `useStakingConfig` / `useBondingConfig`
  - `useStakingAccount` / `useBondingAccount`
- Chỉ hai consumer cho mỗi pattern; thêm shared hooks + types + tests dễ tăng
  số lớp và che cache/refetch options hơn là giảm độ phức tạp thật.
- Không có shared tests bắt buộc cho query options khi không có shared helper.

Decision record nằm trong `docs/SHARED_CODE_ARCHITECTURE.md` và
`docs/vi/SHARED_CODE_ARCHITECTURE.md`.

### Phạm vi đã cân nhắc (không làm)

Chỉ tách hành vi có invariant giống nhau nếu gate đạt:

- GET account URL phải encode address.
- Wallet account query:
  - disable khi address không hợp lệ
  - `staleTime: 0`
  - `refetchOnMount: 'always'`
  - `refetchOnWindowFocus: false`
- Config query dùng stale time 30 giây.
- POST quote/confirmation dùng `dedupeKey: null`.

Vẫn giữ named functions hiện tại:

- `fetchStakingConfig`, `fetchStakingAccount`, `fetchStakingQuote`
- `fetchBondingConfig`, `fetchBondingAccount`, `fetchBondingQuote`
- Hai hàm confirmation POST

### Decision gate (đã đánh giá)

Sau Điểm 1–4:

1. Prototype helper query generic trong một branch nhỏ. — **chưa có / không làm**
2. So sánh số dòng, type inference, stack trace, và độ rõ của feature files.
3. Chỉ merge khi:
   - Không cần type cast ở consumer.
   - Không che endpoint hoặc query key.
   - Shared tests bảo vệ toàn bộ query options.
   - Tổng code và độ phức tạp thực sự giảm.
4. **Không đạt** → giữ wrapper hiện tại và ghi quyết định “không refactor”.

### Điều kiện hoàn thành

- ✅ Quyết định “không refactor” đã ghi vào shared architecture docs.
- ✅ Query keys, cache/refetch behavior, và named feature API exports không đổi.

## 11. Điểm 6 — Dùng chung server transaction confirmation lookup

### Hiện trạng

Hai loader có cùng RPC skeleton:

- `server/loaders/stakingTransactionConfirmation.ts`
- `server/loaders/bondingTransactionConfirmation.ts`

Phần chung:

1. Resolve provider.
2. Đọc transaction và receipt song song.
3. Trả `not_mined` khi thiếu transaction hoặc receipt.
4. So sender, target, và calldata.
5. Map receipt status sang confirmed/reverted/unavailable.

Phần khác:

- Action snapshot.
- ABI và contract mapping.
- `buildExpectedCall`.
- Loại mismatch error và message.

### Thiết kế

Tạo:

- `server/utils/transactionConfirmationLookup.ts`
- `server/types/transactionConfirmationTypes.ts`

API dự kiến:

```ts
confirmTransactionOnChain({
  transactionHash,
  account,
  expectedCall,
  getProvider,
  createMismatchError,
})
```

`expectedCall` chỉ có:

- `target`
- `data`

Feature loader tiếp tục:

1. Parse request feature-specific.
2. Dùng `buildExpectedCall(action)`.
3. Gọi shared lookup.

### Migration

1. Tạo unit tests shared bằng provider test double.
2. Migrate Staking loader, giữ route tests.
3. Migrate Bonding loader, giữ route tests.
4. Giữ `buildExpectedCall` tests trong từng feature.
5. Không đưa Swap verification vào helper nếu Swap cần kiểm tra value,
   quote/HMAC, hoặc metadata ngoài sender/target/calldata.

### Điều kiện hoàn thành

- Provider init/read failure trả `confirmation_unavailable`.
- Thiếu transaction hoặc receipt trả `not_mined`.
- Sender, target, hoặc calldata mismatch vẫn throw validation error an toàn.
- Receipt status `null` không bị coi là revert.
- Response và HTTP status của routes không đổi.

## 12. Điểm 7 — Dùng chung debounce, abort, race guard, và stale quote

### Hiện trạng

Hai hooks lặp phần lớn lifecycle:

- `features/staking/hooks/useStakingQuote.ts`
- `features/bonding/hooks/useBondingQuote.ts`

Phần giống nhau:

- Debounce 1 giây.
- `AbortController`.
- Monotonic request id chống response cũ.
- Xóa quote ngay khi input đổi.
- Chỉ bật loading khi debounce kết thúc.
- Tick mỗi giây để tính stale sau 60 giây.
- `freshQuote()` bỏ debounce và hủy request cũ.
- `invalidate()` hủy request và reset state.

Phần phải giữ feature-local:

- `buildStakingQuoteRequest`.
- `buildBondingQuoteRequest`.
- Request type và response type.
- Error fallback.
- Request key/dependencies:
  - Staking: amount + duration.
  - Bonding: mode + amount + term.

### Thiết kế

Tạo:

- `hooks/useDebouncedAbortableQuote.ts`
- `types/debouncedAbortableQuote.types.ts`

API dự kiến:

```ts
useDebouncedAbortableQuote<TRequest, TQuote>({
  enabled,
  request,
  requestKey,
  fetchQuote,
  debounceMs,
  staleMs,
  fallbackErrorMessage,
})
```

`requestKey` phải là primitive stable string hoặc readonly primitive tuple được
normalize rõ ràng. Không nhận dependency array tùy ý rồi bỏ lint dependency.

Feature wrappers tiếp tục export public API hiện tại:

- `useStakingQuote(input)`
- `useBondingQuote(input)`
- `STAKING_QUOTE_DEBOUNCE_MS`
- `BONDING_QUOTE_DEBOUNCE_MS`
- stale constants và request builders

Hai wrappers chỉ map request key, fetch function, constants, và error fallback
vào shared hook.

### Tests bắt buộc

- Disabled hoặc request `null` reset state và không fetch.
- Input đổi trước debounce hủy timer/request cũ.
- Loading chỉ bật khi request thật sự bắt đầu.
- Response cũ đến sau không ghi đè response mới.
- Abort không set error.
- Network error set fallback đúng.
- Quote chuyển stale đúng mốc.
- `freshQuote()`:
  - không chờ debounce
  - hủy auto-quote đang chạy
  - trả quote mới hoặc `null`
- `invalidate()`:
  - hủy request
  - tăng request id
  - reset toàn bộ state
- Request key Bonding thay đổi khi side/mode/term đổi.
- Request key Staking thay đổi khi amount/duration đổi.

### Điều kiện hoàn thành

- Public return shape của hai feature hooks không đổi.
- CTA preflight vẫn dùng `freshQuote()`.
- Không tăng số request khi render lại với request object mới nhưng dữ liệu
  không đổi.
- Không có stale closure khi account/form thay đổi trong lúc request đang chạy.

## 13. Thứ tự triển khai đề xuất

Thực hiện theo các PR hoặc commit độc lập sau:

1. Baseline và characterization tests.
2. Generic account refetch.
3. Client transaction confirmation.
4. Confirmation + account sync.
5. Pending storage factory.
6. Generic pending transaction hook.
7. Generic debounced quote hook.
8. Server confirmation lookup.
9. Decision gate cho API/query wrappers. — **đã xong: không refactor**
10. Cleanup imports, dead files, tests trùng, và cập nhật docs.

Lý do:

- Điểm 1 là thay đổi nhỏ nhất và được Điểm 4 sử dụng.
- Điểm 2 phải có trước Điểm 4.
- Storage factory phải ổn định trước khi generic hook phụ thuộc vào nó.
- Quote hook độc lập với transaction flow nên có thể tách thành PR riêng.
- Server lookup làm sau client để giảm số tầng thay đổi đồng thời.
- API/query wrappers để cuối vì lợi ích thấp hơn và dễ tạo abstraction thừa.

## 14. Verification cho mỗi bước

Sau mỗi bước:

1. Chạy formatter/linter áp dụng cho file đã sửa.
2. Chạy test gần nhất với module.
3. Chạy `npm run typecheck`.
4. Chạy:
   - `npm run test:client`
   - `npm run test:staking`
   - `npm run test:bonding`
5. Nếu sửa server, chạy thêm `npm run test:server`.
6. Cuối toàn bộ refactor, chạy `npm run build`.

Manual smoke test cuối:

- Connect/disconnect/switch Polygon ở Staking và Bonding.
- Submit transaction mới và chờ receipt.
- Reload khi đang confirmation rồi resume.
- Chuyển wallet giữa lúc đang confirmation.
- Mô phỏng browser RPC lỗi nhưng server RPC thành công.
- Mô phỏng cả browser/server RPC chưa xác định được kết quả.
- Nhập quote nhanh liên tục; chỉ request cuối cập nhật UI.
- Đổi duration/term/side trong lúc quote đang chạy.
- Chờ quote stale rồi bấm CTA để xác nhận `freshQuote()` chạy.

## 15. Cập nhật tài liệu sau refactor

Sau khi code được merge:

- Cập nhật `docs/SHARED_CODE_ARCHITECTURE.md`.
- Cập nhật `docs/vi/SHARED_CODE_ARCHITECTURE.md`.
- Cập nhật Staking/Bonding technical overview nếu đường dẫn module hoặc
  transaction sequence thay đổi.
- Ghi rõ module nào shared và module nào cố ý giữ feature-local.
- Không đánh dấu một bước hoàn thành trong tài liệu trước khi tests và migration
  của cả Staking lẫn Bonding đã xong.

## 16. Definition of done

Refactor hoàn thành khi:

- Bảy nhóm đã được xử lý hoặc có decision record rõ ràng cho phần cố ý không
  refactor (Điểm 5: API/query wrappers giữ feature-local).
- Không còn implementation trùng của account refetch, client confirmation,
  confirm+sync, pending envelope/storage, pending hook, quote lifecycle, và
  server lookup (trừ phần cố ý không share đã ghi trong docs).
- Feature-local action parsing, contract mapping, CTA state, math, và copy vẫn
  tách biệt.
- Không đổi localStorage compatibility, endpoints, query keys, hoặc response
  contracts.
- Typecheck, client, staking, bonding, server tests, và production build pass.
- Shared architecture và technical docs khớp cấu trúc code mới.
