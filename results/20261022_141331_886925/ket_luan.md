# Kết quả thí nghiệm (được sinh từ số liệu thực tế)

- Số kịch bản tĩnh: 120; số bài toán động: 160.
- Số nghiệm không khớp oracle BFS: 0.

| Thuật toán | Tỷ lệ nghiệm đúng | Số ô xét TB ± SD | Runtime TB ± SD (ms) |
|---|---:|---:|---:|
| bfs | 100.0% | 306.8 ± 265.5 | 0.4118 ± 0.4028 |
| bibfs | 100.0% | 230.2 ± 243.8 | 0.4207 ± 0.4726 |
| dijkstra | 100.0% | 307.0 ± 265.5 | 0.6257 ± 0.5733 |
| astar | 100.0% | 237.2 ± 221.1 | 0.5750 ± 0.5839 |

## Ra quyết định
- Theo số ô xét trung bình trên tập kiểm thử này, **bibfs** ít ô xét nhất trong số phương pháp có tỷ lệ nghiệm đúng 100%.
- Nếu yêu cầu nghiệm ngắn nhất trên lưới đơn vị và dễ kiểm chứng: BFS là baseline phù hợp.
- Nếu cần giảm ô xét: ưu tiên phương pháp có số ô xét tốt nhất, sau khi kiểm tra runtime/độ ổn định trên máy triển khai.
- Khi tường thay đổi, phải lập lại kế hoạch; không khẳng định tối ưu toàn bộ hành trình khi không biết trước biến cố.

## Giới hạn
- Không đo hội tụ loss: đây là thuật toán tìm đường chính xác, không phải tối ưu ngẫu nhiên học lặp.
- So sánh động dùng cùng tọa độ/tốc độ chèn tường theo seed; khi vật cản đúng vị trí agent hiện tại, sự kiện được bỏ qua vì không thể đặt tường lên agent.
- Runtime ngắn dễ nhiễu; cần lặp lại nhiều đợt và warm-up nếu muốn so sánh thời gian nghiêm ngặt.