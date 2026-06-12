// ================================================================
//  APP.JS — Xử lý logic ứng dụng quản lý chi tiêu
//
//  File này làm 3 việc chính:
//    1. Kiểm tra người dùng đã đăng nhập chưa
//    2. Đọc / ghi dữ liệu giao dịch vào localStorage
//    3. Cập nhật giao diện (danh sách, tổng tiền, biểu đồ)
//
//  KIẾN THỨC CẦN BIẾT TRƯỚC KHI ĐỌC:
//    - localStorage : bộ nhớ của trình duyệt, lưu được dữ liệu dạng text
//    - JSON         : định dạng chuyển đổi giữa object/mảng ↔ text
//    - DOM          : document.getElementById(...) để lấy thẻ HTML theo id
// ================================================================


// ================================================================
//  PHẦN 1: KIỂM TRA ĐĂNG NHẬP
//  Code này chạy NGAY KHI trang tải, trước tất cả mọi thứ khác.
// ================================================================

/*
  localStorage.getItem('currentUser') trả về:
    - null              : nếu chưa có key 'currentUser' (chưa đăng nhập)
    - chuỗi JSON        : nếu đã đăng nhập, ví dụ: '{"username":"alice","fullname":"Alice"}'

  JSON.parse(...) chuyển chuỗi JSON → object JavaScript.
  Ví dụ: '{"username":"alice"}' → { username: "alice" }

  Nếu getItem trả về null → JSON.parse(null) → null
  Nên currentUser sẽ là null khi chưa đăng nhập.
*/
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

// Nếu currentUser là null (chưa đăng nhập) → chuyển sang trang login
if (!currentUser) {
  // window.location.href = '...' là cách chuyển trang bằng JavaScript
  window.location.href = 'login.html';
}


// ================================================================
//  PHẦN 2: KHAI BÁO BIẾN TOÀN CỤC
//  "Toàn cục" = khai báo ở đây, dùng được trong MỌI hàm bên dưới
// ================================================================

/*
  Mỗi người dùng có một key riêng trong localStorage để tránh
  dữ liệu bị lẫn lộn giữa các tài khoản.
  Ví dụ: alice dùng key "transactions_alice"
         bob   dùng key "transactions_bob"

  Toán tử + nối chuỗi:
    'transactions_' + 'alice' → 'transactions_alice'
*/
const STORAGE_KEY = 'transactions_' + (currentUser ? currentUser.username : 'guest');

/*
  Mảng lưu tất cả giao dịch trong bộ nhớ RAM (biến JavaScript).
  Mỗi phần tử là 1 object giao dịch, ví dụ:
  {
    id:       1716200000000,   ← số timestamp (mili-giây từ 1970)
    name:     'Tiền điện',
    amount:   200000,
    type:     'expense',       ← 'expense' hoặc 'income'
    category: 'Nhà ở',
    date:     '2025-05-20'
  }

  Lưu ý: Dữ liệu ở đây chỉ tồn tại trong tab đang mở.
  Muốn lưu lâu dài → cần dùng localStorage (hàm saveToStorage bên dưới).
*/
let transactions = [];

/*
  Lưu "instance" (đối tượng) biểu đồ Chart.js đang hiển thị.
  Mỗi khi cần vẽ lại biểu đồ, ta phải hủy biểu đồ cũ trước
  (gọi chartInstance.destroy()) để tránh bị chồng lên nhau.
  Khởi đầu = null vì chưa có biểu đồ nào.
*/
let chartInstance = null;


// ================================================================
//  PHẦN 3: KHỞI ĐỘNG ỨNG DỤNG
//  Các hàm này chạy ngay sau khi trang tải xong
// ================================================================

initUserBar();             // Bước 1: Hiện tên và avatar người dùng
loadFromStorage();         // Bước 2: Đọc dữ liệu đã lưu từ localStorage
renderList(transactions);  // Bước 3: Vẽ danh sách giao dịch lên màn hình
updateSummary();           // Bước 4: Tính và hiện tổng thu / chi / số dư
renderChart(transactions); // Bước 5: Vẽ biểu đồ tròn theo danh mục


// ================================================================
//  CÁC HÀM CHỨC NĂNG
//  (Mỗi hàm làm đúng 1 việc, đặt tên rõ ràng theo việc đó)
// ================================================================


