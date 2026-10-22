# PathLab — Đồ án tối ưu đường đi trong mê cung động (Python)

## Chạy trên Windows

```bat
python server.py
```

Mở http://localhost:8000. Toàn bộ thuật toán tìm đường (BFS, BFS hai chiều, Dijkstra, A*) chạy trên **Python**, HTML/CSS/JS chỉ là giao diện tương tác. Không cần cài thư viện ngoài. Python có API `/api/solve` (POST) và `/api/experiment` (POST).

Chạy thực nghiệm hoàn toàn bằng Python, kể cả khi không mở web:

```bat
python experiment.py --trials 120 --seed 20261016
```

Dữ liệu thực thu trong `results/<thời_điểm>/`: `runs.csv` (từng trial), `dynamic_runs.csv` (mê cung động), `summary.csv` (mean, std), `trace_first_scenario.json` (lịch sử các lần mở rộng), `metadata.json` (môi trường và cấu hình) và `ket_luan.md` (quyết định từ kết quả thật). File dữ liệu cũ không bị ghi đè.

## Problem formulation

Bản đồ ở thời điểm t là đồ thị `G_t=(V_t,E_t)`, một ô hợp lệ tương ứng một đỉnh. Biến quyết định: `x_ij ∈ {0,1}` thể hiện cạnh `(i,j)` có được chọn trên đường đi từ `s_t` đến `g` hay không, hoặc tương đương chuỗi đường `P=(p0,...,pk)`. Hàm mục tiêu `min Σ_(i,j)∈E_t c_ij x_ij`, với `c_ij=1` cho mọi bước hợp lệ. Miền khả thi: các chuỗi đường đi trong lưới, từ vị trí hiện tại đến đích, không xuyên tường, không vượt biên, các bước cách nhau Manhattan 1; tương đương ràng buộc bảo toàn luồng `Σ_j x_vj - Σ_i x_iv = 1 (v=s), -1 (v=g), 0 (còn lại)` trên cạnh hợp lệ. Nếu không có đường đi, bài toán bất khả thi (không được coi là độ dài vô hạn là nghiệm hợp lệ).

## Thuật toán và tại sao tối ưu

- **BFS (baseline):** duyệt lớp, bảo đảm ít bước nhất với chi phí đơn vị.
- **BiBFS (cải tiến):** BFS hai chiều từ đầu và đích, ưu tiên mở rộng frontier nhỏ hơn, nối tại giao điểm tốt nhất; vẫn bảo đảm ngắn nhất trên lưới đơn vị. Giảm ô xét không có nghĩa luôn giảm runtime.
- **Dijkstra:** nonnegative edge weights, trả nghiệm có tổng chi phí nhỏ nhất.
- **A*:** heuristic Manhattan là admissible/consistent trên lưới 4 hướng với chi phí 1. Kết quả ngắn nhất.
- Sau khi người dùng vẽ/xóa tường giữa lúc di chuyển, UI gọi lại Python từ vị trí hiện tại. Đây là **replanning từ đầu**, không phải D* Lite hay học tăng cường.

## Thực nghiệm công bằng và diễn giải

- 120 kịch bản tĩnh có seed xác định; 4 thuật toán trên cùng lưới, tường, start/end, trọng số, điều kiện dừng. Kích thước 15/20/30; mật độ tường 10/25/35%.
- Mỗi nghiệm đều được kiểm tra từng bước (tọa độ, tường, ô kề, S/E) và so chiều dài/tính khả thi với BFS oracle. Trường `valid` lưu kiểm chứng.
- Đánh giá mean ± std (runtime, ô đã xét), success rate, kiểm tra tính khả thi, độ dài nghiệm thành công. Không được lấy độ dài trung bình chỉ của các kịch bản khả thi để đại diện cho cả tập dữ liệu.
- `trace_first_scenario.json` là lịch sử mở rộng theo lượt, không phải đường hội tụ loss. Đây là thuật toán chính xác nên không có convergence loss như gradient descent; có thể phân tích số bước mở rộng đến nghiệm và tiến độ frontier.
- `dynamic_runs.csv` thử nghiệm 40 kịch bản đầu và bốn lần có thể chèn vật cản; có các thước đo hoàn thành, tổng bước di chuyển, tổng thời gian tìm đường, tổng ô xét và số lần lập lại kế hoạch.
- **Giới hạn fairness của thử nghiệm động:** vị trí tường được chọn trên đường sắp đi nên có thể khác giữa các phương pháp. Đây là cùng quy tắc sự kiện và seed, chưa phải cùng *chuỗi bản đồ* tuyệt đối. Kết luận so sánh chính thức nên dựa trên bộ static paired, và đánh giá động như tình huống minh họa/độ bền.
- Về runtime, Python được đo bằng `perf_counter_ns`, thời gian thực thi rất ngắn có nhiễu; mẫu hiện chưa tách warm-up. Muốn kiểm định chặt chẽ cần chạy nhiều batch và nêu CPU/RAM/Python trong báo cáo. Không khẳng định tốc độ nào luôn hơn trước khi xem CSV.

## Hướng kết luận

