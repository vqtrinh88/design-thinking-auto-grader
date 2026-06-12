# Design Thinking Auto Grader

Ứng dụng Next.js để chấm tự động bài luận môn Design Thinking theo rubrik, đối sánh MSSV/Họ tên, và xuất file Excel tổng hợp điểm đã chấm.

## Chức năng

- Tải **1 file Excel danh sách lớp** (`.xlsx`, `.xls`)
- Tải **nhiều file bài luận** (`.pdf`, `.docx`, `.txt`, `.md`)
- Đối sánh **MSSV / Họ tên** từ tên file hoặc nội dung
- Chấm bài bằng **OpenAI Responses API** với **Structured Outputs**
- Bước điểm **0.5**
- Mức sàn mặc định **7.0** cho bài hợp lệ
- Gắn cờ:
  - nghi AI (`DT_Co_nghi_AI`, `DT_Ly_do_nghi_AI`)
  - dưới 1.500 từ (`DT_Duoi_1500_tu`, `DT_So_tu_uoc_tinh`)
- Xuất file Excel hoàn chỉnh: `bang-tong-hop-diem-da-cham.xlsx`
- Tạo thêm sheet `Review_Manual` cho các trường hợp cần kiểm tra thủ công

## Cột đầu ra

- `DT_1_Gioi_thieu_DT`
- `DT_2_Qua_trinh_ca_nhan_va_nhom`
- `DT_3_Cam_nhan_ve_mon_hoc`
- `DT_4_Ung_dung_tuong_lai`
- `DT_Tong`
- `DT_5_Gop_y_cho_giang_vien`
- `DT_Nhan_xet_chung`
- `DT_Co_nghi_AI`
- `DT_Ly_do_nghi_AI`
- `DT_Duoi_1500_tu`
- `DT_So_tu_uoc_tinh`
- `DT_File_match`
- `DT_Muc_do_tin_cay_match`

## Cài đặt

```bash
npm install
cp .env.example .env.local
npm run dev
```

Truy cập `http://localhost:3000`.

## Biến môi trường

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.5
```


## Deploy lên Vercel

1. Đưa thư mục project này lên một GitHub repository.
2. Vào Vercel, chọn **Add New Project** và import repository.
3. Trong **Environment Variables**, thêm:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.5
```

4. Bấm **Deploy**.
5. Sau khi deploy xong, route `app/api/grade/route.ts` sẽ được Vercel triển khai thành serverless function.

Lưu ý:
- Route chấm bài đã khai báo `runtime = "nodejs"` và `maxDuration = 300`.
- Với lớp đông hoặc file PDF nặng, thời gian chạy thực tế còn phụ thuộc giới hạn function của gói Vercel đang dùng.
- Biến môi trường trên Vercel được cấu hình trong phần Project Settings và được mã hóa khi lưu.

## Ghi chú kỹ thuật

- App dùng **Responses API** cho text generation và structured extraction.
- Structured Outputs được triển khai bằng `responses.parse(...)` + `zodTextFormat(...)`.
- Với PDF có ít text parse được ở local, app fallback sang **file input** bằng Files API (`purpose: user_data`) rồi gửi `input_file` vào Responses API.
- Cờ nghi AI chỉ là **cờ rà soát**, không phải kết luận tuyệt đối.
- Nếu nhiều file cùng match một MSSV, app ưu tiên file có confidence cao hơn và đẩy file còn lại sang `Review_Manual`.

## Định dạng roster nên có

App sẽ tự đọc một trong các cột sau nếu có:

- MSSV / Mã số sinh viên / Ma so sinh vien
- Họ tên / Ho ten / Họ và tên / Ho va ten

## Mở rộng nên làm tiếp

- Batch queue để tránh timeout với lớp rất đông
- Caching theo hash file
- Dashboard phân bố điểm
- Export thêm CSV/PDF summary
- Chế độ chấm lại một bài riêng lẻ