// ----------------------------------------------------------------
//  HÀM: initUserBar()
//  Mục đích: Hiển thị tên và chữ cái đầu của người dùng lên
//             thanh thông tin ở đầu trang
// ----------------------------------------------------------------
function initUserBar() {
  // document.getElementById('...') tìm thẻ HTML có id tương ứng
  // Nếu không tìm thấy → trả về null
  const greeting = document.getElementById('user-greeting');
  const avatar   = document.getElementById('user-avatar');

  // Chỉ thực hiện nếu cả 2 thẻ và currentUser đều tồn tại
  if (greeting && currentUser) {
    // .textContent = '...' thay đổi nội dung chữ của thẻ
    greeting.textContent = 'Xin chào, ' + currentUser.fullname + '!';

    /*
      Lấy chữ cái đầu tiên của tên để làm avatar.
      Ví dụ: "Alice Nguyen" → charAt(0) → 'A' → toUpperCase() → 'A'

      charAt(0)    : lấy ký tự ở vị trí 0 (vị trí đầu tiên)
      toUpperCase(): chuyển thành chữ in hoa
    */
    avatar.textContent = currentUser.fullname.charAt(0).toUpperCase();
  }
}


// ----------------------------------------------------------------
//  HÀM: addTransaction()
//  Mục đích: Đọc dữ liệu từ form nhập → kiểm tra → lưu vào mảng
//  Được gọi khi người dùng bấm nút "Thêm giao dịch"
// ----------------------------------------------------------------
function addTransaction() {
  // --- Bước 1: Đọc giá trị từ các ô nhập trong form ---

  /*
    .value    : lấy nội dung hiện tại của ô nhập (luôn là chuỗi text)
    .trim()   : xóa khoảng trắng đầu/cuối
                Ví dụ: "  Tiền điện  " → "Tiền điện"
    parseFloat: chuyển chuỗi sang số thực
                Ví dụ: "200000" → 200000
                Nếu không phải số → trả về NaN (Not a Number)
  */
  const name     = document.getElementById('inp-name').value.trim();
  const amount   = parseFloat(document.getElementById('inp-amount').value);
  const type     = document.getElementById('inp-type').value;       // 'expense' hoặc 'income'
  const category = document.getElementById('inp-category').value;   // 'Ăn uống', 'Nhà ở'...
  const date     = document.getElementById('inp-date').value;       // Định dạng 'YYYY-MM-DD'

  // --- Bước 2: Kiểm tra dữ liệu hợp lệ trước khi lưu ---
  if (name === '') {
    alert('Vui lòng nhập tên giao dịch!');
    return; // "return" thoát khỏi hàm ngay, không chạy code phía dưới
  }
  if (isNaN(amount) || amount <= 0) {
    // isNaN() kiểm tra xem có phải NaN không (Not a Number)
    // isNaN(200000) → false (bình thường)
    // isNaN("abc")  → true  (không hợp lệ)
    alert('Vui lòng nhập số tiền hợp lệ!');
    return;
  }
  if (date === '') {
    alert('Vui lòng chọn ngày!');
    return;
  }

  // --- Bước 3: Tạo object giao dịch mới ---
  /*
    Date.now() trả về số mili-giây kể từ 1/1/1970 đến hiện tại.
    Đây là cách tạo ID độc nhất đơn giản nhất:
    - Mỗi lần gọi cho ra số khác nhau (thời gian luôn tăng)
    - Không cần đếm thủ công 1, 2, 3...

    Cú pháp { key: value } là object literal (tạo object ngay tại chỗ)
  */
  const newTransaction = {
    id:       Date.now(),
    name:     name,
    amount:   amount,
    type:     type,
    category: category,
    date:     date
  };

  // --- Bước 4: Thêm vào mảng và cập nhật mọi thứ ---
  /*
    .push() thêm 1 phần tử vào cuối mảng
    Sau lệnh này: transactions = [...giao dịch cũ..., newTransaction]
  */
  transactions.push(newTransaction);

  saveToStorage();           // Ghi mảng mới vào localStorage
  renderList(transactions);  // Vẽ lại danh sách
  updateSummary();           // Tính lại tổng tiền
  renderChart(transactions); // Vẽ lại biểu đồ

  // --- Bước 5: Xóa trắng các ô nhập để sẵn sàng nhập tiếp ---
  document.getElementById('inp-name').value   = '';
  document.getElementById('inp-amount').value = '';
  document.getElementById('inp-date').value   = '';
}


