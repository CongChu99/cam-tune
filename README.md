# CamTune — AI Camera Settings Advisor

Ứng dụng web gợi ý thông số máy ảnh thông minh (ISO, khẩu độ, tốc độ màn trập, white balance) dựa trên AI — phân tích GPS, thời tiết thực tế và đặc tính cảm biến của từng dòng máy ảnh cụ thể.

---

## Tính năng chính

- **AI Recommendations** — Nhập vị trí + điều kiện ánh sáng → nhận ngay top-3 gợi ý thông số với giải thích chi tiết
- **Dual-Mode UX** — Chế độ Learning (giải thích tại sao) và Quick Mode (dashboard gọn cho pro)
- **Camera Profile** — Quản lý nhiều body máy ảnh, lưu thông số đặc trưng của từng máy
- **Shoot Sessions** — Ghi lại lịch sử buổi chụp, thời tiết, vị trí GPS và kết quả thực tế
- **Shoot Plans** — Lên kế hoạch chụp ảnh theo giờ vàng/bạc, dự báo thời tiết
- **Community Cards** — Chia sẻ và khám phá thông số chụp từ cộng đồng nhiếp ảnh
- **Lightroom & Capture One** — Tích hợp xuất thông số trực tiếp vào phần mềm hậu kỳ

---

## Yêu cầu

