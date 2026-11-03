import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
import {
  ClassificationScorer,
  StandardTaxonomyCategory,
  DEFAULT_CLASSIFICATION_WEIGHTS
} from '../modules/documents/classificationScorer.js';

describe('ClassificationScorer (Epic E7-T2)', () => {
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    db = new Database(':memory:');
    const migrator = new DatabaseMigrator(db, allMigrations);
    migrator.runPendingMigrations();
  });

  afterEach(() => {
    db.close();
  });

  it('guarantees deterministic output: identical input yields exact same score', () => {
    const input = {
      filePath: '02_Business_Requirements/BRD_Payment_Gateway_v2.md',
      headings: ['# Business Requirement Document', '## Quy tắc nghiệp vụ', '### Thanh toán qua QR Code'],
      content: 'Tài liệu mô tả business requirement và quy tắc nghiệp vụ cổng thanh toán nội địa và quy trình merchant onboarding.'
    };

    const run1 = ClassificationScorer.score(input);
    const run2 = ClassificationScorer.score(input);
    const run3 = ClassificationScorer.score(input);

    expect(run1).toEqual(run2);
    expect(run2).toEqual(run3);
    expect(run1.primaryCategory).toBe('02_Business_Requirements');
    expect(run1.primaryScore).toBeGreaterThanOrEqual(0.75);
    expect(run1.canAutoClassifyWithoutLLM).toBe(true);
  });

  it('respects configurable weights from configuration instead of hard-coded values', () => {
    const input = {
      filePath: 'random_document.md',
      headings: ['# Architecture Design'],
      content: 'Sơ đồ kiến trúc microservices và database schema.'
    };

    const defaultResult = ClassificationScorer.score(input);

    // Custom weights prioritizing headings heavily
    const customResult = ClassificationScorer.score({
      ...input,
      weights: { pathWeight: 0.1, headingWeight: 0.8, keywordWeight: 0.1 }
    });

    expect(customResult.usedWeights.headingWeight).toBe(0.8);
    expect(customResult.usedWeights.pathWeight).toBe(0.1);
    expect(customResult.primaryCategory).toBe('05_Technical_Documents');
    // Heading score has 0.8 weight so total score should be higher than default where heading is 0.35
    expect(customResult.primaryScore).toBeGreaterThan(defaultResult.primaryScore);
  });

  it('accurately classifies 20 sample documents across 8 taxonomy categories without LLM (>= 17 required)', () => {
    const testCases: Array<{
      filePath: string;
      headings: string[];
      content: string;
      expectedCategory: StandardTaxonomyCategory;
    }> = [
      // 01_Project_Overview (3 cases)
      {
        filePath: 'Project_Charter_DocQA_MVP.md',
        headings: ['# Project Charter', '## Tổng quan dự án', '## Mục tiêu và phạm vi'],
        content: 'Tài liệu điều lệ dự án xác định vision, scope và milestones bàn giao MVP cho stakeholders.',
        expectedCategory: '01_Project_Overview'
      },
      {
        filePath: 'Executive_Vision_FCB_Core_Banking.docx',
        headings: ['# Vision Statement', '## Lộ trình chuyển đổi số', '## Kế hoạch WBS'],
        content: 'Báo cáo tổng quan dự án và roadmap chiến lược chuyển đổi core banking gửi ban điều hành.',
        expectedCategory: '01_Project_Overview'
      },
      {
        filePath: 'Project_Scope_and_Milestones.txt',
        headings: ['# Project Scope', '## Các mốc bàn giao'],
        content: 'Chi tiết phạm vi và milestones bàn giao các giai đoạn của dự án.',
        expectedCategory: '01_Project_Overview'
      },

      // 02_Business_Requirements (3 cases)
      {
        filePath: 'BRD_Payment_Gateway_v2.md',
        headings: ['# BRD Payment Gateway', '## Quy tắc nghiệp vụ', '## Quy trình thanh toán'],
        content: 'Business requirement document cho hệ thống cổng thanh toán và chính sách đối soát.',
        expectedCategory: '02_Business_Requirements'
      },
      {
        filePath: 'Business_Rules_Loyalty_Points.docx',
        headings: ['# Business Rules', '## Quy tắc tích điểm', '## Chính sách voucher VIP'],
        content: 'Quy tắc nghiệp vụ và workflow chuyển đổi voucher quà tặng theo user story.',
        expectedCategory: '02_Business_Requirements'
      },
      {
        filePath: 'User_Stories_Merchant_Onboarding.txt',
        headings: ['# User Stories', '## Quy trình đăng ký merchant'],
        content: 'Tập hợp user stories và business rule cho merchant onboarding.',
        expectedCategory: '02_Business_Requirements'
      },

      // 03_System_Requirements (3 cases)
      {
        filePath: 'SRS_DocQA_Document_Pipeline_v1.md',
        headings: ['# Software Requirements Specification (SRS)', '## Yêu cầu chức năng', '## Yêu cầu phi chức năng'],
        content: 'Tài liệu SRS đặc tả functional spec, non-functional requirements và use cases.',
        expectedCategory: '03_System_Requirements'
      },
      {
        filePath: 'Functional_Spec_User_Authentication.docx',
        headings: ['# Functional Spec', '## Yêu cầu hệ thống', '## Xác thực đa nhân tố MFA'],
        content: 'SRS đặc tả use cases và luồng xác thực đa nhân tố cho tài khoản người dùng.',
        expectedCategory: '03_System_Requirements'
      },
      {
        filePath: 'NFR_Performance_and_Scalability.txt',
        headings: ['# Non-Functional Requirements (NFR)', '## Performance & Latency'],
        content: 'Yêu cầu phi chức năng hệ thống với tải 10,000 CCU và latency < 200ms.',
        expectedCategory: '03_System_Requirements'
      },

      // 04_UI_UX (3 cases)
      {
        filePath: 'UI_Design_Spec_Header_and_Sidebar.md',
        headings: ['# UI Design Spec', '## Typography and Color Tokens', '## Layout and Components'],
        content: 'Đặc tả thiết kế giao diện Figma, wireframe, style guide và khung lưới responsive.',
        expectedCategory: '04_UI_UX'
      },
      {
        filePath: 'Figma_Wireframe_Flow_Document_Reader.docx',
        headings: ['# Wireframe Flow', '## UX Prototype', '## Mockup Reader Screen'],
        content: 'Trải nghiệm người dùng giao diện đọc tài liệu Figma prototype với Zen Mode.',
        expectedCategory: '04_UI_UX'
      },
      {
        filePath: 'UX_Guidelines_Mobile_Responsiveness.txt',
        headings: ['# Mobile UX Guidelines', '## Giao diện Responsive'],
        content: 'Style guide mockup và các component UI thích ứng với màn hình di động.',
        expectedCategory: '04_UI_UX'
      },

      // 05_Technical_Documents (3 cases)
      {
        filePath: 'Architecture_Design_DocQA_Platform.md',
        headings: ['# System Architecture', '## Database Schema', '## Microservices Endpoints'],
        content: 'Thiết kế kiến trúc giải pháp với SQLite WAL, RESTful API specs và database schema.',
        expectedCategory: '05_Technical_Documents'
      },
      {
        filePath: 'Database_Schema_DDL_Data_Model.docx',
        headings: ['# Database Schema DDL', '## ERD Model', '## Foreign Keys'],
        content: 'Chi tiết bảng cơ sở dữ liệu database, erd khóa ngoại và ddl scripts.',
        expectedCategory: '05_Technical_Documents'
      },
      {
        filePath: 'OpenAPI_Spec_Documents_API_v1.json',
        headings: ['# OpenAPI Spec', '## RESTful Endpoints', '## Request Payload Schema'],
        content: 'Đặc tả OpenAPI Swagger v3.0 kiến trúc API và data model payload.',
        expectedCategory: '05_Technical_Documents'
      },

      // 06_QA (2 cases)
      {
        filePath: 'Master_Test_Plan_DocQA_Release_1.0.md',
        headings: ['# Master Test Plan', '## Chiến lược kiểm thử', '## Kịch bản Test Cases'],
        content: 'Kế hoạch kiểm thử QA/QC tổng thể, danh sách kịch bản test case và traceability matrix.',
        expectedCategory: '06_QA'
      },
      {
        filePath: 'Test_Cases_Upload_Hardening_Zip_Bomb.docx',
        headings: ['# Test Case Suite', '## Acceptance Criteria', '## Regression Testing'],
        content: 'Tập hợp kịch bản kiểm thử test case và defect tracking cho upload hardening.',
        expectedCategory: '06_QA'
      },

      // 07_EVD_Evidence (2 cases)
      {
        filePath: 'UAT_Signoff_Report_Sprint_3.md',
        headings: ['# UAT Sign-off Report', '## Biên bản nghiệm thu', '## Chữ ký phê duyệt'],
        content: 'Biên bản nghiệm thu minh chứng evidence kết quả kiểm thử và test execution log.',
        expectedCategory: '07_EVD_Evidence'
      },
      {
        filePath: 'Test_Execution_Log_Regression_Run.docx',
        headings: ['# Test Execution Log', '## Audit Trail Minh chứng', '## Screenshot Evidence'],
        content: 'Nhật ký thực thi test execution log, bằng chứng screenshot và audit trail.',
        expectedCategory: '07_EVD_Evidence'
      },

      // 08_Change_History (1 case)
      {
        filePath: 'Release_Notes_v0.1.0_MVP.md',
        headings: ['# Release Notes v0.1.0', '## Lịch sử thay đổi', '## Changelog Hotfix'],
        content: 'Nhật ký phát hành release notes ghi nhận changelog và lịch sử thay đổi phiên bản.',
        expectedCategory: '08_Change_History'
      }
    ];

    let correctCount = 0;

    for (const testCase of testCases) {
      const res = ClassificationScorer.score({
        filePath: testCase.filePath,
        headings: testCase.headings,
        content: testCase.content
      });

      if (res.primaryCategory === testCase.expectedCategory) {
        correctCount++;
      }
    }

    expect(testCases.length).toBe(20);
    expect(correctCount).toBeGreaterThanOrEqual(17);
    // In our implementation, accuracy is 20/20 (100%)
    expect(correctCount).toBe(20);
  });

  it('marks ambiguous when content and headings are completely non-informative', () => {
    const res = ClassificationScorer.score({
      filePath: 'note.txt',
      headings: ['# Hello'],
      content: 'Chỉ là một ghi chú ngắn không có từ khóa chuyên ngành nào.'
    });

    expect(res.isAmbiguous).toBe(true);
    expect(res.canAutoClassifyWithoutLLM).toBe(false);
    expect(res.primaryScore).toBeLessThan(0.40);
  });

  it('detects secondary categories for multi-purpose documents', () => {
    const res = ClassificationScorer.score({
      filePath: 'Feature_Payment_and_API_Spec.md',
      headings: ['# Business Requirements Payment', '## Architecture & Database Schema'],
      content: 'Tài liệu chứa cả business requirement quy tắc nghiệp vụ lẫn thiết kế architecture database schema api spec.'
    });

    expect(res.secondaryCategories.length).toBeGreaterThan(0);
    const categories = [res.primaryCategory, ...res.secondaryCategories.map(s => s.category)];
    expect(categories).toContain('02_Business_Requirements');
    expect(categories).toContain('05_Technical_Documents');
  });
});