// ----------------------------------------------------------------
//  HÀM: saveToStorage()
//  Mục đích: Lưu mảng transactions vào localStorage
//
//  localStorage chỉ lưu được TEXT (chuỗi ký tự),
//  nên ta phải chuyển mảng → chuỗi JSON trước khi lưu.
// ----------------------------------------------------------------
function saveToStorage() {
  /*
    JSON.stringify(mảng) chuyển mảng → chuỗi JSON.
    Ví dụ:
      [{ id: 1, name: "Điện" }]
      → '[{"id":1,"name":"Điện"}]'

    localStorage.setItem(key, value) ghi cặp key-value vào trình duyệt.
    Dữ liệu này tồn tại kể cả khi tắt tab, tắt máy.
  */
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}


// ----------------------------------------------------------------
//  HÀM: loadFromStorage()
//  Mục đích: Đọc dữ liệu đã lưu từ localStorage khi mở trang
//
//  Đây là quá trình ngược lại với saveToStorage:
//  Chuỗi JSON → mảng JavaScript
// ----------------------------------------------------------------
function loadFromStorage() {
  /*
    localStorage.getItem(key) đọc dữ liệu theo key.
    Trả về:
      - null   : nếu chưa từng lưu gì (lần đầu mở app)
      - chuỗi  : nếu đã có dữ liệu

    Ta kiểm tra !== null trước khi parse để tránh lỗi
    JSON.parse(null) → null (không phải mảng)
  */
  const chuoiJSON = localStorage.getItem(STORAGE_KEY);

  if (chuoiJSON !== null) {
    /*
      JSON.parse(chuỗi) chuyển chuỗi JSON → mảng JavaScript.
      Ví dụ:
        '[{"id":1,"name":"Điện"}]'
        → [{ id: 1, name: "Điện" }]

      Sau lệnh này, biến transactions có đầy đủ dữ liệu cũ.
    */
    transactions = JSON.parse(chuoiJSON);
  }
  // Nếu chuoiJSON === null → không làm gì, giữ mảng rỗng [] như ban đầu
}


// ----------------------------------------------------------------
//  HÀM: updateSummary()
//  Mục đích: Tính tổng thu / tổng chi / số dư → hiển thị lên 3 thẻ
// ----------------------------------------------------------------
function updateSummary() {
  // Khởi tạo 2 biến bộ đếm, bắt đầu từ 0
  let totalIncome  = 0;
  let totalExpense = 0;

  /*
    Vòng lặp for duyệt qua TỪNG giao dịch trong mảng.
    i bắt đầu từ 0 (phần tử đầu tiên), tăng dần đến hết mảng.

    transactions.length = số lượng giao dịch trong mảng
    transactions[i]     = giao dịch thứ i (đếm từ 0)
  */
  for (let i = 0; i < transactions.length; i++) {
    const gdHienTai = transactions[i]; // Giao dịch đang xét

    if (gdHienTai.type === 'income') {
      totalIncome += gdHienTai.amount;   // += nghĩa là cộng thêm vào
    } else {
      totalExpense += gdHienTai.amount;  // type === 'expense'
    }
  }

  // Số dư = tổng thu - tổng chi
  const balance = totalIncome - totalExpense;

  // Cập nhật nội dung text của 3 thẻ HTML
  document.getElementById('total-income').textContent  = formatMoney(totalIncome);
  document.getElementById('total-expense').textContent = formatMoney(totalExpense);
  document.getElementById('balance').textContent       = formatMoney(balance);

  // Đổi màu số dư thành đỏ nếu âm (chi nhiều hơn thu)
  const balanceEl = document.getElementById('balance');
  if (balance < 0) {
    balanceEl.style.color = '#e74c3c'; // Đỏ
  } else {
    balanceEl.style.color = '';  // Trống = trả về màu mặc định trong CSS
  }
}


