# CÀI VÀO DỰ ÁN CŨ (OVERLAY)

1. Sao lưu `src/pages/GraphPage.jsx`, `src/pages/GraphPage.css`, `src/data/sampleGraph.js`, `src/data/graphMapper.js`, `src/config/graphConfig.js`.
2. Chép các file trong thư mục `src/` của gói overlay vào `src/` của dự án cũ.
3. **KHÔNG ghi đè 9 file API gốc của bạn** (`drugsApi`, `proteinsApi`, `drugProteinApi`, `keggGeneApi`, `pathwayApi`, `keggGenePathwayApi`, `proteinGeneApi`, `diseaseHumanApi`, `humanGeneDieaseApi`). Đây là lý do overlay không chứa 9 file này.
4. Kiểm tra các export function trong 9 file API cũ khớp `src/data/sampleGraph.js`. `humanGeneDieaseApi.js` có tên sai chính tả cũ; nếu đã đổi file, sửa import trong sampleGraph.
5. Chạy `npm install @xyflow/react elkjs lucide-react sigma graphology graphology-layout-forceatlas2 graphology-layout-noverlap`.
6. Cấu hình các endpoint tuỳ chọn, nhất là MONDO → HPO trong `.env` (xem `.env.example`).
7. Chạy `npm run dev`, mở trang GraphPage hiện có.

**Lưu ý:** File `GraphPage.css` mới thuộc `src/pages/`; nó không phụ thuộc `src/css/GraphPage.css` của bản cũ. Mặc định Workflow Mode sử dụng node API thật. Không có dữ liệu giả.

Để kiểm thử mapping/workflow, chạy `node --test tests/*.test.mjs` nếu đã có package.json có `type: module`.

Nếu bạn muốn dự án độc lập có thể chạy ngay, dùng gói `Drug_ADR_Workflow_ReactFlow_Sigma_Complete.zip` thay vì overlay.
