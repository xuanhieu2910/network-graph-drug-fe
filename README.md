# Drug Knowledge Graph Frontend — phiên bản tối ưu Workflow

Ứng dụng React + Vite, hiển thị tri thức dược học từ FastAPI theo hai cách:
Workflow (React Flow, node xếp cột) và Full Network (Sigma.js).

## Chạy trên máy Windows

```powershell
cd network-graph-drug-fe
npm install
npm run dev
```

Truy cập URL Vite in trên terminal (thường là http://localhost:5173), sau đó vào **Knowledge Graph**.
Backend FastAPI phải chạy đúng địa chỉ `VITE_API_BASE_URL` (mặc định `http://127.0.0.1:8000`).
Nếu dùng bản ZIP đầy đủ đã bao gồm `node_modules`, có thể thử `npm run dev` ngay;
`npm install` sẽ đồng bộ dependency khi cần. Không cần copy thư mục `node_modules/.vite` cũ.

Kiểm thử thuật toán (không cần chạy backend):

```powershell
npm test
```

## Thay đổi quan trọng

- **Viewport virtualization** trong `src/data/workflowViewport.js`: toàn bộ KG vẫn có trong bộ nhớ, nhưng React Flow chỉ nhận node trong vùng đang xem và các edge có hai đầu nằm trong vùng được vẽ. Giới hạn DOM/SVG khoảng 420 node và 1.300 cạnh mỗi khung hình; lúc zoom ra xa lấy mẫu theo các cột. Zoom vào hoặc nhảy tới node để xem đầy đủ chi tiết khu vực đó.
- **Bố trí cột tuyến tính** trong `workflowColumns.js`: duyệt toàn bộ edges một lượt thay vì một lượt cho từng cột. Không áp dụng giới hạn lên dữ liệu KG gốc.
- **Không dựng lại chỉ mục workflow** mỗi lần chuyển phạm vi/bộ lọc; chỉ mục được memo hóa theo `data`.
- **Throttling pan/zoom** (~95 ms), hỗ trợ ResizeObserver và lưu vị trí node đã kéo.
- **Inspector** dùng adjacency index, không quét toàn bộ edges sau mỗi lần chọn.
- **Sigma Worker** sửa đường dẫn `../workers/graphLayout.worker.js`; không còn tự động chạy đồng bộ thuật toán rất lớn trên UI thread nếu worker thất bại.
- **Lazy-loading Sigma.js và trang Graph**, tránh tải renderer nặng khi chưa cần.
- **MONDO–HPO mapping**: hỗ trợ quan hệ dùng khóa `database_id` trỏ đến HPO catalog, và `disease_id` trỏ đến MONDO catalog, chỉ khi cả hai được đối chiếu rõ ràng; không xem `database_id` dạng số như một HP code.

## Lưu ý về mạng dữ liệu lớn

Dòng thông tin trên canvas hiển thị `đang vẽ X/Y node · A/B cạnh`.
`Y` và `B` là số node/cạnh hợp lệ của workflow đang chọn; **không bị xóa hay giới hạn**.
`X` và `A` là lượng đang vẽ để tránh lag. Cạnh nối đến node ngoài vùng nhìn có thể
chưa được vẽ cho đến khi hai đầu đều ở trong vùng nhìn hoặc người dùng điều hướng/zoom.
Với các graph dày đặc, số cạnh đang vẽ có giới hạn 1.300, được báo rõ trên UI.

Không tự sinh cạnh biomedical mới. Bật/tắt một loại node sẽ ẩn cạnh liên quan đúng theo API.

## Kiểm thử

`npm test`: kiểm tra bảo toàn node/cạnh, hướng ADR–HPO, filter,
viewport, dữ liệu mô phỏng 21.000 node / 18.000 cạnh, và join MONDO–HPO qua `database_id`.

**Giới hạn xác minh:** kiểm thử thuật toán và phân tích cú pháp JSX đã chạy trên môi trường tạo file. Việc build và đo FPS thực tế cần chạy trên Windows cùng phiên bản npm/Vite và API FastAPI của dự án; các gói binding Vite trong ZIP gốc là bản Windows, không chạy được bằng tool build Linux tại đây.