Chọn phương pháp **chỉ khi** đúng constraint, độ dài nghiệm khớp oracle trên toàn bộ test và giá trị runtime/ô xét/độ ổn định phù hợp điều kiện triển khai. BFS là baseline dễ kiểm chứng; BiBFS là cải tiến có thể giảm số ô xét; A* thường đáng thử cho bản đồ lớn khi có heuristic tốt; Dijkstra phù hợp mở rộng sang chi phí cạnh không âm không đồng nhất. Kết luận tự động thực tế trong `ket_luan.md`.

## Hiển thị tiến trình thực nghiệm (V3)

Nút **Chạy thực nghiệm** nay chạy tác vụ Python nền. Dashboard hỏi trạng thái `/api/experiment/status/{job_id}` trong khi tác vụ đang chạy, cho thấy kịch bản, thuật toán, số ô đang xét, nghiệm và tiến độ thực. Khung bản đồ **phát lại trace các nút được mở rộng do Python tạo ra** (hoạt họa chỉ để quan sát, không cộng vào runtime). Bảng đối chiếu cập nhật bằng kết quả từng lượt, rồi thay bằng Mean ± Std sau khi tất cả hoàn thành. Runtime ghi trong CSV chỉ đo phần thuật toán Python, không gồm độ trễ để người xem kịp quan sát. Trace một lượt có giới hạn lưu để giảm dữ liệu gửi lên giao diện. Không coi thanh tiến độ là đồ thị hội tụ loss.

## V21: Thuật toán Python chạy từng bước thực sự

Trang mô phỏng không còn gọi `/api/solve` để tính sẵn trước khi nhấn chạy.
`/api/live/start` tạo phiên tìm kiếm, `/api/live/step` thực hiện **một lần mở rộng nút thực trên Python** và trả về trạng thái để UI vẽ.
BFS, BFS hai chiều, Dijkstra và A* đều dùng cơ chế này. Khởi tạo mê cung chỉ đặt lại trạng thái, bộ đếm bắt đầu từ 0.
Khi có tường mới, `/api/live/edit` cập nhật trạng thái Python. Nếu ô vừa chặn chưa từng được thuật toán phát hiện, quá trình hiện tại tiếp tục mà không khởi tạo lại. Nếu tường chạm vùng đã phát hiện (hoặc xóa tường có thể tạo đường ngắn hơn), thuật toán khởi tạo lại từ vị trí nhân vật để không báo sai tính tối ưu. Trong giai đoạn nhân vật đã di chuyển theo đường tìm được, chỉ thêm tường vào đường hiện tại mới bắt buộc tìm lại.

Lưu ý: API phiên tìm kiếm giữ trạng thái trong bộ nhớ của server, dành cho demo trên máy cá nhân; không thiết kế để triển khai nhiều máy chủ. Bộ thực nghiệm batch và xuất CSV/JSON trước đây vẫn độc lập.


## Mo trang web tu dong (Windows)

Nhan dup chuot `MO_PATHLAB.bat` de chay server va tu dong mo trinh duyet mac dinh. Hoac chay `python server.py`. Dung server bang `Ctrl + C` trong cua so terminal. Neu cong 8000 dang duoc su dung, hay dung server cu truoc.


## V25 – Bằng chứng tối ưu hóa
- Chạy thực nghiệm Python từ giao diện để tạo `results/<timestamp>/runs.csv`, `summary.csv`, `dynamic_runs.csv`, `dynamic_summary.csv`, `metadata.json`, hai hình SVG trong `figures/`.
- Hai biểu đồ trong giao diện và SVG được sinh từ **số liệu thực nghiệm thật**, không sử dụng giá trị ví dụ.
- Thiết kế tĩnh: cùng seed, bản đồ, S/E, mật độ, objective và điều kiện dừng cho bốn thuật toán. Độ dài nghiệm so với oracle BFS.
- Thiết kế động: cùng lịch thêm vật cản và tọa độ trước khi chạy, nhưng sự kiện đặt tường trùng nhân vật được bỏ qua; hành trình từng thuật toán có thể khác nhau. `replans` bao gồm lần lập kế hoạch ban đầu.
- Đánh giá chất lượng: độ dài nghiệm; chi phí: ô mở rộng, runtime; độ ổn định: trung bình ± độ lệch chuẩn; thực nghiệm động: tỷ lệ thành công, số lần lập kế hoạch lại, quãng đường di chuyển.
- `requirements.txt`: không cần thư viện ngoài; dùng Python 3.10+. GitHub cần ít nhất năm commit theo tiến độ thực tế; không tạo commit giả. Báo cáo và slide cần soạn riêng.
- AI assistance: AI hỗ trợ lập trình; người thực hiện cần tự chạy, kiểm chứng kết quả, giải thích công thức và thuật toán.


### V26 – sửa hoạt ảnh thực nghiệm
Lưu đầy đủ các ô mở rộng của mỗi lượt Python thay vì giới hạn 100 ô. Đường vàng chỉ xuất hiện sau khi phát xong toàn bộ lượt tìm kiếm; lượt tiếp theo xoá sạch hoạt ảnh trước.

### V27 – Đồng bộ hoạt ảnh thực nghiệm
Tốc độ là thời lượng giữa hai lượt Python (không phải cho mỗi ô). Trace được phát hết trong khoảng 78% thời lượng lượt, hiện tiến độ đã xét, rồi mới tô đường đi. Các mê cung bị cô lập có thể chỉ mở rộng ít ô.
