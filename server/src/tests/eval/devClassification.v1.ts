/**
 * Development set 1 for the with/without comparison of M0-T2.
 *
 * Synthetic documents written for this evaluation (not customer data). Labels follow the definitions in
 * docs/DOCUMENT-TAXONOMY.md. The scorer vocabulary was tuned against this set, by the same author.
 * nameType: 'descriptive' = a person could guess the folder from the file name; 'generic' = the name says nothing.
 * This is NOT an acceptance dataset and NOT a held-out set: results on it only guard against regressions.
 * An acceptance set must be labelled by BA/QA on real documents (E17-T1).
 */
export interface ClassificationSample {
  id: string;
  fileName: string;
  nameType: 'descriptive' | 'generic';
  language: 'vi' | 'en';
  expected: string;
  content: string;
}

export const DEV_CLASSIFICATION_V1: ClassificationSample[] = [
  // ---------- 01_Project_Overview ----------
  {
    id: 'H01', fileName: 'project_charter_loyalty_app.md', nameType: 'descriptive', language: 'en', expected: '01_Project_Overview',
    content: `# Loyalty App Project Charter
## Purpose
The Loyalty App project gives retail customers one place to collect and redeem points across all partner stores.
## Objectives
- Launch an MVP in the first half of next year.
- Reach 50,000 active members in the first six months after launch.
## Scope
In scope: member registration, point balance, partner store directory. Out of scope: payment processing and e-commerce checkout.
## Stakeholders
Project sponsor, product owner, delivery manager, partner store representatives.
## Milestones
Discovery, MVP build, pilot with three partner stores, public launch.`
  },
  {
    id: 'H02', fileName: 'tam_nhin_va_pham_vi_du_an.md', nameType: 'descriptive', language: 'vi', expected: '01_Project_Overview',
    content: `# Tầm nhìn và phạm vi dự án Cổng dịch vụ khách hàng
## Tầm nhìn
Xây dựng một cổng dịch vụ duy nhất để khách hàng tự tra cứu hợp đồng, hóa đơn và gửi yêu cầu hỗ trợ.
## Mục tiêu kinh doanh
- Giảm số cuộc gọi tới tổng đài.
- Rút ngắn thời gian phản hồi yêu cầu của khách hàng.
## Phạm vi
Trong phạm vi: tra cứu hợp đồng, hóa đơn, gửi yêu cầu. Ngoài phạm vi: thanh toán trực tuyến.
## Các bên liên quan
Ban tài trợ dự án, phòng chăm sóc khách hàng, phòng công nghệ.
## Lộ trình
Giai đoạn 1 khảo sát, giai đoạn 2 xây dựng bản thử nghiệm, giai đoạn 3 triển khai toàn quốc.`
  },
  {
    id: 'H03', fileName: 'notes_1105.md', nameType: 'generic', language: 'en', expected: '01_Project_Overview',
    content: `# Kickoff summary
We agreed on why this project exists: the warehouse team loses time re-entering delivery data by hand.
## Goals
Cut manual data entry and give managers a daily view of deliveries.
## What is in and out
In: delivery intake, daily summary. Out: route planning, driver payroll.
## Who is involved
Sponsor from operations, a product owner, the delivery team, two warehouse leads.
## High-level timeline
Phase one is discovery and a pilot in one warehouse. Phase two is rollout to the remaining sites.
## Main risks
Low adoption by warehouse staff and unclear ownership of master data.`
  },
  {
    id: 'H04', fileName: 'tong_hop_thang_10.md', nameType: 'generic', language: 'vi', expected: '01_Project_Overview',
    content: `# Giới thiệu chung về dự án Quản lý đào tạo nội bộ
Dự án nhằm thay thế việc theo dõi khóa học bằng bảng tính rời rạc.
## Mục tiêu
Tập trung thông tin khóa học, học viên và kết quả vào một nơi.
## Phạm vi tổng thể
Bao gồm đăng ký khóa học, điểm danh và báo cáo tổng hợp. Không bao gồm tính lương giảng viên.
## Tổ chức dự án
Nhà tài trợ là phòng nhân sự. Nhóm thực hiện gồm quản lý dự án, phân tích nghiệp vụ, lập trình và kiểm thử.
## Các mốc chính
Khởi động, hoàn thành bản đầu tiên, chạy thử tại một chi nhánh, mở rộng toàn công ty.`
  },

  // ---------- 02_Business_Requirements ----------
  {
    id: 'H05', fileName: 'brd_quan_ly_don_hang.md', nameType: 'descriptive', language: 'vi', expected: '02_Business_Requirements',
    content: `# Yêu cầu nghiệp vụ: Quản lý đơn hàng
## Bối cảnh nghiệp vụ
Nhân viên bán hàng hiện ghi đơn qua điện thoại và nhập lại vào sổ, dẫn tới sai sót.
## Quy trình nghiệp vụ mong muốn
Khách đặt hàng, nhân viên xác nhận, kho chuẩn bị hàng, giao hàng, thu tiền.
## Quy tắc nghiệp vụ
- Đơn hàng trên 20 triệu đồng phải được trưởng nhóm bán hàng phê duyệt.
- Khách hàng còn nợ quá hạn không được tạo đơn mới.
- Đơn chưa xuất kho được phép hủy mà không mất phí.
## Chính sách chiết khấu
Khách hàng thân thiết được chiết khấu theo doanh số của quý trước.`
  },
  {
    id: 'H06', fileName: 'quy_tac_nghiep_vu_hoan_tien.md', nameType: 'descriptive', language: 'vi', expected: '02_Business_Requirements',
    content: `# Quy tắc nghiệp vụ hoàn tiền
## Điều kiện hoàn tiền
- Khách hàng được yêu cầu hoàn tiền trong vòng 7 ngày kể từ ngày nhận hàng.
- Sản phẩm khuyến mãi không được hoàn tiền, chỉ được đổi sản phẩm khác.
## Mức hoàn
Hoàn toàn bộ nếu lỗi do nhà bán. Hoàn 80% nếu khách đổi ý.
## Thẩm quyền phê duyệt
Yêu cầu hoàn dưới 2 triệu đồng do nhân viên chăm sóc khách hàng duyệt. Từ 2 triệu đồng trở lên do quản lý duyệt.
## Ngoại lệ
Đơn hàng của đối tác doanh nghiệp áp dụng theo hợp đồng riêng.`
  },
  {
    id: 'H07', fileName: 'final_v3.md', nameType: 'generic', language: 'vi', expected: '02_Business_Requirements',
    content: `# Chương trình tích điểm khách hàng thân thiết
## Cách tính điểm
Mỗi 10.000 đồng chi tiêu được 1 điểm. Giao dịch bằng thẻ đồng thương hiệu được nhân đôi điểm.
## Hạng thành viên
Hạng Bạc từ 500 điểm, hạng Vàng từ 2.000 điểm, hạng Kim cương từ 5.000 điểm trong một năm.
## Quy định đổi điểm
Điểm chỉ được đổi khi tài khoản đã xác minh số điện thoại. Mỗi lần đổi tối thiểu 100 điểm.
## Hết hạn điểm
Điểm hết hạn sau 12 tháng kể từ ngày phát sinh. Khách hàng bị hạ hạng nếu không đạt ngưỡng trong năm kế tiếp.`
  },
  {
    id: 'H08', fileName: 'memo_q4.md', nameType: 'generic', language: 'en', expected: '02_Business_Requirements',
    content: `# Merchant onboarding: what the business needs
## Stories
As a merchant, I want to submit my company documents once so that I can start selling within two working days.
As a risk officer, I want to see which merchants are missing documents so that I can follow up.
## Rules agreed with operations
- A merchant cannot receive payouts until the bank account is verified.
- Merchants in restricted industries must be approved by the risk officer.
- The commission rate is set per merchant category and reviewed every quarter.
## Process
Apply, verify identity, sign the agreement, activate the store.`
  },

  // ---------- 03_System_Requirements ----------
  {
    id: 'H09', fileName: 'srs_notification_service.md', nameType: 'descriptive', language: 'en', expected: '03_System_Requirements',
    content: `# Software Requirements Specification: Notification Service
## Functional Requirements
- FR-01: The system shall send an email when an order status changes.
- FR-02: The system shall let a user turn off each notification type.
- FR-03: The system shall retry a failed delivery up to three times.
## Non-Functional Requirements
- NFR-01: 95% of notifications shall be delivered within 60 seconds.
- NFR-02: The service shall be available 99.5% of the time each month.
## Use Case: Mute a notification type
Actor: registered user. Main flow: open preferences, switch off a type, save. The system stops sending that type.`
  },
  {
    id: 'H10', fileName: 'dac_ta_yeu_cau_chuc_nang_dang_nhap.md', nameType: 'descriptive', language: 'vi', expected: '03_System_Requirements',
    content: `# Đặc tả yêu cầu phần mềm: Chức năng đăng nhập
## Yêu cầu chức năng
- Hệ thống phải cho phép người dùng đăng nhập bằng email và mật khẩu.
- Hệ thống phải khóa tài khoản 15 phút sau 5 lần nhập sai liên tiếp.
- Hệ thống phải gửi mã xác thực qua email khi đăng nhập từ thiết bị lạ.
## Yêu cầu phi chức năng
- Thời gian phản hồi đăng nhập không quá 2 giây với 500 người dùng đồng thời.
- Mật khẩu phải được lưu ở dạng băm.
## Ca sử dụng: Đăng nhập
Tác nhân: người dùng đã đăng ký. Luồng chính: nhập email, nhập mật khẩu, hệ thống kiểm tra và mở trang chủ.`
  },
  {
    id: 'H11', fileName: 'doc_0412.md', nameType: 'generic', language: 'en', expected: '03_System_Requirements',
    content: `# Report module: what the software must do
## Functions
- The system shall generate a monthly sales report per branch.
- The system shall allow export of a report to CSV and PDF.
- The system shall restrict each branch manager to the data of their own branch.
## Quality attributes
- A report covering one year of data shall be generated in under 10 seconds.
- The module shall support 200 concurrent users.
- All report downloads shall be recorded with user and time.
## Use case: Export a report
Actor: branch manager. Precondition: logged in. Main flow: choose a period, generate, choose a format, download.`
  },
  {
    id: 'H12', fileName: 'ban_nhap_2.md', nameType: 'generic', language: 'vi', expected: '03_System_Requirements',
    content: `# Phân hệ đặt lịch hẹn: hệ thống cần làm gì
## Chức năng
- Hệ thống phải hiển thị các khung giờ còn trống của từng bác sĩ.
- Hệ thống phải gửi tin nhắn nhắc lịch trước giờ hẹn 24 giờ.
- Hệ thống phải cho phép bệnh nhân hủy lịch trước giờ hẹn ít nhất 2 giờ.
## Ràng buộc chất lượng
- Hệ thống phải phục vụ được 1.000 lượt đặt lịch mỗi giờ.
- Dữ liệu lịch hẹn phải được sao lưu hằng ngày.
## Ca sử dụng: Đặt lịch
Tác nhân: bệnh nhân. Luồng chính: chọn bác sĩ, chọn khung giờ, xác nhận. Luồng thay thế: khung giờ vừa bị người khác đặt.`
  },

  // ---------- 04_UI_UX ----------
  {
    id: 'H13', fileName: 'wireframe_checkout_flow.md', nameType: 'descriptive', language: 'en', expected: '04_UI_UX',
    content: `# Checkout flow wireframes
## Screen 1: Cart
Header with back arrow and title. List of item cards with thumbnail, name, quantity stepper. Sticky footer with total and a primary button "Continue".
## Screen 2: Delivery
Form with address fields stacked in one column. Inline validation message under each field. Secondary button "Use saved address".
## Screen 3: Review
Summary card, collapsible order details, primary button "Place order".
## Interaction notes
The primary button is disabled until the form is valid. Show a skeleton loader while prices load.`
  },
  {
    id: 'H14', fileName: 'style_guide_mobile.md', nameType: 'descriptive', language: 'en', expected: '04_UI_UX',
    content: `# Mobile style guide
## Colors
Primary #1A73E8, surface #FFFFFF, error #D93025. Text on primary must be white.
## Typography
Headline 24px semibold, body 16px regular, caption 12px. Line height 1.5 for body text.
## Spacing
Use an 8px grid. Screen side padding is 16px. Minimum touch target is 44 by 44 px.
## Components
Buttons: primary, secondary, text. Each has default, pressed, disabled and loading states.
Inputs: label above the field, helper text below, error state with red border.
## Icons
Outline icons, 24px, 2px stroke.`
  },
  {
    id: 'H15', fileName: 'untitled.md', nameType: 'generic', language: 'en', expected: '04_UI_UX',
    content: `# Dashboard page layout
## Layout
Left sidebar 240px wide with navigation icons and labels. Top bar with search field and avatar menu. Content area uses a 12-column grid.
## Cards
Four summary cards in the first row. Each card has a label, a large number and a small trend arrow. Cards have 8px rounded corners and a soft shadow.
## Table
Sticky header, zebra rows, row hover highlight. Empty state shows an illustration and a short message.
## Responsive behaviour
Below 768px the sidebar collapses into a hamburger menu and cards stack in one column.
## Dark mode
Background #121212, card surface #1E1E1E, text contrast at least 4.5:1.`
  },
  {
    id: 'H16', fileName: 'file_moi.md', nameType: 'generic', language: 'vi', expected: '04_UI_UX',
    content: `# Màn hình danh sách sản phẩm
## Bố cục
Thanh tiêu đề ở trên cùng có ô tìm kiếm và biểu tượng giỏ hàng. Bên dưới là lưới sản phẩm hai cột trên điện thoại, bốn cột trên máy tính.
## Thẻ sản phẩm
Ảnh vuông, tên sản phẩm tối đa hai dòng, giá in đậm, nút "Thêm vào giỏ" màu chủ đạo.
## Màu sắc và phông chữ
Màu chủ đạo xanh dương, nền trắng. Tiêu đề cỡ 20px đậm, nội dung cỡ 14px.
## Trạng thái
Khi đang tải hiển thị khung xám. Khi không có sản phẩm hiển thị hình minh họa và dòng chữ gợi ý.
## Tương tác
Chạm vào thẻ mở màn hình chi tiết. Kéo xuống để làm mới danh sách.`
  },

  // ---------- 05_Technical_Documents ----------
  {
    id: 'H17', fileName: 'kien_truc_he_thong_thanh_toan.md', nameType: 'descriptive', language: 'vi', expected: '05_Technical_Documents',
    content: `# Kiến trúc hệ thống thanh toán
## Thành phần
Cổng API nhận yêu cầu từ ứng dụng. Dịch vụ thanh toán xử lý giao dịch. Hàng đợi tin nhắn chuyển sự kiện sang dịch vụ đối soát.
## Cơ sở dữ liệu
PostgreSQL lưu giao dịch, có bản sao chỉ đọc cho báo cáo. Redis dùng làm bộ nhớ đệm phiên.
## Triển khai
Mỗi dịch vụ đóng gói bằng container, chạy sau bộ cân bằng tải, có hai vùng sẵn sàng.
## Sơ đồ tuần tự: Tạo giao dịch
Ứng dụng gọi cổng API, cổng API gọi dịch vụ thanh toán, dịch vụ ghi cơ sở dữ liệu rồi phát sự kiện.
## Giám sát
Thu thập log tập trung và số đo độ trễ theo từng endpoint.`
  },
  {
    id: 'H18', fileName: 'openapi_orders_v2.md', nameType: 'descriptive', language: 'en', expected: '05_Technical_Documents',
    content: `# Orders API v2
## Authentication
Bearer token in the Authorization header.
## Endpoints
### GET /v2/orders
Query parameters: status, page, pageSize. Response 200: JSON array of Order objects.
### POST /v2/orders
Request body: customerId (string), items (array of sku and quantity). Response 201 with the created Order. Response 422 on validation error.
### GET /v2/orders/{id}
Response 404 if the order does not exist.
## Schema: Order
id (uuid), customerId (string), status (enum: NEW, PAID, SHIPPED), total (decimal), createdAt (ISO 8601 timestamp).
## Rate limiting
100 requests per minute per token. HTTP 429 when exceeded.`
  },
  {
    id: 'H19', fileName: 'export_2026_11.md', nameType: 'generic', language: 'en', expected: '05_Technical_Documents',
    content: `# Tables
## customers
CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
## orders
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), status TEXT NOT NULL, total_cents INTEGER NOT NULL);
CREATE INDEX idx_orders_customer ON orders (customer_id);
## order_items
CREATE TABLE order_items (order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, sku TEXT NOT NULL, quantity INTEGER NOT NULL, PRIMARY KEY (order_id, sku));
## Notes
Foreign keys are enforced. Write-ahead logging is enabled. Timestamps are stored in UTC.`
  },
  {
    id: 'H20', fileName: 'handover.md', nameType: 'generic', language: 'vi', expected: '05_Technical_Documents',
    content: `# Ghi chú bàn giao kỹ thuật
## Các dịch vụ
Dịch vụ người dùng viết bằng Node.js, dịch vụ báo cáo viết bằng Python. Hai dịch vụ giao tiếp qua REST và hàng đợi tin nhắn.
## Hạ tầng
Máy chủ ứng dụng chạy container sau bộ cân bằng tải. Cơ sở dữ liệu MySQL có một bản chính và một bản sao.
## Cấu hình
Biến môi trường được nạp từ kho bí mật. Cổng dịch vụ người dùng là 8080, dịch vụ báo cáo là 8090.
## Quy trình triển khai
Đẩy mã lên nhánh chính sẽ kích hoạt pipeline build, chạy kiểm tra, tạo image và triển khai lên môi trường staging.
## Sao lưu
Cơ sở dữ liệu được sao lưu toàn bộ mỗi đêm và giữ trong 30 ngày.`
  },

  // ---------- 06_QA ----------
  {
    id: 'H21', fileName: 'test_plan_release_2_1.md', nameType: 'descriptive', language: 'en', expected: '06_QA',
    content: `# Test Plan for Release 2.1
## Scope of testing
In scope: order creation, refund, notification settings. Out of scope: legacy reports.
## Test levels
Unit tests by developers, integration tests in CI, system and regression tests by QA.
## Entry and exit criteria
Entry: build deployed to staging and smoke test passed. Exit: no open critical or major defects, 95% of planned test cases executed.
## Test environment
Staging with anonymised data refreshed weekly.
## Defect management
Defects are logged with severity and priority and triaged daily.
## Schedule
Test design in week 1, execution in weeks 2 and 3, regression in week 4.`
  },
  {
    id: 'H22', fileName: 'kich_ban_kiem_thu_gio_hang.md', nameType: 'descriptive', language: 'vi', expected: '06_QA',
    content: `# Kịch bản kiểm thử: Giỏ hàng
## TC-01: Thêm sản phẩm vào giỏ
Điều kiện trước: người dùng đã đăng nhập. Các bước: mở trang sản phẩm, bấm "Thêm vào giỏ". Kết quả mong đợi: giỏ hàng tăng 1 sản phẩm.
## TC-02: Thêm sản phẩm hết hàng
Các bước: mở sản phẩm đã hết hàng, bấm "Thêm vào giỏ". Kết quả mong đợi: hiển thị thông báo hết hàng, giỏ không đổi.
## TC-03: Xóa sản phẩm khỏi giỏ
Các bước: mở giỏ hàng, bấm xóa một sản phẩm. Kết quả mong đợi: sản phẩm biến mất và tổng tiền được tính lại.
## Dữ liệu kiểm thử
Một tài khoản thường, một sản phẩm còn hàng, một sản phẩm hết hàng.`
  },
  {
    id: 'H23', fileName: 'draft_b.md', nameType: 'generic', language: 'en', expected: '06_QA',
    content: `# Login checks
## Case 1: valid credentials
Preconditions: an active account exists. Steps: open the login page, enter email and password, submit. Expected result: the home page opens.
## Case 2: wrong password five times
Steps: submit a wrong password five times in a row. Expected result: the account is locked and a lock message is shown.
## Case 3: empty email
Steps: leave email empty and submit. Expected result: a validation message appears and no request is sent.
## Coverage
Each case is traced to a requirement id. Negative and boundary cases are included.
## Priority
Case 1 is smoke. Cases 2 and 3 are regression.`
  },
  {
    id: 'H24', fileName: 'ban_cuoi.md', nameType: 'generic', language: 'vi', expected: '06_QA',
    content: `# Cách tiếp cận đảm bảo chất lượng cho đợt phát hành cuối năm
## Phạm vi
Kiểm tra các chức năng đặt hàng, thanh toán và hoàn tiền. Không kiểm tra báo cáo cũ.
## Các loại kiểm thử
Kiểm thử chức năng, kiểm thử hồi quy, kiểm thử hiệu năng và kiểm thử bảo mật cơ bản.
## Tiêu chí bắt đầu và kết thúc
Bắt đầu khi bản dựng đã lên môi trường thử nghiệm. Kết thúc khi không còn lỗi nghiêm trọng và đã chạy hết các ca kiểm thử ưu tiên cao.
## Quản lý lỗi
Lỗi được ghi nhận kèm mức độ nghiêm trọng, được phân loại mỗi ngày.
## Phân công
Hai kiểm thử viên chạy thủ công, một kỹ sư viết kiểm thử tự động.`
  },

  // ---------- 07_EVD_Evidence ----------
  {
    id: 'H25', fileName: 'uat_signoff_sprint_12.md', nameType: 'descriptive', language: 'en', expected: '07_EVD_Evidence',
    content: `# UAT Sign-off: Sprint 12
## Summary
User acceptance testing was carried out on staging by three business users over two days.
## Results
18 scenarios executed, 17 passed, 1 failed and was retested successfully after a fix.
## Evidence attached
Screenshots of each passed scenario, the exported result sheet, and the retest recording.
## Open items
None blocking. One cosmetic issue accepted for the next sprint.
## Sign-off
The business owner confirms the delivered scope is accepted for release. Signed by the product owner and the QA lead on the date of the review meeting.`
  },
  {
    id: 'H26', fileName: 'ket_qua_chay_regression_2026_11_03.md', nameType: 'descriptive', language: 'vi', expected: '07_EVD_Evidence',
    content: `# Kết quả chạy kiểm thử hồi quy ngày 03/11/2026
## Môi trường
Bản dựng 2.4.0-rc2 trên môi trường staging.
## Tổng hợp
Đã chạy 240 ca kiểm thử tự động: 236 đạt, 3 không đạt, 1 bị bỏ qua. Thời gian chạy 18 phút.
## Các ca không đạt
- Đặt hàng với mã giảm giá hết hạn: mong đợi thông báo lỗi, thực tế đơn vẫn được tạo.
- Xuất báo cáo PDF: quá thời gian chờ.
- Đổi mật khẩu: không gửi email xác nhận.
## Bằng chứng đính kèm
Log thực thi, ảnh chụp màn hình tại bước lỗi, video ghi lại ca đặt hàng.
## Người thực hiện
Nhóm kiểm thử, đã được trưởng nhóm xác nhận.`
  },
  {
    id: 'H27', fileName: 'scan_0007.md', nameType: 'generic', language: 'vi', expected: '07_EVD_Evidence',
    content: `# Biên bản nghiệm thu
Hôm nay, đại diện bên giao và bên nhận cùng xác nhận kết quả chạy thử phân hệ kho.
## Nội dung đã kiểm tra
Nhập kho, xuất kho, kiểm kê. Tổng cộng 25 tình huống, 25 tình huống đạt.
## Tài liệu kèm theo
Ảnh chụp màn hình từng tình huống, bảng kết quả có chữ ký của người thực hiện.
## Kết luận
Bên nhận đồng ý nghiệm thu phân hệ kho và cho phép đưa vào sử dụng chính thức.
## Chữ ký xác nhận
Đại diện bên giao: trưởng nhóm dự án. Đại diện bên nhận: trưởng phòng kho vận.`
  },
  {
    id: 'H28', fileName: 'attachment_01.md', nameType: 'generic', language: 'en', expected: '07_EVD_Evidence',
    content: `# Run output
Build 3.1.7 on staging, executed by the nightly job.
## Log
[22:00:03] suite checkout started
[22:00:41] PASS create order with one item
[22:01:10] PASS create order with coupon
[22:01:52] FAIL refund partially shipped order: expected status REFUNDED, actual PENDING
[22:02:30] PASS cancel unpaid order
[22:02:31] suite checkout finished: 4 run, 3 passed, 1 failed
## Captured artefacts
Screenshot at the failing step, HTTP trace of the refund call, video of the run.
## Verified by
QA engineer on duty, result recorded against the release checklist.`
  },

  // ---------- 08_Change_History ----------
  {
    id: 'H29', fileName: 'release_notes_v2_4_0.md', nameType: 'descriptive', language: 'en', expected: '08_Change_History',
    content: `# Release Notes v2.4.0
## New
- Customers can save more than one delivery address.
- Export of order history to CSV.
## Improved
- The order list loads faster for accounts with many orders.
## Fixed
- Expired coupons were accepted at checkout.
- Password reset email was not sent for some accounts.
## Breaking changes
- The v1 orders endpoint is removed. Use v2.
## Upgrade notes
Run the database migration before starting the new version.`
  },
  {
    id: 'H30', fileName: 'nhat_ky_thay_doi_api.md', nameType: 'descriptive', language: 'vi', expected: '08_Change_History',
    content: `# Nhật ký thay đổi
## Phiên bản 1.3.0
- Thêm: trường ghi chú cho đơn hàng.
- Sửa: lỗi tính sai phí vận chuyển khi đơn có nhiều kiện.
## Phiên bản 1.2.1
- Sửa: lỗi không gửi được thông báo khi đổi trạng thái đơn.
## Phiên bản 1.2.0
- Thêm: tìm kiếm đơn hàng theo số điện thoại.
- Thay đổi: mã lỗi xác thực đổi từ 400 sang 401.
- Gỡ bỏ: tham số sắp xếp cũ không còn được hỗ trợ.
## Phiên bản 1.1.0
- Thêm: phân trang cho danh sách đơn hàng.`
  },
  {
    id: 'H31', fileName: 'new_doc.md', nameType: 'generic', language: 'en', expected: '08_Change_History',
    content: `# What changed
## 3.2.0
Added: bulk import of products from a spreadsheet. Changed: the session now ends after 30 minutes without activity instead of 60. Fixed: totals were rounded incorrectly for some currencies.
## 3.1.1
Fixed: the mobile menu did not close after navigation.
## 3.1.0
Added: two-step verification for administrators. Deprecated: the old export format, to be removed in 4.0. Removed: support for the legacy browser.
## 3.0.0
Changed: prices are now stored without tax. This version is not backward compatible with 2.x data exports.`
  },
  {
    id: 'H32', fileName: 'minutes_w45.md', nameType: 'generic', language: 'vi', expected: '08_Change_History',
    content: `# Yêu cầu thay đổi số 14
## Nội dung thay đổi
Đổi thời hạn hủy đơn miễn phí từ 24 giờ xuống 12 giờ trước giờ giao.
## Lý do
Kho cần thêm thời gian để sắp xếp lại hàng khi đơn bị hủy.
## So với phiên bản trước
Tài liệu quy định bán hàng bản 2.0 ghi 24 giờ. Bản 2.1 sẽ ghi 12 giờ.
## Ảnh hưởng
Cần cập nhật thông báo cho khách hàng và các ca kiểm thử liên quan đến hủy đơn.
## Lịch sử phê duyệt
Đề xuất bởi trưởng kho. Đã được ban quản lý sản phẩm chấp thuận, áp dụng từ bản phát hành kế tiếp.`
  }
];
