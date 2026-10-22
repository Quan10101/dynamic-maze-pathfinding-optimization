# Kết quả thí nghiệm (được sinh từ số liệu thực tế)

- Số kịch bản tĩnh: 30; số bài toán động: 120.
- Số nghiệm không khớp oracle BFS: 0.

| Thuật toán | Tỷ lệ nghiệm đúng | Số ô xét TB ± SD | Runtime TB ± SD (ms) |
|---|---:|---:|---:|
| bfs | 100.0% | 325.8 ± 264.2 | 0.3088 ± 0.2405 |
| bibfs | 100.0% | 262.2 ± 243.4 | 0.3356 ± 0.2898 |
| dijkstra | 100.0% | 326.1 ± 264.1 | 0.4749 ± 0.3935 |
| astar | 100.0% | 240.7 ± 212.6 | 0.4103 ± 0.3712 |

## Ra quyết định
- Theo số ô xét trung bình trên tập kiểm thử này, **astar** ít ô xét nhất trong số phương pháp có tỷ lệ nghiệm đúng 100%.
- Nếu yêu cầu nghiệm ngắn nhất trên lưới đơn vị và dễ kiểm chứng: BFS là baseline phù hợp.
- Nếu cần giảm ô xét: ưu tiên phương pháp có số ô xét tốt nhất, sau khi kiểm tra runtime/độ ổn định trên máy triển khai.
- Khi tường thay đổi, phải lập lại kế hoạch; không khẳng định tối ưu toàn bộ hành trình khi không biết trước biến cố.

## Giới hạn
- Không đo hội tụ loss: đây là thuật toán tìm đường chính xác, không phải tối ưu ngẫu nhiên học lặp.
- So sánh động dùng cùng tọa độ/tốc độ chèn tường theo seed; khi vật cản đúng vị trí agent hiện tại, sự kiện được bỏ qua vì không thể đặt tường lên agent.
- Runtime ngắn dễ nhiễu; cần lặp lại nhiều đợt và warm-up nếu muốn so sánh thời gian nghiêm ngặt.