// ----------------------------------------------------------------
//  HÀM: renderList(list)
//  Mục đích: Tạo HTML và hiển thị danh sách giao dịch
//
//  Tham số "list": mảng giao dịch cần hiển thị
//    - Bình thường truyền vào: transactions (toàn bộ)
//    - Khi lọc tháng truyền vào: mảng đã lọc
// ----------------------------------------------------------------
function renderList(list) {
  // Tìm thẻ div có id="transaction-list" — đây là nơi chứa danh sách
  const container = document.getElementById('transaction-list');

  // Trường hợp đặc biệt: chưa có giao dịch nào
  if (list.length === 0) {
    // .innerHTML = '...' thay toàn bộ nội dung bên trong thẻ bằng HTML mới
    container.innerHTML = '<p style="text-align:center;color:#aaa;margin:20px 0">Chưa có giao dịch nào.</p>';
    return;
  }

  /*
    Bảng tra icon theo danh mục.
    Object này hoạt động như "từ điển":
      key   = tên danh mục (chuỗi)
      value = object chứa tên icon và màu sắc

    Các icon lấy từ thư viện Tabler Icons (đã nhúng trong HTML):
    https://tabler-icons.io
  */
  const categoryIcons = {
    'Ăn uống':   { icon: 'ti-bowl',                  color: '#f39c12' }, // Vàng cam
    'Nhà ở':     { icon: 'ti-home',                  color: '#3498db' }, // Xanh dương
    'Di chuyển': { icon: 'ti-motorbike',              color: '#9b59b6' }, // Tím
    'Giải trí':  { icon: 'ti-device-gamepad-2',      color: '#e91e8c' }, // Hồng
    'Lương':     { icon: 'ti-briefcase',              color: '#27ae60' }, // Xanh lá
    'Học tập':   { icon: 'ti-book',                  color: '#1abc9c' }, // Xanh ngọc
    'Khác':      { icon: 'ti-dots-circle-horizontal', color: '#95a5a6' }, // Xám
  };

  /*
    Biến html dùng để tích lũy (cộng dồn) chuỗi HTML của tất cả dòng.
    Sau vòng lặp, gán 1 lần vào container thay vì gán từng dòng
    → hiệu quả hơn vì trình duyệt chỉ phải render 1 lần.
  */
  let html = '';

  for (let i = 0; i < list.length; i++) {
    const t = list[i]; // Viết tắt cho giao dịch đang xét

    // Chọn dấu + hay - tùy loại giao dịch
    const sign = t.type === 'income' ? '+' : '-';
    // Cú pháp A ? B : C = "nếu A đúng thì B, ngược lại C" (toán tử 3 ngôi)

    /*
      Tra icon theo danh mục.
      Cú pháp: object[key]
        categoryIcons['Ăn uống'] → { icon: 'ti-bowl', color: '#f39c12' }

      Nếu danh mục không có trong bảng → dùng icon mặc định ti-tag xám
      Cú pháp: A || B = "nếu A là falsy thì dùng B"
        undefined || { ... } → { ... }
    */
    const iconInfo = categoryIcons[t.category] || { icon: 'ti-tag', color: '#95a5a6' };

    /*
      Template literal (chuỗi mẫu) bắt đầu và kết thúc bằng dấu backtick `
      Cho phép viết HTML nhiều dòng và nhúng biến với cú pháp ${biến}.
      Dễ đọc hơn nhiều so với nối chuỗi bằng dấu +.
    */
    html += `
      <div class="transaction-item">

        <!-- Cột trái: tên và thông tin phụ -->
        <div class="info">
          <div class="name">${t.name}</div>
          <div class="meta">
            <i class="ti ${iconInfo.icon}" style="color:${iconInfo.color};font-size:16px;vertical-align:-2px;margin-right:4px"></i>
            ${t.category} &bull; ${t.date}
          </div>
          <!-- &bull; là mã HTML cho ký tự dấu chấm tròn • -->
        </div>

        <!-- Cột phải: số tiền và nút xóa -->
        <div class="right">
          <div class="amount ${t.type}">${sign}${formatMoney(t.amount)}</div>
          <!-- class="${t.type}" → thêm class "income" hoặc "expense" để CSS tô màu -->

          <button class="btn-delete" onclick="deleteEntry(${t.id})" aria-label="Xóa giao dịch">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
          <!-- onclick="deleteEntry(${t.id})" → khi bấm nút, gọi hàm deleteEntry với đúng ID -->
        </div>

      </div>
    `;
  }

  // Sau khi vòng lặp xong, gán toàn bộ HTML vào container 1 lần
  container.innerHTML = html;
}


// ----------------------------------------------------------------
//  HÀM: deleteEntry(id)
//  Mục đích: Xóa 1 giao dịch khỏi mảng theo ID
//  Được gọi khi người dùng bấm nút thùng rác
// ----------------------------------------------------------------
function deleteEntry(id) {
  /*
    Array.findIndex(callback) duyệt mảng và trả về INDEX (vị trí) của
    phần tử đầu tiên thỏa điều kiện.
    Nếu không tìm thấy → trả về -1.

    Arrow function: t => t.id === id
      Nghĩa là: "với mỗi phần tử t, trả về true nếu t.id bằng id"
    Đây là cách viết ngắn của: function(t) { return t.id === id; }
  */
  const index = transactions.findIndex(t => t.id === id);

  if (index !== -1) {
    /*
      Array.splice(vị_trí, số_lượng_xóa) xóa phần tử khỏi mảng.
      Ví dụ: splice(2, 1) → xóa 1 phần tử tại vị trí 2
    */
    transactions.splice(index, 1);

    // Cập nhật lại mọi thứ sau khi xóa
    saveToStorage();
    renderList(transactions);
    updateSummary();
    renderChart(transactions);
  }
}


