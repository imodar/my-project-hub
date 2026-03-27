-- Legal pages table (privacy policy, terms of service, etc.)
CREATE TABLE public.legal_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  content_ar text NOT NULL DEFAULT '',
  content_en text NOT NULL DEFAULT '',
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

-- Anyone can read legal pages (no auth required)
CREATE POLICY "Anyone can read legal pages" ON public.legal_pages
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins manage legal pages" ON public.legal_pages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial content
INSERT INTO public.legal_pages (slug, title_ar, title_en, content_ar, content_en) VALUES
(
  'privacy-policy',
  'سياسة الخصوصية',
  'Privacy Policy',
  '<h2>مقدمة</h2>
<p>نحن في تطبيق <strong>عائلتي</strong> نقدّر خصوصيتك ونلتزم بحماية بياناتك الشخصية وفقاً لنظام حماية البيانات الشخصية (PDPL) في المملكة العربية السعودية.</p>

<h2>البيانات التي نجمعها</h2>
<ul>
  <li><strong>بيانات الحساب:</strong> رقم الجوال، الاسم، الصورة الشخصية</li>
  <li><strong>بيانات العائلة:</strong> القوائم، المهام، المناسبات، الرسائل، والوثائق التي تضيفها</li>
  <li><strong>بيانات الموقع:</strong> فقط عند تفعيل مشاركة الموقع مع أفراد العائلة</li>
  <li><strong>بيانات الجهاز:</strong> نوع الجهاز ونظام التشغيل لتحسين الأداء</li>
</ul>

<h2>كيف نستخدم بياناتك</h2>
<ul>
  <li>تقديم خدمات التطبيق وتحسينها</li>
  <li>مزامنة البيانات بين أجهزتك وأفراد عائلتك</li>
  <li>إرسال الإشعارات والتنبيهات التي تطلبها</li>
  <li>حماية حسابك ومنع الاستخدام غير المصرح به</li>
</ul>

<h2>مشاركة البيانات</h2>
<p>لا نبيع بياناتك الشخصية لأي طرف ثالث. تُشارك بياناتك فقط مع:</p>
<ul>
  <li>أفراد عائلتك المسجلين في نفس المجموعة العائلية</li>
  <li>مقدمي الخدمات التقنية (الاستضافة، التخزين السحابي) بموجب اتفاقيات حماية البيانات</li>
</ul>

<h2>حقوقك</h2>
<ul>
  <li><strong>الوصول:</strong> يمكنك طلب نسخة من بياناتك في أي وقت</li>
  <li><strong>التصحيح:</strong> يمكنك تعديل بياناتك من خلال التطبيق</li>
  <li><strong>الحذف:</strong> يمكنك طلب حذف حسابك وجميع بياناتك</li>
  <li><strong>النقل:</strong> يمكنك تصدير بياناتك بصيغة قابلة للقراءة</li>
</ul>

<h2>أمان البيانات</h2>
<p>نستخدم تقنيات التشفير المتقدمة (E2EE) لحماية رسائلك، ونحمي بياناتك باستخدام أحدث معايير الأمان.</p>

<h2>الاحتفاظ بالبيانات</h2>
<p>نحتفظ ببياناتك طالما حسابك نشط. عند طلب الحذف، تُحذف جميع البيانات خلال 30 يوماً.</p>

<h2>التواصل معنا</h2>
<p>لأي استفسارات حول الخصوصية، تواصل معنا عبر البريد الإلكتروني أو من خلال التطبيق.</p>',

  '<h2>Introduction</h2>
<p>At <strong>My Family</strong> app, we value your privacy and are committed to protecting your personal data in accordance with the Personal Data Protection Law (PDPL) of Saudi Arabia.</p>

<h2>Data We Collect</h2>
<ul>
  <li><strong>Account data:</strong> Phone number, name, profile picture</li>
  <li><strong>Family data:</strong> Lists, tasks, events, messages, and documents you add</li>
  <li><strong>Location data:</strong> Only when you enable location sharing with family members</li>
  <li><strong>Device data:</strong> Device type and OS for performance improvement</li>
</ul>

<h2>How We Use Your Data</h2>
<ul>
  <li>Provide and improve app services</li>
  <li>Sync data between your devices and family members</li>
  <li>Send notifications and alerts you request</li>
  <li>Protect your account and prevent unauthorized use</li>
</ul>

<h2>Data Sharing</h2>
<p>We do not sell your personal data to any third party. Your data is only shared with:</p>
<ul>
  <li>Family members registered in the same family group</li>
  <li>Technical service providers (hosting, cloud storage) under data protection agreements</li>
</ul>

<h2>Your Rights</h2>
<ul>
  <li><strong>Access:</strong> You can request a copy of your data at any time</li>
  <li><strong>Correction:</strong> You can modify your data through the app</li>
  <li><strong>Deletion:</strong> You can request deletion of your account and all data</li>
  <li><strong>Portability:</strong> You can export your data in a readable format</li>
</ul>

<h2>Data Security</h2>
<p>We use advanced encryption (E2EE) to protect your messages and secure your data using the latest security standards.</p>

<h2>Data Retention</h2>
<p>We retain your data as long as your account is active. Upon deletion request, all data is deleted within 30 days.</p>

<h2>Contact Us</h2>
<p>For any privacy inquiries, contact us via email or through the app.</p>'
),
(
  'terms-of-service',
  'الشروط والأحكام',
  'Terms of Service',
  '<h2>مقدمة</h2>
<p>مرحباً بك في تطبيق <strong>عائلتي</strong>. باستخدامك لهذا التطبيق، فإنك توافق على الالتزام بهذه الشروط والأحكام.</p>

<h2>وصف الخدمة</h2>
<p>تطبيق عائلتي هو منصة لإدارة شؤون الأسرة، تشمل:</p>
<ul>
  <li>إدارة المهام وقوائم التسوق</li>
  <li>التقويم العائلي والمناسبات</li>
  <li>المحادثة العائلية المشفرة</li>
  <li>إدارة الميزانية والديون</li>
  <li>تتبع المواقع (بموافقة الأعضاء)</li>
  <li>إدارة الوثائق والملفات</li>
  <li>وغيرها من الخدمات العائلية</li>
</ul>

<h2>إنشاء الحساب</h2>
<ul>
  <li>يجب أن يكون عمرك 13 سنة على الأقل لاستخدام التطبيق</li>
  <li>أنت مسؤول عن الحفاظ على أمان حسابك</li>
  <li>المعلومات التي تقدمها يجب أن تكون صحيحة ودقيقة</li>
</ul>

<h2>الاستخدام المقبول</h2>
<p>يجب عليك استخدام التطبيق بطريقة قانونية وأخلاقية. يُحظر:</p>
<ul>
  <li>استخدام التطبيق لأغراض غير مشروعة</li>
  <li>محاولة الوصول غير المصرح به لحسابات الآخرين</li>
  <li>مشاركة محتوى مسيء أو غير لائق</li>
  <li>التلاعب بنظام التطبيق أو محاولة اختراقه</li>
</ul>

<h2>المحتوى والملكية</h2>
<ul>
  <li>أنت تحتفظ بملكية المحتوى الذي تنشئه في التطبيق</li>
  <li>بمشاركة المحتوى مع عائلتك، فإنك تمنحهم إذناً بالوصول إليه</li>
  <li>التطبيق وعلامته التجارية ملك لفريق التطوير</li>
</ul>

<h2>الاشتراكات والمدفوعات</h2>
<ul>
  <li>بعض الميزات قد تتطلب اشتراكاً مدفوعاً</li>
  <li>الأسعار قابلة للتغيير مع إشعار مسبق</li>
  <li>يمكن إلغاء الاشتراك في أي وقت</li>
</ul>

<h2>إخلاء المسؤولية</h2>
<p>التطبيق مقدم "كما هو" دون ضمانات من أي نوع. لا نتحمل المسؤولية عن:</p>
<ul>
  <li>فقدان البيانات بسبب ظروف خارجة عن إرادتنا</li>
  <li>انقطاع الخدمة المؤقت</li>
  <li>أي ضرر ناتج عن استخدام التطبيق</li>
</ul>

<h2>تعديل الشروط</h2>
<p>نحتفظ بحق تعديل هذه الشروط في أي وقت. سنُخطرك بالتغييرات الجوهرية عبر التطبيق.</p>

<h2>القانون الحاكم</h2>
<p>تخضع هذه الشروط لأنظمة المملكة العربية السعودية.</p>',

  '<h2>Introduction</h2>
<p>Welcome to the <strong>My Family</strong> app. By using this app, you agree to abide by these terms and conditions.</p>

<h2>Service Description</h2>
<p>My Family is a family management platform that includes:</p>
<ul>
  <li>Task and shopping list management</li>
  <li>Family calendar and events</li>
  <li>Encrypted family chat</li>
  <li>Budget and debt management</li>
  <li>Location tracking (with member consent)</li>
  <li>Document and file management</li>
  <li>And other family services</li>
</ul>

<h2>Account Creation</h2>
<ul>
  <li>You must be at least 13 years old to use the app</li>
  <li>You are responsible for maintaining the security of your account</li>
  <li>The information you provide must be accurate and correct</li>
</ul>

<h2>Acceptable Use</h2>
<p>You must use the app in a lawful and ethical manner. It is prohibited to:</p>
<ul>
  <li>Use the app for illegal purposes</li>
  <li>Attempt unauthorized access to other accounts</li>
  <li>Share offensive or inappropriate content</li>
  <li>Tamper with or attempt to hack the app</li>
</ul>

<h2>Content and Ownership</h2>
<ul>
  <li>You retain ownership of the content you create in the app</li>
  <li>By sharing content with your family, you grant them access</li>
  <li>The app and its branding belong to the development team</li>
</ul>

<h2>Subscriptions and Payments</h2>
<ul>
  <li>Some features may require a paid subscription</li>
  <li>Prices are subject to change with prior notice</li>
  <li>Subscriptions can be cancelled at any time</li>
</ul>

<h2>Disclaimer</h2>
<p>The app is provided "as is" without warranties of any kind. We are not responsible for:</p>
<ul>
  <li>Data loss due to circumstances beyond our control</li>
  <li>Temporary service interruptions</li>
  <li>Any damage resulting from using the app</li>
</ul>

<h2>Terms Modification</h2>
<p>We reserve the right to modify these terms at any time. We will notify you of material changes through the app.</p>

<h2>Governing Law</h2>
<p>These terms are governed by the laws of the Kingdom of Saudi Arabia.</p>'
);