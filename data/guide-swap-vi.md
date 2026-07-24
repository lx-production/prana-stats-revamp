# Hướng dẫn PRANA Swap

Hướng dẫn ngắn này giải thích các bước trên ví và các số liệu bạn sẽ thấy khi dùng **PRANA Swap** trên website chính thức. Đọc cùng với [Điều khoản & Công bố rủi ro](/terms).

PRANA Swap chạy trên **Polygon mainnet**. Hãy giữ sẵn **POL** để trả gas. Chỉ kết nối trên tên miền chính thức, và đối chiếu địa chỉ contract kỹ trước khi xác nhận.

## 1. Approve

Khi bạn swap token **ERC-20** (ví dụ USDC, USDT, hoặc PRANA), router Uniswap cần quyền kéo token đó từ ví của bạn. Quyền đó là giao dịch **approve**.

Luồng thường gặp:

1. Bạn nhập số lượng và xem quote
2. Nếu allowance chưa đủ, ví yêu cầu **Approve** trước
3. Sau khi approve được xác nhận, ví yêu cầu xác nhận **Swap**

Trên màn hình approve, hãy kiểm tra:

- **token** đang được approve
- **số lượng**
- **spender** (phải là Uniswap SwapRouter02)

Swap **POL native** không cần approve ERC-20. Bạn chỉ xác nhận chính giao dịch swap.

Approve là một giao dịch on-chain riêng và tốn gas. Approve bị hủy hoặc thất bại không chuyển token của bạn, nhưng bạn vẫn có thể mất gas.

## 2. Exact allowance

PRANA Swap yêu cầu approve **đúng số lượng đầu vào** của quote hiện tại, không phải unlimited allowance.

Ví dụ:

- Swap 100 USDC → approve 100 USDC
- Swap 50 PRANA → approve 50 PRANA

Nếu bạn đổi số lượng swap, có thể cần approve lại. Exact allowance giới hạn số token router được phép chi tiêu cho lần swap đó.

Lưu ý:

- Swap thành công sẽ dùng hết (hoặc dùng) số lượng đã approve
- Nếu swap bị hủy, thất bại, hoặc chỉ dùng một phần allowance, một phần allowance có thể vẫn còn on-chain
- Allowance còn lại không có nghĩa là router đang giữ token của bạn; đó chỉ là quyền chi tiêu mà bạn có thể thu hồi sau

## 3. Slippage

**Slippage** là chênh lệch giữa output theo quote và output cuối cùng on-chain khi giá thay đổi trong lúc giao dịch đang pending.

PRANA Swap hiện dùng mức slippage **cố định 0,5%** trên giao diện. Bạn chưa thể đổi mức này trong UI hiện tại.

Nếu thị trường biến động quá mức dung sai đó trước khi xác nhận, swap có thể **revert** thay vì khớp với tỷ giá xấu hơn. Giao dịch revert vẫn có thể tốn gas.

Bảo vệ slippage quan trọng nhất khi pool thay đổi giữa lúc lấy quote và lúc xác nhận. Price impact do quy mô lệnh của bạn đã được phản ánh trong quote.

## 4. Minimum received

**Minimum received** (tối thiểu nhận được) là số lượng token đầu ra thấp nhất mà swap được phép giao on-chain.

Nó được tính từ output theo quote trừ đi dung sai slippage cố định (quote × 99,5% với slippage 0,5%).

Nếu thực thi sẽ giao ít hơn mức này, giao dịch sẽ revert. Hãy xem **Minimum received** cùng với route và ước tính gas trước khi xác nhận.

Quote chỉ là ước tính. Số nhận cuối cùng có thể cao hơn mức tối thiểu, nhưng sẽ không thấp hơn trừ khi giao dịch thất bại.

## 5. Transaction pending

Sau khi bạn xác nhận trên ví, trạng thái có thể hiện các giai đoạn đang chờ hoặc đang xác nhận, ví dụ:

- **Approve in Wallet** / **Confirming Approval**
- **Swap in Wallet** / **Confirming Swap**

Khi giao dịch đang pending:

- chờ ví và mạng xử lý xong; đừng spam nhiều lần xác nhận trùng
- bạn có thể mở giao dịch trên Polygonscan từ UI thành công hoặc pending khi đã có hash
- thời gian xác nhận phụ thuộc tắc nghẽn Polygon và mức gas bạn chọn
- đóng modal không hủy giao dịch đã được broadcast

Nếu UI báo đang pending nhưng ví đã hiện thành công hoặc thất bại, hãy làm mới số dư và kiểm tra Polygonscan bằng mã hash giao dịch.

## 6. Revoke allowance

PRANA Swap hiện **không** có nút **Revoke** sẵn trong giao diện. Bạn có trách nhiệm tự kiểm tra allowance ERC-20 còn lại sau các lần swap bị hủy hoặc thất bại.

Trước khi revoke, hãy xác nhận spender là Uniswap SwapRouter02 chính thức trên Polygon:

[0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45)

Các cách thường dùng:

- dùng phần quản lý token allowance / spending cap trong ví, nếu ví có hỗ trợ
- dùng công cụ kiểm tra và revoke allowance uy tín có hỗ trợ Polygon
- trên Polygonscan, mở contract của token → **Write Contract** → `approve(spender, 0)` với spender là SwapRouter02

Revoke đặt allowance về 0 (hoặc mức an toàn khác mà bạn chọn). Thao tác này cần chữ ký ví và gas. Không bao giờ chia sẻ seed phrase hoặc private key để nhờ ai “revoke hộ”.

Về rủi ro, địa chỉ contract, và điều khoản pháp lý, xem [Điều khoản & Công bố rủi ro](/terms).
