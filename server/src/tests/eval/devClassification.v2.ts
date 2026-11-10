import type { HeldoutDoc } from './heldoutClassification.v1.js';

/**
 * Second held-out classification set.
 *
 * Written BEFORE the scorer rules were read or changed, and first run only AFTER the scorer was tuned on
 * heldoutClassification.v1. Use v1 as the development set and this file as the check that tuning generalises.
 * Do not tune the scorer against this file; once it is used for tuning it stops being a held-out set.
 * Synthetic documents, not customer data, not labelled by BA/QA.
 */
export const HELDOUT_CLASSIFICATION_V2: HeldoutDoc[] = [
  {
    id: 'V01', fileName: 'gioi_thieu_du_an_erp.md', nameType: 'descriptive', language: 'vi', expected: '01_Project_Overview',
    content: `# Giới thiệu dự án ERP cho nhà máy
## Lý do thực hiện
Nhà máy đang dùng nhiều phần mềm rời rạc cho mua hàng, sản xuất và kế toán.
## Mục tiêu
Hợp nhất dữ liệu về một hệ thống và rút ngắn thời gian khóa sổ cuối tháng.
## Phạm vi dự án
Giai đoạn đầu gồm mua hàng và kho. Sản xuất và kế toán thuộc giai đoạn sau.
## Các bên tham gia
Ban giám đốc nhà máy là nhà tài trợ. Đội triển khai gồm quản lý dự án và các trưởng bộ phận.
## Kế hoạch tổng thể
Khảo sát trong quý một, triển khai thử trong quý hai, vận hành chính thức trong quý ba.`
  },
  {
    id: 'V02', fileName: 'slide_notes.md', nameType: 'generic', language: 'en', expected: '01_Project_Overview',
    content: `# About this initiative
The clinic network wants patients to book and manage visits without calling the front desk.
## Why now
Phone lines are overloaded and one in five calls is abandoned.
## What success looks like
Most bookings made online within a year of launch, and shorter waiting time at the front desk.
## Boundaries
Included: booking, reminders, rescheduling. Not included: billing and insurance claims.
## People
An executive sponsor, a steering committee, the product owner and the delivery team.
## Roadmap
Pilot in two clinics, then a regional rollout, then the full network.`
  },
  {
    id: 'V03', fileName: 'business_rules_leave_policy.md', nameType: 'descriptive', language: 'en', expected: '02_Business_Requirements',
    content: `# Business rules: employee leave
## Entitlement
A full-time employee earns 1.5 days of annual leave per month worked. Part-time employees earn leave in proportion to their hours.
## Approval
Leave of up to three days is approved by the line manager. Longer leave also needs approval from the department head.
## Carry-over
At most five unused days carry over to the next year. Carried-over days expire at the end of March.
## Exceptions
Sick leave with a medical certificate does not reduce the annual balance.
## Business process
Request, manager approval, HR confirmation, calendar update.`
  },
  {
    id: 'V04', fileName: 'v2_chot.md', nameType: 'generic', language: 'vi', expected: '02_Business_Requirements',
    content: `# Quy định phí giao hàng
## Cách tính phí
Đơn hàng nội thành dưới 300.000 đồng tính phí 20.000 đồng. Đơn từ 300.000 đồng trở lên được miễn phí.
## Giao hàng ngoại thành
Phụ thu 10.000 đồng cho mỗi đơn. Không áp dụng miễn phí cho hàng cồng kềnh.
## Khách hàng doanh nghiệp
Phí được tính theo hợp đồng khung, do trưởng phòng kinh doanh phê duyệt từng trường hợp.
## Hoàn phí
Nếu giao trễ quá 2 ngày do lỗi của công ty thì hoàn toàn bộ phí giao hàng cho khách.
## Đối tượng áp dụng
Tất cả đơn bán lẻ tạo từ kênh trực tuyến.`
  },
  {
    id: 'V05', fileName: 'yeu_cau_he_thong_module_kho.md', nameType: 'descriptive', language: 'vi', expected: '03_System_Requirements',
    content: `# Yêu cầu hệ thống: Phân hệ kho
## Yêu cầu chức năng
- Hệ thống phải ghi nhận phiếu nhập kho theo từng lô hàng.
- Hệ thống phải cảnh báo khi tồn kho thấp hơn mức tối thiểu.
- Hệ thống phải cho phép kiểm kê theo từng vị trí kệ.
## Yêu cầu phi chức năng
- Tra cứu tồn kho phải trả kết quả trong vòng 3 giây.
- Hệ thống phải hoạt động được khi có 300 người dùng đồng thời.
## Ca sử dụng: Nhập kho
Tác nhân: thủ kho. Luồng chính: quét mã lô hàng, nhập số lượng, xác nhận. Hệ thống cập nhật tồn kho.`
  },
  {
    id: 'V06', fileName: 'tmp_0920.md', nameType: 'generic', language: 'en', expected: '03_System_Requirements',
    content: `# Search feature: required behaviour
## The system shall
- return results for a product name query within one second for 95% of requests;
- support filtering by category, price range and availability;
- tolerate a single-character typo in the query;
- record each query with a timestamp for analytics.
## Constraints
The feature shall work on the two latest versions of the major browsers and remain usable with a screen reader.
## Use case: Find a product
Actor: shopper. Preconditions: none. Main flow: type a query, see results, apply a filter, open a product. Alternative flow: no results, the system suggests similar terms.`
  },
  {
    id: 'V07', fileName: 'thiet_ke_giao_dien_trang_chu.md', nameType: 'descriptive', language: 'vi', expected: '04_UI_UX',
    content: `# Thiết kế giao diện trang chủ
## Bố cục tổng thể
Phần đầu trang có logo bên trái, thanh điều hướng ở giữa và nút đăng nhập bên phải. Bên dưới là băng chuyền ảnh rộng toàn màn hình.
## Thành phần
Thẻ danh mục dạng lưới ba cột, mỗi thẻ có biểu tượng và nhãn. Nút kêu gọi hành động dùng màu cam nổi bật.
## Kiểu chữ và màu
Tiêu đề dùng phông không chân cỡ 28px. Màu nền xám nhạt, màu chữ xám đậm.
## Hành vi trên thiết bị di động
Thanh điều hướng thu gọn thành biểu tượng ba gạch. Lưới danh mục chuyển thành một cột.
## Trạng thái di chuột
Thẻ danh mục nổi lên và đổ bóng khi di chuột qua.`
  },
  {
    id: 'V08', fileName: 'page2.md', nameType: 'generic', language: 'en', expected: '04_UI_UX',
    content: `# Settings screen
## Structure
A scrollable list grouped into sections: Account, Notifications, Privacy. Each row has an icon on the left, a label, and either a toggle switch or a chevron on the right.
## Visual details
Section titles are uppercase, 12px, muted grey. Rows are 56px tall with a hairline divider. Toggles use the accent colour when on.
## Feedback
Changing a toggle shows a brief toast at the bottom. Destructive rows such as "Delete account" use red text and open a confirmation dialog.
## Accessibility
All controls have visible focus rings and a minimum contrast ratio of 4.5:1.`
  },
  {
    id: 'V09', fileName: 'database_schema_hr.md', nameType: 'descriptive', language: 'en', expected: '05_Technical_Documents',
    content: `# HR database schema
## employees
Columns: id (bigint, primary key), full_name (varchar), department_id (bigint, foreign key to departments.id), hired_on (date).
## departments
Columns: id (bigint, primary key), name (varchar, unique), manager_id (bigint, nullable foreign key to employees.id).
## leave_requests
Columns: id, employee_id (foreign key), start_date, end_date, status (enum). Index on (employee_id, start_date).
## Conventions
Snake case names, UTC timestamps, soft delete with a deleted_at column. Migrations are versioned and applied in order.`
  },
  {
    id: 'V10', fileName: 'ghi_chu.md', nameType: 'generic', language: 'vi', expected: '05_Technical_Documents',
    content: `# Mô tả các điểm cuối của dịch vụ đặt phòng
## Xác thực
Mọi yêu cầu phải kèm token trong tiêu đề Authorization.
## GET /rooms
Tham số truy vấn: ngày nhận phòng, ngày trả phòng, số khách. Trả về mã 200 cùng danh sách phòng trống dạng JSON.
## POST /bookings
Thân yêu cầu gồm mã phòng, mã khách và khoảng ngày. Trả về mã 201 khi tạo thành công, mã 409 khi phòng đã có người đặt.
## Mã lỗi
400 khi thiếu tham số, 401 khi token không hợp lệ, 500 khi lỗi máy chủ.
## Giới hạn
Mỗi token được gọi tối đa 60 lần mỗi phút.`
  },
  {
    id: 'V11', fileName: 'test_cases_payment.md', nameType: 'descriptive', language: 'en', expected: '06_QA',
    content: `# Test cases: payment
## TC-PAY-01 Pay with a valid card
Preconditions: cart has one item. Steps: go to checkout, enter a valid test card, confirm. Expected result: payment succeeds and the order status is PAID.
## TC-PAY-02 Pay with an expired card
Steps: enter a card with a past expiry date, confirm. Expected result: an error message is shown and no order is created.
## TC-PAY-03 Double submit
Steps: press Confirm twice quickly. Expected result: exactly one charge is made.
## Traceability
TC-PAY-01 covers requirement PAY-1. TC-PAY-02 and TC-PAY-03 cover PAY-4.`
  },
  {
    id: 'V12', fileName: 'ban_3.md', nameType: 'generic', language: 'vi', expected: '06_QA',
    content: `# Các ca kiểm thử chức năng đặt lịch
## Ca 1: Đặt lịch thành công
Điều kiện trước: bệnh nhân đã đăng nhập. Các bước: chọn bác sĩ, chọn khung giờ trống, bấm xác nhận. Kết quả mong đợi: lịch hẹn được tạo và có tin nhắn xác nhận.
## Ca 2: Đặt trùng khung giờ
Các bước: hai người cùng chọn một khung giờ và xác nhận. Kết quả mong đợi: chỉ một người đặt được, người còn lại nhận thông báo khung giờ đã hết.
## Ca 3: Hủy lịch sát giờ
Các bước: hủy lịch khi còn 1 giờ trước giờ hẹn. Kết quả mong đợi: hệ thống từ chối và hiển thị lý do.
## Mức ưu tiên
Ca 1 chạy trong mọi đợt hồi quy.`
  },
  {
    id: 'V13', fileName: 'bien_ban_nghiem_thu_uat.md', nameType: 'descriptive', language: 'vi', expected: '07_EVD_Evidence',
    content: `# Biên bản nghiệm thu UAT phân hệ bán hàng
## Thành phần tham gia
Đại diện phòng kinh doanh, đại diện đội dự án và trưởng nhóm kiểm thử.
## Kết quả thực hiện
Đã chạy 30 kịch bản nghiệm thu: 29 đạt, 1 không đạt đã được sửa và chạy lại đạt.
## Bằng chứng kèm theo
Ảnh chụp màn hình của từng kịch bản, bảng tổng hợp kết quả và video ghi lại kịch bản chạy lại.
## Kết luận
Phòng kinh doanh đồng ý nghiệm thu và cho phép phát hành.
## Ký xác nhận
Trưởng phòng kinh doanh và quản lý dự án đã ký vào ngày họp nghiệm thu.`
  },
  {
    id: 'V14', fileName: 'out_1112.md', nameType: 'generic', language: 'en', expected: '07_EVD_Evidence',
    content: `# Execution record
Build 5.0.2, staging, run by the release pipeline.
## Totals
128 automated checks executed: 126 passed, 2 failed, 0 skipped. Duration 11 minutes.
## Failures
- Export invoice as PDF: expected a file download, actual HTTP 500.
- Change email: expected a confirmation mail, none received within 60 seconds.
## Attached proof
Console log of the run, screenshots at each failed step, and the screen recording of the invoice scenario.
## Confirmation
Reviewed and confirmed by the QA lead. Result recorded for the release decision.`
  },
  {
    id: 'V15', fileName: 'changelog.md', nameType: 'descriptive', language: 'en', expected: '08_Change_History',
    content: `# Changelog
## [1.8.0]
### Added
- Filter orders by date range.
### Changed
- Default page size is now 50 instead of 20.
### Fixed
- Wrong currency symbol on refund receipts.
## [1.7.2]
### Fixed
- Session was not cleared on logout in some browsers.
## [1.7.0]
### Added
- Dark theme.
### Deprecated
- Legacy export endpoint, to be removed in 2.0.
### Removed
- Support for the old mobile app version.`
  },
  {
    id: 'V16', fileName: 'thong_bao.md', nameType: 'generic', language: 'vi', expected: '08_Change_History',
    content: `# Ghi chú phát hành bản 4.2
## Tính năng mới
- Cho phép lưu nhiều địa chỉ giao hàng.
- Thêm báo cáo doanh thu theo tuần.
## Cải tiến
- Trang danh sách đơn hàng tải nhanh hơn.
## Sửa lỗi
- Sửa lỗi mã giảm giá hết hạn vẫn được áp dụng.
- Sửa lỗi không gửi email khi đổi mật khẩu.
## Thay đổi không tương thích
- Gỡ bỏ giao diện lập trình phiên bản 1. Cần chuyển sang phiên bản 2.
## So với bản 4.1
Bản 4.1 chưa có báo cáo theo tuần và chỉ lưu một địa chỉ giao hàng.`
  }
];
