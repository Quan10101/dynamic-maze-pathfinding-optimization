# Kết quả thí nghiệm (được sinh từ số liệu thực tế)

- Số kịch bản tĩnh: 8; số bài toán động: 32.
- Số nghiệm không khớp oracle BFS: 0.

| Thuật toán | Tỷ lệ nghiệm đúng | Số ô xét TB ± SD | Runtime TB ± SD (ms) |
|---|---:|---:|---:|
| bfs | 100.0% | 319.8 ± 268.5 | 0.2943 ± 0.2395 |
| bibfs | 100.0% | 259.6 ± 253.9 | 0.3385 ± 0.3101 |
| dijkstra | 100.0% | 319.8 ± 268.5 | 0.5067 ± 0.3943 |
| astar | 100.0% | 262.2 ± 228.1 | 0.4291 ± 0.3741 |

## Ra quyết định
- Theo số ô xét trung bình trên tập kiểm thử này, **bibfs** ít ô xét nhất trong số phương pháp có tỷ lệ nghiệm đúng 100%.
- Nếu yêu cầu nghiệm ngắn nhất trên lưới đơn vị và dễ kiểm chứng: BFS là baseline phù hợp.
- Nếu cần giảm ô xét: ưu tiên phương pháp có số ô xét tốt nhất, sau khi kiểm tra runtime/độ ổn định trên máy triển khai.
- Khi tường thay đổi, phải lập lại kế hoạch; không khẳng định tối ưu toàn bộ hành trình khi không biết trước biến cố.

## Giới hạn
- Không đo hội tụ loss: đây là thuật toán tìm đường chính xác, không phải tối ưu ngẫu nhiên học lặp.
- So sánh động dùng cùng tọa độ/tốc độ chèn tường theo seed; khi vật cản đúng vị trí agent hiện tại, sự kiện được bỏ qua vì không thể đặt tường lên agent.
- Runtime ngắn dễ nhiễu; cần lặp lại nhiều đợt và warm-up nếu muốn so sánh thời gian nghiêm ngặt.