// ----------------------------------------------------------------
//  HÀM: filterByMonth()
//  Mục đích: Lọc và chỉ hiển thị giao dịch trong tháng được chọn
//  Được gọi tự động khi người dùng thay đổi ô chọn tháng (onchange)
// ----------------------------------------------------------------
function filterByMonth() {
  // Đọc giá trị từ ô chọn tháng, định dạng: 'YYYY-MM' (ví dụ: '2025-05')
  const month = document.getElementById('filter-month').value;

  // Nếu không chọn tháng (xóa trắng) → hiện tất cả
  if (month === '') {
    renderList(transactions);
    return;
  }

  /*
    Array.filter(callback) tạo mảng MỚI chỉ giữ những phần tử
    thỏa điều kiện trong callback (không sửa mảng gốc).

    String.startsWith(chuỗi_con) kiểm tra chuỗi có bắt đầu bằng chuỗi_con không.
    Ví dụ: '2025-05-20'.startsWith('2025-05') → true
            '2025-04-01'.startsWith('2025-05') → false

    Vì ngày lưu dạng 'YYYY-MM-DD', ta chỉ cần kiểm tra phần đầu 'YYYY-MM'
    để biết giao dịch có thuộc tháng đó không.
  */
  const filtered = transactions.filter(t => t.date.startsWith(month));

  // Hiển thị mảng đã lọc (không ảnh hưởng đến mảng transactions gốc)
  renderList(filtered);
}


// ----------------------------------------------------------------
//  HÀM: clearFilter()
//  Mục đích: Xóa bộ lọc tháng → hiện lại tất cả giao dịch
// ----------------------------------------------------------------
function clearFilter() {
  // Đặt lại ô chọn tháng về rỗng
  document.getElementById('filter-month').value = '';
  // Hiển thị toàn bộ mảng gốc
  renderList(transactions);
}


