# Cổng thông tin sinh viên

Website tĩnh (không backend), nội dung lấy trực tiếp từ các file .md trong repo GitHub qua REST API.

## Cấu trúc
- index.html, style.css, script.js — mã nguồn trang web
- content/hoc-bong, content/su-kien, content/tuyen-dung, content/thong-bao — nơi đặt file .md cho từng chuyên mục

## Cấu hình
Mở script.js, sửa phần CONFIG ở đầu file:
- githubUsername
- repoName
- branch
- categories (danh sách chuyên mục và đường dẫn thư mục tương ứng)

## Định dạng file .md
    ---
    title: Tiêu đề bài viết
    date: 2026-09-16
    summary: Tóm tắt ngắn
    image: https://link-anh.jpg
    ---
    Nội dung markdown ở đây...

## Bật GitHub Pages
Settings → Pages → chọn branch và thư mục / (root) → Save.
# 26dhth08-news
