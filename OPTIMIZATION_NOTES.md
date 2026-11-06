# Báo cáo tối ưu — 06/11/2026

## Triệu chứng và nguyên nhân

1. Workflow dùng `useNodesState` và `useEdgesState` cho toàn bộ KG. Với hàng nghìn node/cạnh, React Flow lưu và xử lý rất nhiều phần tử ngoài vùng nhìn, dù bật `onlyRenderVisibleElements`.
2. Mỗi lần thay root, phạm vi, loại node: tạo lại adjacency index và layout nhiều lần.
3. `workflowColumns.js` từng quét toàn bộ edges cho từng cột.
4. Inspector lọc toàn bộ danh sách cạnh sau mỗi click node.
5. Sigma Worker có đường dẫn sai (`./graphLayout.worker.js` so với `../workers/graphLayout.worker.js`), dễ rơi vào fallback chạy layout đồng bộ và làm treo UI.
6. Bundle Graph từng import Sigma đồng bộ dù đang chọn Workflow.

## Giải pháp

| Thành phần | Trước | Sau |
| --- | --- | --- |
| Workflow DOM | Tất cả node/edge | Chỉ vùng nhìn, tối đa ~420 node + 1.300 cạnh |
| Dữ liệu thực | Tất cả | Tất cả (giữ nguyên) |
| Layout | Quét edges lặp lại theo từng cột | Một lượt phân loại edges + sort theo từng cột |
| Tìm liên kết Inspector | O(E) mỗi lần click | Chỉ quét các cạnh kề đã được index |
| Pan/Zoom | State update theo mouse | Update giới hạn ~95 ms, overscan |
| Sigma.js | Worker URL sai | Worker URL chính xác + fallback an toàn |
| Initial code load | Sigma import tĩnh | Sigma và trang Graph lazy-loaded |
| Disease–HPO | Không nhận `database_id` FK | Chỉ join với ontology catalog có ID hợp lệ |

## Kiểm thử tự động

Chạy `npm test` từ thư mục project.
Kiểm thử tập dữ liệu mô phỏng **21.000 node + 18.000 cạnh** cho kết quả ví dụ:
layout + viewport selection khoảng **70–90 ms** (môi trường test), canvas **336 node + 240 cạnh** trong cấu hình zoom kiểm thử. Đây là phép đo JS thuật toán, không phải benchmark FPS hay thời gian render browser.

## Cách kiểm tra trên máy phát triển

1. Giải nén bản đã tối ưu, đồng bộ `.env.local` tùy biến của máy cũ nếu có.
2. `npm run dev`, mở Network Explorer → Workflow → Tất cả node theo loại.
3. Bật Chrome DevTools → Performance để so sánh long task và FPS khi kéo, zoom, chuyển loại.
4. Đối chiếu số node/edge được tải từ API với counter tổng trên màn hình. Counters trong vùng canvas nhỏ hơn tổng là chủ ý, không phải mất dữ liệu.
5. Test trực tiếp Disease → HPO với API; nếu vẫn không join, xem `sampleKeys` trong API & ID Diagnostics, cần đối chiếu tên khóa thực trong backend.

## Không thay đổi

- Không xóa node/edge thật, không bổ sung cạnh giả, không giới hạn node theo từng loại trong dữ liệu.
- Không thay tên API backend, không sửa phương pháp chuẩn hóa UMLS CUI/HP/MONDO cốt lõi.
- Không thay dữ liệu nhà thuốc/disease.
