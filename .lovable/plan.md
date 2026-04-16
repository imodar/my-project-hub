

# نشر Edge Functions المحدّثة

## الوضع الحالي
أنا في وضع القراءة فقط (Plan Mode) ولا أستطيع نشر الـ Edge Functions مباشرة. بمجرد الموافقة على هذه الخطة، سأنتقل لوضع التنفيذ وأنشر جميع الدوال المحدّثة.

## الدوال المطلوب نشرها

بناءً على الإصلاحات الأمنية التي تم تطبيقها:

1. **phone-auth** — إصلاح تسريب OTP (Fix 1) + Error leakage (Fix 10)
2. **account-api** — Error leakage (Fix 10)
3. **admin-api** — Error leakage (Fix 10)
4. **albums-api** — Error leakage (Fix 10)
5. **auth-management** — Error leakage (Fix 10)
6. **budget-api** — Error leakage (Fix 10)
7. **calendar-api** — Error leakage (Fix 10)
8. **chat-api** — Error leakage (Fix 10)
9. **debts-api** — Error leakage (Fix 10)
10. **documents-api** — Error leakage (Fix 10)
11. **family-management** — Error leakage (Fix 10)
12. **health-api** — Error leakage (Fix 10)
13. **location-api** — Error leakage (Fix 10)
14. **market-api** — Error leakage (Fix 10)
15. **notifications-api** — Error leakage (Fix 10)
16. **places-api** — Error leakage (Fix 10)
17. **settings-api** — Error leakage (Fix 10)
18. **subscription-webhook** — Error leakage (Fix 10)
19. **tasks-api** — Error leakage (Fix 10)
20. **trash-api** — Error leakage (Fix 10)
21. **trips-api** — Error leakage (Fix 10)
22. **vehicles-api** — Error leakage (Fix 10)
23. **will-api** — Error leakage (Fix 10)
24. **worship-api** — Error leakage (Fix 10)
25. **zakat-api** — Error leakage (Fix 10)
26. **account-cleanup** — Error leakage (Fix 10)
27. **trash-cleanup** — Error leakage (Fix 10)
28. **notification-scheduler** — Error leakage (Fix 10)
29. **notifications-generator** — Error leakage (Fix 10)
30. **account-api** — Error leakage (Fix 10)

## خطوة التنفيذ

استدعاء `supabase--deploy_edge_functions` لنشر جميع الدوال دفعة واحدة، ثم اختبار `phone-auth` للتأكد من عدم تسريب الـ OTP.