// ----------------------------------------------------------------
//  HÀM: renderChart(list)
//  Mục đích: Vẽ biểu đồ donut (bánh rán) thể hiện chi tiêu theo danh mục
//  Dùng thư viện Chart.js (đã nhúng trong index.html)
// ----------------------------------------------------------------
function renderChart(list) {
  // Lấy các thẻ liên quan đến biểu đồ
  const canvas = document.getElementById('myChart');    // Thẻ <canvas> để vẽ
  const wrap   = document.getElementById('chart-wrap'); // Div bao biểu đồ
  const empty  = document.getElementById('chart-empty');// Div "trạng thái trống"

  // --- Bước 1: Tính tổng chi tiêu theo từng danh mục ---
  /*
    categoryTotals là 1 object dùng như bảng tra:
      key   = tên danh mục
      value = tổng tiền đã chi cho danh mục đó

    Ví dụ sau vòng lặp:
    {
      'Ăn uống': 500000,
      'Di chuyển': 200000
    }
  */
  const categoryTotals = {};

  for (let i = 0; i < list.length; i++) {
    // Chỉ tính giao dịch CHI (expense), bỏ qua thu nhập
    if (list[i].type === 'expense') {
      const cat = list[i].category;

      // Nếu danh mục này chưa có trong bảng → khởi tạo = 0
      if (categoryTotals[cat] === undefined) {
        categoryTotals[cat] = 0;
      }

      // Cộng thêm số tiền của giao dịch này vào tổng của danh mục
      categoryTotals[cat] += list[i].amount;
    }
  }

  /*
    Object.keys(obj)   → mảng các KEY   (tên danh mục)
    Object.values(obj) → mảng các VALUE (tổng tiền)

    Ví dụ với categoryTotals = { 'Ăn uống': 500000, 'Nhà ở': 300000 }:
      labels = ['Ăn uống', 'Nhà ở']
      data   = [500000, 300000]

    Chart.js dùng 2 mảng này để vẽ: phần tử cùng chỉ số sẽ ghép cặp với nhau
  */
  const labels = Object.keys(categoryTotals);
  const data   = Object.values(categoryTotals);

  // --- Bước 2: Xử lý trường hợp không có dữ liệu chi ---
  if (labels.length === 0) {
    // Ẩn biểu đồ, hiện thông báo "Chưa có dữ liệu"
    if (wrap)  wrap.style.display  = 'none';
    if (empty) empty.style.display = 'block';

    // Hủy biểu đồ cũ nếu có (tránh memory leak)
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  // --- Bước 3: Hiện biểu đồ, ẩn thông báo trống ---
  if (wrap)  wrap.style.display  = 'block';
  if (empty) empty.style.display = 'none';

  // Hủy biểu đồ cũ trước khi vẽ biểu đồ mới
  // (Nếu không hủy, biểu đồ mới sẽ đè lên biểu đồ cũ → lỗi hiển thị)
  if (chartInstance) {
    chartInstance.destroy();
  }

  // --- Bước 4: Vẽ biểu đồ mới bằng Chart.js ---
  /*
    canvas.getContext('2d') lấy "bút vẽ 2D" của thẻ <canvas>
    Chart.js cần tham số này để biết sẽ vẽ lên đâu.
  */
  const ctx = canvas.getContext('2d');

  /*
    new Chart(ctx, config) tạo biểu đồ mới.
    Ta lưu kết quả vào chartInstance để có thể hủy sau này.

    Cấu hình Chart.js gồm 3 phần chính:
      type    : kiểu biểu đồ ('doughnut' = bánh rán có lỗ giữa)
      data    : dữ liệu cần vẽ
      options : tùy chỉnh giao diện
  */
  chartInstance = new Chart(ctx, {
    type: 'doughnut',

    data: {
      labels: labels, // Nhãn mỗi phần (tên danh mục)
      datasets: [{
        data: data,   // Giá trị mỗi phần (tổng tiền)
        backgroundColor: [
          '#e74c3c', '#3498db', '#2ecc71',
          '#f39c12', '#9b59b6', '#1abc9c', '#95a5a6'
          // Màu lần lượt tô cho từng phần của biểu đồ
        ],
        borderWidth: 2,      // Độ dày đường viền
        borderColor: '#fff'  // Màu đường viền (trắng = tạo khoảng cách giữa các phần)
      }]
    },

    options: {
      plugins: {
        legend: {
          position: 'bottom' // Chú thích hiển thị phía dưới biểu đồ
        },
        tooltip: {
          callbacks: {
            /*
              Tùy chỉnh nội dung tooltip (bong bóng khi rê chuột).
              Mặc định Chart.js hiện số thô: "500000"
              Ta override để hiện đẹp hơn: "Ăn uống: 500.000 ₫"

              ctx.label : tên danh mục (ví dụ: "Ăn uống")
              ctx.raw   : số tiền gốc (ví dụ: 500000)
            */
            label: function(ctx) {
              return ' ' + ctx.label + ': ' + formatMoney(ctx.raw);
            }
          }
        }
      }
    }
  });
}


// ----------------------------------------------------------------
//  HÀM: doLogout()
//  Mục đích: Đăng xuất — xóa phiên đăng nhập → về trang login
// ----------------------------------------------------------------
function doLogout() {
  // Hỏi xác nhận trước khi đăng xuất
  // confirm() hiện hộp thoại với 2 nút OK / Cancel
  // → OK: trả về true | Cancel: trả về false
  if (!confirm('Bạn có chắc muốn đăng xuất?')) {
    return; // Người dùng bấm Cancel → thoát hàm, không làm gì
  }

  /*
    Xóa key 'currentUser' khỏi localStorage.
    Khi mở lại trang, code ở đầu file sẽ thấy currentUser = null
    và tự động chuyển về login.html.
  */
  localStorage.removeItem('currentUser');

  window.location.href = 'login.html';
}


// ----------------------------------------------------------------
//  HÀM PHỤ: formatMoney(amount)
//  Mục đích: Định dạng số tiền theo kiểu Việt Nam
//
//  Ví dụ:
//    formatMoney(1500000) → "1.500.000 ₫"
//    formatMoney(200)     → "200 ₫"
// ----------------------------------------------------------------
function formatMoney(amount) {
  /*
    .toLocaleString('vi-VN') định dạng số theo locale Việt Nam:
      - Dùng dấu chấm (.) làm dấu phân cách hàng nghìn
      - Ví dụ: 1500000 → "1.500.000"

    + ' ₫' thêm ký hiệu tiền đồng phía sau
    ₫ là ký tự Unicode cho đồng Việt Nam
  */
  return amount.toLocaleString('vi-VN') + ' ₫';
}
