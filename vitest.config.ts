/**
 * Vitest Configuration
 *
 * منفصل عن vite.config.ts لتجنب تعارض PWA plugin مع الاختبارات.
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // بيئة المتصفح المحاكاة
    environment: "jsdom",
    // تفعيل globals (describe, it, expect) بدون استيراد
    globals: true,
    // ملف الإعداد المشترك
    setupFiles: ["./src/test/setup.ts"],
    // أنماط ملفات الاختبار
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // تغطية الكود
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**", "src/hooks/**"],
      exclude: [
        "src/lib/utils.ts",
        "src/lib/haptics.ts",
        "src/**/*.d.ts",
      ],
      // الحد الأدنى المطلوب (يُزاد تدريجياً مع إضافة اختبارات جديدة)
      thresholds: {
        statements: 20,
        branches: 15,
        functions: 20,
        lines: 20,
      },
    },
    // timeout للاختبارات الطويلة (crypto, etc.)
    testTimeout: 15_000,
    hookTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