- **Node.js** 20+
- **PostgreSQL** database — khuyến nghị dùng [Supabase](https://supabase.com) (free tier)
- **Upstash Redis** — dùng cho rate limiting & cache ([upstash.com](https://upstash.com), free tier)
- **OpenAI API key** — người dùng tự cung cấp khi đăng nhập (BYOK model)

---

## Cài đặt

### 1. Clone và cài dependencies

```bash
git clone https://github.com/your-org/cam-tune.git
cd cam-tune
npm install
```

### 2. Tạo Supabase project

1. Vào [supabase.com](https://supabase.com) → tạo project mới
2. Vào **Project Settings → Database** → copy **Connection string** (dạng `postgresql://...`)
3. Vào **Project Settings → API** → copy **Project URL** và **anon key**

### 3. Tạo Upstash Redis

1. Vào [console.upstash.com](https://console.upstash.com) → tạo database mới (region gần nhất)
2. Copy **REST URL** và **REST Token**

### 4. Cấu hình biến môi trường

Copy file mẫu và điền thông tin:

```bash
cp .env.example .env.local
```

Mở `.env.local` và điền đầy đủ:

```env
# Database — Supabase PostgreSQL
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_SECRET="[tạo bằng: openssl rand -base64 32]"
NEXTAUTH_URL="http://localhost:3000"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon key từ Supabase dashboard]"

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://[endpoint].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[token từ Upstash console]"

# Encryption key — dùng để mã hóa OpenAI API key của user
ENCRYPTION_KEY="[tạo bằng: openssl rand -hex 32]"
```

> **Lưu ý:** `NEXTAUTH_SECRET` và `ENCRYPTION_KEY` có thể tạo nhanh bằng:
> ```bash
> openssl rand -base64 32   # cho NEXTAUTH_SECRET
> openssl rand -hex 32      # cho ENCRYPTION_KEY
> ```

### 5. Khởi tạo database

Tạo migration ban đầu và apply lên PostgreSQL:

```bash
npx prisma migrate dev --name init
```

Seed dữ liệu máy ảnh (20 model phổ biến):

```bash
npx prisma db seed
```

### 6. Chạy ứng dụng

```bash
npm run dev
```

Mở trình duyệt tại [http://localhost:3000](http://localhost:3000)

---

## Hướng dẫn sử dụng

### Lần đầu đăng nhập

1. Vào trang chủ → nhấn **Sign in**
2. Đăng nhập bằng email (magic link) hoặc OAuth provider đã cấu hình

### Thiết lập hồ sơ máy ảnh

1. Vào **Profile → Camera Profiles**
2. Nhấn **Add Camera** → tìm kiếm model máy của bạn (Sony, Canon, Nikon, Fujifilm...)
3. Thêm lens profile (tiêu cự, khẩu độ tối đa)
4. Đặt làm profile **Active**

### Thêm OpenAI API Key

AI recommendations yêu cầu OpenAI key của riêng bạn (BYOK — Bring Your Own Key):

1. Vào **Settings → AI Settings**
2. Nhập OpenAI API key (`sk-...`)
3. Chọn model muốn dùng (GPT-4o, GPT-4o mini...)
4. Key được mã hóa AES-256 trước khi lưu vào database

### Nhận gợi ý thông số

1. Vào **Recommend**
2. Cho phép truy cập vị trí GPS (hoặc nhập thủ công)
3. Chọn loại cảnh chụp (portrait, landscape, street, night...)
4. Nhấn **Get Recommendation** → AI phân tích điều kiện và trả về top-3 gợi ý

### Ghi lại buổi chụp

1. Khi ra ngoài chụp, vào **Sessions → New Session**
2. App tự động ghi nhận vị trí, thời tiết, góc mặt trời
3. Sau khi chụp xong, điền **Actual Settings** và rating
4. Dữ liệu được dùng để cải thiện gợi ý lần sau

### Lên kế hoạch chụp

1. Vào **Plans → New Plan**
2. Chọn ngày, giờ và địa điểm
3. App dự báo điều kiện ánh sáng và thời tiết
4. Thông số được tự động tính toán trước

### Cộng đồng

1. Vào **Community** để xem thông số từ các nhiếp ảnh gia khác
2. Lọc theo địa điểm, loại cảnh, dòng máy
3. **Like** / **Save** card để lưu vào collection của bạn
4. Chia sẻ thông số của mình bằng cách bật **Make Public** khi tạo settings card

### Tích hợp Lightroom / Capture One

1. Vào **Integrations**
2. Kết nối tài khoản Lightroom hoặc Capture One
3. Từ màn hình Sessions, nhấn **Export to Lightroom** hoặc **Sync to Capture One**

---

## Scripts

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Chạy development server (Turbopack) |
| `npm run build` | Build production |
| `npm run start` | Chạy production server |
| `npm run lint` | Kiểm tra linting |
| `npm run test` | Chạy unit tests |
| `npm run test:coverage` | Chạy tests với báo cáo coverage |
| `npx prisma studio` | Mở Prisma Studio (GUI quản lý database) |
| `npx prisma migrate dev` | Tạo và apply migration mới |
| `npx prisma db seed` | Seed dữ liệu camera database |

---

## Cấu trúc dự án

```
cam-tune/
├── app/                  # Next.js App Router
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth endpoints
│   │   ├── recommend/    # AI recommendation engine
│   │   ├── sessions/     # Shoot session management
│   │   ├── cameras/      # Camera database & profiles
│   │   ├── community/    # Community cards
│   │   └── plans/        # Shoot planning
│   ├── (pages)/          # UI pages
│   └── layout.tsx
├── components/           # React components
├── lib/                  # Shared utilities
│   ├── prisma.ts         # Prisma client singleton
│   ├── auth.ts           # NextAuth config
│   ├── camera-database.ts
│   ├── session-logger.ts
│   ├── lightroom-service.ts
│   └── captureone-service.ts
├── prisma/
│   ├── schema.prisma     # Database schema (PostgreSQL)
│   ├── migrations/       # Migration history
│   └── seed.ts           # Camera database seed (20 models)
├── store/                # Zustand state management
├── types/                # TypeScript types
└── docs/                 # Project specs & c4flow artifacts
```

---

## Stack công nghệ

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7 |
| Auth | NextAuth v4 |
| AI | OpenAI API (BYOK) |
| Cache / Rate limiting | Upstash Redis |
| UI | React 19, Tailwind CSS v4, Radix UI |
| State | Zustand |
| Maps | Leaflet / React Leaflet |
| Testing | Vitest, Testing Library |

---

## Troubleshooting

**`DATABASE_URL` không hợp lệ**
- Kiểm tra connection string từ Supabase: **Settings → Database → Connection string → URI**
- Thay `[YOUR-PASSWORD]` bằng database password thực

**Lỗi `prisma generate` hoặc migration**
```bash
npx prisma generate
npx prisma migrate dev --name init
```

**Lỗi Redis connection**
- Kiểm tra `UPSTASH_REDIS_REST_URL` bắt đầu bằng `https://`
- Không dùng Redis URL dạng `redis://` — Upstash REST API khác với Redis protocol

**AI không hoạt động**
- Kiểm tra OpenAI API key đã được thêm trong **Settings → AI Settings**
- Key phải bắt đầu bằng `sk-` và có đủ credit

**Lỗi `ENCRYPTION_KEY`**
- Key phải là 64 ký tự hex (32 bytes)
- Tạo lại: `openssl rand -hex 32`
